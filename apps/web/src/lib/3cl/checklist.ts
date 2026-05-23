/**
 * KOVAS — Checklist 3CL-DPE 2021 embarquée (lot MISSION-C).
 *
 * Source : Méthode de calcul 3CL-DPE 2021 publiée par l'ADEME / Ministère
 * de la Transition Écologique (arrêté du 31 mars 2021, JO du 13 avril 2021).
 * Référentiel applicable à tous les DPE de logements existants depuis le
 * 01/07/2021 (mise à jour 14/04/2024 pour petites surfaces).
 *
 * Pourquoi cette lib existe :
 *   1. Un DPE valide exige ~200 champs structurés. Un défaut de saisie =
 *      la méthode 3CL applique une valeur "par défaut" pénalisante (souvent
 *      la pire hypothèse) → étiquette dégradée à tort → recours du client.
 *   2. Le brief Benjamin (avatar diagnostiqueur expérimenté) identifie ce
 *      "piège des valeurs par défaut" comme la 1ère source de litige.
 *   3. La checklist permet à KOVAS de garantir la complétude AVANT export
 *      vers Liciel (Phase 1) ou avant calcul interne (Phase 2 ADEME).
 *
 * Convention :
 *   - `key` est un chemin technique pointé `bati.annee_construction` qui
 *     mappe directement vers `dossier_field_values.field_path` côté DB.
 *   - `defaultValuePitfall` documente explicitement le piège métier — sert
 *     dans le récap visuel pour expliquer pourquoi le champ est critique.
 *   - `applicableTo` permet de scoper les champs par type de pièce
 *     (ex: "douche_baignoire" applicable uniquement à 'bathroom').
 *   - `required: true` = champ obligatoire pour DPE valide. Un required non
 *     rempli déclenche un risk flag (badge ambre sur la pièce + alerte récap).
 *
 * Total : 224 champs (cf. brief MISSION-C cible 200+).
 *
 * Authority : CLAUDE.md §3 features 5+7 (check-lists + validation cohérence).
 */

import type { RoomType } from '@/lib/mission/room-completion'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Catégorie 3CL canonique d'un champ checklist.
 * Aligné sur la structure du moteur 3CL-DPE 2021 (10 chapitres).
 */
export type CheckCategory =
  | 'general' // identification bien, méta (24 champs)
  | 'bati' // bâti / enveloppe (24 champs)
  | 'menuiseries' // menuiseries opaques (portes, etc.) — 12 champs
  | 'parois_vitrees' // baies, fenêtres, parois translucides — 32 champs
  | 'chauffage' // production + distribution + émission — 38 champs
  | 'ecs' // eau chaude sanitaire — 16 champs
  | 'ventilation' // ventilation (naturelle/VMC) — 18 champs
  | 'climatisation' // froid — 12 champs
  | 'enr' // énergies renouvelables / photovoltaïque / solaire — 14 champs
  | 'eclairage' // éclairage tertiaire (faible impact DPE résid.) — 8 champs
  | 'ponts_thermiques' // ponts thermiques — 18 champs
  | 'pieces' // champs par pièce (surface, hauteur, etc.) — 8 champs

/** Type primitif d'un champ checklist. */
export type CheckItemType = 'enum' | 'number' | 'boolean' | 'text' | 'date'

/** Règles de validation runtime pour un champ. */
export interface CheckValidationRules {
  /** Borne mini (number) ou date ISO. */
  min?: number | string
  /** Borne maxi (number) ou date ISO. */
  max?: number | string
  /** Regex pattern (text). Sérialisé en string pour rester JSON-safe. */
  pattern?: string
}

/**
 * Item de la checklist 3CL.
 *
 * Tous les champs sont en anglais (variables) avec libellé FR.
 * Aucun `any` (CLAUDE.md §10 — TypeScript strict).
 */
export interface CheckItem {
  /** Chemin technique unique (ex: 'parois_vitrees.inclinaison'). */
  key: string
  /** Libellé FR affiché à l'utilisateur. */
  label: string
  /** Catégorie 3CL. */
  category: CheckCategory
  /** Type primitif. */
  type: CheckItemType
  /** Champ obligatoire pour DPE valide (déclenche risk flag si non rempli). */
  required: boolean
  /** Valeurs énumérées (si type === 'enum'). */
  enumValues?: readonly string[]
  /** Unité (m², kW, etc.) affichée à droite du champ. */
  unit?: string
  /** Types de pièces auxquelles ce champ s'applique. Si absent → champ global. */
  applicableTo?: readonly RoomType[]
  /**
   * Documentation du piège méthode 3CL si laissé à la valeur par défaut.
   * Vide pour les champs non-critiques.
   */
  defaultValuePitfall?: string
  /** Règles de validation runtime. */
  validationRules?: CheckValidationRules
  /** Description courte (info-bulle, prompt IA). */
  description?: string
}

// -----------------------------------------------------------------------------
// Helpers internes — factorisent les enums redondants
// -----------------------------------------------------------------------------

const YES_NO = ['oui', 'non'] as const
const ORIENTATIONS = [
  'nord',
  'nord_est',
  'est',
  'sud_est',
  'sud',
  'sud_ouest',
  'ouest',
  'nord_ouest',
] as const

// -----------------------------------------------------------------------------
// CHECK_ITEMS_3CL — 224 champs (cf. brief cible 200+)
// -----------------------------------------------------------------------------

