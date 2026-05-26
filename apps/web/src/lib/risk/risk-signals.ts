/**
 * KOVAS — Module Risk Signals (Bouclier Conformité, Upsell #3 Tugan v3.0).
 *
 * Détecteurs heuristiques V1 (pas de ML) pour identifier les missions à risque
 * de contrôle ADEME / DPE shopping / incohérences cadastre / sauts de classe
 * anormaux / données aberrantes / patterns d'erreurs récurrentes.
 *
 * Module TypeScript pur, sans dépendance Next.js / Deno / Supabase — utilisable
 * côté Edge Function (audit-conformite-monthly-user) ET côté composant Next.js
 * (preview dashboard). Aucun side effect ni import I/O.
 *
 * Framing produit : "Liciel calcule techniquement le DPE selon la méthode
 * 3CL-2021. KOVAS scanne préventivement chaque mois pour identifier les
 * missions à risque de contrôle ADEME et te livre un plan de remédiation."
 *
 * Authority : CLAUDE.md §10 (TypeScript strict, zéro any) + brief
 * Bouclier Conformité 2026-05-26.
 *
 * AUCUNE mention de provider IA tiers dans ce module (directive transversale).
 */

/* -------------------------------------------------------------------------- */
/*  Types métier minimaux                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Shape minimale d'une mission utilisée par les détecteurs. Les champs sont
 * permissifs (`null | undefined` autorisé) pour absorber l'hétérogénéité des
 * sources (DB Supabase, fixtures de test, payload Edge Function brut).
 *
 * **Important** : ce type est volontairement plus large que la définition DB
 * `missions` — il agrège missions + property jointes en un seul objet plat
 * (cf. `audit-conformite-monthly-user/index.ts` qui fait la jointure).
 */
export interface Mission {
  readonly id: string
  readonly type: string
  readonly createdAt: string
  readonly completedAt?: string | null

  // Référence cadastrale + adresse (depuis properties)
  readonly propertyId: string
  readonly address?: string | null
  readonly cadastreSection?: string | null
  readonly cadastreNumber?: string | null
  readonly cadastrePrefix?: string | null

  // Surfaces (m²) — vient de properties + saisie terrain mission
  readonly surfaceCarrez?: number | null
  readonly surfaceBoutin?: number | null
  readonly surfaceTotal?: number | null
  readonly surfaceCadastre?: number | null
  readonly surfaceDpe?: number | null

  // Résultats DPE
  readonly dpeLetter?: string | null
  readonly gesLetter?: string | null
  readonly energyValue?: number | null
  readonly gesValue?: number | null
  readonly numeroDpe?: string | null

  // Équipement / cohérence physique
  readonly heatingPowerKw?: number | null
  readonly hasTravauxDocumented?: boolean | null
  readonly yearBuilt?: number | null

  // Pre-export analyses agrégées (findings JSONB) — top-level type
  readonly preExportFindingTypes?: readonly string[] | null
}

/* -------------------------------------------------------------------------- */
/*  Risk signal — sortie unifiée                                               */
/* -------------------------------------------------------------------------- */

export type RiskSignalType =
  | 'dpe_shopping'
  | 'cadastre_mismatch'
  | 'class_jump'
  | 'aberrant_data'
  | 'pattern_recurrent'

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface RiskSignal {
  readonly type: RiskSignalType
  readonly severity: RiskSeverity
  readonly missionId: string
  /** Description courte en français, lisible par le diagnostiqueur. */
  readonly description: string
  /** Preuves brutes pour explicabilité — sérialisé en JSONB côté DB. */
  readonly evidence: Readonly<Record<string, unknown>>
}

/* -------------------------------------------------------------------------- */
/*  Severity weights (agrégation score)                                        */
/* -------------------------------------------------------------------------- */

const SEVERITY_WEIGHTS: Readonly<Record<RiskSeverity, number>> = {
  low: 2,
  medium: 5,
  high: 12,
  critical: 25,
}

/* -------------------------------------------------------------------------- */
/*  Constantes seuils heuristiques V1                                          */
/* -------------------------------------------------------------------------- */

