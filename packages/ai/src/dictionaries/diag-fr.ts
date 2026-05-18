/**
 * Glossaire métier diagnostic immobilier FR (~200 termes).
 *
 * Usage :
 * - Whisper API `prompt` parameter (~224 token cap, sélectionner 50-80 termes par mission)
 * - Claude system prompt cached 1h
 * - iOS SFSpeechRecognizer `contextualStrings` (offline fallback)
 *
 * Cf. research/whisper-transcription.md §6
 */

import type { MissionType } from '@kovas/shared'

export const DIAG_VOCAB_FR = {
  bati: [
    'mérule',
    'salpêtre',
    'mousse',
    'condensation',
    'infiltration',
    'fissure',
    'lézarde',
    'ponts thermiques',
    'étanchéité',
    'parement',
    'bardage',
    'bardage bois',
    'enduit',
    'crépi',
    'ravalement',
    'nez de dalle',
    'linteau',
    'allège',
    'retour de mur',
  ],
  isolation: [
    'ITE',
    'ITI',
    "isolation par l'extérieur",
    "isolation par l'intérieur",
    'laine de verre',
    'laine de roche',
    'polystyrène',
    'PSE',
    'PUR',
    'polyuréthane',
    'ouate de cellulose',
    'fibre de bois',
    'R thermique',
    'lambda',
  ],
  chauffage: [
    'chaudière gaz',
    'chaudière fioul',
    'chaudière condensation',
    'chaudière basse température',
    'pompe à chaleur',
    'PAC air-eau',
    'PAC air-air',
    'PAC géothermique',
    'chauffe-eau thermodynamique',
    'ballon ECS',
    'radiateur',
    'plancher chauffant',
    'poêle à bois',
    'poêle à granulés',
    'insert',
    'cheminée',
    'VMC simple flux',
    'VMC double flux',
    'VMR',
    'VMC hygroréglable',
  ],
  marquesChaudiere: [
    'Saunier Duval',
    'Frisquet',
    'ELM Leblanc',
    'Chappée',
    'De Dietrich',
    'Atlantic',
    'Viessmann',
    'Vaillant',
    'Buderus',
    'Bosch',
    'Riello',
    'Chaffoteaux',
    'Auer',
    'Hitachi',
    'Daikin',
    'Mitsubishi',
    'LG',
    'Panasonic',
  ],
  energie: [
    'DPE A',
    'DPE B',
    'DPE C',
    'DPE D',
    'DPE E',
    'DPE F',
    'DPE G',
    'classe énergétique',
    'classe climatique',
    'GES',
    'kWh par mètre carré par an',
    'énergie primaire',
    'énergie finale',
    'ECS',
    'ECS solaire',
    'panneaux photovoltaïques',
  ],
  diagnostics: [
    'amiante',
    'plomb',
    'termites',
    'mérule',
    'gaz',
    'électricité',
    'loi Carrez',
    'loi Boutin',
    'ERP',
    'état des risques et pollutions',
    'DPE vente',
    'DPE location',
    'DPE copro',
    'DPE collectif',
  ],
  aides: [
    "MaPrimeRénov'",
    'CEE',
    "Certificats d'Économies d'Énergie",
    'éco-PTZ',
    'PAR',
    'RGE',
    'MAR',
    "Mon Accompagnateur Rénov'",
  ],
  unitesActeurs: [
    'mètre carré',
    'm²',
    'centimètre',
    'kWh',
    'watt',
    'kilowatt',
    'ampère',
    'volt',
    'degré Celsius',
    'hectopascal',
    'pascal',
    'diagnostiqueur',
    'COFRAC',
    'ADEME',
    'DHUP',
    'DGCCRF',
    'notaire',
    'mandataire',
  ],
} as const

/**
 * Retourne le sous-ensemble de vocabulaire pertinent pour un type de mission.
 * Utilisé pour optimiser le prompt Whisper (~224 token cap).
 */
export function vocabForMissionType(missionType: MissionType): string[] {
  const baseVocab = [
    ...DIAG_VOCAB_FR.bati,
    ...DIAG_VOCAB_FR.unitesActeurs,
  ]

  switch (missionType) {
    case 'dpe_vente':
    case 'dpe_location':
    case 'copropriete':
      return [
        ...baseVocab,
        ...DIAG_VOCAB_FR.isolation,
        ...DIAG_VOCAB_FR.chauffage,
        ...DIAG_VOCAB_FR.marquesChaudiere,
        ...DIAG_VOCAB_FR.energie,
        ...DIAG_VOCAB_FR.aides,
      ]
    case 'amiante_vente':
    case 'amiante_avant_travaux':
      return [...baseVocab, 'amiante', 'fibres', 'flocage', 'calorifuge', 'faux plafond']
    case 'plomb_crep':
      return [...baseVocab, 'plomb', 'peinture', 'CREP', 'unité de diagnostic']
    case 'gaz':
      return [...baseVocab, 'gaz', 'chaudière', 'robinet', 'vanne', 'tuyauterie', 'GPL']
    case 'electricite':
      return [...baseVocab, 'tableau électrique', 'différentiel', 'disjoncteur', 'liaison équipotentielle']
    case 'termites':
      return [...baseVocab, 'termites', 'xylophage', 'champignon lignivore']
    case 'carrez_boutin':
      return [...baseVocab, 'surface privative', 'surface habitable', 'mezzanine', 'sous-pente']
    case 'erp':
      return [...baseVocab, 'sismique', 'radon', 'inondation', 'mouvement de terrain', 'argile']
    default:
      return baseVocab
  }
}
