/**
 * Parser custom JS — 80% des cas terrain structurés sans appel IA.
 *
 * Stratégie hybride :
 * - Patterns regex pour mesures, années, surfaces
 * - Matching exact contre vocabulaire diag-fr (équipements, marques, isolations)
 * - Score de confiance heuristique
 * - Si confiance < 0.7 → fallback Claude Haiku (J6)
 *
 * Objectif coût : 0,01€/mission (vs 0,15€ tout Claude).
 */

export interface VoiceParsedData {
  surface_m2?: number
  year_built?: number
  ceiling_height_m?: number
  rooms_count?: number

  equipment: {
    kind:
      | 'chaudiere'
      | 'chauffe_eau'
      | 'radiateur'
      | 'pac'
      | 'climatisation'
      | 'fenetre'
      | 'isolation'
      | 'ventilation'
      | 'tableau_elec'
      | 'autre'
    brand?: string
    model?: string
    energy_class?: string
    year_install?: number
    notes?: string
  }[]

  observations: string[] // Phrases d'intérêt extraites
  raw_keywords: string[] // Mots-clés repérés
  confidence: number // 0-1 heuristique
}

// Vocabulaire ciblé — sous-ensemble pour parsing rapide
const BRANDS_CHAUDIERE = [
  'saunier duval',
  'frisquet',
  'elm leblanc',
  'chappée',
  'de dietrich',
  'atlantic',
  'viessmann',
  'vaillant',
  'buderus',
  'unical',
  'ariston',
  'auer',
  'styx',
  'oertli',
]

const BRANDS_PAC = [
  'daikin',
  'mitsubishi',
  'toshiba',
  'panasonic',
  'atlantic',
  'hitachi',
  'lg',
  'samsung',
]

const ISOLATION_KEYWORDS = [
  'laine de verre',
  'laine de roche',
  'polystyrène',
  'pse',
  'pur',
  'polyuréthane',
  'ouate de cellulose',
  'fibre de bois',
  'ite',
  'iti',
]

const VENTILATION_KEYWORDS = [
  'vmc simple flux',
  'vmc double flux',
  'vmc hygro',
  'vmc hygroréglable',
  'vmr',
  'ventilation naturelle',
]

const ENERGY_CLASS_PATTERN = /classe?\s+(?:énergétique\s+|énerg\s+)?([A-G])\b/gi
const SURFACE_PATTERN =
  /(\d{1,4}(?:[,.]\d{1,2})?)\s*(?:m²|m2|mètre[s]?\s+carré[s]?|metres?\s+carr[eé]s?)/gi
const YEAR_PATTERN = /\b(?:constru(?:it|ction)\s+en\s+|année\s+|de\s+)(\d{4})\b/gi
const YEAR_LOOSE_PATTERN = /\b(1[89]\d{2}|20[012]\d)\b/g
const CEILING_PATTERN =
  /(?:hauteur\s+(?:sous\s+plafond|s\.?p\.?)\s+(?:de\s+|:\s*)?)(\d(?:[,.]\d{1,2})?)\s*m(?:\b|ètres?)/gi

/**
 * Normalise une chaîne pour matching insensitive (lowercase, sans accents).
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function findBrand(text: string, brands: string[]): string | undefined {
  const norm = normalize(text)
  for (const b of brands) {
    if (norm.includes(normalize(b))) return b
  }
  return undefined
}

function extractSurface(text: string): number | undefined {
  SURFACE_PATTERN.lastIndex = 0
  const m = SURFACE_PATTERN.exec(text)
  if (!m) return undefined
  return Number.parseFloat(m[1]!.replace(',', '.'))
}

function extractYear(text: string): number | undefined {
  YEAR_PATTERN.lastIndex = 0
  const m = YEAR_PATTERN.exec(text)
  if (m) return Number.parseInt(m[1]!, 10)
  YEAR_LOOSE_PATTERN.lastIndex = 0
  const m2 = YEAR_LOOSE_PATTERN.exec(text)
  if (m2) return Number.parseInt(m2[1]!, 10)
  return undefined
}

function extractCeilingHeight(text: string): number | undefined {
  CEILING_PATTERN.lastIndex = 0
  const m = CEILING_PATTERN.exec(text)
  if (!m) return undefined
  return Number.parseFloat(m[1]!.replace(',', '.'))
}

function extractEnergyClass(text: string): string | undefined {
  ENERGY_CLASS_PATTERN.lastIndex = 0
  const m = ENERGY_CLASS_PATTERN.exec(text)
  return m?.[1]?.toUpperCase()
}

/**
 * Parser principal — accepte un transcript brut, retourne données structurées.
 */