/** Écart de surface DPE vs cadastre considéré comme suspect (en pourcentage). */
const SURFACE_MISMATCH_PCT_THRESHOLD = 15

/** Écart minimum de classes énergie entre 2 DPE du même bien pour signaler DPE shopping. */
const DPE_SHOPPING_CLASS_GAP = 2

/** Fenêtre de lookback (mois) pour la détection DPE shopping. */
const DPE_SHOPPING_LOOKBACK_MONTHS = 12

/** Échelle des classes énergie de A (1) à G (7). */
const ENERGY_CLASS_ORDER: Readonly<Record<string, number>> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
}

/**
 * Borne haute physique acceptable du ratio puissance chauffage (W) / m². Au-delà,
 * la mission est probablement saisie avec une erreur d'unité (kW vs W) ou un
 * équipement mal renseigné. Valeur calée sur les ordres de grandeur Effinergie :
 * jusqu'à 150 W/m² pour habitat ancien mal isolé, au-delà = aberrant.
 */
const ABERRANT_HEATING_W_PER_M2_HIGH = 200

/**
 * Borne basse : 5 W/m² est physiquement insuffisant pour chauffer un logement
 * (même très bien isolé). En-dessous = saisie incomplète / unité erronée.
 */
const ABERRANT_HEATING_W_PER_M2_LOW = 5

/* -------------------------------------------------------------------------- */
/*  Helpers internes                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Construit une clé canonique pour identifier "le même bien" entre 2 missions.
 * Préfère la référence cadastrale complète (préfixe + section + numéro). En
 * dernier recours, fallback sur l'adresse normalisée. Retourne `null` si on
 * n'a aucune ancre fiable (auquel cas on ne peut pas comparer).
 */
function propertyKey(mission: Mission): string | null {
  if (mission.cadastreSection && mission.cadastreNumber) {
    const prefix = mission.cadastrePrefix ?? ''
    return `cad:${prefix}-${mission.cadastreSection}-${mission.cadastreNumber}`
  }
  const addr = mission.address?.trim().toLowerCase()
  if (addr && addr.length > 5) {
    return `addr:${addr.replace(/\s+/g, ' ')}`
  }
  return null
}

/** Convertit une lettre A-G en rang numérique 1-7 (A=1 meilleur, G=7 pire). */
function classRank(letter: string | null | undefined): number | null {
  if (!letter) return null
  return ENERGY_CLASS_ORDER[letter.toUpperCase()] ?? null
}

/** Différence en mois calendaires entre deux dates ISO. */
function monthsBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA)
  const b = new Date(isoB)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  const diff = Math.abs(b.getTime() - a.getTime())
  return diff / (1000 * 60 * 60 * 24 * 30.4375)
}

/* -------------------------------------------------------------------------- */
/*  Détecteur 1 — DPE shopping                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Détecte les cas de "DPE shopping" : deux DPE distincts (numéros différents)
 * sur le même bien (cadastre identique OU adresse identique) dans la fenêtre
 * des 12 derniers mois, avec un écart de classes énergie ≥ 2 niveaux.
 *
 * Pattern fraude typique : un propriétaire fait refaire un DPE chez un autre
 * diagnostiqueur pour obtenir une meilleure classe (F → C par exemple) sans
 * travaux documentés. L'ADEME contrôle ce type d'écart.
 *
 * Severity logic :
 *   - écart 2 classes (ex F→D)  → medium
 *   - écart 3 classes (ex G→D)  → high
 *   - écart ≥ 4 classes         → critical
 *
 * @param missions - Liste complète des missions du user sur la fenêtre d'audit
 *                   (typiquement 30 derniers jours + lookback 12 mois historique).
 *                   On compare chaque mission DPE récente vs son historique.
 * @returns Tous les signaux DPE shopping détectés (peut être multiple si plusieurs biens).
 */
