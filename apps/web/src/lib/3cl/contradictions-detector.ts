/**
 * KOVAS — Détecteur de contradictions métier DPE / 3CL (lot MISSION-C).
 *
 * Lib pure côté client qui prend l'état actuel des données saisies (champs
 * globaux + champs par pièce) et détecte les incohérences métier.
 *
 * Philosophie :
 *   - Tests "sanity check" simples — pas d'IA, pas de réseau.
 *   - Couvre les erreurs de saisie courantes (surface qui dépasse, énergie
 *     incohérente avec équipement, etc.).
 *   - Sépare `warning` (à confirmer) de `error` (bloquant pour export).
 *   - Liste de règles ouvertes (`addRule()` futur) pour permettre des
 *     règles par cabinet à terme.
 *
 * Authority : CLAUDE.md §3 feature 7 (validation cohérence basique, pas d'IA).
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ContradictionSeverity = 'warning' | 'error'

/** Une contradiction détectée. */
export interface Contradiction {
  /** Clef stable (sert pour dédup + click "Aller corriger"). */
  id: string
  severity: ContradictionSeverity
  /** Message FR à afficher au diagnostiqueur. */
  message: string
  /** Chemins techniques des champs en cause (pour highlight + scroll). */
  affectedKeys: string[]
  /** Suggestion d'action courte (CTA secondaire). */
  suggestedAction?: string
  /** Catégorie pour grouper le récap. */
  category: 'surface' | 'energie' | 'isolation' | 'equipement' | 'historique' | 'piece'
}

/** Snapshot d'une pièce pour le détecteur. */
export interface RoomSnapshot {
  id: string
  name: string
  type: string
  /** Surface au sol en m². */
  surfaceSqm?: number | null
  /** Hauteur sous plafond en m. */
  ceilingHeightM?: number | null
  /** Champs renseignés (key → value brute). */
  fields?: Record<string, string | number | boolean | null>
}

/** Snapshot global de la mission pour le détecteur. */
export interface MissionSnapshot {
  /** Année de construction du bâti. */
  yearBuilt?: number | null
  /** Surface habitable totale (m²). */
  surfaceHabitableSqm?: number | null
  /** Hauteur sous plafond moyenne (m). */
  ceilingHeightAvgM?: number | null
  /** Mitoyenneté ("isole", "mitoyen_1_cote", ...). */
  mitoyennete?: string | null
  /** Type chauffage principal. */
  chauffageType?: string | null
  /** Énergie chauffage. */
  chauffageEnergie?: string | null
  /** Arrivée gaz présente. */
  arriveeGazPresent?: 'oui' | 'non' | null
  /** Cuve fioul présente. */
  cuveFioulPresent?: 'oui' | 'non' | null
  /** Type ECS. */
  ecsType?: string | null
  /** Énergie ECS. */
  ecsEnergie?: string | null
  /** Type vitrage dominant. */
  vitrageType?: string | null
  /** Année menuiseries. */
  menuiserieAnnee?: number | null
  /** Isolation combles. */
  isolationCombles?: string | null
  /** Isolation murs. */
  isolationMurs?: string | null
  /** Type plancher haut. */
  plancherHaut?: string | null
  /** Type plancher bas. */
  plancherBas?: string | null
  /** Type ventilation. */
  ventilationType?: string | null
  /** Présence climatisation. */
  climPresente?: 'oui' | 'non' | null
  /** Présence photovoltaïque. */
  pvPresent?: 'oui' | 'non' | null
  /** Classe DPE estimée (saisie diagnostiqueur). */
  classeDpeEstimee?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  /** Régulation chauffage. */
  regulationType?: string | null
  /** Année DPE précédent. */
  dpeAnterieurAnnee?: number | null
  /** Classe DPE précédent. */
  dpeAnterieurClasse?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'inconnue' | null
  /** Nb total émetteurs chauffage. */
  nbEmetteursTotal?: number | null
  /** Nombre total de pièces principales. */
  nbPiecesPrincipales?: number | null
  /** Présence rénovation isolation. */
  renovationIsolationAnnee?: number | null
}

