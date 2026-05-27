/**
 * Lexique métier diagnostic immobilier français (~600 termes).
 *
 * Objectif :
 * - Booster la reconnaissance Whisper sur le jargon technique (initial prompt)
 * - Enrichir le system prompt Claude pour structuration / extraction canonique
 *
 * Sections : 10 domaines + sous-catégories de termes (arrays string).
 * Source : addendum KOVAS section 2.2 (lexique métier complet).
 *
 * Convention :
 * - Identifiants TS en anglais (sections / fonctions exportées)
 * - Termes du lexique en français (orthographe métier officielle FR)
 * - Tous les arrays sont readonly (immutabilité runtime)
 *
 * Usage :
 *   import { buildWhisperPrompt, buildClaudeContextVocabulary } from
 *     '@/lib/local-ai/vocabulary/diagnostic-jargon'
 *
 *   const wp = buildWhisperPrompt(['dpe', 'amiante'])         // <= 224 tokens
 *   const cv = buildClaudeContextVocabulary(['dpe', 'amiante']) // bloc structuré
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Section logique du lexique métier (1 par diagnostic standard + transverses). */
export type JargonSection =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'mesurage'
  | 'erp'
  | 'batiment'
  | 'marques'
  | 'administratif'

/** Sous-catégorie d'une section (label libre). */
export type JargonSubcategory = string

/** Map sous-catégorie → liste de termes français (verbatim). */
export type JargonCategoryMap = Readonly<Record<JargonSubcategory, readonly string[]>>

/** Lexique complet par section. */
export type DiagnosticJargon = Readonly<Record<JargonSection, JargonCategoryMap>>

// ---------------------------------------------------------------------------
// Lexique complet — DIAGNOSTIC_JARGON
// ---------------------------------------------------------------------------

