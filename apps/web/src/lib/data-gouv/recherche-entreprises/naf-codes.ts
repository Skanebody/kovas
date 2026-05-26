/**
 * KOVAS — Codes NAF (nomenclature INSEE Rev. 2) acceptables pour l'activité
 * diagnostic immobilier.
 *
 * Source : INSEE, nomenclature NAF Rev. 2 (en vigueur 2026).
 *   - https://www.insee.fr/fr/metadonnees/nafr2/sousClasse/71.20B
 *   - https://www.insee.fr/fr/metadonnees/nafr2/sousClasse/71.12B
 *
 * Périmètre :
 *   - 71.20B  "Analyses, essais et inspections techniques"  → coeur de cible
 *     diagnostic immobilier (DPE, amiante, plomb, gaz, élec, termites,
 *     Carrez/Boutin, ERP). C'est le code officiel attendu par l'État pour
 *     les cabinets de diagnostic.
 *   - 71.12B  "Ingénierie, études techniques"               → certains cabinets
 *     multi-activités (audit énergétique, bureau d'études) sont enregistrés
 *     sous ce code. Accepté comme NAF valide pour ne pas exclure les pros
 *     déjà installés.
 *
 * Volontairement EXCLU :
 *   - 71.20A  "Contrôle technique automobile"               → pas le métier
 *     (mention initiale dans le brief par erreur, INSEE confirme : code
 *     dédié contrôle technique des véhicules).
 *
 * Format de comparaison : la valeur `activite_principale` renvoyée par
 * l'API Recherche d'Entreprises (api.gouv.fr) est de la forme `"71.20B"`
 * avec point séparateur. Les SIRET INSEE bruts utilisent souvent `"7120B"`
 * sans point (cf. apps/web/src/app/api/sirene/lookup/route.ts).
 *
 * `isDiagnosticNAF()` normalise les deux formats pour comparaison robuste.
 *
 * Authority : CLAUDE.md §6 (anti-abus essai gratuit), `docs/data-gouv-opportunities.md` §2.5.
 */

export const DIAGNOSTIC_NAF_CODES = ['71.20B', '71.12B'] as const

export type DiagnosticNafCode = (typeof DIAGNOSTIC_NAF_CODES)[number]

/**
 * Normalise un code NAF à la forme canonique avec point (`"7120B"` → `"71.20B"`).
 * Retourne `null` si le format n'est pas reconnaissable.
 */
export function normalizeNafCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toUpperCase()
  if (trimmed.length === 0) return null
  // Déjà au format `"71.20B"`
  if (/^\d{2}\.\d{2}[A-Z]$/.test(trimmed)) return trimmed
  // Format `"7120B"` → insérer le point
  if (/^\d{4}[A-Z]$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}.${trimmed.slice(2)}`
  }
  return null
}

/**
 * Vérifie si un code NAF (toute forme normalisable) appartient au périmètre
 * diagnostic immobilier.
 */
export function isDiagnosticNAF(raw: string | null | undefined): boolean {
  const normalized = normalizeNafCode(raw)
  if (!normalized) return false
  return (DIAGNOSTIC_NAF_CODES as readonly string[]).includes(normalized)
}

/**
 * Libellé humain lisible pour les codes NAF acceptés. Utilisé dans les
 * messages UI / admin / rapports.
 */
export const NAF_LABELS: Readonly<Record<DiagnosticNafCode, string>> = {
  '71.20B': 'Analyses, essais et inspections techniques',
  '71.12B': 'Ingénierie, études techniques',
}

export function getNafLabel(raw: string | null | undefined): string | null {
  const normalized = normalizeNafCode(raw)
  if (!normalized) return null
  if (normalized in NAF_LABELS) return NAF_LABELS[normalized as DiagnosticNafCode]
  return null
}