export const CHECK_ITEMS_3CL: ReadonlyArray<CheckItem> = [
  // ============================================================
  // GENERAL — 24 champs (identification + contexte bien)
  // ============================================================
  {
    key: 'general.adresse_complete',
    label: 'Adresse complète du bien',
    category: 'general',
    type: 'text',
    required: true,
  },
  {
    key: 'general.code_postal',
    label: 'Code postal',
    category: 'general',
    type: 'text',
    required: true,
    validationRules: { pattern: '^\\d{5}$' },
  },
  {
    key: 'general.commune_insee',
    label: 'Code INSEE commune',
    category: 'general',
    type: 'text',
    required: true,
    validationRules: { pattern: '^\\d{5}$' },
    defaultValuePitfall:
      'Code INSEE manquant → zone climatique inférée par CP imprécis (H1/H2/H3).',
  },
  {
    key: 'general.zone_climatique',
    label: 'Zone climatique',
    category: 'general',
    type: 'enum',
    enumValues: ['H1a', 'H1b', 'H1c', 'H2a', 'H2b', 'H2c', 'H2d', 'H3'],
    required: true,
    defaultValuePitfall:
      'Zone climatique conditionne tous les coefficients 3CL. Par défaut = H1a (la plus pénalisante).',
  },
  {
    key: 'general.altitude_m',
    label: 'Altitude',
    category: 'general',
    type: 'number',
    unit: 'm',
    required: true,
    validationRules: { min: 0, max: 3000 },
  },
  {
    key: 'general.type_bien',
    label: 'Type de bien',
    category: 'general',
    type: 'enum',
    enumValues: ['maison_individuelle', 'appartement', 'logement_collectif_dans_immeuble'],
    required: true,
  },
  {
    key: 'general.usage',
    label: 'Usage du bien',
    category: 'general',
    type: 'enum',
    enumValues: ['residence_principale', 'residence_secondaire', 'location', 'vente'],
    required: true,
  },
  {
    key: 'general.motif_dpe',
    label: 'Motif du DPE',
    category: 'general',
    type: 'enum',
    enumValues: ['vente', 'location', 'construction_neuve', 'renouvellement', 'mise_a_jour_audit'],
    required: true,
  },
  {
    key: 'general.numero_dossier',
    label: 'N° de dossier interne',
    category: 'general',
    type: 'text',
    required: true,
  },
  {
    key: 'general.numero_lot',
    label: 'N° de lot (copropriété)',
    category: 'general',
    type: 'text',
    required: false,
  },
  {
    key: 'general.numero_etage',
    label: 'Étage du logement',
    category: 'general',
    type: 'number',
    unit: '',
    required: false,
    validationRules: { min: -3, max: 60 },
  },
  {
    key: 'general.dpe_anterieur_classe',
    label: 'Classe DPE antérieure',
    category: 'general',
    type: 'enum',
    enumValues: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'inconnue'],
    required: false,
  },
  {
    key: 'general.dpe_anterieur_date',
    label: 'Date du DPE précédent',
    category: 'general',
    type: 'date',
    required: false,
  },
  {
    key: 'general.numero_ademe_anterieur',
    label: 'N° ADEME du DPE précédent',
    category: 'general',
    type: 'text',
    required: false,
  },
  {
    key: 'general.proprietaire_nom',
    label: 'Nom du propriétaire',
    category: 'general',
    type: 'text',
    required: true,
  },
  {
    key: 'general.proprietaire_adresse',
    label: 'Adresse propriétaire (si différente)',
    category: 'general',
    type: 'text',
    required: false,
  },
  {
    key: 'general.proprietaire_telephone',
    label: 'Téléphone propriétaire',
    category: 'general',
    type: 'text',
    required: false,
  },
  {
    key: 'general.proprietaire_email',
    label: 'Email propriétaire',
    category: 'general',
    type: 'text',
    required: false,
  },
  {
    key: 'general.date_visite',
    label: 'Date de la visite terrain',
    category: 'general',
    type: 'date',
    required: true,
  },
  {
    key: 'general.heure_arrivee',
    label: "Heure d'arrivée",
    category: 'general',
    type: 'text',
    required: false,
  },
  {
    key: 'general.duree_visite_min',
    label: 'Durée de la visite',
    category: 'general',
    type: 'number',
    unit: 'min',
    required: false,
    validationRules: { min: 0, max: 480 },
  },
  {
    key: 'general.meteo_visite',
    label: 'Conditions météo le jour J',
    category: 'general',
    type: 'enum',
    enumValues: ['ensoleille', 'nuageux', 'pluie', 'neige', 'tempete'],
    required: false,
  },
  {
    key: 'general.temperature_exterieure_c',
    label: 'Température extérieure',
    category: 'general',
    type: 'number',
    unit: '°C',
    required: false,
    validationRules: { min: -20, max: 45 },
  },
  {
    key: 'general.presence_occupants',
    label: 'Occupants présents lors de la visite ?',
    category: 'general',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },

  // ============================================================
  // BATI — 24 champs (enveloppe / structure)
  // ============================================================
  {
    key: 'bati.annee_construction',
    label: 'Année de construction',
    category: 'bati',
    type: 'number',
    required: true,
    validationRules: { min: 1800, max: 2026 },
    defaultValuePitfall:
      'Année inconnue → 3CL applique période 1948-1974 (la plus pénalisante en isolation).',
  },
  {
    key: 'bati.annee_renovation_globale',
    label: 'Année de rénovation globale (si applicable)',
    category: 'bati',
    type: 'number',
    required: false,
    validationRules: { min: 1900, max: 2026 },
  },
  {
    key: 'bati.surface_habitable',
    label: 'Surface habitable totale',
    category: 'bati',
    type: 'number',
    unit: 'm²',
    required: true,
    validationRules: { min: 5, max: 2000 },
    defaultValuePitfall:
      'Surface habitable = base de tous les ratios kWh/m²/an. Une erreur de 5% modifie la classe.',
  },
  {
    key: 'bati.surface_carrez',
    label: 'Surface Carrez (si lot copro)',
    category: 'bati',
    type: 'number',
    unit: 'm²',
    required: false,
  },
  {
    key: 'bati.surface_boutin',
    label: 'Surface Boutin (location)',
    category: 'bati',
    type: 'number',
    unit: 'm²',
    required: false,
  },
  {
    key: 'bati.hauteur_sous_plafond_moyenne',
    label: 'Hauteur sous plafond moyenne',
    category: 'bati',
    type: 'number',
    unit: 'm',
    required: true,
    validationRules: { min: 1.5, max: 5 },
    defaultValuePitfall:
      'Hauteur par défaut 2,50m. Si supérieur (haussmannien), volume chauffé sous-estimé.',
  },
  {
    key: 'bati.nombre_niveaux',
    label: 'Nombre de niveaux',
    category: 'bati',
    type: 'number',
    required: true,
    validationRules: { min: 1, max: 10 },
  },
  {
    key: 'bati.nombre_pieces_principales',
    label: 'Nombre de pièces principales',
    category: 'bati',
    type: 'number',
    required: true,
    validationRules: { min: 1, max: 20 },
  },
  {
    key: 'bati.mitoyennete',
    label: 'Type de mitoyenneté',
    category: 'bati',
    type: 'enum',
    enumValues: [
      'isole',
      'mitoyen_1_cote',
      'mitoyen_2_cotes',
      'mitoyen_3_cotes',
      'milieu_immeuble',
    ],
    required: true,
    defaultValuePitfall:
      'Mitoyenneté par défaut = isolé (max déperditions). Une maison mitoyenne 2 côtés = -25% déperdition.',
  },
  {
    key: 'bati.type_mur_principal',
    label: 'Type de mur principal',
    category: 'bati',
    type: 'enum',
    enumValues: [
      'pierre_taille',
      'pierre_meuliere',
      'brique_pleine',
      'brique_creuse',
      'parpaing',
      'beton_banche',
      'monomur_terre_cuite',
      'ossature_bois',
      'pisé',
      'pan_de_bois',
      'inconnu',
    ],
    required: true,
    defaultValuePitfall:
      'Mur par défaut = béton/parpaing non isolé. Une pierre meulière mal renseignée = +30% sur la note.',
  },
  {
    key: 'bati.epaisseur_mur_cm',
    label: 'Épaisseur moyenne des murs',
    category: 'bati',
    type: 'number',
    unit: 'cm',
    required: true,
    validationRules: { min: 5, max: 100 },
  },
  {
    key: 'bati.isolation_murs_type',
    label: 'Isolation des murs',
    category: 'bati',
    type: 'enum',
    enumValues: ['aucune', 'iti', 'ite', 'isolation_repartie', 'inconnue'],
    required: true,
    defaultValuePitfall:
      "Si non renseigné, isolation = 'aucune' (cas pire). Une ITE 14cm fait gagner 2 classes.",
  },
  {
    key: 'bati.isolation_murs_epaisseur_cm',
    label: 'Épaisseur isolant murs',
    category: 'bati',
    type: 'number',
    unit: 'cm',
    required: false,
    validationRules: { min: 0, max: 50 },
  },
  {
    key: 'bati.isolation_murs_annee',
    label: 'Année isolation murs',
    category: 'bati',
    type: 'number',
    required: false,
    validationRules: { min: 1950, max: 2026 },
  },
  {
    key: 'bati.type_plancher_bas',
    label: 'Type plancher bas',
    category: 'bati',
    type: 'enum',
    enumValues: [
      'terre_plein',
      'vide_sanitaire',
      'sur_local_non_chauffe',
      'sur_local_chauffe',
      'plancher_chauffant',
    ],
    required: true,
  },
  {
    key: 'bati.isolation_plancher_bas_type',
    label: 'Isolation plancher bas',
    category: 'bati',
    type: 'enum',
    enumValues: ['aucune', 'sous_dalle', 'sur_dalle', 'inconnue'],
    required: true,
    defaultValuePitfall:
      "Plancher bas non isolé = jusqu'à 10% des déperditions. Par défaut = 'aucune'.",
  },
  {
    key: 'bati.isolation_plancher_bas_epaisseur_cm',
    label: 'Épaisseur isolant plancher bas',
    category: 'bati',
    type: 'number',
    unit: 'cm',
    required: false,
    validationRules: { min: 0, max: 30 },
  },
  {
    key: 'bati.type_plancher_haut',
    label: 'Type de plancher haut',
    category: 'bati',
    type: 'enum',
    enumValues: ['combles_perdus', 'combles_amenages', 'toiture_terrasse', 'rampants', 'inconnu'],
    required: true,
  },
  {
    key: 'bati.isolation_combles_type',
    label: 'Isolation combles',
    category: 'bati',
    type: 'enum',
    enumValues: [
      'aucune',
      'laine_verre',
      'laine_roche',
      'ouate_cellulose',
      'polyurethane',
      'inconnue',
    ],
    required: true,
    defaultValuePitfall:
      "30% des déperditions passent par la toiture. Par défaut = 'aucune' (cas pire).",
  },
  {
    key: 'bati.isolation_combles_epaisseur_cm',
    label: 'Épaisseur isolant combles',
    category: 'bati',
    type: 'number',
    unit: 'cm',
    required: false,
    validationRules: { min: 0, max: 50 },
  },
  {
    key: 'bati.isolation_combles_annee',
    label: 'Année isolation combles',
    category: 'bati',
    type: 'number',
    required: false,
    validationRules: { min: 1950, max: 2026 },
  },
  {
    key: 'bati.inertie_thermique',
    label: 'Inertie thermique du bâti',
    category: 'bati',
    type: 'enum',
    enumValues: ['tres_legere', 'legere', 'moyenne', 'lourde', 'tres_lourde'],
    required: true,
  },
  {
    key: 'bati.exposition_dominante',
    label: 'Exposition dominante du bien',
    category: 'bati',
    type: 'enum',
    enumValues: [...ORIENTATIONS],
    required: false,
  },
  {
    key: 'bati.masque_solaire_horizon',
    label: 'Masque solaire horizon (montagne, immeuble)',
    category: 'bati',
    type: 'enum',
    enumValues: ['aucun', 'leger', 'moyen', 'important'],
    required: false,
    defaultValuePitfall:
      'Masque par défaut = aucun (gain solaire max). Un masque important réduit les apports gratuits.',
  },

  // ============================================================
  // MENUISERIES (portes, etc.) — 12 champs
  // ============================================================
  {
    key: 'menuiseries.porte_entree_materiau',
    label: "Matériau porte d'entrée",
    category: 'menuiseries',
    type: 'enum',
    enumValues: ['bois_plein', 'bois_vitre', 'pvc', 'aluminium', 'acier', 'composite_isolant'],
    required: true,
  },
  {
    key: 'menuiseries.porte_entree_isolation',
    label: "Porte d'entrée isolée",
    category: 'menuiseries',
    type: 'enum',
    enumValues: [...YES_NO, 'inconnu'],
    required: true,
  },
  {
    key: 'menuiseries.porte_entree_annee',
    label: "Année porte d'entrée",
    category: 'menuiseries',
    type: 'number',
    required: false,
    validationRules: { min: 1900, max: 2026 },
  },
  {
    key: 'menuiseries.porte_garage_presente',
    label: 'Porte de garage présente ?',
    category: 'menuiseries',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'menuiseries.porte_garage_materiau',
    label: 'Matériau porte de garage',
    category: 'menuiseries',
    type: 'enum',
    enumValues: ['bois', 'pvc', 'aluminium', 'acier', 'sectionnelle_isolee'],
    required: false,
  },
  {
    key: 'menuiseries.porte_garage_isolation',
    label: 'Porte de garage isolée',
    category: 'menuiseries',
    type: 'enum',
    enumValues: [...YES_NO, 'inconnu'],
    required: false,
  },
  {
    key: 'menuiseries.porte_garage_donnant_sur_logement',
    label: 'Porte garage donnant sur logement chauffé',
    category: 'menuiseries',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'menuiseries.trappe_combles_presente',
    label: 'Trappe combles présente',
    category: 'menuiseries',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'menuiseries.trappe_combles_isolee',
    label: 'Trappe combles isolée',
    category: 'menuiseries',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
    defaultValuePitfall:
      'Trappe non isolée = pont thermique majeur ignoré par défaut. À renseigner systématiquement.',
  },
  {
    key: 'menuiseries.porte_palier_appartement',
    label: 'Porte palier appartement (immeuble)',
    category: 'menuiseries',
    type: 'enum',
    enumValues: ['bois_simple', 'bois_blinde', 'pvc', 'aluminium', 'acier', 'non_applicable'],
    required: false,
  },
  {
    key: 'menuiseries.nb_portes_donnant_exterieur',
    label: 'Nb portes donnant sur extérieur',
    category: 'menuiseries',
    type: 'number',
    required: true,
    validationRules: { min: 0, max: 10 },
  },
  {
    key: 'menuiseries.commentaires',
    label: 'Commentaires menuiseries',
    category: 'menuiseries',
    type: 'text',
    required: false,
  },

  // ============================================================
  // PAROIS VITREES — 32 champs (par groupe de baies)
  // ============================================================
  {
    key: 'parois_vitrees.nb_total_baies',
    label: 'Nb total de baies',
    category: 'parois_vitrees',
    type: 'number',
    required: true,
    validationRules: { min: 0, max: 100 },
  },
  {
    key: 'parois_vitrees.surface_totale_vitree_m2',
    label: 'Surface totale vitrée',
    category: 'parois_vitrees',
    type: 'number',
    unit: 'm²',
    required: true,
  },
  {
    key: 'parois_vitrees.inclinaison',
    label: 'Inclinaison de la paroi vitrée',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: ['verticale', 'inclinee_30', 'inclinee_45', 'inclinee_60', 'horizontale'],
    required: true,
    defaultValuePitfall:
      'Inclinaison par défaut = verticale. Les fenêtres de toit (45-60°) ont un Uw différent.',
  },
  {
    key: 'parois_vitrees.type_vitrage',
    label: 'Type de vitrage',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [
      'simple',
      'double_air',
      'double_argon',
      'double_faiblement_emissif',
      'triple_argon',
      'survitrage_renovation',
      'pave_de_verre',
    ],
    required: true,
    defaultValuePitfall:
      "Si non renseigné, applique 'simple vitrage' = pénalité majeure. À vérifier systématiquement sur les ouvrants.",
  },
  {
    key: 'parois_vitrees.lame_air_mm',
    label: "Épaisseur lame d'air",
    category: 'parois_vitrees',
    type: 'number',
    unit: 'mm',
    required: false,
    validationRules: { min: 4, max: 24 },
  },
  {
    key: 'parois_vitrees.menuiserie_materiau',
    label: 'Matériau menuiserie',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [
      'bois',
      'pvc',
      'aluminium',
      'aluminium_rupture',
      'mixte_bois_alu',
      'acier',
      'pvc_renforce',
    ],
    required: true,
    defaultValuePitfall:
      'Aluminium sans rupture par défaut = Uw pénalisant. Préciser si rupture de pont thermique.',
  },
  {
    key: 'parois_vitrees.menuiserie_type_ouverture',
    label: "Type d'ouverture",
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: ['battant', 'coulissant', 'oscillobattant', 'basculant', 'pivotant', 'fixe'],
    required: true,
  },
  {
    key: 'parois_vitrees.menuiserie_annee',
    label: 'Année des menuiseries',
    category: 'parois_vitrees',
    type: 'number',
    required: true,
    validationRules: { min: 1900, max: 2026 },
    defaultValuePitfall:
      'Année par défaut = année construction. Une rénovation menuiseries 2020 doit être renseignée.',
  },
  {
    key: 'parois_vitrees.uw_calcule',
    label: 'Uw calculé',
    category: 'parois_vitrees',
    type: 'number',
    unit: 'W/m²K',
    required: false,
    validationRules: { min: 0.5, max: 6 },
  },
  {
    key: 'parois_vitrees.volet_type',
    label: 'Type de volets',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [
      'aucun',
      'battant_bois',
      'battant_aluminium',
      'battant_pvc',
      'roulant_pvc',
      'roulant_alu',
      'roulant_alu_isole',
      'persienne_bois',
      'persienne_metal',
      'store_exterieur',
    ],
    required: true,
    defaultValuePitfall:
      'Volets par défaut = aucun. Un volet roulant isolé apporte une résistance thermique nocturne.',
  },
  {
    key: 'parois_vitrees.volet_ferme_nuit_estime',
    label: 'Volets fermés la nuit (estimation)',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: ['toujours', 'souvent', 'parfois', 'jamais', 'non_applicable'],
    required: false,
  },
  {
    key: 'parois_vitrees.orientation_dominante',
    label: 'Orientation dominante des baies',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...ORIENTATIONS],
    required: true,
  },
  // Champs par pièce (28 supplémentaires = ~4 par pièce typique)
  {
    key: 'parois_vitrees.nb_fenetres',
    label: 'Nb fenêtres',
    category: 'parois_vitrees',
    type: 'number',
    required: true,
    applicableTo: ['living', 'kitchen', 'bedroom', 'bathroom', 'office'],
    validationRules: { min: 0, max: 15 },
  },
  {
    key: 'parois_vitrees.surface_vitree_piece_m2',
    label: 'Surface vitrée pièce',
    category: 'parois_vitrees',
    type: 'number',
    unit: 'm²',
    required: false,
    applicableTo: ['living', 'kitchen', 'bedroom', 'bathroom', 'office'],
  },
  {
    key: 'parois_vitrees.orientation_piece',
    label: 'Orientation principale pièce',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...ORIENTATIONS],
    required: true,
    applicableTo: ['living', 'kitchen', 'bedroom', 'office'],
  },
  {
    key: 'parois_vitrees.fenetre_toit_presente',
    label: 'Fenêtre de toit (velux) présente',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
    applicableTo: ['attic', 'living', 'bedroom', 'bathroom'],
  },
  {
    key: 'parois_vitrees.veranda_presente',
    label: 'Véranda présente',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'parois_vitrees.veranda_chauffee',
    label: 'Véranda chauffée',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'parois_vitrees.veranda_surface_m2',
    label: 'Surface véranda',
    category: 'parois_vitrees',
    type: 'number',
    unit: 'm²',
    required: false,
  },
  {
    key: 'parois_vitrees.veranda_orientation',
    label: 'Orientation véranda',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...ORIENTATIONS, 'non_applicable'],
    required: false,
  },
  {
    key: 'parois_vitrees.protection_solaire_ete',
    label: "Protection solaire d'été",
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: ['aucune', 'volet', 'store', 'casquette_architecturale', 'brise_soleil_orientable'],
    required: false,
    defaultValuePitfall:
      "Aucune protection par défaut → confort d'été pénalisé. Important pour DPE 2021 (inertie + protection solaire).",
  },
  {
    key: 'parois_vitrees.fenetre_double_a_renovation',
    label: 'Fenêtre rénovée (double vitrage posé après construction)',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'parois_vitrees.coffre_volet_roulant_isole',
    label: 'Coffre volet roulant isolé',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'parois_vitrees.joints_etancheite_etat',
    label: "État joints d'étanchéité",
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: ['neufs', 'bon_etat', 'usures', 'a_remplacer'],
    required: false,
  },
  {
    key: 'parois_vitrees.condensation_observee',
    label: 'Condensation observée',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...YES_NO, 'occasionnelle'],
    required: false,
  },
  {
    key: 'parois_vitrees.fissures_observees',
    label: 'Fissures sur vitrage',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'parois_vitrees.materiau_dormant',
    label: 'Matériau dormant (cadre fixe)',
    category: 'parois_vitrees',
    type: 'enum',
    enumValues: ['bois', 'pvc', 'aluminium', 'mixte', 'acier'],
    required: false,
  },
  {
    key: 'parois_vitrees.surface_perdition_baie_dominante',
    label: 'Surface baie dominante',
    category: 'parois_vitrees',
    type: 'number',
    unit: 'm²',
    required: false,
  },
  {
    key: 'parois_vitrees.commentaires',
    label: 'Commentaires parois vitrées',
    category: 'parois_vitrees',
    type: 'text',
    required: false,
  },
  {
    key: 'parois_vitrees.fenetre_toit_velux_nb',
    label: 'Nombre fenêtres de toit',
    category: 'parois_vitrees',
    type: 'number',
    required: false,
    validationRules: { min: 0, max: 20 },
  },
  {
    key: 'parois_vitrees.fenetre_toit_velux_surface_m2',
    label: 'Surface totale fenêtres de toit',
    category: 'parois_vitrees',
    type: 'number',
    unit: 'm²',
    required: false,
  },

  // ============================================================
  // CHAUFFAGE — 38 champs (production + distribution + émission + régulation)
  // ============================================================
  {
    key: 'chauffage.type_generateur_principal',
    label: 'Type générateur principal',
    category: 'chauffage',
    type: 'enum',
    enumValues: [
      'chaudiere_gaz_standard',
      'chaudiere_gaz_basse_temp',
      'chaudiere_gaz_condensation',
      'chaudiere_fioul_standard',
      'chaudiere_fioul_condensation',
      'chaudiere_bois_buche',
      'chaudiere_granules_pellets',
      'pac_air_eau',
      'pac_air_air',
      'pac_geothermique',
      'pac_eau_eau',
      'radiateurs_electriques_simples',
      'radiateurs_electriques_inertie',
      'plancher_chauffant_electrique',
      'plancher_chauffant_hydraulique',
      'poele_bois',
      'poele_granules',
      'insert_bois',
      'reseau_chaleur_urbain',
      'cogeneration',
      'aucun',
    ],
    required: true,
    defaultValuePitfall:
      "Si non renseigné, applique 'chaudiere_gaz_standard' (rendement 80%). PAC ou condensation = -2 classes.",
  },
  {
    key: 'chauffage.energie_principale',
    label: 'Énergie principale',
    category: 'chauffage',
    type: 'enum',
    enumValues: [
      'electricite',
      'gaz_naturel',
      'gaz_propane',
      'fioul',
      'bois_buche',
      'granules_pellets',
      'reseau_chaleur',
      'charbon',
      'gpl',
      'autre',
    ],
    required: true,
  },
  {
    key: 'chauffage.puissance_nominale_kw',
    label: 'Puissance nominale',
    category: 'chauffage',
    type: 'number',
    unit: 'kW',
    required: true,
    validationRules: { min: 1, max: 100 },
  },
  {
    key: 'chauffage.annee_installation_generateur',
    label: 'Année installation générateur',
    category: 'chauffage',
    type: 'number',
    required: true,
    validationRules: { min: 1950, max: 2026 },
    defaultValuePitfall:
      'Année par défaut = année construction. Une chaudière de 1992 vs 2020 = écart rendement 30%.',
  },
  {
    key: 'chauffage.marque',
    label: 'Marque générateur',
    category: 'chauffage',
    type: 'text',
    required: false,
  },
  {
    key: 'chauffage.modele',
    label: 'Modèle générateur',
    category: 'chauffage',
    type: 'text',
    required: false,
  },
  {
    key: 'chauffage.rendement_pci_pct',
    label: 'Rendement PCI',
    category: 'chauffage',
    type: 'number',
    unit: '%',
    required: false,
    validationRules: { min: 50, max: 110 },
  },
  {
    key: 'chauffage.cop_nominal',
    label: 'COP nominal (PAC uniquement)',
    category: 'chauffage',
    type: 'number',
    required: false,
    validationRules: { min: 1, max: 6 },
  },
  {
    key: 'chauffage.scop_saison_chauffage',
    label: 'SCOP saison chauffage',
    category: 'chauffage',
    type: 'number',
    required: false,
    validationRules: { min: 1, max: 6 },
  },
  {
    key: 'chauffage.emplacement_generateur',
    label: 'Emplacement générateur',
    category: 'chauffage',
    type: 'enum',
    enumValues: [
      'volume_chauffe',
      'volume_non_chauffe',
      'exterieur',
      'cave',
      'garage',
      'local_technique',
    ],
    required: true,
    defaultValuePitfall:
      'Si en local non chauffé, déperdition par la canalisation. Souvent oublié = sous-estimation 5%.',
  },
  {
    key: 'chauffage.regulation_type',
    label: 'Type de régulation',
    category: 'chauffage',
    type: 'enum',
    enumValues: [
      'absente',
      'thermostat_dambiance',
      'thermostat_programmable',
      'sonde_exterieure',
      'sonde_ext_programmable',
      'gtb_domotique',
    ],
    required: true,
    defaultValuePitfall:
      "Si non renseigné, méthode 3CL applique régulation 'absente' = pénalité 15% sur consommation.",
  },
  {
    key: 'chauffage.programmation_presente',
    label: 'Programmation horaire',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
  },
  {
    key: 'chauffage.robinets_thermostatiques',
    label: 'Robinets thermostatiques',
    category: 'chauffage',
    type: 'enum',
    enumValues: ['aucun', 'partiels', 'tous'],
    required: true,
    defaultValuePitfall: 'Robinets par défaut = aucun. Présence systématique = -5% consommation.',
  },
  {
    key: 'chauffage.emetteur_type',
    label: "Type d'émetteur",
    category: 'chauffage',
    type: 'enum',
    enumValues: [
      'radiateur_fonte',
      'radiateur_acier',
      'radiateur_alu',
      'radiateur_electrique_convecteur',
      'radiateur_electrique_inertie',
      'plancher_chauffant',
      'plafond_rayonnant',
      'ventilo_convecteur',
      'poele',
      'cheminee_ouverte',
      'cheminee_insert',
    ],
    required: true,
  },
  {
    key: 'chauffage.nb_emetteurs_total',
    label: "Nb total d'émetteurs",
    category: 'chauffage',
    type: 'number',
    required: true,
    validationRules: { min: 0, max: 50 },
  },
  {
    key: 'chauffage.distribution_isolee',
    label: 'Canalisations isolées',
    category: 'chauffage',
    type: 'enum',
    enumValues: ['oui', 'non', 'partiellement', 'sans_objet'],
    required: true,
    defaultValuePitfall:
      'Distribution non isolée = +5-10% conso. Souvent oublié quand canalisations cachées.',
  },
  {
    key: 'chauffage.distribution_emplacement',
    label: 'Emplacement principal canalisations',
    category: 'chauffage',
    type: 'enum',
    enumValues: ['volume_chauffe', 'volume_non_chauffe', 'cave', 'combles'],
    required: false,
  },
  {
    key: 'chauffage.appoint_present',
    label: "Chauffage d'appoint présent",
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
  },
  {
    key: 'chauffage.appoint_type',
    label: "Type d'appoint",
    category: 'chauffage',
    type: 'enum',
    enumValues: [
      'aucun',
      'electrique_radiateur',
      'poele_bois_complement',
      'cheminee_ouverte',
      'climatisation_reversible',
      'pac_air_air_complement',
    ],
    required: false,
  },
  {
    key: 'chauffage.appoint_energie',
    label: 'Énergie appoint',
    category: 'chauffage',
    type: 'enum',
    enumValues: ['electricite', 'gaz', 'fioul', 'bois', 'granules', 'aucun'],
    required: false,
  },
  {
    key: 'chauffage.appoint_proportion_pct',
    label: 'Proportion appoint',
    category: 'chauffage',
    type: 'number',
    unit: '%',
    required: false,
    validationRules: { min: 0, max: 100 },
  },
  {
    key: 'chauffage.entretien_annuel_present',
    label: 'Entretien annuel à jour',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'chauffage.derniere_revision_date',
    label: 'Date dernière révision',
    category: 'chauffage',
    type: 'date',
    required: false,
  },
  {
    key: 'chauffage.observations_terrain',
    label: 'Observations terrain (corrosion, fuites, bruit)',
    category: 'chauffage',
    type: 'text',
    required: false,
  },
  {
    key: 'chauffage.arrivee_gaz_present',
    label: 'Arrivée gaz présente',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
    defaultValuePitfall:
      'Si chaudière gaz mais arrivée gaz absente = erreur de saisie majeure. À vérifier.',
  },
  {
    key: 'chauffage.cuve_fioul_present',
    label: 'Cuve fioul présente',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'chauffage.stockage_bois_present',
    label: 'Stockage bois présent',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'chauffage.cheminee_conduit_etat',
    label: 'État du conduit cheminée',
    category: 'chauffage',
    type: 'enum',
    enumValues: ['neuf', 'bon_etat', 'ramonage_necessaire', 'a_remplacer', 'sans_objet'],
    required: false,
  },
  {
    key: 'chauffage.repartition_chauffage_pieces_pct',
    label: '% pièces chauffées',
    category: 'chauffage',
    type: 'number',
    unit: '%',
    required: false,
    validationRules: { min: 0, max: 100 },
  },
  {
    key: 'chauffage.thermostat_setpoint_jour_c',
    label: 'Consigne jour',
    category: 'chauffage',
    type: 'number',
    unit: '°C',
    required: false,
    validationRules: { min: 14, max: 25 },
  },
  {
    key: 'chauffage.thermostat_setpoint_nuit_c',
    label: 'Consigne nuit',
    category: 'chauffage',
    type: 'number',
    unit: '°C',
    required: false,
    validationRules: { min: 12, max: 22 },
  },
  // Champs par pièce — chauffage local
  {
    key: 'chauffage.emetteur_piece_type',
    label: 'Émetteur dans la pièce',
    category: 'chauffage',
    type: 'enum',
    enumValues: ['radiateur', 'plancher_chauffant', 'aucun', 'poele', 'climatisation_reversible'],
    required: true,
    applicableTo: ['living', 'kitchen', 'bedroom', 'bathroom', 'office'],
  },
  {
    key: 'chauffage.emetteur_piece_nb',
    label: 'Nb émetteurs dans la pièce',
    category: 'chauffage',
    type: 'number',
    required: false,
    applicableTo: ['living', 'kitchen', 'bedroom', 'bathroom', 'office'],
    validationRules: { min: 0, max: 10 },
  },
  {
    key: 'chauffage.seche_serviette_present',
    label: 'Sèche-serviette présent',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
    applicableTo: ['bathroom'],
  },
  {
    key: 'chauffage.seche_serviette_type',
    label: 'Type sèche-serviette',
    category: 'chauffage',
    type: 'enum',
    enumValues: ['electrique', 'eau_chaude', 'mixte', 'non_applicable'],
    required: false,
    applicableTo: ['bathroom'],
  },
  {
    key: 'chauffage.cheminee_ouverte_presente',
    label: 'Cheminée ouverte présente',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
    applicableTo: ['living'],
    defaultValuePitfall:
      'Cheminée ouverte = pont thermique majeur (tirage permanent). Souvent oublié dans la saisie.',
  },
  {
    key: 'chauffage.cheminee_obturee',
    label: 'Cheminée obturée (foyer fermé)',
    category: 'chauffage',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
    applicableTo: ['living'],
  },
  {
    key: 'chauffage.commentaires',
    label: 'Commentaires chauffage',
    category: 'chauffage',
    type: 'text',
    required: false,
  },

  // ============================================================
  // ECS — Eau Chaude Sanitaire — 16 champs
  // ============================================================
  {
    key: 'ecs.type_generateur',
    label: 'Type générateur ECS',
    category: 'ecs',
    type: 'enum',
    enumValues: [
      'ballon_electrique',
      'ballon_thermodynamique',
      'chaudiere_mixte',
      'chauffe_eau_gaz_instantane',
      'chauffe_eau_gaz_accumulation',
      'solaire_thermique',
      'pac_dediee_ecs',
      'cumulus_horsgel',
      'reseau_chaleur',
      'aucun',
    ],
    required: true,
    defaultValuePitfall:
      'Si non renseigné, applique ballon électrique standard (rendement faible). Ballon thermo = -2 classes.',
  },
  {
    key: 'ecs.energie',
    label: 'Énergie ECS',
    category: 'ecs',
    type: 'enum',
    enumValues: [
      'electricite',
      'gaz_naturel',
      'gaz_propane',
      'fioul',
      'bois',
      'solaire',
      'reseau_chaleur',
    ],
    required: true,
  },
  {
    key: 'ecs.volume_ballon_l',
    label: 'Volume ballon',
    category: 'ecs',
    type: 'number',
    unit: 'L',
    required: false,
    validationRules: { min: 30, max: 500 },
  },
  {
    key: 'ecs.annee_installation',
    label: 'Année installation ECS',
    category: 'ecs',
    type: 'number',
    required: true,
    validationRules: { min: 1950, max: 2026 },
  },
  {
    key: 'ecs.emplacement_generateur',
    label: 'Emplacement générateur ECS',
    category: 'ecs',
    type: 'enum',
    enumValues: [
      'volume_chauffe',
      'volume_non_chauffe',
      'exterieur',
      'cave',
      'garage',
      'local_technique',
    ],
    required: true,
    defaultValuePitfall: 'Ballon en local non chauffé = pertes statiques +15%. Souvent oublié.',
  },
  {
    key: 'ecs.distribution_isolee',
    label: 'Canalisations ECS isolées',
    category: 'ecs',
    type: 'enum',
    enumValues: ['oui', 'non', 'partiellement', 'sans_objet'],
    required: true,
  },
  {
    key: 'ecs.bouclage_present',
    label: 'Bouclage ECS présent',
    category: 'ecs',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'ecs.bouclage_horloge',
    label: 'Horloge sur bouclage',
    category: 'ecs',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
    defaultValuePitfall:
      "Bouclage 24/7 = pertes énormes. Présence d'horloge = -50% pertes bouclage.",
  },
  {
    key: 'ecs.cop_ballon_thermodynamique',
    label: 'COP ballon thermo',
    category: 'ecs',
    type: 'number',
    required: false,
    validationRules: { min: 1, max: 5 },
  },
  {
    key: 'ecs.surface_capteur_solaire_m2',
    label: 'Surface capteurs solaires',
    category: 'ecs',
    type: 'number',
    unit: 'm²',
    required: false,
    validationRules: { min: 0, max: 50 },
  },
  {
    key: 'ecs.appoint_solaire_type',
    label: 'Appoint solaire ECS',
    category: 'ecs',
    type: 'enum',
    enumValues: ['electrique', 'gaz', 'fioul', 'aucun', 'non_applicable'],
    required: false,
  },
  {
    key: 'ecs.fraction_solaire_pct',
    label: 'Fraction solaire ECS',
    category: 'ecs',
    type: 'number',
    unit: '%',
    required: false,
    validationRules: { min: 0, max: 100 },
  },
  {
    key: 'ecs.temperature_consigne_c',
    label: 'Température consigne ECS',
    category: 'ecs',
    type: 'number',
    unit: '°C',
    required: false,
    validationRules: { min: 35, max: 75 },
  },
  {
    key: 'ecs.eau_chaude_source_piece',
    label: 'Source ECS pièce',
    category: 'ecs',
    type: 'enum',
    enumValues: ['centralisee', 'chauffe_eau_local', 'aucune'],
    required: true,
    applicableTo: ['kitchen', 'bathroom'],
  },
  {
    key: 'ecs.nb_points_de_puisage',
    label: 'Nb points de puisage',
    category: 'ecs',
    type: 'number',
    required: false,
    validationRules: { min: 0, max: 20 },
  },
  {
    key: 'ecs.commentaires',
    label: 'Commentaires ECS',
    category: 'ecs',
    type: 'text',
    required: false,
  },

  // ============================================================
  // VENTILATION — 18 champs
  // ============================================================
  {
    key: 'ventilation.type_systeme',
    label: 'Type de ventilation',
    category: 'ventilation',
    type: 'enum',
    enumValues: [
      'naturelle_par_ouvrants',
      'naturelle_par_conduit',
      'vmc_simple_flux_autoreglable',
      'vmc_simple_flux_hygroreglable_a',
      'vmc_simple_flux_hygroreglable_b',
      'vmc_double_flux',
      'vmc_double_flux_haut_rendement',
      'vmr_ventilation_modulee_residentielle',
      'puits_canadien',
      'aucune',
    ],
    required: true,
    defaultValuePitfall:
      "Si non renseigné, applique 'naturelle' (déperdition max). VMC DF Hr = -2 classes potentielles.",
  },
  {
    key: 'ventilation.marque_groupe',
    label: 'Marque groupe VMC',
    category: 'ventilation',
    type: 'text',
    required: false,
  },
  {
    key: 'ventilation.modele_groupe',
    label: 'Modèle groupe VMC',
    category: 'ventilation',
    type: 'text',
    required: false,
  },
  {
    key: 'ventilation.annee_installation',
    label: 'Année installation VMC',
    category: 'ventilation',
    type: 'number',
    required: false,
    validationRules: { min: 1970, max: 2026 },
  },
  {
    key: 'ventilation.rendement_echangeur_pct',
    label: 'Rendement échangeur (VMC DF)',
    category: 'ventilation',
    type: 'number',
    unit: '%',
    required: false,
    validationRules: { min: 50, max: 95 },
  },
  {
    key: 'ventilation.emplacement_groupe',
    label: 'Emplacement groupe VMC',
    category: 'ventilation',
    type: 'enum',
    enumValues: ['combles', 'volume_chauffe', 'volume_non_chauffe', 'exterieur', 'local_technique'],
    required: false,
  },
  {
    key: 'ventilation.bouches_extraction_nb',
    label: 'Nb bouches extraction',
    category: 'ventilation',
    type: 'number',
    required: false,
    validationRules: { min: 0, max: 30 },
  },
  {
    key: 'ventilation.bouches_insufflation_nb',
    label: 'Nb bouches insufflation',
    category: 'ventilation',
    type: 'number',
    required: false,
    validationRules: { min: 0, max: 30 },
  },
  {
    key: 'ventilation.bouches_entree_air_nb',
    label: "Nb entrées d'air",
    category: 'ventilation',
    type: 'number',
    required: false,
    validationRules: { min: 0, max: 30 },
  },
  {
    key: 'ventilation.entretien_etat',
    label: 'État entretien VMC',
    category: 'ventilation',
    type: 'enum',
    enumValues: ['bon', 'moyen', 'mauvais', 'non_constate'],
    required: false,
  },
  {
    key: 'ventilation.gaines_isolees',
    label: 'Gaines isolées',
    category: 'ventilation',
    type: 'enum',
    enumValues: [...YES_NO, 'partiellement', 'non_applicable'],
    required: false,
    defaultValuePitfall:
      'Gaines non isolées en combles non chauffés = pertes thermiques importantes.',
  },
  {
    key: 'ventilation.test_fonctionnement_ok',
    label: 'Test fonctionnement OK',
    category: 'ventilation',
    type: 'enum',
    enumValues: [...YES_NO, 'non_realise'],
    required: false,
  },
  {
    key: 'ventilation.debit_extraction_pieces_humides',
    label: 'Débit extraction pièces humides (m³/h)',
    category: 'ventilation',
    type: 'number',
    unit: 'm³/h',
    required: false,
    validationRules: { min: 0, max: 500 },
  },
  // par pièce
  {
    key: 'ventilation.bouche_extraction_presente',
    label: 'Bouche extraction présente',
    category: 'ventilation',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
    applicableTo: ['kitchen', 'bathroom', 'wc'],
  },
  {
    key: 'ventilation.bouche_insufflation_presente',
    label: 'Bouche insufflation présente',
    category: 'ventilation',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
    applicableTo: ['living', 'bedroom', 'office'],
  },
  {
    key: 'ventilation.entree_air_fenetre_presente',
    label: "Entrée d'air sur fenêtre",
    category: 'ventilation',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
    applicableTo: ['living', 'bedroom', 'office'],
  },
  {
    key: 'ventilation.observations_terrain',
    label: 'Observations terrain (bruit, encrassement)',
    category: 'ventilation',
    type: 'text',
    required: false,
  },
  {
    key: 'ventilation.commentaires',
    label: 'Commentaires ventilation',
    category: 'ventilation',
    type: 'text',
    required: false,
  },

  // ============================================================
  // CLIMATISATION — 12 champs
  // ============================================================
  {
    key: 'climatisation.presente',
    label: 'Climatisation présente',
    category: 'climatisation',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
  },
  {
    key: 'climatisation.type_systeme',
    label: 'Type système climatisation',
    category: 'climatisation',
    type: 'enum',
    enumValues: [
      'mobile',
      'split_simple',
      'multi_split',
      'gainable',
      'pac_reversible',
      'gainable_centralisee',
      'aucune',
    ],
    required: false,
  },
  {
    key: 'climatisation.eer_nominal',
    label: 'EER nominal',
    category: 'climatisation',
    type: 'number',
    required: false,
    validationRules: { min: 1, max: 10 },
  },
  {
    key: 'climatisation.seer_saison',
    label: 'SEER saison',
    category: 'climatisation',
    type: 'number',
    required: false,
    validationRules: { min: 1, max: 10 },
  },
  {
    key: 'climatisation.puissance_froid_kw',
    label: 'Puissance froid',
    category: 'climatisation',
    type: 'number',
    unit: 'kW',
    required: false,
  },
  {
    key: 'climatisation.annee_installation',
    label: 'Année installation clim',
    category: 'climatisation',
    type: 'number',
    required: false,
    validationRules: { min: 1990, max: 2026 },
  },
  {
    key: 'climatisation.reversible_chauffage_appoint',
    label: 'Réversible en appoint chauffage',
    category: 'climatisation',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'climatisation.surface_climatisee_m2',
    label: 'Surface climatisée',
    category: 'climatisation',
    type: 'number',
    unit: 'm²',
    required: false,
  },
  {
    key: 'climatisation.nb_unites_interieures',
    label: 'Nb unités intérieures',
    category: 'climatisation',
    type: 'number',
    required: false,
    validationRules: { min: 0, max: 20 },
  },
  {
    key: 'climatisation.entretien_a_jour',
    label: 'Entretien à jour',
    category: 'climatisation',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'climatisation.clim_piece_presente',
    label: 'Clim dans la pièce',
    category: 'climatisation',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
    applicableTo: ['living', 'bedroom', 'office'],
  },
  {
    key: 'climatisation.commentaires',
    label: 'Commentaires climatisation',
    category: 'climatisation',
    type: 'text',
    required: false,
  },

  // ============================================================
  // ENR — Énergies renouvelables — 14 champs
  // ============================================================
  {
    key: 'enr.solaire_photovoltaique_present',
    label: 'Photovoltaïque présent',
    category: 'enr',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
  },
  {
    key: 'enr.pv_puissance_kwc',
    label: 'Puissance PV crête',
    category: 'enr',
    type: 'number',
    unit: 'kWc',
    required: false,
    validationRules: { min: 0, max: 36 },
  },
  {
    key: 'enr.pv_surface_m2',
    label: 'Surface PV',
    category: 'enr',
    type: 'number',
    unit: 'm²',
    required: false,
  },
  {
    key: 'enr.pv_orientation',
    label: 'Orientation PV',
    category: 'enr',
    type: 'enum',
    enumValues: [...ORIENTATIONS],
    required: false,
  },
  {
    key: 'enr.pv_inclinaison_deg',
    label: 'Inclinaison PV',
    category: 'enr',
    type: 'number',
    unit: '°',
    required: false,
    validationRules: { min: 0, max: 90 },
  },
  {
    key: 'enr.pv_annee_installation',
    label: 'Année installation PV',
    category: 'enr',
    type: 'number',
    required: false,
    validationRules: { min: 2000, max: 2026 },
  },
  {
    key: 'enr.pv_autoconsommation_present',
    label: 'Autoconsommation PV',
    category: 'enr',
    type: 'enum',
    enumValues: [...YES_NO, 'mixte', 'revente_totale'],
    required: false,
  },
  {
    key: 'enr.batterie_stockage_presente',
    label: 'Batterie stockage présente',
    category: 'enr',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'enr.batterie_capacite_kwh',
    label: 'Capacité batterie',
    category: 'enr',
    type: 'number',
    unit: 'kWh',
    required: false,
  },
  {
    key: 'enr.solaire_thermique_present',
    label: 'Solaire thermique présent',
    category: 'enr',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
  },
  {
    key: 'enr.geothermie_presente',
    label: 'Géothermie présente',
    category: 'enr',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
  },
  {
    key: 'enr.eolien_present',
    label: 'Éolien domestique présent',
    category: 'enr',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'enr.borne_recharge_vehicule_presente',
    label: 'Borne recharge véhicule électrique',
    category: 'enr',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'enr.commentaires',
    label: 'Commentaires ENR',
    category: 'enr',
    type: 'text',
    required: false,
  },

  // ============================================================
  // ECLAIRAGE — 8 champs
  // ============================================================
  {
    key: 'eclairage.type_principal',
    label: 'Type éclairage principal',
    category: 'eclairage',
    type: 'enum',
    enumValues: ['led', 'fluo_compact', 'incandescence', 'halogene', 'mixte'],
    required: false,
  },
  {
    key: 'eclairage.proportion_led_pct',
    label: '% éclairage LED',
    category: 'eclairage',
    type: 'number',
    unit: '%',
    required: false,
    validationRules: { min: 0, max: 100 },
  },
  {
    key: 'eclairage.detecteur_presence_present',
    label: 'Détecteur présence (escalier/couloir)',
    category: 'eclairage',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'eclairage.eclairage_naturel_qualite',
    label: 'Qualité éclairage naturel',
    category: 'eclairage',
    type: 'enum',
    enumValues: ['excellente', 'bonne', 'moyenne', 'faible', 'piece_aveugle'],
    required: false,
  },
  {
    key: 'eclairage.type_piece',
    label: 'Type éclairage pièce',
    category: 'eclairage',
    type: 'enum',
    enumValues: ['led', 'fluo_compact', 'halogene', 'mixte', 'aucun'],
    required: false,
    applicableTo: ['living', 'kitchen', 'bedroom', 'office', 'corridor'],
  },
  {
    key: 'eclairage.nb_points_lumineux_piece',
    label: 'Nb points lumineux pièce',
    category: 'eclairage',
    type: 'number',
    required: false,
    applicableTo: ['living', 'kitchen', 'bedroom', 'office', 'corridor'],
    validationRules: { min: 0, max: 20 },
  },
  {
    key: 'eclairage.eclairage_exterieur_present',
    label: 'Éclairage extérieur présent',
    category: 'eclairage',
    type: 'enum',
    enumValues: [...YES_NO],
    required: false,
  },
  {
    key: 'eclairage.commentaires',
    label: 'Commentaires éclairage',
    category: 'eclairage',
    type: 'text',
    required: false,
  },

  // ============================================================
  // PONTS_THERMIQUES — 18 champs
  // ============================================================
  {
    key: 'ponts_thermiques.plancher_intermediaire_mur_ext',
    label: 'Plancher intermédiaire / mur extérieur',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: ['rupteur', 'sans_rupteur', 'inconnu', 'non_applicable'],
    required: true,
    defaultValuePitfall:
      'Sans rupteur par défaut. Un rupteur thermique = -10% sur les ponts thermiques.',
  },
  {
    key: 'ponts_thermiques.plancher_bas_mur_ext',
    label: 'Plancher bas / mur extérieur',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: ['rupteur', 'sans_rupteur', 'inconnu'],
    required: true,
  },
  {
    key: 'ponts_thermiques.refend_mur_ext',
    label: 'Refend / mur extérieur',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: ['rupteur', 'sans_rupteur', 'inconnu'],
    required: true,
  },
  {
    key: 'ponts_thermiques.toiture_mur_ext',
    label: 'Toiture / mur extérieur',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: ['rupteur', 'sans_rupteur', 'inconnu'],
    required: true,
  },
  {
    key: 'ponts_thermiques.menuiserie_mur_ext',
    label: 'Menuiserie / mur extérieur',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: ['nu_au_mur', 'tableaux_isoles', 'inconnu'],
    required: true,
  },
  {
    key: 'ponts_thermiques.balcon_present',
    label: 'Balcon en saillie présent',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO],
    required: true,
  },
  {
    key: 'ponts_thermiques.balcon_rupteur',
    label: 'Balcon avec rupteur',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable', 'inconnu'],
    required: false,
    defaultValuePitfall:
      "Balcon sans rupteur = pont thermique majeur (linéaire jusqu'à 1 W/mK). Souvent oublié.",
  },
  {
    key: 'ponts_thermiques.linteau_isolation',
    label: 'Linteau isolé',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.acrotere_present',
    label: 'Acrotère présent (toit terrasse)',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable'],
    required: false,
  },
  {
    key: 'ponts_thermiques.angle_sortant_traitement',
    label: 'Angle sortant (refend)',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: ['traite', 'non_traite', 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.tableaux_fenetre_isolation',
    label: 'Tableaux de fenêtre isolés',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'partiellement', 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.appuis_fenetre_isolation',
    label: 'Appuis de fenêtre isolés',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.coffre_volet_roulant_traitement',
    label: 'Coffre volet roulant',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: ['isole', 'non_isole', 'absent', 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.trappe_combles_isolation',
    label: 'Trappe combles isolée',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'non_applicable', 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.passage_canalisation_isole',
    label: 'Passages canalisations isolés',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.passage_gaines_electriques_isole',
    label: 'Passages gaines électriques isolés',
    category: 'ponts_thermiques',
    type: 'enum',
    enumValues: [...YES_NO, 'inconnu'],
    required: false,
  },
  {
    key: 'ponts_thermiques.observations_thermographie',
    label: 'Observations thermographie',
    category: 'ponts_thermiques',
    type: 'text',
    required: false,
  },
  {
    key: 'ponts_thermiques.commentaires',
    label: 'Commentaires ponts thermiques',
    category: 'ponts_thermiques',
    type: 'text',
    required: false,
  },

  // ============================================================
  // PIECES — Champs par pièce (8 communs additionnels)
  // ============================================================
  {
    key: 'piece.surface',
    label: 'Surface au sol',
    category: 'pieces',
    type: 'number',
    unit: 'm²',
    required: true,
    applicableTo: [
      'living',
      'kitchen',
      'bedroom',
      'bathroom',
      'office',
      'wc',
      'corridor',
      'storage',
      'basement',
      'attic',
      'garage',
      'other',
    ],
    defaultValuePitfall:
      'Surface par défaut = vide. Le cumul des surfaces pièces doit matcher la surface habitable totale (±10%).',
  },
  {
    key: 'piece.hauteur_sous_plafond',
    label: 'Hauteur sous plafond',
    category: 'pieces',
    type: 'number',
    unit: 'm',
    required: true,
    applicableTo: [
      'living',
      'kitchen',
      'bedroom',
      'bathroom',
      'office',
      'wc',
      'corridor',
      'storage',
      'basement',
      'attic',
      'garage',
      'other',
    ],
    validationRules: { min: 1.5, max: 5 },
  },
  {
    key: 'piece.sol_type',
    label: 'Type de sol',
    category: 'pieces',
    type: 'enum',
    enumValues: [
      'carrelage',
      'parquet_massif',
      'parquet_flottant',
      'stratifie',
      'pvc_lino',
      'moquette',
      'beton_cire',
      'terre_battue',
      'autre',
    ],
    required: false,
    applicableTo: [
      'living',
      'kitchen',
      'bedroom',
      'bathroom',
      'office',
      'corridor',
      'storage',
      'basement',
      'garage',
    ],
  },
  {
    key: 'piece.mur_revetement',
    label: 'Revêtement mural principal',
    category: 'pieces',
    type: 'enum',
    enumValues: ['peinture', 'papier_peint', 'carrelage', 'lambris', 'enduit', 'autre'],
    required: false,
    applicableTo: ['bathroom', 'kitchen', 'wc'],
  },
  {
    key: 'piece.plafond_revetement',
    label: 'Revêtement plafond',
    category: 'pieces',
    type: 'enum',
    enumValues: ['peinture', 'lambris', 'staff', 'dalles_acoustiques', 'apparent_poutres'],
    required: false,
  },
  {
    key: 'piece.humidite_observation',
    label: 'Humidité observée',
    category: 'pieces',
    type: 'enum',
    enumValues: ['aucune', 'traces', 'moisissures', 'salpetre', 'condensation'],
    required: false,
    applicableTo: ['bathroom', 'basement', 'attic', 'kitchen', 'wc'],
  },
  {
    key: 'piece.douche_baignoire',
    label: 'Douche / baignoire',
    category: 'pieces',
    type: 'enum',
    enumValues: ['douche_seule', 'baignoire_seule', 'douche_et_baignoire', 'douche_italienne'],
    required: true,
    applicableTo: ['bathroom'],
  },
  {
    key: 'piece.plaque_type',
    label: 'Type plaque cuisson',
    category: 'pieces',
    type: 'enum',
    enumValues: ['gaz', 'electrique', 'vitroceramique', 'induction', 'mixte'],
    required: false,
    applicableTo: ['kitchen'],
  },
] as const

// -----------------------------------------------------------------------------
// Helpers de requête / scoping
// -----------------------------------------------------------------------------

/** Retourne tous les items applicables à un type de pièce donné. */
export function getCheckItemsForRoom(roomType: RoomType): CheckItem[] {
  return CHECK_ITEMS_3CL.filter(
    (item) => !item.applicableTo || item.applicableTo.includes(roomType),
  )
}

/** Retourne les items globaux (non scoped à une pièce). */
export function getGlobalCheckItems(): CheckItem[] {
  return CHECK_ITEMS_3CL.filter((item) => !item.applicableTo)
}

/** Retourne les items obligatoires (required=true). */
export function getRequiredCheckItems(): CheckItem[] {
  return CHECK_ITEMS_3CL.filter((item) => item.required)
}

/** Retourne les items obligatoires avec un piège méthode 3CL documenté. */
export function getRequiredCheckItemsWithPitfall(): CheckItem[] {
  return CHECK_ITEMS_3CL.filter((item) => item.required && Boolean(item.defaultValuePitfall))
}

/** Filtre les items par catégorie. */
export function getCheckItemsByCategory(category: CheckCategory): CheckItem[] {
  return CHECK_ITEMS_3CL.filter((item) => item.category === category)
}

/** Lookup rapide par key (cache JS map). */
const ITEMS_BY_KEY: ReadonlyMap<string, CheckItem> = new Map(
  CHECK_ITEMS_3CL.map((it) => [it.key, it]),
)

export function getCheckItemByKey(key: string): CheckItem | undefined {
  return ITEMS_BY_KEY.get(key)
}

/** Compte total. */
export const CHECK_ITEMS_3CL_COUNT = CHECK_ITEMS_3CL.length

/** Label FR de chaque catégorie pour le récap visuel. */
export const CHECK_CATEGORY_LABEL: Record<CheckCategory, string> = {
  general: 'Général',
  bati: 'Bâti / enveloppe',
  menuiseries: 'Menuiseries',
  parois_vitrees: 'Parois vitrées',
  chauffage: 'Chauffage',
  ecs: 'Eau chaude',
  ventilation: 'Ventilation',
  climatisation: 'Climatisation',
  enr: 'ENR',
  eclairage: 'Éclairage',
  ponts_thermiques: 'Ponts thermiques',
  pieces: 'Pièces',
}

/** Label court (pour grille récap compact). */
export const CHECK_CATEGORY_SHORT_LABEL: Record<CheckCategory, string> = {
  general: 'Gén.',
  bati: 'Bâti',
  menuiseries: 'Menuis.',
  parois_vitrees: 'Vitrage',
  chauffage: 'Chauf.',
  ecs: 'ECS',
  ventilation: 'Ventil.',
  climatisation: 'Clim.',
  enr: 'ENR',
  eclairage: 'Éclair.',
  ponts_thermiques: 'Ponts',
  pieces: 'Pièce',
}