export const DIAGNOSTIC_JARGON: DiagnosticJargon = {
  // -------------------------------------------------------------------------
  // DPE — Diagnostic de Performance Énergétique
  // -------------------------------------------------------------------------
  dpe: {
    methode: [
      '3CL',
      '3CL-DPE-2021',
      'méthode 3CL',
      'méthode conventionnelle',
      'DPE collectif',
      'DPE individuel',
      'DPE tertiaire',
      'audit énergétique réglementaire',
    ],
    indicateurs: [
      'kWhEP/m².an',
      'kWh/m²/an',
      'kgCO2/m².an',
      'kgCO2eq/m².an',
      'consommation énergie primaire',
      'consommation énergie finale',
      'Cep',
      'Cef',
      'Cep,max',
      'GES',
      'gaz à effet de serre',
      'émissions CO2',
      'coefficient de conversion',
      'facteur 2,3',
      'besoin de chauffage',
      'besoin ECS',
      'besoin refroidissement',
      'consommation auxiliaires',
      'éclairage forfaitaire',
    ],
    etiquettes: [
      'étiquette A',
      'étiquette B',
      'étiquette C',
      'étiquette D',
      'étiquette E',
      'étiquette F',
      'étiquette G',
      'classe A',
      'classe B',
      'classe C',
      'classe D',
      'classe E',
      'classe F',
      'classe G',
      'logement décent',
      'passoire thermique',
      'passoire énergétique',
      'logement énergivore',
    ],
    parois: [
      'Uw',
      'Uf',
      'Ug',
      'Up',
      'Uc',
      'Ubat',
      'coefficient de transmission thermique',
      'résistance thermique R',
      'pont thermique',
      'pont thermique linéaire',
      'pont thermique ponctuel',
      'ψ psi',
      'mur extérieur',
      'mur de refend',
      'mur mitoyen',
      'plancher bas',
      'plancher haut',
      'plancher intermédiaire',
      'toiture',
      'combles perdus',
      'combles aménagés',
      'rampants',
      'ITE',
      "isolation thermique par l'extérieur",
      'ITI',
      "isolation thermique par l'intérieur",
      'ITR',
      'isolation thermique répartie',
      'sarking',
    ],
    chauffage: [
      'chaudière',
      'chaudière gaz',
      'chaudière fioul',
      'chaudière condensation',
      'chaudière basse température',
      'chaudière mixte',
      'chaudière bois',
      'chaudière granulés',
      'chaudière micro-cogénération',
      'pompe à chaleur',
      'PAC',
      'PAC air-air',
      'PAC air-eau',
      'PAC eau-eau',
      'PAC sol-eau',
      'PAC géothermique',
      'PAC réversible',
      'COP',
      'coefficient de performance',
      'SCOP',
      'EER',
      'SEER',
      'poêle à granulés',
      'poêle à bois',
      'poêle à pétrole',
      'insert',
      'foyer fermé',
      'foyer ouvert',
      'radiateur électrique',
      'convecteur',
      'panneau rayonnant',
      'radiateur à inertie',
      'radiateur fluide caloporteur',
      'plancher chauffant',
      'plafond rayonnant',
      'sèche-serviettes',
      'cheminée à foyer fermé',
      'cheminée à foyer ouvert',
    ],
    ecs: [
      'ECS',
      'eau chaude sanitaire',
      'ballon ECS',
      'ballon électrique',
      'cumulus',
      'chauffe-eau électrique',
      'chauffe-eau thermodynamique',
      'CET',
      'chauffe-eau solaire individuel',
      'CESI',
      'système solaire combiné',
      'SSC',
      'ballon thermodynamique',
      'production ECS instantanée',
      'production ECS accumulation',
      'ECS solaire',
      'préparateur ECS',
    ],
    ventilation: [
      'VMC',
      'ventilation mécanique contrôlée',
      'VMC simple flux',
      'VMC simple flux autoréglable',
      'VMC simple flux hygroréglable A',
      'VMC simple flux hygroréglable B',
      'VMC hygro A',
      'VMC hygro B',
      'VMC double flux',
      'VMC double flux thermodynamique',
      'VMR',
      'ventilation mécanique répartie',
      'VMI',
      'ventilation mécanique par insufflation',
      'ventilation naturelle',
      'ventilation par tirage thermique',
      "entrée d'air",
      "bouche d'extraction",
      'caisson VMC',
      'échangeur thermique',
    ],
    isolation: [
      'laine de verre',
      'laine de roche',
      'laine minérale',
      'laine de bois',
      'fibre de bois',
      'ouate de cellulose',
      'chanvre',
      'liège',
      'paille',
      'polystyrène expansé',
      'PSE',
      'polystyrène extrudé',
      'XPS',
      'polyuréthane',
      'PUR',
      'PIR',
      'polyisocyanurate',
      'mousse phénolique',
      'verre cellulaire',
      'panneau isolant sous vide',
      'PIV',
      'isolant biosourcé',
      'isolant mince réfléchissant',
      'IMR',
      "épaisseur d'isolant",
      'lambda',
      'λ',
      'conductivité thermique',
    ],
    fenetres: [
      'simple vitrage',
      'double vitrage',
      'double vitrage faiblement émissif',
      'double vitrage VIR',
      'double vitrage argon',
      'double vitrage à isolation renforcée',
      'triple vitrage',
      'survitrage',
      'menuiserie bois',
      'menuiserie PVC',
      'menuiserie aluminium',
      'menuiserie alu rupture de pont thermique',
      'menuiserie mixte bois-alu',
      'fenêtre de toit',
      'verrière',
      'volet roulant',
      'volet battant',
      'volet persienne',
      'volet isolant',
      "porte d'entrée isolante",
    ],
  },

  // -------------------------------------------------------------------------
  // AMIANTE
  // -------------------------------------------------------------------------
  amiante: {
    types_mission: [
      'DAPP',
      'dossier amiante parties privatives',
      'DTA',
      'dossier technique amiante',
      'DAAT',
      'diagnostic amiante avant travaux',
      'DAAD',
      'diagnostic amiante avant démolition',
      'Mission A',
      'Mission B',
      'Mission B1',
      'Mission B2',
      'repérage amiante vente',
      'repérage amiante location',
      'repérage amiante avant travaux',
      'fiche récapitulative DTA',
    ],
    materiaux: [
      'MPCA',
      "matériau ou produit contenant de l'amiante",
      'matériau amianté',
      'flocage',
      'calorifugeage',
      'faux plafond',
      'dalle vinyle amiante',
      'dalle de sol',
      'colle bitumineuse',
      'colle noire',
      'fibrociment',
      'plaque ondulée fibrociment',
      'plaque éverite',
      'ardoise fibrociment',
      'ardoise amiantée',
      'canalisation fibrociment',
      'enduit projeté',
      'enduit à la colle',
      'mortier-colle',
      'joint de carrelage',
      "mastic d'étanchéité",
      'joint de fenêtre',
      'joint de chaudière',
      'tresse amiantée',
      'carton amianté',
      'fil étoupe',
      'plaque vinyle amiante',
      'chrysotile',
      'amosite',
      'crocidolite',
      'amiante blanc',
      'amiante brun',
      'amiante bleu',
      'fibre courte',
      'fibre fine',
      'fibre amiante',
    ],
    process: [
      'META',
      'microscopie électronique à transmission analytique',
      'MOLP',
      'microscopie optique en lumière polarisée',
      'prélèvement représentatif',
      'analyse en laboratoire COFRAC',
      'laboratoire COFRAC',
      'liste A',
      'liste B',
      'liste C',
      'évaluation périodique EVA',
      'EP',
      'évaluation périodique',
      "mesure d'empoussièrement",
      "mesure d'air",
      'fibre par litre',
      'f/L',
      'seuil 5 f/L',
      "niveau d'empoussièrement",
      'sous-section 3',
      'sous-section 4',
      'SS3',
      'SS4',
      'plan de retrait',
      'plan de démolition',
      'confinement',
      'encapsulage',
      'recouvrement',
    ],
    reglementation: [
      'avant 1er juillet 1997',
      'permis de construire antérieur à 1997',
      'décret n° 96-97',
      'décret n° 2011-629',
      'code de la santé publique R1334',
      'code du travail R4412',
      'arrêté du 26 juin 2013',
      'arrêté du 12 décembre 2012',
      'norme NF X46-020',
      'norme NF X46-021',
      "certification de l'opérateur",
      'opérateur de repérage certifié',
    ],
  },

  // -------------------------------------------------------------------------
  // PLOMB CREP
  // -------------------------------------------------------------------------
  plomb: {
    abreviations: [
      'CREP',
      "constat de risque d'exposition au plomb",
      'DRIPP',
      "diagnostic de risque d'intoxication par le plomb des peintures",
      'CRPE',
    ],
    techniques: [
      'fluorescence X',
      'analyseur XRF',
      'pistolet XRF',
      'mg/cm²',
      'milligramme par centimètre carré',
      'seuil 1 mg/cm²',
      'prélèvement et analyse en laboratoire',
      'unité de diagnostic',
      'UD',
      'sondage sur peinture',
      'support enduit plâtre',
      'support bois peint',
      'support métal peint',
    ],
    etats: [
      'écaillage',
      'cloquage',
      'farinage',
      'pulvérulence',
      'fissuration',
      'croûte',
      "état d'usage",
      'état dégradé',
      'état non dégradé',
      'révélateur de dégradation',
      'surface impactée',
      'menuiserie écaillée',
    ],
    parties: [
      'plinthe',
      'huisserie',
      'dormant',
      'ouvrant',
      'imposte',
      "rampe d'escalier",
      'limon',
      'contremarche',
      'volet intérieur',
      'embrasure',
      'allège',
      'tableau de fenêtre',
      'cimaise',
      'lambris',
      'soubassement peint',
    ],
    reglementation: [
      'antérieur à 1949',
      'immeuble construit avant 1949',
      'permis de construire avant 1er janvier 1949',
      'décret n° 2006-474',
      'arrêté du 19 août 2011',
      'norme NF X46-030',
      "notice d'information ARS",
      'saturnisme',
    ],
  },

  // -------------------------------------------------------------------------
  // GAZ
  // -------------------------------------------------------------------------
  gaz: {
    abreviations: [
      'GN',
      'gaz naturel',
      'GPL',
      'gaz de pétrole liquéfié',
      'propane',
      'butane',
      'GRDF',
      'gaz réseau distribution France',
      'PCS',
      'pouvoir calorifique supérieur',
    ],
    elements: [
      'OCG',
      'organe de coupure générale',
      'PDL',
      'point de livraison',
      'compteur gaz',
      'détendeur',
      'détendeur-régulateur',
      'robinet de commande',
      "robinet d'arrêt",
      'tuyauterie fixe',
      'tuyau souple',
      'tuyau flexible à durée illimitée',
      'tube cuivre',
      'tube acier',
      'PE',
      'polyéthylène',
      'piquage',
      'siphon disconnecteur',
      'ventouse',
      'ventouse horizontale',
      'ventouse verticale',
      'conduit de fumée',
      'tubage inox',
      'gaine technique gaz',
      'GTG',
      'chaudière étanche',
      'chaudière à ventouse',
      'chaudière type B',
      'chaudière type C',
      'évacuation des produits de combustion',
      "amenée d'air comburant",
    ],
    anomalies: [
      'A1',
      'A2',
      'DGI',
      'danger grave et immédiat',
      'CO',
      'monoxyde de carbone',
      'fuite gaz',
      'odeur gaz',
      "défaut d'étanchéité",
      'corrosion conduit',
      'absence ventouse',
      'défaut combustion',
      'flamme jaune',
      'flamme bleue',
      'refoulement',
      'tirage insuffisant',
      'condamnation tuyau souple périmé',
    ],
    reglementation: [
      'NF P 45-500',
      'arrêté du 6 avril 2007',
      'arrêté du 23 février 2018',
      'opérateur certifié gaz',
      'certificat de conformité Qualigaz',
      'Qualigaz',
      'installation intérieure de gaz',
      'plus de 15 ans',
    ],
  },

  // -------------------------------------------------------------------------
  // ÉLECTRICITÉ
  // -------------------------------------------------------------------------
  electricite: {
    abreviations: [
      'AGCP',
      'appareil général de commande et de protection',
      'DDR',
      'dispositif différentiel à courant résiduel',
      'GTL',
      'gaine technique logement',
      'ETEL',
      'espace technique électrique du logement',
      'TGBT',
      'tableau général basse tension',
      'IP',
      'indice de protection',
      'IK',
      'indice de chocs mécaniques',
      'TBT',
      'très basse tension',
      'TBTS',
      'très basse tension de sécurité',
    ],
    elements: [
      'disjoncteur de branchement',
      'disjoncteur différentiel',
      'disjoncteur divisionnaire',
      'inter-différentiel',
      'interrupteur sectionneur',
      'fusible',
      'porte-fusible',
      'fusible à cartouche',
      'parafoudre',
      'LEP',
      'liaison équipotentielle principale',
      'LES',
      'liaison équipotentielle supplémentaire',
      'prise de terre',
      'piquet de terre',
      'borne principale de terre',
      'BPT',
      'résistance de terre',
      'conducteur de protection PE',
      'conducteur de neutre',
      'phase neutre terre',
      'tableau de répartition',
      'rangée modulaire',
      'peigne de raccordement',
      'rail DIN',
      'goulotte électrique',
      'plinthe technique',
      'gaine ICTA',
      'gaine TPC',
      'boîte de dérivation',
      'prise 2P+T',
      'prise terre',
      'prise commandée',
      'prise spécialisée 32A',
      'circuit spécialisé',
      'circuit prises',
      'circuit éclairage',
      'éclairage de sécurité',
      'bloc autonome BAES',
    ],
    anomalies: [
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'B6',
      'B7',
      'B8',
      'B9',
      'B10',
      'B11',
      'contact direct',
      'contact indirect',
      'surintensité',
      'court-circuit',
      'absence de prise de terre',
      'absence de différentiel 30 mA',
      'matériel vétuste',
      'fil dénudé',
      'volume 0',
      'volume 1',
      'volume 2',
      'volume hors zone',
      "sécurité salle d'eau",
      'IPX1',
      'IPX4',
      'IPX5',
    ],
    reglementation: [
      'NF C 15-100',
      'NF C 14-100',
      'NF C 16-600',
      'arrêté du 28 septembre 2017',
      'plus de 15 ans',
      'installation électrique intérieure',
      'opérateur certifié électricité',
      'attestation Consuel',
      'Consuel',
    ],
  },

  // -------------------------------------------------------------------------
  // TERMITES & PARASITES DU BOIS
  // -------------------------------------------------------------------------
  termites: {
    insectes: [
      'termite',
      'reticulitermes',
      'reticulitermes lucifugus',
      'reticulitermes flavipes',
      'reticulitermes santonensis',
      'termite souterrain',
      'capricorne',
      'capricorne des maisons',
      'hespérophane',
      'hespérophane cinerea',
      'hespérophane bungii',
      'vrillette',
      'petite vrillette',
      'grosse vrillette',
      'vrillette du parquet',
      'lyctus',
      'lyctus brunneus',
      'sirex',
      'fourmi charpentière',
      'mérule',
      'mérule pleureuse',
      'serpula lacrymans',
      'coniophore',
      'coniophora puteana',
      'champignon lignivore',
      'pourriture cubique',
      'pourriture fibreuse',
      'pourriture molle',
    ],
    indices: [
      'galerie',
      'galerie larvaire',
      'cordonnet',
      'cordonnet terreux',
      'cordonnet de termites',
      'cheminement',
      'vermoulure',
      'sciure',
      'frass',
      "trou d'envol",
      'trou de sortie',
      'orifice de sortie',
      'attaque ancienne',
      'attaque active',
      'attaque résiduelle',
      'présence active',
      'mycélium',
      'sporophore',
      'rhizomorphe',
      'humidité bois',
      "taux d'humidité",
      'bois altéré',
      'bois déliquescent',
    ],
    elements_inspectes: [
      'charpente',
      'charpente fermette',
      'charpente traditionnelle',
      'ferme',
      'arbalétrier',
      'entrait',
      'panne',
      'chevron',
      'solive',
      'solivage',
      'poutre',
      'poutre maîtresse',
      'lambourde',
      'plancher bois',
      'parquet',
      'plinthe',
      'escalier bois',
      'huisserie bois',
      'bardage',
      'cloison ossature bois',
      'pied de poteau',
      'tête de poteau',
      'sablière',
      'lambris',
      'volet bois',
      'porte bois',
    ],
  },

  // -------------------------------------------------------------------------
  // MESURAGE (Carrez / Boutin / SHON / SHOB)
  // -------------------------------------------------------------------------
  mesurage: {
    loi_carrez: [
      'loi Carrez',
      'surface privative loi Carrez',
      'surface Carrez',
      'attestation Carrez',
      'mesurage Carrez',
      'exclusion Carrez',
      'sous-pente 1m80',
      'hauteur sous plafond inférieure à 1,80 m',
      'surface utile privative',
      'lot de copropriété',
      'mezzanine',
      'comble aménagé',
    ],
    loi_boutin: [
      'loi Boutin',
      'surface habitable',
      'surface habitable loi Boutin',
      'attestation Boutin',
      'mesurage Boutin',
      'surface plancher',
      'logement nu',
      "bail d'habitation",
    ],
    techniques: [
      'télémètre laser',
      'Leica Disto',
      'Leica DISTO',
      'Bosch GLM',
      'Stabila LD',
      'mètre ruban',
      'décamètre',
      'pige télescopique',
      'croquis coté',
      'plan coté',
      'hauteur sous plafond',
      'HSP',
      'sous-pente',
      'embrasure',
      'tableau',
      'SHON',
      'surface hors œuvre nette',
      'SHOB',
      'surface hors œuvre brute',
      'SDP',
      'surface de plancher',
      'emprise au sol',
    ],
  },

  // -------------------------------------------------------------------------
  // ERP (État des Risques et Pollutions)
  // -------------------------------------------------------------------------
  erp: {
    abreviations: [
      'ERP',
      'état des risques et pollutions',
      'ERNMT',
      'état des risques naturels miniers et technologiques',
      'IAL',
      'information acquéreur locataire',
      'ESRIS',
      'état des servitudes risques et informations sur les sols',
      'PPRI',
      'plan de prévention des risques inondation',
      'PPRT',
      'plan de prévention des risques technologiques',
      'PPRN',
      'plan de prévention des risques naturels',
      'PPRM',
      'plan de prévention des risques miniers',
      'TRI',
      "territoire à risque important d'inondation",
      'BASOL',
      'base de données BASOL',
      'BASIAS',
      'base de données BASIAS',
      'SIS',
      "secteur d'information sur les sols",
    ],
    risques: [
      'risque inondation',
      'risque crue',
      'submersion marine',
      'remontée de nappe',
      'risque sismique',
      'zone sismique 1',
      'zone sismique 2',
      'zone sismique 3',
      'zone sismique 4',
      'zone sismique 5',
      'SEVESO',
      'SEVESO seuil bas',
      'SEVESO seuil haut',
      'risque industriel',
      'risque nucléaire',
      'risque transport matières dangereuses',
      'TMD',
      'risque feu de forêt',
      'risque mouvement de terrain',
      'retrait gonflement des argiles',
      'aléa argile faible',
      'aléa argile moyen',
      'aléa argile fort',
      'cavité souterraine',
      'carrière souterraine',
      'effondrement',
      'glissement de terrain',
      'éboulement',
      'avalanche',
      'cyclone',
      'radon',
      'potentiel radon catégorie 1',
      'potentiel radon catégorie 2',
      'potentiel radon catégorie 3',
      'pollution des sols',
      'site et sol pollué',
    ],
  },

  // -------------------------------------------------------------------------
  // BÂTIMENT (structures, matériaux, second œuvre)
  // -------------------------------------------------------------------------
  batiment: {
    structures: [
      'parpaing',
      'parpaing creux',
      'bloc béton',
      'aggloméré ciment',
      'brique creuse',
      'brique pleine',
      'brique monomur',
      'monomur terre cuite',
      'béton banché',
      'béton armé',
      'voile béton',
      'pierre',
      'pierre de taille',
      'moellon',
      'meulière',
      'meulière brute',
      'pisé',
      'pisé de terre',
      'bauge',
      'torchis',
      'colombages',
      'pan de bois',
      'ossature bois',
      'MOB',
      'maison ossature bois',
      'CLT',
      'cross laminated timber',
      'bois lamellé-collé',
      'BLC',
      'panneau sandwich',
      'maçonnerie traditionnelle',
      'mur porteur',
      'mur de refend',
      'mur pignon',
      'mur de façade',
      'soubassement',
      'fondation',
      'longrine',
      'semelle filante',
      'radier',
    ],
    couvertures: [
      'tuile mécanique',
      'tuile canal',
      'tuile romane',
      'tuile plate',
      'tuile en terre cuite',
      'ardoise naturelle',
      'ardoise fibrociment',
      'zinc',
      'cuivre',
      'bac acier',
      'shingle',
      'bardeau bitumé',
      'lauze',
      'chaume',
      'toiture-terrasse',
      'toiture végétalisée',
      'gouttière',
      'chéneau',
      "descente d'eaux pluviales",
      'noue',
      'arêtier',
      'faîtage',
      'égout de toiture',
    ],
    planchers: [
      'plancher bois',
      'plancher hourdis',
      'hourdis béton',
      'hourdis polystyrène',
      'poutrelle hourdis',
      'dalle béton',
      'dalle pleine',
      'dalle alvéolaire',
      'plancher collaborant',
      'vide sanitaire',
      'cave',
      'sous-sol',
      'cave en terre battue',
      'plancher chauffant',
      'chape',
      'chape liquide',
      'chape ciment',
      'chape anhydrite',
    ],
    autres: [
      'mitoyenneté',
      'mur mitoyen',
      'fosse septique',
      'fosse toutes eaux',
      "micro-station d'épuration",
      'assainissement non collectif',
      'ANC',
      'SPANC',
      "tout à l'égout",
      'assainissement collectif',
      'eaux pluviales',
      'eaux usées',
      'eaux vannes',
      'raccordement réseau',
      "compteur d'eau",
      'puits',
      "récupérateur d'eau de pluie",
      'cheminée',
      'conduit de fumée',
      'souche de cheminée',
      'tubage',
      'garde-corps',
      'rambarde',
      'main courante',
      'véranda',
      'pergola',
      'abri de jardin',
    ],
  },

  // -------------------------------------------------------------------------
  // MARQUES (équipements rencontrés sur le terrain)
  // -------------------------------------------------------------------------
  marques: {
    chaudieres: [
      'Vaillant',
      'Saunier Duval',
      'Frisquet',
      'De Dietrich',
      'Viessmann',
      'ELM Leblanc',
      'Chappée',
      'Buderus',
      'Ariston',
      'Atlantic',
      'Geminox',
      'Weishaupt',
      'Wolf',
      'Bosch Thermotechnologie',
      'Baxi',
      'Riello',
      'Oertli',
    ],
    pac: [
      'Daikin',
      'Mitsubishi Electric',
      'Mitsubishi Heavy',
      'Atlantic',
      'Toshiba',
      'Panasonic',
      'Hitachi',
      'LG',
      'Samsung',
      'Fujitsu',
      'Stiebel Eltron',
      'Aldes',
      'Thermor',
      'Auer',
      'CIAT',
    ],
    fenetres: [
      'Velux',
      'Roto',
      'Fakro',
      'Lapeyre',
      'Tryba',
      'K-Line',
      'Schüco',
      'Internorm',
      'Bieber',
      'Janneau',
      'Atrya',
      'Bouvet',
      'Solabaie',
      'Art & Fenêtres',
    ],
    tableau: [
      'Schneider Electric',
      'Schneider',
      'Hager',
      'Legrand',
      'ABB',
      'Siemens',
      'General Electric',
      'Eaton',
      'Merlin Gerin',
      'Resi9',
      'XL3',
      'Drivia',
    ],
  },

  // -------------------------------------------------------------------------
  // ADMINISTRATIF (acteurs, documents, opérations de rénovation)
  // -------------------------------------------------------------------------
  administratif: {
    acteurs: [
      'mandant',
      'mandataire',
      "donneur d'ordre",
      'propriétaire',
      'copropriétaire',
      'bailleur',
      'locataire',
      'acquéreur',
      'vendeur',
      'syndic',
      'syndic de copropriété',
      'syndicat des copropriétaires',
      'conseil syndical',
      'gestionnaire',
      'agence immobilière',
      'notaire',
      'clerc de notaire',
      'curateur',
      'tuteur',
      'mandataire judiciaire',
      'expert judiciaire',
      'expert immobilier',
      "maître d'œuvre",
      "maître d'ouvrage",
      'AMO',
      "assistant à maîtrise d'ouvrage",
      'architecte',
      "bureau d'études thermiques",
      'BET',
      'diagnostiqueur immobilier certifié',
    ],
    documents: [
      'compromis de vente',
      'promesse de vente',
      'avant-contrat',
      'acte authentique',
      "bail d'habitation",
      'bail commercial',
      'bail meublé',
      'état des lieux',
      'EDL',
      'règlement de copropriété',
      'état descriptif de division',
      'EDD',
      "PV d'assemblée générale",
      'procès-verbal AG',
      'PV AG',
      "carnet d'entretien",
      'carnet numérique du logement',
      'DPE existant',
      'ancien DPE',
      'titre de propriété',
      'extrait cadastral',
      'plan cadastral',
      'matrice cadastrale',
      "certificat d'urbanisme",
      'CU',
      'permis de construire',
      'PC',
      'déclaration préalable',
      'DP',
      'attestation thermique',
      'RT 2012',
      'RE 2020',
    ],
    operations: [
      "MaPrimeRénov'",
      "MaPrimeRénov' Sérénité",
      "MaPrimeRénov' Copropriété",
      'CEE',
      "certificats d'économies d'énergie",
      'prime CEE',
      'coup de pouce CEE',
      'éco-PTZ',
      'éco-prêt à taux zéro',
      'prêt avance rénovation',
      'TVA à 5,5%',
      'TVA réduite',
      'BAR-TH-104',
      'BAR-TH-112',
      'BAR-TH-113',
      'BAR-TH-129',
      'BAR-TH-143',
      'BAR-EN-101',
      'BAR-EN-102',
      'BAR-EN-103',
      'BAR-EN-104',
      'BAR-EN-106',
      "fiche d'opération standardisée",
      'rénovation globale',
      'rénovation par geste',
      'audit énergétique incitatif',
      "mon accompagnateur Rénov'",
      "France Rénov'",
      'ANAH',
      "agence nationale de l'habitat",
    ],
  },
}