export function parseVoiceTranscript(transcript: string): VoiceParsedData {
  if (!transcript || transcript.trim().length === 0) {
    return { equipment: [], observations: [], raw_keywords: [], confidence: 0 }
  }

  const text = transcript.trim()
  const norm = normalize(text)
  const equipment: VoiceParsedData['equipment'] = []
  const keywords: string[] = []

  // NOTE : regex matchent contre `norm` (sans accents). Toutes les lettres sont
  // déjà en minuscule et NFD-stripped donc on écrit sans accent.

  // Détection chaudière
  if (/chaudiere|bruleur/.test(norm)) {
    const brand = findBrand(text, BRANDS_CHAUDIERE)
    equipment.push({
      kind: 'chaudiere',
      brand,
      year_install: extractYear(text),
    })
    keywords.push('chaudière')
  }

  // Détection PAC
  if (/pompe\s+a\s+chaleur|p\.?a\.?c\.?\b|pac\s+air/.test(norm)) {
    const brand = findBrand(text, BRANDS_PAC)
    equipment.push({
      kind: 'pac',
      brand,
      year_install: extractYear(text),
    })
    keywords.push('PAC')
  }

  // Détection chauffe-eau / ECS
  if (/chauffe[\s-]eau|ballon\s+(?:ecs|d['']?eau)/.test(norm)) {
    equipment.push({ kind: 'chauffe_eau' })
    keywords.push('chauffe-eau')
  }

  // Détection radiateurs
  if (/radiateur|convecteur/.test(norm)) {
    equipment.push({ kind: 'radiateur' })
    keywords.push('radiateurs')
  }

  // Détection isolation
  for (const iso of ISOLATION_KEYWORDS) {
    if (norm.includes(normalize(iso))) {
      equipment.push({ kind: 'isolation', notes: iso })
      keywords.push(iso)
      break // une seule isolation suffit pour le parser V1
    }
  }

  // Détection ventilation
  for (const vent of VENTILATION_KEYWORDS) {
    if (norm.includes(normalize(vent))) {
      equipment.push({ kind: 'ventilation', notes: vent })
      keywords.push(vent)
      break
    }
  }

  // Détection fenêtres
  if (/(double|triple|simple)\s+vitrage|fenetre|menuiserie/.test(norm)) {
    const vitrage = norm.match(/(double|triple|simple)\s+vitrage/)?.[1]
    equipment.push({ kind: 'fenetre', notes: vitrage ? `${vitrage} vitrage` : 'menuiserie' })
    keywords.push('menuiseries')
  }

  // Tableau électrique
  if (/tableau\s+(?:electrique|elec)|disjoncteur|fusible|differentiel/.test(norm)) {
    equipment.push({ kind: 'tableau_elec' })
    keywords.push('tableau électrique')
  }

  // Observations (phrases d'intérêt — détecte mots clés à risque)
  const observations: string[] = []
  const sentences = text.split(/[.!?]\s+/).filter(Boolean)
  for (const s of sentences) {
    const lower = normalize(s)
    if (
      /fissure|infiltration|humidite|moisissure|degradation|defaut|risque|attention|mauvais\s+etat/.test(
        lower,
      )
    ) {
      observations.push(s.trim())
    }
  }

  // Score de confiance heuristique :
  //  - 0.3 base si parser a tourné
  //  - +0.1 par champ structuré
  //  - +0.2 si surface OU année trouvée
  //  - +0.1 si équipement avec marque
  let confidence = 0.3
  const surface = extractSurface(text)
  const year = extractYear(text)
  const ceiling = extractCeilingHeight(text)
  const energyClass = extractEnergyClass(text)

  if (surface) confidence += 0.15
  if (year) confidence += 0.15
  if (ceiling) confidence += 0.1
  if (energyClass) confidence += 0.1
  confidence += Math.min(equipment.length * 0.05, 0.2)
  if (equipment.some((e) => e.brand)) confidence += 0.1

  confidence = Math.min(confidence, 1)

  return {
    surface_m2: surface,
    year_built: year,
    ceiling_height_m: ceiling,
    equipment,
    observations,
    raw_keywords: keywords,
    confidence,
  }
}

export const VOICE_PARSER_THRESHOLD = 0.7