export function detectDpeShopping(missions: readonly Mission[]): RiskSignal[] {
  const signals: RiskSignal[] = []
  const dpes = missions.filter((m) => m.type === 'dpe' && classRank(m.dpeLetter) !== null)

  // Group by property key
  const byProperty = new Map<string, Mission[]>()
  for (const m of dpes) {
    const key = propertyKey(m)
    if (!key) continue
    const arr = byProperty.get(key) ?? []
    arr.push(m)
    byProperty.set(key, arr)
  }

  for (const [key, group] of byProperty) {
    if (group.length < 2) continue

    // Compare each pair within the lookback window
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]
        const b = group[j]
        if (!a || !b) continue
        const monthsApart = monthsBetween(a.createdAt, b.createdAt)
        if (monthsApart > DPE_SHOPPING_LOOKBACK_MONTHS) continue

        const rankA = classRank(a.dpeLetter)
        const rankB = classRank(b.dpeLetter)
        if (rankA === null || rankB === null) continue

        const gap = Math.abs(rankA - rankB)
        if (gap < DPE_SHOPPING_CLASS_GAP) continue

        // Skip if same DPE number (re-upload, pas shopping)
        if (a.numeroDpe && b.numeroDpe && a.numeroDpe === b.numeroDpe) continue

        const severity: RiskSeverity = gap >= 4 ? 'critical' : gap >= 3 ? 'high' : 'medium'

        // On signale la mission la plus récente (celle que tu viens de saisir)
        const recent = new Date(a.createdAt) > new Date(b.createdAt) ? a : b
        const older = recent === a ? b : a

        signals.push({
          type: 'dpe_shopping',
          severity,
          missionId: recent.id,
          description: `Deux DPE sur le même bien en ${monthsApart.toFixed(1)} mois avec écart de ${gap} classe(s) (${older.dpeLetter ?? '?'} → ${recent.dpeLetter ?? '?'}). Risque de contrôle ADEME élevé.`,
          evidence: {
            propertyKey: key,
            recentMissionId: recent.id,
            recentClass: recent.dpeLetter,
            recentNumeroDpe: recent.numeroDpe ?? null,
            previousMissionId: older.id,
            previousClass: older.dpeLetter,
            previousNumeroDpe: older.numeroDpe ?? null,
            monthsApart: Number(monthsApart.toFixed(1)),
            classGap: gap,
          },
        })
      }
    }
  }

  return signals
}

/* -------------------------------------------------------------------------- */
/*  Détecteur 2 — Cadastre mismatch                                            */
/* -------------------------------------------------------------------------- */

/**
 * Détecte les incohérences entre la surface saisie dans le DPE et la surface
 * cadastrale officielle (référence IGN / DGFiP). Au-delà de ±15% d'écart, le
 * dossier est exposé à un contrôle.
 *
 * Severity :
 *   - écart 15-25%   → medium
 *   - écart 25-40%   → high
 *   - écart > 40%    → critical
 *
 * @param mission - Une mission unique (le détecteur est mono-mission).
 * @returns Un signal ou null si surfaces manquantes / écart sous le seuil.
 */