// ---------------------------------------------------------------------------
// Mappings utilitaires
// ---------------------------------------------------------------------------

/**
 * Mapping mission type DB → section logique du lexique.
 * Permet d'accepter en entrée soit des sections (`dpe`, `amiante`) soit
 * des mission types (`dpe_vente`, `amiante_avant_travaux`).
 */
const MISSION_TYPE_TO_SECTION: Readonly<Record<string, JargonSection>> = {
  dpe_vente: 'dpe',
  dpe_location: 'dpe',
  copropriete: 'dpe',
  amiante_vente: 'amiante',
  amiante_avant_travaux: 'amiante',
  plomb_crep: 'plomb',
  gaz: 'gaz',
  electricite: 'electricite',
  termites: 'termites',
  carrez_boutin: 'mesurage',
  erp: 'erp',
}

/** Toutes les sections valides (clés de DIAGNOSTIC_JARGON). */
const VALID_SECTIONS = new Set<JargonSection>(Object.keys(DIAGNOSTIC_JARGON) as JargonSection[])

/**
 * Sections transverses ajoutées par défaut à toute mission terrain :
 * - `mesurage` : surfaces toujours impliquées
 * - `batiment` : structures rencontrées universellement
 * - `marques` : équipements identifiés (chaudières, PAC, tableau, fenêtres)
 * - `administratif` : acteurs et documents (mandant, syndic, notaire...)
 */