// -----------------------------------------------------------------------------
// Helpers internes — petites fonctions de match plus tolérantes que ===
// -----------------------------------------------------------------------------

function isChaudiereGaz(type: string | null | undefined): boolean {
  if (!type) return false
  return (
    type.startsWith('chaudiere_gaz_') ||
    type === 'chauffe_eau_gaz_instantane' ||
    type === 'chauffe_eau_gaz_accumulation'
  )
}

function isChaudiereFioul(type: string | null | undefined): boolean {
  if (!type) return false
  return type.startsWith('chaudiere_fioul_')
}

function isPac(type: string | null | undefined): boolean {
  if (!type) return false
  return type.startsWith('pac_')
}

function isDoubleVitrage(type: string | null | undefined): boolean {
  if (!type) return false
  return (
    type.startsWith('double_') || type.startsWith('triple_') || type === 'survitrage_renovation'
  )
}

function isHighPerformance(classe: string | null | undefined): boolean {
  return classe === 'A' || classe === 'B'
}

function isLowPerformance(classe: string | null | undefined): boolean {
  return classe === 'F' || classe === 'G'
}

// -----------------------------------------------------------------------------
// Règles métier — 18 règles canoniques (cible brief : 15-20)
// -----------------------------------------------------------------------------

type Rule = (mission: MissionSnapshot, rooms: readonly RoomSnapshot[]) => Contradiction[]

/**
 * Règle 1 — Chaudière gaz mais pas d'arrivée gaz mentionnée.
 * Erreur grave : impossible matériellement.
 */
const ruleGasBoilerWithoutGasInlet: Rule = (m) => {
  if (isChaudiereGaz(m.chauffageType) && m.arriveeGazPresent === 'non') {
    return [
      {
        id: 'rule-1-gas-boiler-no-inlet',
        severity: 'error',
        category: 'equipement',
        message:
          'Chaudière gaz détectée mais arrivée gaz absente. Vérifier le branchement (citerne propane ?).',
        affectedKeys: ['chauffage.type_generateur_principal', 'chauffage.arrivee_gaz_present'],
        suggestedAction: 'Vérifier le compteur gaz ou la citerne extérieure',
      },
    ]
  }
  return []
}

/**
 * Règle 2 — Double vitrage sur bâti pré-1948 sans rénovation mentionnée.
 * Warning : possible mais nécessite confirmation.
 */
const ruleOldBuildingDoubleGlazingNoRenovation: Rule = (m) => {
  if (
    m.yearBuilt != null &&
    m.yearBuilt < 1948 &&
    isDoubleVitrage(m.vitrageType) &&
    (m.menuiserieAnnee == null || m.menuiserieAnnee < 1980)
  ) {
    return [
      {
        id: 'rule-2-old-bati-modern-glazing',
        severity: 'warning',
        category: 'historique',
        message: `Bâti ${m.yearBuilt} avec double vitrage. Date de rénovation des menuiseries à confirmer.`,
        affectedKeys: [
          'bati.annee_construction',
          'parois_vitrees.type_vitrage',
          'parois_vitrees.menuiserie_annee',
        ],
        suggestedAction: "Saisir l'année de rénovation des menuiseries",
      },
    ]
  }
  return []
}

/**
 * Règle 3 — Grande maison avec très peu d'émetteurs électriques.
 */
const ruleLargeHouseFewEmitters: Rule = (m) => {
  if (
    m.surfaceHabitableSqm != null &&
    m.surfaceHabitableSqm > 150 &&
    m.chauffageType === 'radiateurs_electriques_simples' &&
    m.nbEmetteursTotal != null &&
    m.nbEmetteursTotal < 6
  ) {
    return [
      {
        id: 'rule-3-large-house-few-emitters',
        severity: 'warning',
        category: 'equipement',
        message: `Surface ${m.surfaceHabitableSqm}m² avec seulement ${m.nbEmetteursTotal} radiateurs électriques. Vérifier le compte.`,
        affectedKeys: ['bati.surface_habitable', 'chauffage.nb_emetteurs_total'],
      },
    ]
  }
  return []
}

