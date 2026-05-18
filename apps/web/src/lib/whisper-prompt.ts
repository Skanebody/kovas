/**
 * Construction du prompt Whisper API (param `prompt`, ~224 token cap).
 * On sélectionne 50-80 termes pertinents selon le type de mission
 * pour améliorer la reconnaissance des noms propres et termes techniques.
 *
 * Cf. research/whisper-transcription.md §6
 */

const VOCAB_COMMON = [
  // Surfaces / mesures
  'mètres carrés', 'm²', 'hauteur sous plafond', 'surface Carrez', 'surface Boutin',
  // Pièces
  'salon', 'séjour', 'cuisine', 'salle de bain', 'chambre', 'couloir', 'entrée',
  // Bâti
  'parpaing', 'pierre', 'béton', 'pisé', 'pan de bois',
]

const VOCAB_DPE = [
  // Isolation
  'ITE', 'ITI', 'laine de verre', 'laine de roche', 'polystyrène', 'PSE', 'polyuréthane',
  'ouate de cellulose', 'fibre de bois',
  // Chauffage
  'chaudière condensation', 'chaudière basse température', 'pompe à chaleur',
  'PAC air-eau', 'PAC air-air', 'chauffe-eau thermodynamique', 'ballon ECS',
  'radiateur', 'plancher chauffant', 'poêle à granulés',
  // Marques chaudières
  'Saunier Duval', 'Frisquet', 'ELM Leblanc', 'Chappée', 'De Dietrich', 'Atlantic',
  'Viessmann', 'Vaillant', 'Buderus', 'Ariston',
  // Marques PAC
  'Daikin', 'Mitsubishi', 'Toshiba', 'Panasonic', 'Hitachi',
  // Ventilation
  'VMC simple flux', 'VMC double flux', 'VMC hygroréglable',
  // Menuiseries
  'double vitrage', 'triple vitrage', 'PVC', 'aluminium', 'menuiserie bois',
  // Classes énergie
  'classe A', 'classe B', 'classe C', 'classe D', 'classe E', 'classe F', 'classe G',
]

const VOCAB_AMIANTE = [
  'amiante', 'fibrociment', 'flocage', 'calorifugeage', 'faux plafond', 'dalle vinyle',
  'colle bitumineuse', 'matériau amianté', 'libération de fibres',
]

const VOCAB_PLOMB = [
  'CREP', 'plomb', 'peinture au plomb', 'écaillage', 'concentration mg/cm²',
  'mesure XRF', 'fluorescence X', 'classement 1', 'classement 2', 'classement 3',
]

const VOCAB_GAZ_ELEC = [
  'tableau électrique', 'disjoncteur différentiel', 'prise de terre', 'mise à la terre',
  'compteur Linky', 'chauffe-eau gaz', 'robinet d\'arrêt', 'conduit cheminée',
  'tubage', 'évacuation gaz',
]

const VOCAB_TERMITES = [
  'termite', 'galerie', 'cordonnet', 'mérule', 'lyctus', 'capricorne', 'vrillette',
  'champignon lignivore', 'humidité bois',
]

const VOCAB_BY_MISSION_TYPE: Record<string, string[]> = {
  dpe_vente: VOCAB_DPE,
  dpe_location: VOCAB_DPE,
  copropriete: VOCAB_DPE,
  amiante_vente: VOCAB_AMIANTE,
  amiante_avant_travaux: VOCAB_AMIANTE,
  plomb_crep: VOCAB_PLOMB,
  gaz: VOCAB_GAZ_ELEC,
  electricite: VOCAB_GAZ_ELEC,
  termites: VOCAB_TERMITES,
  carrez_boutin: [],
  erp: [],
}

/**
 * Construit le `prompt` Whisper pour un type de mission donné.
 * Max ~80 termes (estimation token : 0,75 token par mot français).
 */
export function buildWhisperPrompt(missionTypes?: string | string[] | null): string {
  const typesArray = Array.isArray(missionTypes)
    ? missionTypes
    : missionTypes
      ? [missionTypes]
      : []

  const specificSet = new Set<string>()
  for (const t of typesArray) {
    for (const term of VOCAB_BY_MISSION_TYPE[t] ?? []) specificSet.add(term)
  }

  const terms = [...VOCAB_COMMON, ...specificSet].slice(0, 80)
  return [
    "Transcription d'une visite de diagnostic immobilier en France.",
    'Vocabulaire métier :',
    `${terms.join(', ')}.`,
  ].join(' ')
}