const ALWAYS_ON_SECTIONS: readonly JargonSection[] = [
  'mesurage',
  'batiment',
  'marques',
  'administratif',
]

/**
 * Convertit une entrée (mission type DB ou section logique) en section valide.
 * Retourne null si non reconnu (silencieusement ignoré).
 */
function resolveSection(input: string): JargonSection | null {
  if (VALID_SECTIONS.has(input as JargonSection)) {
    return input as JargonSection
  }
  return MISSION_TYPE_TO_SECTION[input] ?? null
}

/**
 * Pour une section, retourne la liste plate de tous les termes
 * (concaténation de toutes les sous-catégories).
 */
function flattenSection(section: JargonSection): readonly string[] {
  const categories = DIAGNOSTIC_JARGON[section]
  const result: string[] = []
  for (const subcategoryTerms of Object.values(categories)) {
    result.push(...subcategoryTerms)
  }
  return result
}

/**
 * Sous-ensemble des termes "les plus distinctifs" par section.
 * Ce sont les abréviations / acronymes / termes rares qui font le plus
 * gagner Whisper à dimension budget tokens limitée (224 max).
 *
 * Stratégie : 6 à 10 termes par section ciblée + 10 communs.
 */
const HIGH_SIGNAL_TERMS: Readonly<Record<JargonSection, readonly string[]>> = {
  dpe: [
    '3CL-DPE-2021',
    'kWhEP/m².an',
    'Cep',
    'Ubat',
    'PAC air-eau',
    'COP',
    'CESI',
    'VMC hygroréglable',
    'ITE',
    'sarking',
  ],
  amiante: [
    'MPCA',
    'DAPP',
    'DTA',
    'DAAT',
    'flocage',
    'calorifugeage',
    'fibrociment',
    'chrysotile',
    'META',
    'COFRAC',
  ],
  plomb: [
    'CREP',
    'fluorescence X',
    'XRF',
    'mg/cm²',
    'écaillage',
    'farinage',
    'huisserie',
    'soubassement peint',
  ],
  gaz: ['OCG', 'PDL', 'ventouse', 'DGI', 'A1', 'A2', 'Qualigaz', 'tubage inox'],
  electricite: [
    'AGCP',
    'DDR',
    'GTL',
    'ETEL',
    'TGBT',
    'LEP',
    'LES',
    'Consuel',
    'NF C 15-100',
    'volume 0',
  ],
  termites: [
    'reticulitermes',
    'capricorne',
    'hespérophane',
    'vrillette',
    'lyctus',
    'mérule',
    'serpula lacrymans',
    'cordonnet',
    'vermoulure',
    'sporophore',
  ],
  mesurage: [
    'loi Carrez',
    'loi Boutin',
    'Leica Disto',
    'Bosch GLM',
    'SHON',
    'SHOB',
    'sous-pente 1m80',
  ],
  erp: [
    'ERP',
    'ERNMT',
    'IAL',
    'PPRI',
    'PPRT',
    'BASOL',
    'BASIAS',
    'SEVESO',
    'radon',
    'retrait gonflement des argiles',
  ],
  batiment: [
    'parpaing',
    'monomur',
    'meulière',
    'pisé',
    'torchis',
    'pan de bois',
    'CLT',
    'hourdis',
    'vide sanitaire',
  ],
  marques: [
    'Vaillant',
    'Saunier Duval',
    'De Dietrich',
    'Viessmann',
    'Daikin',
    'Mitsubishi',
    'Atlantic',
    'Velux',
    'Tryba',
    'Schneider',
    'Hager',
    'Legrand',
  ],
  administratif: [
    'mandant',
    'syndic',
    'notaire',
    'compromis',
    'PV AG',
    "MaPrimeRénov'",
    'CEE',
    'éco-PTZ',
    'BAR-TH-104',
  ],
}