/**
 * Règle 4 — Étiquette DPE A annoncée mais bâti pré-1990 sans isolation.
 */
const ruleHighRatingOldBuildingNoInsulation: Rule = (m) => {
  if (
    isHighPerformance(m.classeDpeEstimee) &&
    m.yearBuilt != null &&
    m.yearBuilt < 1990 &&
    (m.isolationMurs === 'aucune' || m.isolationMurs == null) &&
    (m.isolationCombles === 'aucune' || m.isolationCombles == null) &&
    m.renovationIsolationAnnee == null
  ) {
    return [
      {
        id: 'rule-4-class-a-old-no-isolation',
        severity: 'error',
        category: 'historique',
        message:
          'Classe A/B annoncée sur bâti ancien sans isolation documentée. Une rénovation lourde doit être renseignée.',
        affectedKeys: [
          'general.classe_dpe_estimee',
          'bati.annee_construction',
          'bati.isolation_murs_type',
          'bati.isolation_combles_type',
        ],
        suggestedAction: "Renseigner l'année et le type de rénovation isolation",
      },
    ]
  }
  return []
}

/**
 * Règle 5 — Surface d'une pièce supérieure à la surface habitable totale.
 */
const ruleRoomSurfaceExceedsTotal: Rule = (m, rooms) => {
  if (m.surfaceHabitableSqm == null) return []
  const errors: Contradiction[] = []
  for (const room of rooms) {
    if (room.surfaceSqm != null && room.surfaceSqm > m.surfaceHabitableSqm) {
      errors.push({
        id: `rule-5-room-too-large-${room.id}`,
        severity: 'error',
        category: 'surface',
        message: `La pièce « ${room.name} » fait ${room.surfaceSqm}m² alors que la surface habitable totale est de ${m.surfaceHabitableSqm}m². Erreur de saisie.`,
        affectedKeys: [`room.${room.id}.surface`, 'bati.surface_habitable'],
        suggestedAction: 'Corriger la surface de la pièce',
      })
    }
  }
  return errors
}

/**
 * Règle 6 — Cumul des surfaces pièces > 110% surface habitable totale.
 */
const ruleSumRoomsExceedsTotal: Rule = (m, rooms) => {
  if (m.surfaceHabitableSqm == null) return []
  const totalRooms = rooms.reduce((sum, r) => sum + (r.surfaceSqm ?? 0), 0)
  if (totalRooms > 0 && totalRooms > m.surfaceHabitableSqm * 1.1) {
    return [
      {
        id: 'rule-6-sum-rooms-exceeds-total',
        severity: 'warning',
        category: 'surface',
        message: `Cumul des pièces saisies : ${totalRooms.toFixed(1)}m² vs surface habitable annoncée ${m.surfaceHabitableSqm}m² (tolérance +10%). Vérifier les mesures.`,
        affectedKeys: ['rooms.cumul', 'bati.surface_habitable'],
      },
    ]
  }
  return []
}

/**
 * Règle 7 — Cumul des surfaces pièces < 50% surface habitable (pièces manquantes).
 */
const ruleSumRoomsTooLow: Rule = (m, rooms) => {
  if (m.surfaceHabitableSqm == null) return []
  const totalRooms = rooms.reduce((sum, r) => sum + (r.surfaceSqm ?? 0), 0)
  if (totalRooms > 0 && totalRooms < m.surfaceHabitableSqm * 0.5) {
    return [
      {
        id: 'rule-7-sum-rooms-too-low',
        severity: 'warning',
        category: 'surface',
        message: `Seulement ${totalRooms.toFixed(1)}m² renseignés sur ${m.surfaceHabitableSqm}m² annoncés. Des pièces manquent probablement.`,
        affectedKeys: ['rooms.cumul', 'bati.surface_habitable'],
        suggestedAction: 'Ajouter les pièces manquantes via la sidebar',
      },
    ]
  }
  return []
}

