/**
 * KOVAS — Items de pièce (mode mission) : type + dérivation de label lisible.
 *
 * Phase 2 mode mission ("tous les éléments") : les captures IA `equipment`,
 * `observation` et `measurement` deviennent des entités stockées, affichées et
 * supprimables par pièce — au lieu d'incrémenter silencieusement un compteur de
 * complétude.
 *
 * `buildRoomItemLabel` dérive un résumé lisible terrain à partir des données
 * brutes de la capture, affiché tel quel dans la sidebar pièces.
 *
 * Authority : CLAUDE.md §3 feature 1 + DS v5 (ton sobre, vocabulaire métier FR).
 */

export type RoomItemKind = 'equipment' | 'observation' | 'measurement'

export interface RoomItem {
  /** crypto.randomUUID côté client — sert aussi de client_local_id pour l'idempotence DB. */
  id: string
  kind: RoomItemKind
  /** Résumé lisible dérivé de la capture (cf. buildRoomItemLabel). */
  label: string
  /** Données structurées brutes de la capture. */
  data: Record<string, unknown>
  createdAt: number
}

// -----------------------------------------------------------------------------
// Helpers de formatage
// -----------------------------------------------------------------------------

/** Convertit un slug technique en libellé lisible : "chaudiere_gaz" → "Chaudière gaz". */
function humanizeSlug(raw: string): string {
  const cleaned = raw.replace(/[_-]+/g, ' ').trim()
  if (cleaned.length === 0) return raw
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

/** Format français des nombres (séparateur décimal virgule). */
function formatNumberFr(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)
}

/** Lit une clé string de façon sûre depuis les données de capture. */
function readString(data: Record<string, unknown>, key: string): string | null {
  const v = data[key]
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

/** Lit une clé numérique de façon sûre (number direct ou string parsable). */
function readNumber(data: Record<string, unknown>, key: string): number | null {
  const v = data[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return null
}

// Libellés métier FR pour les types de mesure connus (sinon humanize du slug).
const MEASUREMENT_TYPE_LABEL: Record<string, string> = {
  surface_carrez: 'Surface Carrez',
  surface_boutin: 'Surface Boutin',
  surface_habitable: 'Surface habitable',
  surface: 'Surface',
  hauteur_sous_plafond: 'Hauteur sous plafond',
  hauteur: 'Hauteur',
}

// Libellés métier FR pour les catégories d'observation connues.
const OBSERVATION_CATEGORY_LABEL: Record<string, string> = {
  humidite: 'Humidité',
  fissure: 'Fissure',
  moisissure: 'Moisissure',
  infiltration: 'Infiltration',
  amiante: 'Présence amiante suspectée',
  plomb: 'Présence plomb suspectée',
  ventilation: 'Défaut ventilation',
}

// Libellés FR pour la sévérité d'une observation.
const SEVERITY_LABEL: Record<string, string> = {
  low: 'faible',
  medium: 'moyenne',
  high: 'élevée',
}

// -----------------------------------------------------------------------------
// buildRoomItemLabel — résumé lisible d'un item
// -----------------------------------------------------------------------------

/**
 * Dérive un libellé lisible à partir des données brutes d'une capture.
 *
 * Exemples :
 *  - equipment    kind="chaudiere_gaz" brand="Saunier Duval"  → "Chaudière gaz · Saunier Duval"
 *  - observation  category="humidite" severity="medium"        → "Humidité (moyenne)"
 *  - measurement  type="surface_carrez" value=22.5 unit="m2"   → "Surface Carrez : 22,5 m²"
 *
 * Le label n'est JAMAIS vide : fallback sobre par kind si aucune donnée exploitable.
 */
export function buildRoomItemLabel(kind: RoomItemKind, data: Record<string, unknown>): string {
  if (kind === 'equipment') {
    const kindLabel = readString(data, 'kind')
    const brand = readString(data, 'brand')
    const base = kindLabel ? humanizeSlug(kindLabel) : 'Équipement'
    return brand ? `${base} · ${brand}` : base
  }

  if (kind === 'observation') {
    const category = readString(data, 'category')
    const severityRaw = readString(data, 'severity')
    const base = category
      ? (OBSERVATION_CATEGORY_LABEL[category] ?? humanizeSlug(category))
      : 'Observation'
    const severity = severityRaw ? (SEVERITY_LABEL[severityRaw] ?? severityRaw) : null
    return severity ? `${base} (${severity})` : base
  }

  // measurement
  const typeRaw = readString(data, 'type')
  const base = typeRaw ? (MEASUREMENT_TYPE_LABEL[typeRaw] ?? humanizeSlug(typeRaw)) : 'Mesure'
  const value = readNumber(data, 'value')
  if (value == null) return base
  const unitRaw = readString(data, 'unit')
  // Normalisation des unités usuelles terrain.
  const unit = unitRaw === 'm2' ? 'm²' : (unitRaw ?? '')
  return unit.length > 0
    ? `${base} : ${formatNumberFr(value)} ${unit}`
    : `${base} : ${formatNumberFr(value)}`
}

/** Libellé FR court par kind (en-tête de groupe dans la sidebar). */
export const ROOM_ITEM_KIND_LABEL: Record<RoomItemKind, string> = {
  equipment: 'Équipement',
  observation: 'Observation',
  measurement: 'Mesure',
}