// ---------------------------------------------------------------------------
// Builders publics
// ---------------------------------------------------------------------------

/** Limite de tokens pour le `prompt` Whisper (cf. doc OpenAI). */
const WHISPER_PROMPT_TOKEN_BUDGET = 224

/**
 * Estimation grossière du nombre de tokens (modèle BPE GPT-like) :
 * - français : ~0,75 mots/token effectif → 1 mot ≈ 1,3 tokens
 * - on prend une marge : 1 terme ≈ 2 tokens (compte les espaces / sous-mots)
 *
 * Cette heuristique reste prudente pour ne jamais dépasser le budget.
 */
function estimateTokens(text: string): number {
  // Heuristique : 1 token ≈ 3,5 caractères en français
  return Math.ceil(text.length / 3.5)
}

/**
 * Construit le `prompt` Whisper enrichi du vocabulaire métier.
 *
 * Stratégie :
 * 1. Sections demandées résolues (mission types ou sections directes)
 * 2. Sections transverses (mesurage, batiment, marques, administratif) toujours ajoutées
 * 3. On prend les termes "high-signal" par section (50-80 termes au total)
 * 4. On tronque pour rester sous WHISPER_PROMPT_TOKEN_BUDGET (224 tokens)
 *
 * @param diagnostics Mission types DB (`dpe_vente`, `amiante_vente`...) OU
 *                    sections logiques (`dpe`, `amiante`...). Mix accepté.
 * @returns Prompt string formaté pour Whisper.
 */