/**
 * Règle 8 — Cuve fioul présente mais énergie principale n'est pas fioul.
 */
const ruleFuelTankWithoutFuelHeating: Rule = (m) => {
  if (
    m.cuveFioulPresent === 'oui' &&
    m.chauffageEnergie != null &&
    m.chauffageEnergie !== 'fioul'
  ) {
    return [
      {
        id: 'rule-8-fuel-tank-no-fuel',
        severity: 'warning',
        category: 'equipement',
        message: `Cuve fioul détectée mais énergie principale = ${m.chauffageEnergie}. Cuve résiduelle d'ancien équipement ? À documenter.`,
        affectedKeys: ['chauffage.cuve_fioul_present', 'chauffage.energie_principale'],
      },
    ]
  }
  return []
}

/**
 * Règle 9 — Chaudière fioul mais cuve fioul absente.
 */
const ruleFuelBoilerNoTank: Rule = (m) => {
  if (isChaudiereFioul(m.chauffageType) && m.cuveFioulPresent === 'non') {
    return [
      {
        id: 'rule-9-fuel-boiler-no-tank',
        severity: 'error',
        category: 'equipement',
        message:
          'Chaudière fioul mais aucune cuve. Vérifier (cuve enterrée ? cuve récemment supprimée ?).',
        affectedKeys: ['chauffage.type_generateur_principal', 'chauffage.cuve_fioul_present'],
      },
    ]
  }
  return []
}

/**
 * Règle 10 — Bâti pré-1948 sans renseignement type de mur (souvent pierre).
 */
const ruleOldBuildingWallTypeUnknown: Rule = (m) => {
  if (
    m.yearBuilt != null &&
    m.yearBuilt < 1948 &&
    (m.isolationMurs == null || m.isolationMurs === 'inconnue')
  ) {
    return [
      {
        id: 'rule-10-old-bati-wall-unknown',
        severity: 'warning',
        category: 'isolation',
        message: `Bâti ${m.yearBuilt} : type de mur et isolation non documentés. Critique pour le calcul 3CL.`,
        affectedKeys: ['bati.type_mur_principal', 'bati.isolation_murs_type'],
        suggestedAction: 'Examiner épaisseur des murs et tester sondage',
      },
    ]
  }
  return []
}

/**
 * Règle 11 — Pompe à chaleur mais bâti pré-1980 sans isolation : peu efficace.
 */
const rulePacOnOldBatiNoInsulation: Rule = (m) => {
  if (
    isPac(m.chauffageType) &&
    m.yearBuilt != null &&
    m.yearBuilt < 1980 &&
    m.isolationMurs === 'aucune' &&
    m.isolationCombles === 'aucune'
  ) {
    return [
      {
        id: 'rule-11-pac-old-no-isolation',
        severity: 'warning',
        category: 'equipement',
        message:
          'PAC sur bâti ancien non isolé : COP réel souvent < 2,5. Renseigner SCOP saison chauffage si disponible.',
        affectedKeys: ['chauffage.type_generateur_principal', 'chauffage.scop_saison_chauffage'],
      },
    ]
  }
  return []
}

/**
 * Règle 12 — Pièces sans surface saisie alors que d'autres en ont.
 */