export function detectCadastreMismatch(mission: Mission): RiskSignal | null {
  const dpe = mission.surfaceDpe
  const cadastre = mission.surfaceCadastre
  if (
    dpe === null ||
    dpe === undefined ||
    cadastre === null ||
    cadastre === undefined ||
    dpe <= 0 ||
    cadastre <= 0
  ) {
    return null
  }

  const diffPct = Math.abs(dpe - cadastre) / cadastre * 100
  if (diffPct < SURFACE_MISMATCH_PCT_THRESHOLD) return null

  const severity: RiskSeverity =
    diffPct >= 40 ? 'critical' : diffPct >= 25 ? 'high' : 'medium'

  return {
    type: 'cadastre_mismatch',
    severity,
    missionId: mission.id,
    description: `Surface DPE (${dpe} m²) vs cadastre (${cadastre} m²) : écart de ${diffPct.toFixed(1)}%. Vérifier le métré et la référence cadastrale.`,
    evidence: {
      surfaceDpe: dpe,
      surfaceCadastre: cadastre,
      diffPct: Number(diffPct.toFixed(1)),
      threshold: SURFACE_MISMATCH_PCT_THRESHOLD,
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Détecteur 3 — Saut de classe anormal                                       */
/* -------------------------------------------------------------------------- */

/**
 * Détecte les sauts de classe énergie anormaux sur un même bien sans travaux
 * documentés. Exemple typique : un bien classé G en 2020 ressort B en 2026
 * sans aucune rénovation enregistrée → quasi-certitude de fraude ou erreur
 * de méthode 3CL.
 *
 * Différence vs DPE shopping : ici on regarde un seul user (le sien) sur sa
 * propre série historique, pas la comparaison avec un autre diagnostiqueur.
 *
 * Severity :
 *   - saut 3 classes sans travaux        → high
 *   - saut ≥ 4 classes sans travaux      → critical
 *   - saut 2 classes sans travaux        → medium (alerte douce)
 *
 * @param missions - Liste complète des missions du user (avec historique).
 * @returns Tous les signaux saut de classe détectés.
 */
export function detectClassJump(missions: readonly Mission[]): RiskSignal[] {
  const signals: RiskSignal[] = []
  const dpes = missions.filter((m) => m.type === 'dpe' && classRank(m.dpeLetter) !== null)

  const byProperty = new Map<string, Mission[]>()
  for (const m of dpes) {
    const key = propertyKey(m)
    if (!key) continue
    const arr = byProperty.get(key) ?? []
    arr.push(m)
    byProperty.set(key, arr)
  }

  for (const [key, group] of byProperty) {
    if (group.length < 2) continue
    // Sort chronologically asc to detect "amélioration" suspecte sans travaux
    const sorted = [...group].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      if (!prev || !cur) continue
      const rankPrev = classRank(prev.dpeLetter)
      const rankCur = classRank(cur.dpeLetter)
      if (rankPrev === null || rankCur === null) continue

      // Amélioration uniquement (cur rank < prev rank = meilleure classe)
      const improvement = rankPrev - rankCur
      if (improvement < 2) continue

      // Si travaux documentés → pas d'alerte (saut justifié)
      if (cur.hasTravauxDocumented === true) continue

      const severity: RiskSeverity =
        improvement >= 4 ? 'critical' : improvement >= 3 ? 'high' : 'medium'

      signals.push({
        type: 'class_jump',
        severity,
        missionId: cur.id,
        description: `Saut de ${improvement} classe(s) sur le même bien (${prev.dpeLetter} → ${cur.dpeLetter}) sans travaux documentés. À justifier.`,
        evidence: {
          propertyKey: key,
          previousClass: prev.dpeLetter,
          currentClass: cur.dpeLetter,
          improvement,
          previousMissionId: prev.id,
          currentMissionId: cur.id,
          hasTravauxDocumented: cur.hasTravauxDocumented ?? false,
        },
      })
    }
  }

  return signals
}

/* -------------------------------------------------------------------------- */
/*  Détecteur 4 — Données aberrantes (cohérence physique)                      */
/* -------------------------------------------------------------------------- */

/**
 * Détecte les saisies physiquement aberrantes sur une mission unique :
 *   - ratio puissance chauffage / surface hors bornes (< 5 W/m² ou > 200 W/m²)
 *   - DPE classe A avec consommation > 50 kWh/m².an (incohérence méthode)
 *   - Maison construite avant 1948 avec classe énergie A ou B sans travaux
 *
 * Severity :
 *   - 1 incohérence détectée   → medium
 *   - ratio extrême (> 500 W/m² ou < 2 W/m²) → high
 *
 * @param mission - Une mission unique.
 * @returns Liste des signaux aberrants (peut être vide ou multiple).
 */
export function detectAberrantData(mission: Mission): RiskSignal[] {
  const signals: RiskSignal[] = []
  const m = mission

  // Vérification ratio puissance chauffage / surface
  const power = m.heatingPowerKw
  const surface = m.surfaceTotal ?? m.surfaceDpe ?? m.surfaceCarrez
  if (power !== null && power !== undefined && surface && surface > 0) {
    const wattsPerM2 = (power * 1000) / surface
    if (wattsPerM2 < ABERRANT_HEATING_W_PER_M2_LOW) {
      const isExtreme = wattsPerM2 < 2
      signals.push({
        type: 'aberrant_data',
        severity: isExtreme ? 'high' : 'medium',
        missionId: m.id,
        description: `Puissance chauffage très faible : ${wattsPerM2.toFixed(1)} W/m² (${power} kW pour ${surface} m²). Vérifier la saisie de l'équipement.`,
        evidence: {
          check: 'heating_power_low',
          heatingPowerKw: power,
          surface,
          wattsPerM2: Number(wattsPerM2.toFixed(1)),
          minThreshold: ABERRANT_HEATING_W_PER_M2_LOW,
        },
      })
    } else if (wattsPerM2 > ABERRANT_HEATING_W_PER_M2_HIGH) {
      const isExtreme = wattsPerM2 > 500
      signals.push({
        type: 'aberrant_data',
        severity: isExtreme ? 'high' : 'medium',
        missionId: m.id,
        description: `Puissance chauffage anormalement élevée : ${wattsPerM2.toFixed(1)} W/m² (${power} kW pour ${surface} m²). Vérifier l'unité de saisie.`,
        evidence: {
          check: 'heating_power_high',
          heatingPowerKw: power,
          surface,
          wattsPerM2: Number(wattsPerM2.toFixed(1)),
          maxThreshold: ABERRANT_HEATING_W_PER_M2_HIGH,
        },
      })
    }
  }

  // Vérification DPE A + conso élevée
  if (m.dpeLetter === 'A' && typeof m.energyValue === 'number' && m.energyValue > 50) {
    signals.push({
      type: 'aberrant_data',
      severity: 'high',
      missionId: m.id,
      description: `Classe A annoncée mais consommation ${m.energyValue} kWh/m².an (> 50). Incohérence méthode 3CL probable.`,
      evidence: {
        check: 'class_a_with_high_consumption',
        dpeLetter: m.dpeLetter,
        energyValue: m.energyValue,
      },
    })
  }

  // Maison ancienne classée A/B sans travaux
  if (
    typeof m.yearBuilt === 'number' &&
    m.yearBuilt < 1948 &&
    (m.dpeLetter === 'A' || m.dpeLetter === 'B') &&
    m.hasTravauxDocumented !== true
  ) {
    signals.push({
      type: 'aberrant_data',
      severity: 'medium',
      missionId: m.id,
      description: `Construction antérieure à 1948 (${m.yearBuilt}) classée ${m.dpeLetter} sans travaux documentés. À vérifier.`,
      evidence: {
        check: 'old_building_good_class',
        yearBuilt: m.yearBuilt,
        dpeLetter: m.dpeLetter,
        hasTravauxDocumented: m.hasTravauxDocumented ?? false,
      },
    })
  }

  return signals
}

/* -------------------------------------------------------------------------- */
/*  Détecteur 5 — Patterns récurrents (top 3 erreurs du user)                  */
/* -------------------------------------------------------------------------- */

/**
 * Détecte les patterns d'erreurs récurrentes chez un diagnostiqueur en se
 * basant sur les `preExportFindingTypes` agrégés issus de `pre_export_analyses`.
 * On signale chaque type d'erreur qui apparaît dans ≥ 30% des missions de la
 * fenêtre — c'est un indicateur de mauvaise habitude méthodologique.
 *
 * Severity :
 *   - 30-50% des missions concernées → medium
 *   - 50-70% des missions concernées → high
 *   - > 70%                          → critical
 *
 * @param missions - Liste complète des missions du user dans la fenêtre.
 * @param lookbackMonths - Fenêtre de référence en mois (informatif uniquement).
 * @returns Top signaux (1 par type d'erreur dépassant le seuil).
 */
export function detectRecurrentPatterns(
  missions: readonly Mission[],
  lookbackMonths: number,
): RiskSignal[] {
  if (missions.length === 0) return []

  // Count occurrences par type d'erreur
  const counts = new Map<string, number>()
  const missionsByType = new Map<string, string[]>()

  for (const m of missions) {
    const findings = m.preExportFindingTypes ?? []
    for (const f of findings) {
      counts.set(f, (counts.get(f) ?? 0) + 1)
      const arr = missionsByType.get(f) ?? []
      arr.push(m.id)
      missionsByType.set(f, arr)
    }
  }

  const total = missions.length
  const signals: RiskSignal[] = []

  for (const [findingType, count] of counts) {
    const pct = (count / total) * 100
    if (pct < 30) continue

    const severity: RiskSeverity = pct > 70 ? 'critical' : pct > 50 ? 'high' : 'medium'

    // On signale la 1ère mission concernée comme "exemple" (pour le PDF)
    const sampleMissionId = missionsByType.get(findingType)?.[0] ?? ''

    signals.push({
      type: 'pattern_recurrent',
      severity,
      missionId: sampleMissionId,
      description: `Erreur récurrente "${findingType}" présente dans ${pct.toFixed(0)}% de tes missions des ${lookbackMonths} derniers mois (${count}/${total}). Pattern méthodologique à corriger.`,
      evidence: {
        findingType,
        occurrences: count,
        totalMissions: total,
        pct: Number(pct.toFixed(1)),
        lookbackMonths,
        affectedMissionIds: missionsByType.get(findingType) ?? [],
      },
    })
  }

  // Limiter aux top 3 (par count desc)
  signals.sort((a, b) => {
    const countA = Number(a.evidence.occurrences ?? 0)
    const countB = Number(b.evidence.occurrences ?? 0)
    return countB - countA
  })

  return signals.slice(0, 3)
}

/* -------------------------------------------------------------------------- */
/*  Agrégation — score global + top 5                                          */
/* -------------------------------------------------------------------------- */

export interface AggregateResult {
  /** Score global 0-100 (plus haut = meilleur, 100 = aucun signal). */
  readonly score: number
  /** Top 5 signaux les plus critiques (ordre desc severity puis arbitraire). */
  readonly top5: readonly RiskSignal[]
  /** Compte par severity (utilisable pour le rapport / dashboard). */
  readonly bySeverity: Readonly<Record<RiskSeverity, number>>
}

/**
 * Agrège tous les signaux détectés en un score global et le top 5 des risques
 * à présenter dans le rapport mensuel.
 *
 * Formule score : `100 - sum(SEVERITY_WEIGHTS[s.severity])`, plafonné à [0, 100].
 *
 * @param signals - Tous les signaux retournés par les 5 détecteurs.
 * @returns Résultat agrégé prêt à insérer dans `audit_conformite_reports`.
 */
export function aggregateRiskSignals(signals: readonly RiskSignal[]): AggregateResult {
  const bySeverity: Record<RiskSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  }

  let penalty = 0
  for (const s of signals) {
    penalty += SEVERITY_WEIGHTS[s.severity]
    bySeverity[s.severity] += 1
  }

  const score = Math.max(0, Math.min(100, 100 - penalty))

  // Tri pour top5 : critical > high > medium > low ; puis stable
  const severityOrder: Readonly<Record<RiskSeverity, number>> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }

  const sorted = [...signals].sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
  const top5 = sorted.slice(0, 5)

  return {
    score,
    top5,
    bySeverity,
  }
}