export function buildWhisperPrompt(diagnostics: readonly string[]): string {
  const sections = new Set<JargonSection>()
  for (const d of diagnostics) {
    const resolved = resolveSection(d)
    if (resolved) sections.add(resolved)
  }
  for (const s of ALWAYS_ON_SECTIONS) sections.add(s)

  // Collecte ordonnée : sections explicites d'abord (priorité), puis transverses
  const orderedSections: JargonSection[] = []
  for (const d of diagnostics) {
    const resolved = resolveSection(d)
    if (resolved && !orderedSections.includes(resolved)) orderedSections.push(resolved)
  }
  for (const s of ALWAYS_ON_SECTIONS) {
    if (!orderedSections.includes(s)) orderedSections.push(s)
  }

  const allTerms: string[] = []
  const seen = new Set<string>()
  for (const section of orderedSections) {
    for (const term of HIGH_SIGNAL_TERMS[section]) {
      if (!seen.has(term)) {
        seen.add(term)
        allTerms.push(term)
      }
    }
  }

  // Préfixe contextuel
  const prefix = 'Diagnostic immobilier français : '
  const suffix = '.'
  const budgetForTerms = WHISPER_PROMPT_TOKEN_BUDGET - estimateTokens(prefix + suffix)

  // Greedy fill jusqu'au budget
  const selected: string[] = []
  let usedTokens = 0
  for (const term of allTerms) {
    const termTokens = estimateTokens(term + ', ')
    if (usedTokens + termTokens > budgetForTerms) break
    selected.push(term)
    usedTokens += termTokens
  }

  return `${prefix}${selected.join(', ')}${suffix}`
}