const ruleMixedRoomsSurfaceMissing: Rule = (_m, rooms) => {
  const withSurface = rooms.filter((r) => r.surfaceSqm != null).length
  const withoutSurface = rooms.filter((r) => r.surfaceSqm == null).length
  if (withSurface > 0 && withoutSurface > 0 && rooms.length > 1) {
    return [
      {
        id: 'rule-12-rooms-mixed-surface',
        severity: 'warning',
        category: 'surface',
        message: `${withoutSurface} pièce(s) sans surface saisie alors que ${withSurface} en ont. Compléter pour cohérence.`,
        affectedKeys: rooms.filter((r) => r.surfaceSqm == null).map((r) => `room.${r.id}.surface`),
      },
    ]
  }
  return []
}

/**
 * Règle 13 — Hauteur sous plafond < 2,20 m mais bâti récent (≥ 1990).
 */
const ruleLowCeilingRecentBuilding: Rule = (m) => {
  if (
    m.yearBuilt != null &&
    m.yearBuilt >= 1990 &&
    m.ceilingHeightAvgM != null &&
    m.ceilingHeightAvgM < 2.2
  ) {
    return [
      {
        id: 'rule-13-low-ceiling-recent',
        severity: 'warning',
        category: 'piece',
        message: `Hauteur sous plafond ${m.ceilingHeightAvgM}m sur bâti ${m.yearBuilt} : inhabituel (norme minimum 2,40m). Vérifier la mesure.`,
        affectedKeys: ['bati.hauteur_sous_plafond_moyenne'],
      },
    ]
  }
  return []
}

/**
 * Règle 14 — Classe F/G annoncée mais isolation + double vitrage présents.
 */
const ruleLowClassButGoodEquipment: Rule = (m) => {
  if (
    isLowPerformance(m.classeDpeEstimee) &&
    m.isolationMurs != null &&
    m.isolationMurs !== 'aucune' &&
    m.isolationCombles != null &&
    m.isolationCombles !== 'aucune' &&
    isDoubleVitrage(m.vitrageType) &&
    (m.chauffageType === 'chaudiere_gaz_condensation' || isPac(m.chauffageType))
  ) {
    return [
      {
        id: 'rule-14-low-class-good-equipment',
        severity: 'warning',
        category: 'historique',
        message:
          'Classe F/G annoncée mais isolation + vitrage + chauffage performant. Recalculer pour confirmer.',
        affectedKeys: ['general.classe_dpe_estimee'],
      },
    ]
  }
  return []
}

/**
 * Règle 15 — Nb pièces principales déclaré incohérent avec pièces saisies.
 */
const ruleNbPiecesIncoherent: Rule = (m, rooms) => {
  if (m.nbPiecesPrincipales == null) return []
  // Comptage des pièces principales = salon + chambres + bureau
  const principalRooms = rooms.filter(
    (r) => r.type === 'living' || r.type === 'bedroom' || r.type === 'office',
  ).length
  if (principalRooms > 0 && Math.abs(principalRooms - m.nbPiecesPrincipales) >= 2) {
    return [
      {
        id: 'rule-15-nb-pieces-incoherent',
        severity: 'warning',
        category: 'piece',
        message: `${m.nbPiecesPrincipales} pièces principales déclarées mais ${principalRooms} renseignées (écart ≥ 2).`,
        affectedKeys: ['bati.nombre_pieces_principales'],
      },
    ]
  }
  return []
}

/**
 * Règle 16 — Régulation absente sur bâti récent (≥ 2010).
 */
const ruleNoRegulationOnRecentBuilding: Rule = (m) => {
  if (m.yearBuilt != null && m.yearBuilt >= 2010 && m.regulationType === 'absente') {
    return [
      {
        id: 'rule-16-no-regulation-recent',
        severity: 'warning',
        category: 'equipement',
        message:
          "Régulation absente sur bâti récent (≥ 2010) : inhabituel. Vérifier la présence d'un thermostat.",
        affectedKeys: ['chauffage.regulation_type'],
      },
    ]
  }
  return []
}

/**
 * Règle 17 — Photovoltaïque déclaré mais aucune surface PV ni puissance.
 */