/* -------------------------------------------------------------------------- */
/*  Helper exporté — pipeline complet (lance les 5 détecteurs)                 */
/* -------------------------------------------------------------------------- */

/**
 * Lance les 5 détecteurs sur une liste de missions et agrège le résultat.
 * Helper de convenance pour le côté Edge Function (un seul appel = un score
 * global + tous les signaux). Le côté Next.js peut au contraire appeler les
 * détecteurs séparément pour des previews ciblées.
 *
 * @param missions - Toutes les missions du user (fenêtre 30j + historique 12 mois).
 * @param lookbackMonths - Fenêtre de référence pour `detectRecurrentPatterns` (typiquement 1).
 * @returns Tous les signaux + agrégat (score + top5).
 */
export function runAllDetectors(
  missions: readonly Mission[],
  lookbackMonths: number,
): { readonly signals: readonly RiskSignal[]; readonly aggregate: AggregateResult } {
  const signals: RiskSignal[] = []

  signals.push(...detectDpeShopping(missions))
  signals.push(...detectClassJump(missions))
  signals.push(...detectRecurrentPatterns(missions, lookbackMonths))

  for (const m of missions) {
    const cad = detectCadastreMismatch(m)
    if (cad) signals.push(cad)
    signals.push(...detectAberrantData(m))
  }

  return {
    signals,
    aggregate: aggregateRiskSignals(signals),
  }
}