/**
 * Construit un bloc texte structuré injectable dans le system prompt Claude.
 *
 * Format :
 *
 *     VOCABULAIRE MÉTIER À CONNAÎTRE :
 *     --- DPE ---
 *     methode: 3CL, 3CL-DPE-2021, ...
 *     indicateurs: kWhEP/m².an, Cep, GES, ...
 *     ...
 *     --- AMIANTE ---
 *     types_mission: DAPP, DTA, ...
 *     ...
 *
 * @param diagnostics Mission types DB ou sections logiques. Si vide, retourne
 *                    toutes les sections (lexique complet).
 */
export function buildClaudeContextVocabulary(diagnostics: readonly string[]): string {
  const sections = new Set<JargonSection>()

  if (diagnostics.length === 0) {
    // Vide → on retourne tout le lexique (cas system prompt général)
    for (const s of VALID_SECTIONS) sections.add(s)
  } else {
    for (const d of diagnostics) {
      const resolved = resolveSection(d)
      if (resolved) sections.add(resolved)
    }
    // Sections transverses systématiques
    for (const s of ALWAYS_ON_SECTIONS) sections.add(s)
  }

  const lines: string[] = ['VOCABULAIRE MÉTIER À CONNAÎTRE :']
  // Ordre stable : suit l'ordre déclaratif de DIAGNOSTIC_JARGON
  for (const section of Object.keys(DIAGNOSTIC_JARGON) as JargonSection[]) {
    if (!sections.has(section)) continue
    lines.push('')
    lines.push(`--- ${section.toUpperCase()} ---`)
    const categories = DIAGNOSTIC_JARGON[section]
    for (const [subcategory, terms] of Object.entries(categories)) {
      lines.push(`${subcategory}: ${terms.join(', ')}`)
    }
  }

  return lines.join('\n')
}

/**
 * Helper exposé pour tests / debug : aplatit tout le lexique en liste de termes.
 */
export function getAllJargonTerms(): readonly string[] {
  const out: string[] = []
  for (const section of Object.keys(DIAGNOSTIC_JARGON) as JargonSection[]) {
    out.push(...flattenSection(section))
  }
  return out
}