const rulePvWithoutSpecs: Rule = (m) => {
  if (m.pvPresent === 'oui') {
    // Note: on n'a pas pv_puissance dans le snapshot direct mais on génère
    // un warning si on s'attend à ce que les champs PV soient renseignés.
    return [
      {
        id: 'rule-17-pv-without-specs',
        severity: 'warning',
        category: 'equipement',
        message:
          'PV présent : pensez à renseigner la puissance crête + orientation + année installation pour le bonus DPE.',
        affectedKeys: ['enr.pv_puissance_kwc', 'enr.pv_orientation', 'enr.pv_annee_installation'],
      },
    ]
  }
  return []
}

/**
 * Règle 18 — DPE précédent classe A et nouveau classe G (ou inverse).
 */
const ruleDpeJumpTooLarge: Rule = (m) => {
  const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  if (!m.classeDpeEstimee || !m.dpeAnterieurClasse || m.dpeAnterieurClasse === 'inconnue') {
    return []
  }
  const idxOld = order.indexOf(m.dpeAnterieurClasse)
  const idxNew = order.indexOf(m.classeDpeEstimee)
  if (idxOld === -1 || idxNew === -1) return []
  const jump = Math.abs(idxOld - idxNew)
  if (jump >= 4) {
    return [
      {
        id: 'rule-18-dpe-jump',
        severity: 'warning',
        category: 'historique',
        message: `Écart de ${jump} classes entre DPE précédent (${m.dpeAnterieurClasse}) et estimé (${m.classeDpeEstimee}). Travaux majeurs ou erreur ?`,
        affectedKeys: ['general.dpe_anterieur_classe', 'general.classe_dpe_estimee'],
      },
    ]
  }
  return []
}

// -----------------------------------------------------------------------------
// Liste canonique des règles
// -----------------------------------------------------------------------------

const RULES: ReadonlyArray<Rule> = [
  ruleGasBoilerWithoutGasInlet,
  ruleOldBuildingDoubleGlazingNoRenovation,
  ruleLargeHouseFewEmitters,
  ruleHighRatingOldBuildingNoInsulation,
  ruleRoomSurfaceExceedsTotal,
  ruleSumRoomsExceedsTotal,
  ruleSumRoomsTooLow,
  ruleFuelTankWithoutFuelHeating,
  ruleFuelBoilerNoTank,
  ruleOldBuildingWallTypeUnknown,
  rulePacOnOldBatiNoInsulation,
  ruleMixedRoomsSurfaceMissing,
  ruleLowCeilingRecentBuilding,
  ruleLowClassButGoodEquipment,
  ruleNbPiecesIncoherent,
  ruleNoRegulationOnRecentBuilding,
  rulePvWithoutSpecs,
  ruleDpeJumpTooLarge,
]

export const CONTRADICTIONS_RULE_COUNT = RULES.length

/**
 * Détecte les contradictions sur un snapshot mission + pièces.
 *
 * Lib pure — pas d'effet de bord, pas d'I/O. Appelable à chaque keystroke.
 */
export function detectContradictions(
  mission: MissionSnapshot,
  rooms: readonly RoomSnapshot[] = [],
): Contradiction[] {
  const out: Contradiction[] = []
  for (const rule of RULES) {
    try {
      const found = rule(mission, rooms)
      if (found.length > 0) out.push(...found)
    } catch {
      // règle qui crashe — on saute (défensif)
    }
  }
  return out
}

/** Groupe les contradictions par severity (pour affichage récap). */
export function groupBySeverity(
  contradictions: readonly Contradiction[],
): Record<ContradictionSeverity, Contradiction[]> {
  return {
    error: contradictions.filter((c) => c.severity === 'error'),
    warning: contradictions.filter((c) => c.severity === 'warning'),
  }
}

/** Compte les erreurs (bloquantes). */
export function countErrors(contradictions: readonly Contradiction[]): number {
  return contradictions.filter((c) => c.severity === 'error').length
}
