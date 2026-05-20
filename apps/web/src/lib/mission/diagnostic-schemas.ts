/**
 * KOVAS — Schémas diagnostics (V1.5 iteration 1, fondations).
 *
 * Authority : CLAUDE.md §3 (8 diagnostics MVP V1.5) + iteration 1 mode Capture-First.
 *
 * IMPORTANT — VALIDATION RÉGLEMENTAIRE :
 * Les sections marquées `needsRegulatoryValidation: true` doivent être validées avec
 * l'advisor diagnostiqueur (CLAUDE.md §18) AVANT toute génération de rapport client.
 * Les valeurs réglementaires (épaisseurs minimum isolation, classes énergie, etc.) ne
 * sont volontairement PAS codées en dur ici — elles seront extraites des règlements
 * officiels DPE 3CL-2021 et amiante NF X 46-020 dans un module séparé `regulatory-rules.ts`.
 */

import type { DiagnosticSchema, DiagnosticType } from './types'

// ============================================
// DPE — Diagnostic de Performance Énergétique
// ============================================
// Référentiel : méthode 3CL-2021 (arrêté du 31 mars 2021).
// TODO VALIDATION REGLEMENTAIRE : champs métier à valider avec advisor diagnostiqueur
// avant tout calcul DPE (Phase 2). En Phase 1, ce schéma sert uniquement à structurer
// la collecte terrain — KOVAS ne CALCULE PAS encore le DPE certifié.

export const DPE_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'DPE',
  version: '2025.1',
  description:
    "Collecte terrain DPE — Phase 1 KOVAS. Le calcul énergétique 3CL-2021 reste dans le logiciel principal du diagnostiqueur (Liciel) jusqu'à certification ADEME Phase 2.",
  sections: [
    {
      id: 'identite_bien',
      label: 'Identité du bien',
      description: 'Caractéristiques générales du logement diagnostiqué.',
      fields: [
        {
          path: 'identite_bien.type_bien',
          label: 'Type de bien',
          kind: 'enum',
          required: true,
          options: [
            { value: 'maison_individuelle', label: 'Maison individuelle' },
            { value: 'appartement', label: 'Appartement' },
            { value: 'immeuble_collectif', label: 'Immeuble collectif' },
          ],
        },
        {
          path: 'identite_bien.annee_construction',
          label: 'Année de construction',
          kind: 'year',
          required: true,
          min: 1800,
          max: 2100,
        },
        {
          path: 'identite_bien.annee_renovation_majeure',
          label: 'Année dernière rénovation majeure',
          kind: 'year',
          min: 1800,
          max: 2100,
        },
        {
          path: 'identite_bien.surface_habitable_m2',
          label: 'Surface habitable (m²)',
          kind: 'number',
          unit: 'm²',
          required: true,
          min: 1,
          max: 10000,
        },
        {
          path: 'identite_bien.nombre_niveaux',
          label: 'Nombre de niveaux',
          kind: 'integer',
          min: 1,
          max: 20,
        },
        {
          path: 'identite_bien.hauteur_sous_plafond_m',
          label: 'Hauteur sous plafond (m)',
          kind: 'number',
          unit: 'm',
          min: 1.5,
          max: 6,
        },
        {
          path: 'identite_bien.usage',
          label: 'Usage du bien',
          kind: 'enum',
          options: [
            { value: 'residence_principale', label: 'Résidence principale' },
            { value: 'residence_secondaire', label: 'Résidence secondaire' },
            { value: 'locatif', label: 'Locatif' },
          ],
        },
      ],
    },
    {
      id: 'enveloppe',
      label: 'Enveloppe du bâtiment',
      description: "Caractéristiques thermiques de l'enveloppe (isolation, menuiseries).",
      fields: [],
      subsections: [
        {
          id: 'isolation_combles',
          label: 'Isolation des combles',
          fields: [
            {
              path: 'enveloppe.isolation_combles.presente',
              label: 'Isolation présente ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'enveloppe.isolation_combles.type',
              label: "Type d'isolant",
              kind: 'enum',
              options: [
                { value: 'laine_verre', label: 'Laine de verre' },
                { value: 'laine_roche', label: 'Laine de roche' },
                { value: 'ouate_cellulose', label: 'Ouate de cellulose' },
                { value: 'polystyrene', label: 'Polystyrène' },
                { value: 'polyurethane', label: 'Polyuréthane' },
                { value: 'fibre_bois', label: 'Fibre de bois' },
                { value: 'autre', label: 'Autre' },
                { value: 'inconnu', label: 'Inconnu' },
              ],
            },
            {
              path: 'enveloppe.isolation_combles.epaisseur_cm',
              label: 'Épaisseur (cm)',
              kind: 'number',
              unit: 'cm',
              min: 0,
              max: 100,
            },
            {
              path: 'enveloppe.isolation_combles.annee_pose',
              label: 'Année de pose',
              kind: 'year',
              min: 1900,
              max: 2100,
            },
            {
              path: 'enveloppe.isolation_combles.etat',
              label: "État de l'isolant",
              kind: 'enum',
              options: [
                { value: 'bon', label: 'Bon' },
                { value: 'moyen', label: 'Moyen' },
                { value: 'degrade', label: 'Dégradé' },
              ],
            },
          ],
        },
        {
          id: 'isolation_murs',
          label: 'Isolation des murs',
          fields: [
            {
              path: 'enveloppe.isolation_murs.presente',
              label: 'Isolation présente ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'enveloppe.isolation_murs.position',
              label: 'Position',
              kind: 'enum',
              options: [
                { value: 'iti', label: 'Isolation thermique intérieure (ITI)' },
                { value: 'ite', label: 'Isolation thermique extérieure (ITE)' },
                { value: 'iti_ite', label: 'Mixte ITI + ITE' },
                { value: 'aucune', label: 'Aucune' },
              ],
            },
            {
              path: 'enveloppe.isolation_murs.materiau_mur',
              label: 'Matériau du mur porteur',
              kind: 'enum',
              options: [
                { value: 'parpaing', label: 'Parpaing / agglo' },
                { value: 'brique_creuse', label: 'Brique creuse' },
                { value: 'brique_pleine', label: 'Brique pleine' },
                { value: 'pierre', label: 'Pierre' },
                { value: 'beton_banche', label: 'Béton banché' },
                { value: 'ossature_bois', label: 'Ossature bois' },
                { value: 'autre', label: 'Autre' },
                { value: 'inconnu', label: 'Inconnu' },
              ],
            },
            {
              path: 'enveloppe.isolation_murs.epaisseur_isolant_cm',
              label: "Épaisseur de l'isolant (cm)",
              kind: 'number',
              unit: 'cm',
              min: 0,
              max: 50,
            },
            {
              path: 'enveloppe.isolation_murs.type_isolant',
              label: "Type d'isolant",
              kind: 'string',
            },
          ],
        },
        {
          id: 'isolation_plancher',
          label: 'Isolation du plancher bas',
          fields: [
            {
              path: 'enveloppe.isolation_plancher.presente',
              label: 'Isolation présente ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'enveloppe.isolation_plancher.type_plancher',
              label: 'Type de plancher bas',
              kind: 'enum',
              options: [
                { value: 'sur_vide_sanitaire', label: 'Sur vide sanitaire' },
                { value: 'sur_terre_plein', label: 'Sur terre-plein' },
                { value: 'sur_local_non_chauffe', label: 'Sur local non chauffé' },
                { value: 'sur_exterieur', label: 'Sur extérieur (porche, parking)' },
              ],
            },
            {
              path: 'enveloppe.isolation_plancher.epaisseur_cm',
              label: 'Épaisseur (cm)',
              kind: 'number',
              unit: 'cm',
              min: 0,
              max: 30,
            },
          ],
        },
        {
          id: 'menuiseries',
          label: 'Menuiseries extérieures',
          description: 'Inventaire des fenêtres, baies, portes extérieures.',
          fields: [
            {
              path: 'enveloppe.menuiseries.type_vitrage_dominant',
              label: 'Vitrage dominant',
              kind: 'enum',
              required: true,
              options: [
                { value: 'simple', label: 'Simple vitrage' },
                { value: 'double_ancien', label: 'Double vitrage ancien (avant 2000)' },
                { value: 'double_recent', label: 'Double vitrage récent (faible émissivité)' },
                { value: 'triple', label: 'Triple vitrage' },
                { value: 'mixte', label: 'Mixte' },
              ],
            },
            {
              path: 'enveloppe.menuiseries.materiau_dominant',
              label: 'Matériau dominant des menuiseries',
              kind: 'enum',
              options: [
                { value: 'pvc', label: 'PVC' },
                { value: 'bois', label: 'Bois' },
                { value: 'alu', label: 'Aluminium' },
                { value: 'alu_rupture', label: 'Alu à rupture de pont thermique' },
                { value: 'mixte', label: 'Mixte' },
              ],
            },
            {
              path: 'enveloppe.menuiseries.annee_pose_dominante',
              label: 'Année de pose dominante',
              kind: 'year',
              min: 1900,
              max: 2100,
            },
            {
              path: 'enveloppe.menuiseries.presence_volets',
              label: 'Volets extérieurs ?',
              kind: 'boolean',
            },
            {
              path: 'enveloppe.menuiseries.type_volets',
              label: 'Type de volets',
              kind: 'enum',
              options: [
                { value: 'battants_bois', label: 'Battants bois' },
                { value: 'battants_pvc', label: 'Battants PVC' },
                { value: 'roulants_manuels', label: 'Roulants manuels' },
                { value: 'roulants_electriques', label: 'Roulants électriques' },
                { value: 'persiennes', label: 'Persiennes' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'systeme_chauffage',
      label: 'Système de chauffage',
      description: "Production de chaleur principale + éventuelles sources d'appoint.",
      fields: [
        {
          path: 'systeme_chauffage.energie_principale',
          label: 'Énergie principale',
          kind: 'enum',
          required: true,
          options: [
            { value: 'gaz_naturel', label: 'Gaz naturel' },
            { value: 'fioul', label: 'Fioul' },
            { value: 'electricite', label: 'Électricité' },
            { value: 'bois_buches', label: 'Bois bûches' },
            { value: 'bois_granules', label: 'Bois granulés' },
            { value: 'pac_air_eau', label: 'PAC air/eau' },
            { value: 'pac_air_air', label: 'PAC air/air' },
            { value: 'pac_geothermique', label: 'PAC géothermique' },
            { value: 'reseau_chaleur', label: 'Réseau de chaleur urbain' },
            { value: 'gpl', label: 'GPL' },
            { value: 'charbon', label: 'Charbon' },
            { value: 'autre', label: 'Autre' },
          ],
        },
        {
          path: 'systeme_chauffage.type_generateur',
          label: 'Type de générateur',
          kind: 'enum',
          options: [
            { value: 'chaudiere_classique', label: 'Chaudière classique' },
            { value: 'chaudiere_basse_temp', label: 'Chaudière basse température' },
            { value: 'chaudiere_condensation', label: 'Chaudière à condensation' },
            { value: 'chaudiere_micro_cogeneration', label: 'Chaudière micro-cogénération' },
            { value: 'convecteurs_elec', label: 'Convecteurs électriques' },
            { value: 'rayonnants_elec', label: 'Panneaux rayonnants électriques' },
            { value: 'inertie_elec', label: 'Radiateurs à inertie' },
            { value: 'pac', label: 'Pompe à chaleur' },
            { value: 'poele', label: 'Poêle' },
            { value: 'insert', label: 'Insert' },
            { value: 'autre', label: 'Autre' },
          ],
        },
        {
          path: 'systeme_chauffage.marque',
          label: 'Marque',
          kind: 'string',
        },
        {
          path: 'systeme_chauffage.modele',
          label: 'Modèle',
          kind: 'string',
        },
        {
          path: 'systeme_chauffage.annee_installation',
          label: "Année d'installation",
          kind: 'year',
          min: 1950,
          max: 2100,
          // TODO VALIDATION REGLEMENTAIRE : seuils d'âge déclenchant un signal "à remplacer"
          needsRegulatoryValidation: true,
        },
        {
          path: 'systeme_chauffage.puissance_kw',
          label: 'Puissance (kW)',
          kind: 'number',
          unit: 'kW',
          min: 0,
          max: 500,
        },
        {
          path: 'systeme_chauffage.rendement_pourcent',
          label: 'Rendement (%) si plaque',
          kind: 'number',
          unit: '%',
          min: 0,
          max: 200, // PAC peut dépasser 100 (COP)
        },
        {
          path: 'systeme_chauffage.emetteurs',
          label: 'Type des émetteurs',
          kind: 'enum',
          options: [
            { value: 'radiateurs_eau', label: 'Radiateurs à eau chaude' },
            { value: 'plancher_chauffant', label: 'Plancher chauffant' },
            { value: 'plafond_rayonnant', label: 'Plafond rayonnant' },
            { value: 'soufflage_air', label: "Soufflage d'air (PAC air/air, gainable)" },
            { value: 'radiateurs_elec', label: 'Radiateurs électriques' },
            { value: 'aucun', label: 'Aucun (poêle seul)' },
          ],
        },
        {
          path: 'systeme_chauffage.presence_regulation',
          label: 'Régulation présente ?',
          kind: 'boolean',
        },
        {
          path: 'systeme_chauffage.type_regulation',
          label: 'Type de régulation',
          kind: 'enum',
          options: [
            { value: 'thermostat_simple', label: 'Thermostat simple' },
            { value: 'thermostat_programmable', label: 'Thermostat programmable' },
            { value: 'sonde_exterieure', label: 'Sonde extérieure' },
            { value: 'domotique', label: 'Domotique / pilotage app' },
          ],
        },
      ],
    },
    {
      id: 'ecs',
      label: 'Eau Chaude Sanitaire (ECS)',
      description: 'Production ECS principale.',
      fields: [
        {
          path: 'ecs.energie',
          label: 'Énergie ECS',
          kind: 'enum',
          required: true,
          options: [
            { value: 'electricite', label: 'Électricité' },
            { value: 'gaz_naturel', label: 'Gaz naturel' },
            { value: 'fioul', label: 'Fioul' },
            { value: 'solaire', label: 'Solaire thermique' },
            { value: 'pac', label: 'Pompe à chaleur (chauffe-eau thermo)' },
            { value: 'reseau_chaleur', label: 'Réseau de chaleur' },
            { value: 'instantane_gaz', label: 'Instantané gaz' },
            { value: 'mixte_chauffage', label: 'Mixte chauffage (combinée)' },
          ],
        },
        {
          path: 'ecs.type_appareil',
          label: "Type d'appareil",
          kind: 'enum',
          options: [
            { value: 'cumulus_electrique', label: 'Cumulus électrique' },
            { value: 'thermodynamique', label: 'Chauffe-eau thermodynamique' },
            { value: 'chaudiere_double_service', label: 'Chaudière double service' },
            { value: 'ballon_solaire', label: 'Ballon solaire' },
            { value: 'instantane', label: 'Instantané' },
            { value: 'autre', label: 'Autre' },
          ],
        },
        {
          path: 'ecs.capacite_litres',
          label: 'Capacité (L)',
          kind: 'integer',
          unit: 'L',
          min: 0,
          max: 1000,
        },
        {
          path: 'ecs.annee_installation',
          label: "Année d'installation",
          kind: 'year',
          min: 1950,
          max: 2100,
        },
        {
          path: 'ecs.marque_modele',
          label: 'Marque / modèle',
          kind: 'string',
        },
        {
          path: 'ecs.position',
          label: "Position de l'appareil",
          kind: 'enum',
          options: [
            { value: 'volume_chauffe', label: 'Dans le volume chauffé' },
            { value: 'hors_volume', label: 'Hors volume chauffé' },
            { value: 'partiellement', label: 'Partiellement dans le volume' },
          ],
        },
      ],
    },
    {
      id: 'ventilation',
      label: 'Ventilation',
      fields: [
        {
          path: 'ventilation.type',
          label: 'Type de ventilation',
          kind: 'enum',
          required: true,
          options: [
            { value: 'naturelle', label: 'Naturelle (aérations basses et hautes)' },
            { value: 'vmc_simple_auto', label: 'VMC simple flux autoréglable' },
            { value: 'vmc_simple_hygro_a', label: 'VMC simple flux hygro A' },
            { value: 'vmc_simple_hygro_b', label: 'VMC simple flux hygro B' },
            { value: 'vmc_double_flux', label: 'VMC double flux' },
            { value: 'vmc_double_flux_thermo', label: 'VMC double flux thermodynamique' },
            { value: 'absente', label: 'Absente / inopérante' },
          ],
        },
        {
          path: 'ventilation.annee_installation',
          label: "Année d'installation",
          kind: 'year',
          min: 1950,
          max: 2100,
        },
        {
          path: 'ventilation.etat',
          label: 'État',
          kind: 'enum',
          options: [
            { value: 'bon', label: 'Bon' },
            { value: 'moyen', label: 'Moyen' },
            { value: 'degrade', label: 'Dégradé / à remplacer' },
          ],
        },
        {
          path: 'ventilation.bouches_dans_pieces_humides',
          label: "Bouches d'extraction présentes dans les pièces humides ?",
          kind: 'boolean',
        },
      ],
    },
    {
      id: 'climatisation',
      label: 'Climatisation',
      fields: [
        {
          path: 'climatisation.presente',
          label: 'Climatisation présente ?',
          kind: 'boolean',
          required: true,
        },
        {
          path: 'climatisation.type',
          label: 'Type',
          kind: 'enum',
          options: [
            { value: 'mono_split', label: 'Mono-split' },
            { value: 'multi_split', label: 'Multi-split' },
            { value: 'gainable', label: 'Gainable' },
            { value: 'mobile', label: 'Mobile' },
          ],
        },
        {
          path: 'climatisation.nb_unites_interieures',
          label: "Nombre d'unités intérieures",
          kind: 'integer',
          min: 0,
          max: 30,
        },
        {
          path: 'climatisation.annee_installation',
          label: "Année d'installation",
          kind: 'year',
          min: 1980,
          max: 2100,
        },
      ],
    },
    {
      id: 'equipements_complementaires',
      label: 'Équipements complémentaires',
      description: 'ENR, domotique, autres équipements impactant le DPE.',
      fields: [
        {
          path: 'equipements_complementaires.photovoltaique_present',
          label: 'Panneaux photovoltaïques ?',
          kind: 'boolean',
        },
        {
          path: 'equipements_complementaires.photovoltaique_puissance_kwc',
          label: 'Puissance photovoltaïque (kWc)',
          kind: 'number',
          unit: 'kWc',
          min: 0,
          max: 100,
        },
        {
          path: 'equipements_complementaires.solaire_thermique_present',
          label: 'Solaire thermique ?',
          kind: 'boolean',
        },
        {
          path: 'equipements_complementaires.cheminee_ouverte',
          label: 'Cheminée ouverte (non insert) ?',
          kind: 'boolean',
        },
        {
          path: 'equipements_complementaires.poele_appoint',
          label: 'Poêle / insert en appoint ?',
          kind: 'boolean',
        },
        {
          path: 'equipements_complementaires.domotique_pilotage_chauffage',
          label: 'Pilotage du chauffage par domotique ?',
          kind: 'boolean',
        },
      ],
    },
  ],
}

// ============================================
// AMIANTE — Diagnostic amiante avant-vente
// ============================================
// Référentiel : Code Santé Publique R1334-15 à R1334-29, NF X 46-020.
// TODO VALIDATION REGLEMENTAIRE : la liste exhaustive des matériaux à inspecter
// (Annexe 13-9 du CSP) doit être validée par l'advisor avant prod. Ici, on couvre
// les principaux pour la collecte terrain V1.5.

export const AMIANTE_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'AMIANTE',
  version: '2025.1',
  description:
    "Collecte terrain Amiante — Phase 1 KOVAS. Repérage visuel des matériaux et produits susceptibles de contenir de l'amiante (liste A et B de l'annexe 13-9 CSP).",
  sections: [
    {
      id: 'donnees_generales',
      label: 'Données générales',
      fields: [
        {
          path: 'donnees_generales.permis_construire_avant_1997',
          label: 'Permis de construire antérieur au 1er juillet 1997 ?',
          kind: 'boolean',
          required: true,
          description:
            "Si NON, le diagnostic amiante n'est en principe pas requis (sauf cas particulier).",
        },
        {
          path: 'donnees_generales.date_permis_construire',
          label: 'Date du permis de construire (si disponible)',
          kind: 'date',
        },
        {
          path: 'donnees_generales.usage_actuel',
          label: 'Usage actuel du bien',
          kind: 'enum',
          options: [
            { value: 'habitation', label: 'Habitation' },
            { value: 'mixte_pro_habitation', label: 'Mixte pro / habitation' },
            { value: 'professionnel', label: 'Professionnel' },
            { value: 'vacant', label: 'Vacant' },
          ],
        },
        {
          path: 'donnees_generales.precedents_diagnostics',
          label: 'Présence de diagnostics amiante antérieurs ?',
          kind: 'boolean',
        },
        {
          path: 'donnees_generales.date_dernier_diag',
          label: 'Date du dernier diagnostic amiante (si applicable)',
          kind: 'date',
        },
      ],
    },
    {
      id: 'inspection_visuelle',
      label: 'Inspection visuelle des matériaux',
      description:
        'Repérage visuel des matériaux de la liste A (flocages, calorifugeages, faux-plafonds) et de la liste B (sols, conduits, toiture, ...).',
      fields: [],
      subsections: [
        {
          id: 'dalles_sol',
          label: 'Dalles de sol / revêtements souples',
          fields: [
            {
              path: 'inspection_visuelle.dalles_sol.presence_suspectee',
              label: 'Présence suspectée ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'inspection_visuelle.dalles_sol.localisation',
              label: 'Localisation (pièces concernées)',
              kind: 'string',
            },
            {
              path: 'inspection_visuelle.dalles_sol.surface_estimee_m2',
              label: 'Surface estimée (m²)',
              kind: 'number',
              unit: 'm²',
              min: 0,
              max: 10000,
            },
            {
              path: 'inspection_visuelle.dalles_sol.etat_conservation',
              label: 'État de conservation',
              kind: 'enum',
              options: [
                { value: 'bon', label: 'Bon état' },
                { value: 'degrade', label: 'Légèrement dégradé' },
                { value: 'tres_degrade', label: 'Très dégradé' },
              ],
              // TODO VALIDATION REGLEMENTAIRE : grille d'évaluation NF X 46-020 §6.3
              needsRegulatoryValidation: true,
            },
            {
              path: 'inspection_visuelle.dalles_sol.recouvert',
              label: 'Recouvert par un autre revêtement ?',
              kind: 'boolean',
            },
            {
              path: 'inspection_visuelle.dalles_sol.prelevement_recommande',
              label: 'Prélèvement recommandé ?',
              kind: 'boolean',
            },
          ],
        },
        {
          id: 'calorifugeages',
          label: 'Calorifugeages (tuyaux, chaudières)',
          fields: [
            {
              path: 'inspection_visuelle.calorifugeages.presence_suspectee',
              label: 'Présence suspectée ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'inspection_visuelle.calorifugeages.localisation',
              label: 'Localisation',
              kind: 'string',
            },
            {
              path: 'inspection_visuelle.calorifugeages.lineaire_m',
              label: 'Linéaire estimé (m)',
              kind: 'number',
              unit: 'm',
              min: 0,
              max: 10000,
            },
            {
              path: 'inspection_visuelle.calorifugeages.etat_conservation',
              label: 'État de conservation',
              kind: 'enum',
              options: [
                { value: 'bon', label: 'Bon état' },
                { value: 'degrade', label: 'Dégradé' },
                { value: 'tres_degrade', label: 'Très dégradé' },
              ],
              needsRegulatoryValidation: true,
            },
            {
              path: 'inspection_visuelle.calorifugeages.prelevement_recommande',
              label: 'Prélèvement recommandé ?',
              kind: 'boolean',
            },
          ],
        },
        {
          id: 'flocages',
          label: 'Flocages (projections fibreuses sur structures)',
          fields: [
            {
              path: 'inspection_visuelle.flocages.presence_suspectee',
              label: 'Présence suspectée ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'inspection_visuelle.flocages.localisation',
              label: 'Localisation',
              kind: 'string',
            },
            {
              path: 'inspection_visuelle.flocages.surface_estimee_m2',
              label: 'Surface estimée (m²)',
              kind: 'number',
              unit: 'm²',
              min: 0,
              max: 10000,
            },
            {
              path: 'inspection_visuelle.flocages.etat_conservation',
              label: 'État de conservation',
              kind: 'enum',
              options: [
                { value: 'bon', label: 'Bon état' },
                { value: 'degrade', label: 'Dégradé' },
                { value: 'tres_degrade', label: 'Très dégradé' },
              ],
              needsRegulatoryValidation: true,
            },
            {
              path: 'inspection_visuelle.flocages.prelevement_recommande',
              label: 'Prélèvement recommandé ?',
              kind: 'boolean',
            },
          ],
        },
        {
          id: 'faux_plafonds',
          label: 'Faux-plafonds (dalles minérales)',
          fields: [
            {
              path: 'inspection_visuelle.faux_plafonds.presence_suspectee',
              label: 'Présence suspectée ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'inspection_visuelle.faux_plafonds.localisation',
              label: 'Localisation',
              kind: 'string',
            },
            {
              path: 'inspection_visuelle.faux_plafonds.surface_estimee_m2',
              label: 'Surface estimée (m²)',
              kind: 'number',
              unit: 'm²',
              min: 0,
              max: 10000,
            },
            {
              path: 'inspection_visuelle.faux_plafonds.etat_conservation',
              label: 'État de conservation',
              kind: 'enum',
              options: [
                { value: 'bon', label: 'Bon état' },
                { value: 'degrade', label: 'Dégradé' },
                { value: 'tres_degrade', label: 'Très dégradé' },
              ],
              needsRegulatoryValidation: true,
            },
            {
              path: 'inspection_visuelle.faux_plafonds.prelevement_recommande',
              label: 'Prélèvement recommandé ?',
              kind: 'boolean',
            },
          ],
        },
        {
          id: 'conduits',
          label: 'Conduits (gaines, descentes EP, conduits de fumée)',
          fields: [
            {
              path: 'inspection_visuelle.conduits.presence_suspectee',
              label: 'Présence suspectée ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'inspection_visuelle.conduits.type',
              label: 'Type',
              kind: 'enum',
              options: [
                { value: 'descente_eaux_pluviales', label: 'Descente eaux pluviales' },
                { value: 'evacuation_eaux_usees', label: 'Évacuation eaux usées' },
                { value: 'conduit_fumee', label: 'Conduit de fumée' },
                { value: 'gaine_ventilation', label: 'Gaine de ventilation' },
                { value: 'autre', label: 'Autre' },
              ],
            },
            {
              path: 'inspection_visuelle.conduits.localisation',
              label: 'Localisation',
              kind: 'string',
            },
            {
              path: 'inspection_visuelle.conduits.lineaire_m',
              label: 'Linéaire estimé (m)',
              kind: 'number',
              unit: 'm',
              min: 0,
              max: 10000,
            },
            {
              path: 'inspection_visuelle.conduits.etat_conservation',
              label: 'État de conservation',
              kind: 'enum',
              options: [
                { value: 'bon', label: 'Bon état' },
                { value: 'degrade', label: 'Dégradé' },
                { value: 'tres_degrade', label: 'Très dégradé' },
              ],
              needsRegulatoryValidation: true,
            },
            {
              path: 'inspection_visuelle.conduits.prelevement_recommande',
              label: 'Prélèvement recommandé ?',
              kind: 'boolean',
            },
          ],
        },
        {
          id: 'toiture',
          label: 'Toiture (plaques ondulées, ardoises fibrociment)',
          fields: [
            {
              path: 'inspection_visuelle.toiture.presence_suspectee',
              label: 'Présence suspectée ?',
              kind: 'boolean',
              required: true,
            },
            {
              path: 'inspection_visuelle.toiture.materiau_apparent',
              label: 'Matériau apparent',
              kind: 'enum',
              options: [
                { value: 'plaques_ondulees', label: 'Plaques ondulées' },
                { value: 'ardoises_fibrociment', label: 'Ardoises fibrociment' },
                { value: 'shingle', label: 'Shingle bitumeux' },
                { value: 'autre', label: 'Autre' },
              ],
            },
            {
              path: 'inspection_visuelle.toiture.surface_estimee_m2',
              label: 'Surface estimée (m²)',
              kind: 'number',
              unit: 'm²',
              min: 0,
              max: 100000,
            },
            {
              path: 'inspection_visuelle.toiture.accessible',
              label: 'Toiture accessible / visible ?',
              kind: 'boolean',
            },
            {
              path: 'inspection_visuelle.toiture.etat_conservation',
              label: 'État de conservation',
              kind: 'enum',
              options: [
                { value: 'bon', label: 'Bon état' },
                { value: 'degrade', label: 'Dégradé (mousse, fissures)' },
                { value: 'tres_degrade', label: 'Très dégradé (casse, fibres apparentes)' },
              ],
              needsRegulatoryValidation: true,
            },
            {
              path: 'inspection_visuelle.toiture.prelevement_recommande',
              label: 'Prélèvement recommandé ?',
              kind: 'boolean',
            },
          ],
        },
      ],
    },
  ],
}

// ============================================
// PLOMB — Constat Risque Exposition Plomb (CREP)
// ============================================
// Référentiel : art. L1334-5 CSP + arrêté du 19/08/2011 (méthodologie CREP).
// Obligation : bâti permis de construire antérieur au 01/01/1949, en vente ou location.
// Mesure par fluorescence X (XRF) — seuil réglementaire 1 mg/cm².
// TODO VALIDATION REGLEMENTAIRE : grille classes 0-1-2-3 (concentration × état) à valider
// par l'advisor diagnostiqueur (CLAUDE.md §18) avant prod.

export const PLOMB_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'PLOMB',
  version: '2025.1',
  description:
    'Collecte terrain CREP (Constat Risque Exposition Plomb) — Phase 1 KOVAS. Repérage par unité de diagnostic (UD) selon arrêté du 19/08/2011. Seuil réglementaire 1 mg/cm² ; classes 0 à 3 selon concentration + état.',
  sections: [
    {
      id: 'donnees_generales',
      label: 'Données générales',
      description: 'Conditions de déclenchement du CREP (art. L1334-5 CSP).',
      fields: [
        {
          path: 'donnees_generales.permis_construire_avant_1949',
          label: 'Permis de construire antérieur au 1er janvier 1949 ?',
          kind: 'boolean',
          required: true,
          description:
            "Si NON, le CREP n'est en principe pas requis (sauf exceptions ex. obligations annexes).",
          extractionHints: ['permis 1949', 'avant 1949', 'antérieur 1949', 'date de construction'],
        },
        {
          path: 'donnees_generales.surface_totale_m2',
          label: 'Surface totale inspectée (m²)',
          kind: 'number',
          unit: 'm²',
          required: true,
          min: 1,
          max: 10000,
          extractionHints: ['surface', 'm²', 'mètres carrés'],
        },
        {
          path: 'donnees_generales.nombre_logements',
          label: 'Nombre de logements (si copropriété)',
          kind: 'integer',
          min: 1,
          max: 500,
          extractionHints: ['copropriété', 'lots', 'logements'],
        },
      ],
    },
    {
      id: 'unites_diagnostic_inspection',
      label: 'Unités de diagnostic (UD)',
      description:
        'Inventaire des UD inspectées. Une UD = un élément de construction unique (substrat + revêtement + localisation). Mesure XRF en mg/cm², déduction classe 0-3 selon arrêté du 19/08/2011.',
      fields: [
        {
          path: 'unites_diagnostic_inspection.ud_list',
          label: 'Liste des UD inspectées',
          kind: 'array',
          description:
            "Tableau d'unités de diagnostic. Chaque UD porte : localisation, substrat, revêtement, concentration mg/cm², état, classe, note explicative.",
          extractionHints: [
            'mur',
            'plafond',
            'plinthe',
            'fenêtre',
            'porte',
            'escalier',
            'embrasure',
          ],
        },
        {
          path: 'unites_diagnostic_inspection.ud.localisation',
          label: "Localisation de l'UD",
          kind: 'string',
          description: 'Ex: "mur ouest cuisine", "plafond chambre 1", "embrasure fenêtre salon".',
          extractionHints: ['cuisine', 'salon', 'chambre', 'sdb', 'wc', 'couloir', 'entrée'],
        },
        {
          path: 'unites_diagnostic_inspection.ud.substrat',
          label: 'Substrat',
          kind: 'enum',
          options: [
            { value: 'platre', label: 'Plâtre' },
            { value: 'bois', label: 'Bois' },
            { value: 'metal', label: 'Métal' },
            { value: 'brique', label: 'Brique' },
            { value: 'beton', label: 'Béton' },
            { value: 'autre', label: 'Autre' },
          ],
          extractionHints: ['plâtre', 'bois', 'métal', 'fer', 'brique', 'béton'],
        },
        {
          path: 'unites_diagnostic_inspection.ud.revetement',
          label: 'Revêtement',
          kind: 'enum',
          options: [
            { value: 'peinture', label: 'Peinture' },
            { value: 'papier_peint', label: 'Papier peint' },
            { value: 'vernis', label: 'Vernis' },
            { value: 'lasure', label: 'Lasure' },
            { value: 'autre', label: 'Autre' },
          ],
          extractionHints: ['peinture', 'papier peint', 'vernis', 'lasure', 'enduit'],
        },
        {
          path: 'unites_diagnostic_inspection.ud.concentration_mg_cm2',
          label: 'Concentration mesurée (mg/cm²)',
          kind: 'number',
          unit: 'mg/cm²',
          min: 0,
          max: 50,
          description: 'Mesure XRF (fluorescence X). Seuil réglementaire CREP = 1 mg/cm².',
          extractionHints: ['mg/cm²', 'XRF', 'fluorescence', 'concentration plomb'],
        },
        {
          path: 'unites_diagnostic_inspection.ud.etat_conservation',
          label: "État de conservation de l'UD",
          kind: 'enum',
          options: [
            { value: 'non_visible', label: 'Non visible / recouvert' },
            { value: 'non_degrade', label: 'Non dégradé' },
            { value: 'etat_d_usage', label: "État d'usage" },
            { value: 'degrade', label: 'Dégradé' },
          ],
          // La formulation "état d'usage" / "dégradé" est réglementaire (arrêté 19/08/2011)
          // et conditionne la classe finale (0/1/2/3) + obligation notification ARS.
          needsRegulatoryValidation: true,
          extractionHints: ['écaillé', 'écaillement', 'pulvérulent', 'dégradé', 'fissures'],
        },
        {
          path: 'unites_diagnostic_inspection.ud.classe',
          label: 'Classe CREP (0 à 3)',
          kind: 'enum',
          options: [
            { value: '0', label: 'Classe 0 (concentration < 1 mg/cm²)' },
            { value: '1', label: 'Classe 1 (≥ 1 mg/cm², non dégradé)' },
            { value: '2', label: "Classe 2 (≥ 1 mg/cm², état d'usage)" },
            { value: '3', label: 'Classe 3 (≥ 1 mg/cm², dégradé)' },
          ],
          // Classe = combinaison concentration × état : déduction réglementaire stricte.
          needsRegulatoryValidation: true,
          extractionHints: ['classe', 'classe 0', 'classe 1', 'classe 2', 'classe 3'],
        },
        {
          path: 'unites_diagnostic_inspection.ud.note_explicative',
          label: 'Note explicative',
          kind: 'text',
          extractionHints: ['note', 'remarque', 'observation', 'commentaire'],
        },
      ],
    },
    {
      id: 'synthese',
      label: 'Synthèse CREP',
      description:
        'Bilan global + déclenchement obligations propriétaire (notification ARS si classe 3).',
      fields: [
        {
          path: 'synthese.presence_plomb_detecte',
          label: 'Présence de plomb détectée ?',
          kind: 'boolean',
          extractionHints: ['plomb détecté', 'présence plomb', 'positif'],
        },
        {
          path: 'synthese.classe_max_etablie',
          label: 'Classe maximale établie',
          kind: 'enum',
          options: [
            { value: '0', label: 'Classe 0' },
            { value: '1', label: 'Classe 1' },
            { value: '2', label: 'Classe 2' },
            { value: '3', label: 'Classe 3' },
          ],
          needsRegulatoryValidation: true,
          extractionHints: ['classe max', 'classe maximale'],
        },
        {
          path: 'synthese.nombre_ud_classe_3',
          label: "Nombre d'UD en classe 3 (urgence)",
          kind: 'integer',
          min: 0,
          max: 1000,
          // Si > 0 : obligation de notification ARS + travaux (art. R1334-7 CSP).
          needsRegulatoryValidation: true,
          extractionHints: ['classe 3', 'urgence', 'travaux', 'ARS'],
        },
        {
          path: 'synthese.risque_sante_present',
          label: 'Risque pour la santé identifié ?',
          kind: 'boolean',
          // Déclenche obligation notification ARS (art. L1334-9 CSP).
          needsRegulatoryValidation: true,
          extractionHints: ['risque sanitaire', 'risque santé', 'ARS', 'notification'],
        },
      ],
    },
  ],
}

// ============================================
// GAZ — État de l'installation intérieure de gaz
// ============================================
// Référentiel : norme NF X 46-020 + arrêté du 18/11/2013 (modifié) + arrêté du 23/02/2018.
// Obligation : installation > 15 ans, à la vente. Codes anomalies officiels : A1 (acceptable),
// A2 (à corriger sans urgence), DGI (Danger Grave et Immédiat → coupure obligatoire par opérateur).

export const GAZ_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'GAZ',
  version: '2025.1',
  description:
    'Collecte terrain état installation gaz — Phase 1 KOVAS. Repérage anomalies tuyauteries, raccordements, ventilation/évacuation selon NF X 46-020. Codes officiels A1 / A2 / DGI.',
  sections: [
    {
      id: 'donnees_generales',
      label: 'Données générales',
      fields: [
        {
          path: 'donnees_generales.installation_anterieure_15_ans',
          label: 'Installation gaz antérieure à 15 ans ?',
          kind: 'boolean',
          required: true,
          extractionHints: ['installation gaz', 'âge installation', '15 ans'],
        },
        {
          path: 'donnees_generales.type_gaz',
          label: 'Type de gaz',
          kind: 'enum',
          required: true,
          options: [
            { value: 'gaz_naturel', label: 'Gaz naturel' },
            { value: 'gpl', label: 'GPL' },
            { value: 'propane', label: 'Propane (citerne)' },
            { value: 'autre', label: 'Autre' },
          ],
          extractionHints: ['gaz naturel', 'GPL', 'propane', 'butane', 'citerne'],
        },
        {
          path: 'donnees_generales.nombre_chaudieres',
          label: 'Nombre de chaudières gaz',
          kind: 'integer',
          min: 0,
          max: 20,
          extractionHints: ['chaudière', 'chaudière gaz', 'générateur'],
        },
        {
          path: 'donnees_generales.nombre_appareils_cuisson',
          label: "Nombre d'appareils de cuisson gaz",
          kind: 'integer',
          min: 0,
          max: 20,
          extractionHints: ['cuisinière', 'gazinière', 'plaques gaz', 'table cuisson'],
        },
      ],
    },
    {
      id: 'tuyauteries_fixes',
      label: 'Tuyauteries fixes',
      description: 'Inspection des canalisations rigides reliant compteur/citerne aux appareils.',
      fields: [
        {
          path: 'tuyauteries_fixes.materiau',
          label: 'Matériau dominant',
          kind: 'enum',
          options: [
            { value: 'cuivre', label: 'Cuivre' },
            { value: 'acier_noir', label: 'Acier noir' },
            { value: 'polyethylene', label: 'Polyéthylène (enterré)' },
            { value: 'multi_couche', label: 'Multi-couche' },
            { value: 'autre', label: 'Autre' },
          ],
          extractionHints: ['cuivre', 'acier', 'polyéthylène', 'PE', 'multi-couche', 'tuyauterie'],
        },
        {
          path: 'tuyauteries_fixes.etat',
          label: 'État général',
          kind: 'enum',
          options: [
            { value: 'bon', label: 'Bon' },
            { value: 'defectueux', label: 'Défectueux' },
          ],
          // La qualification "défectueux" doit s'appuyer sur les critères NF X 46-020.
          needsRegulatoryValidation: true,
          extractionHints: ['bon état', 'corrosion', 'oxydation', 'défectueux'],
        },
        {
          path: 'tuyauteries_fixes.anomalies_detectees',
          label: 'Codes anomalies détectées',
          kind: 'array',
          description:
            'Codes officiels : A1 (acceptable), A2 (à corriger), DGI (danger grave immédiat).',
          // Codes A1/A2/DGI = vocabulaire réglementaire strict.
          needsRegulatoryValidation: true,
          extractionHints: ['A1', 'A2', 'DGI', 'danger grave', 'anomalie'],
        },
        {
          path: 'tuyauteries_fixes.localisation_anomalies',
          label: 'Localisation des anomalies',
          kind: 'string',
          extractionHints: ['cuisine', 'chaufferie', 'palier', 'cave', 'extérieur'],
        },
      ],
    },
    {
      id: 'raccordements_appareils',
      label: 'Raccordements aux appareils',
      description: 'Flexibles / tubes souples reliant la tuyauterie fixe aux appareils.',
      fields: [
        {
          path: 'raccordements_appareils.flexibles_normalises',
          label: 'Flexibles normalisés (NF) ?',
          kind: 'boolean',
          extractionHints: ['flexible', 'tube souple', 'NF', 'normalisé'],
        },
        {
          path: 'raccordements_appareils.dates_flexibles',
          label: 'Dates limites des flexibles',
          kind: 'array',
          description: 'Liste des dates de péremption (DLU) inscrites sur les flexibles.',
          extractionHints: ['date péremption', 'DLU', 'date limite', 'expiration'],
        },
        {
          path: 'raccordements_appareils.anomalies',
          label: 'Anomalies raccordements',
          kind: 'array',
          // Codes anomalies A1/A2/DGI applicables ici aussi.
          needsRegulatoryValidation: true,
          extractionHints: ['flexible périmé', 'A1', 'A2', 'DGI', 'fuite'],
        },
      ],
    },
    {
      id: 'ventilation_evacuation',
      label: 'Ventilation / évacuation des produits de combustion',
      description: "Conduits d'évacuation + aérations basses/hautes obligatoires.",
      fields: [
        {
          path: 'ventilation_evacuation.conduit_evacuation_present',
          label: "Conduit d'évacuation présent ?",
          kind: 'boolean',
          extractionHints: ['conduit évacuation', 'conduit fumée', 'ventouse', 'cheminée'],
        },
        {
          path: 'ventilation_evacuation.vmc_gaz_presente',
          label: 'VMC gaz présente ?',
          kind: 'boolean',
          extractionHints: ['VMC gaz', 'VMC', 'ventilation mécanique'],
        },
        {
          path: 'ventilation_evacuation.aerations_basses',
          label: 'Aérations basses présentes ?',
          kind: 'boolean',
          extractionHints: ['aération basse', 'entrée air', 'amenée air'],
        },
        {
          path: 'ventilation_evacuation.aerations_hautes',
          label: 'Aérations hautes présentes ?',
          kind: 'boolean',
          extractionHints: ['aération haute', 'sortie air', 'extraction'],
        },
      ],
    },
    {
      id: 'synthese',
      label: 'Synthèse installation gaz',
      fields: [
        {
          path: 'synthese.nombre_anomalies_a1',
          label: "Nombre d'anomalies A1 (acceptables)",
          kind: 'integer',
          min: 0,
          max: 100,
          needsRegulatoryValidation: true,
          extractionHints: ['A1'],
        },
        {
          path: 'synthese.nombre_anomalies_a2',
          label: "Nombre d'anomalies A2 (à corriger)",
          kind: 'integer',
          min: 0,
          max: 100,
          needsRegulatoryValidation: true,
          extractionHints: ['A2'],
        },
        {
          path: 'synthese.nombre_anomalies_dgi',
          label: "Nombre d'anomalies DGI (danger grave immédiat)",
          kind: 'integer',
          min: 0,
          max: 100,
          description:
            'DGI > 0 → coupure obligatoire par opérateur GRDF + travaux avant remise en service.',
          needsRegulatoryValidation: true,
          extractionHints: ['DGI', 'danger grave', 'coupure', 'GRDF'],
        },
        {
          path: 'synthese.installation_conforme',
          label: 'Installation conforme ?',
          kind: 'boolean',
          needsRegulatoryValidation: true,
          extractionHints: ['conforme', 'non conforme'],
        },
      ],
    },
  ],
}

// ============================================
// ELEC — État de l'installation intérieure d'électricité
// ============================================
// Référentiel : norme XP C 16-600 + arrêté du 28/09/2017.
// Obligation : installation > 15 ans, à la vente. Codes anomalies officiels B1 / B2 / B3.

export const ELEC_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'ELEC',
  version: '2025.1',
  description:
    'Collecte terrain état installation électrique — Phase 1 KOVAS. Vérification des 6 points obligatoires (AGCP, dispositif différentiel, protections circuits, liaison équipotentielle, matériels vétustes, conducteurs) selon XP C 16-600.',
  sections: [
    {
      id: 'donnees_generales',
      label: 'Données générales',
      fields: [
        {
          path: 'donnees_generales.installation_anterieure_15_ans',
          label: 'Installation électrique antérieure à 15 ans ?',
          kind: 'boolean',
          required: true,
          extractionHints: ['installation', '15 ans', 'âge'],
        },
        {
          path: 'donnees_generales.puissance_souscrite_kva',
          label: 'Puissance souscrite (kVA)',
          kind: 'number',
          unit: 'kVA',
          min: 0,
          max: 100,
          extractionHints: ['kVA', 'puissance souscrite', 'compteur', 'Linky'],
        },
        {
          path: 'donnees_generales.tableau_principal_localisation',
          label: 'Localisation du tableau principal',
          kind: 'string',
          extractionHints: ['tableau', 'tableau électrique', 'GTL', 'placard'],
        },
      ],
    },
    {
      id: 'agcp',
      label: 'Appareil Général de Commande et de Protection (AGCP)',
      description: "Disjoncteur de branchement ou organe équivalent en tête d'installation.",
      fields: [
        {
          path: 'agcp.present',
          label: 'AGCP présent ?',
          kind: 'boolean',
          required: true,
          extractionHints: ['AGCP', 'disjoncteur branchement', 'disjoncteur principal'],
        },
        {
          path: 'agcp.accessible',
          label: 'AGCP accessible ?',
          kind: 'boolean',
          extractionHints: ['accessible', 'visible', 'manoeuvrable'],
        },
        {
          path: 'agcp.type',
          label: "Type d'AGCP",
          kind: 'enum',
          options: [
            { value: 'disjoncteur_branchement', label: 'Disjoncteur de branchement' },
            { value: 'fusibles', label: 'Fusibles (ancien)' },
            { value: 'autre', label: 'Autre' },
          ],
          extractionHints: ['disjoncteur', 'fusible', 'porte-fusible'],
        },
      ],
    },
    {
      id: 'dispositif_differentiel',
      label: 'Dispositif différentiel résiduel (DDR)',
      description: "Protection 30 mA obligatoire en tête de circuits prises et salles d'eau.",
      fields: [
        {
          path: 'dispositif_differentiel.dr_30ma_present',
          label: 'DDR 30 mA présent ?',
          kind: 'boolean',
          required: true,
          extractionHints: ['30 mA', 'différentiel', 'DDR', 'interrupteur différentiel'],
        },
        {
          path: 'dispositif_differentiel.nombre_circuits_protected',
          label: 'Nombre de circuits protégés par DDR',
          kind: 'integer',
          min: 0,
          max: 100,
          extractionHints: ['circuits protégés', 'circuits différentiel'],
        },
        {
          path: 'dispositif_differentiel.anomalies_detectees',
          label: 'Anomalies détectées',
          kind: 'array',
          needsRegulatoryValidation: true,
          extractionHints: ['B1', 'B2', 'B3', 'anomalie différentiel'],
        },
      ],
    },
    {
      id: 'protections_circuits',
      label: 'Protections des circuits',
      description: 'Disjoncteurs divisionnaires / fusibles par circuit.',
      fields: [
        {
          path: 'protections_circuits.tous_circuits_proteges',
          label: 'Tous les circuits sont-ils protégés ?',
          kind: 'boolean',
          required: true,
          extractionHints: ['protection circuit', 'disjoncteur divisionnaire'],
        },
        {
          path: 'protections_circuits.presence_fil_pilote',
          label: 'Fil pilote présent (chauffage électrique) ?',
          kind: 'boolean',
          extractionHints: ['fil pilote', 'pilotage chauffage'],
        },
        {
          path: 'protections_circuits.presence_disjoncteur_divisionnaire',
          label: 'Disjoncteurs divisionnaires présents ?',
          kind: 'boolean',
          extractionHints: ['disjoncteur divisionnaire', 'disjoncteur unipolaire'],
        },
      ],
    },
    {
      id: 'liaison_equipotentielle_pieces_eau',
      label: "Liaison équipotentielle dans les pièces d'eau",
      description: 'Obligatoire dans salles de bains et cuisines (volumes 0/1/2).',
      fields: [
        {
          path: 'liaison_equipotentielle_pieces_eau.presente_salle_bain',
          label: 'Liaison équipotentielle salle de bain ?',
          kind: 'boolean',
          extractionHints: ['liaison équipotentielle', 'masse', 'salle de bain', 'sdb'],
        },
        {
          path: 'liaison_equipotentielle_pieces_eau.presente_cuisine',
          label: 'Liaison équipotentielle cuisine ?',
          kind: 'boolean',
          extractionHints: ['liaison équipotentielle', 'cuisine'],
        },
      ],
    },
    {
      id: 'materiels_vetustes',
      label: 'Matériels vétustes ou inadaptés',
      description: 'Recensement des éléments présentant un risque pour les personnes.',
      fields: [
        {
          path: 'materiels_vetustes.prises_terre_sans_protection',
          label: 'Prises sans terre / sans protection ?',
          kind: 'boolean',
          extractionHints: ['prise sans terre', 'prise 2P', 'pas de terre'],
        },
        {
          path: 'materiels_vetustes.fils_denudes_visibles',
          label: 'Fils dénudés visibles ?',
          kind: 'boolean',
          extractionHints: ['fil dénudé', 'conducteur apparent', 'gaine abimée'],
        },
        {
          path: 'materiels_vetustes.materiels_obsoletes_array',
          label: 'Matériels obsolètes recensés',
          kind: 'array',
          extractionHints: ['matériel ancien', 'fusible céramique', 'bakélite', 'porcelaine'],
        },
      ],
    },
    {
      id: 'synthese',
      label: 'Synthèse installation électrique',
      fields: [
        {
          path: 'synthese.nombre_anomalies_b1',
          label: "Nombre d'anomalies B1",
          kind: 'integer',
          min: 0,
          max: 100,
          needsRegulatoryValidation: true,
          extractionHints: ['B1'],
        },
        {
          path: 'synthese.nombre_anomalies_b2',
          label: "Nombre d'anomalies B2",
          kind: 'integer',
          min: 0,
          max: 100,
          needsRegulatoryValidation: true,
          extractionHints: ['B2'],
        },
        {
          path: 'synthese.nombre_anomalies_b3',
          label: "Nombre d'anomalies B3 (les plus graves)",
          kind: 'integer',
          min: 0,
          max: 100,
          needsRegulatoryValidation: true,
          extractionHints: ['B3', 'risque grave'],
        },
        {
          path: 'synthese.installation_conforme',
          label: 'Installation conforme ?',
          kind: 'boolean',
          needsRegulatoryValidation: true,
          extractionHints: ['conforme', 'non conforme'],
        },
      ],
    },
  ],
}

// ============================================
// TERMITES — État relatif à la présence de termites
// ============================================
// Référentiel : loi du 08/06/1999 + art. L133-6 CCH + arrêté préfectoral départemental.
// Obligation : zones à risque déclarées par arrêté préfectoral.

export const TERMITES_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'TERMITES',
  version: '2025.1',
  description:
    'Collecte terrain état parasitaire termites — Phase 1 KOVAS. Inspection visuelle non destructive en zones à risque préfectoral (loi 8/06/1999, art. L133-6 CCH).',
  sections: [
    {
      id: 'donnees_generales',
      label: 'Données générales',
      fields: [
        {
          path: 'donnees_generales.zone_risque_prefectoral',
          label: 'Zone à risque selon arrêté préfectoral ?',
          kind: 'boolean',
          required: true,
          extractionHints: ['arrêté préfectoral', 'zone à risque', 'zone infestée'],
        },
        {
          path: 'donnees_generales.arrete_prefectoral_reference',
          label: "Référence de l'arrêté préfectoral",
          kind: 'string',
          extractionHints: ['arrêté', 'préfecture', 'référence'],
        },
        {
          path: 'donnees_generales.date_arrete',
          label: "Date de l'arrêté préfectoral",
          kind: 'date',
          extractionHints: ['date arrêté', 'publication'],
        },
        {
          path: 'donnees_generales.surface_inspectee_m2',
          label: 'Surface inspectée (m²)',
          kind: 'number',
          unit: 'm²',
          required: true,
          min: 1,
          max: 100000,
          extractionHints: ['surface inspectée', 'm²'],
        },
      ],
    },
    {
      id: 'inspection_visuelle',
      label: 'Inspection visuelle par zone',
      description:
        'Tableau des zones inspectées (sous-sol, charpente, plinthes, encadrements, etc.) avec présence/traces/humidité.',
      fields: [
        {
          path: 'inspection_visuelle.zones',
          label: 'Zones inspectées',
          kind: 'array',
          extractionHints: ['sous-sol', 'cave', 'charpente', 'plinthes', 'menuiseries'],
        },
        {
          path: 'inspection_visuelle.zone.nom',
          label: 'Nom de la zone',
          kind: 'string',
          extractionHints: ['sous-sol', 'charpente', 'plinthe', 'huisserie', 'parquet'],
        },
        {
          path: 'inspection_visuelle.zone.accessibilite',
          label: 'Accessibilité de la zone',
          kind: 'enum',
          options: [
            { value: 'accessible', label: 'Accessible' },
            { value: 'partiellement_accessible', label: 'Partiellement accessible' },
            { value: 'non_accessible', label: 'Non accessible' },
          ],
          extractionHints: ['accessible', 'inaccessible', 'condamné', 'encombré'],
        },
        {
          path: 'inspection_visuelle.zone.presence_termites_visible',
          label: 'Présence de termites visible ?',
          kind: 'boolean',
          extractionHints: ['termites', 'galeries', 'cordons', 'tunnels boueux'],
        },
        {
          path: 'inspection_visuelle.zone.traces_anciennes',
          label: 'Traces anciennes (galeries, cordonnets) ?',
          kind: 'boolean',
          extractionHints: ['traces anciennes', 'galeries vides', 'cordonnets'],
        },
        {
          path: 'inspection_visuelle.zone.humidite_anormale',
          label: 'Humidité anormale (favorise termites) ?',
          kind: 'boolean',
          extractionHints: ['humidité', 'remontée capillaire', 'infiltration', 'moisissure'],
        },
        {
          path: 'inspection_visuelle.zone.bois_degrades',
          label: 'Bois dégradés (localisations)',
          kind: 'array',
          extractionHints: ['bois dégradé', 'bois pourri', 'bois mort', 'attaqué'],
        },
        {
          path: 'inspection_visuelle.zone.notes',
          label: 'Notes',
          kind: 'text',
          extractionHints: ['note', 'observation', 'remarque'],
        },
      ],
    },
    {
      id: 'autres_agents_destructeurs',
      label: 'Autres agents destructeurs du bois',
      description: 'Informatif (hors périmètre réglementaire termites stricto sensu).',
      fields: [
        {
          path: 'autres_agents_destructeurs.champignons_lignivores',
          label: 'Champignons lignivores (mérule, etc.) ?',
          kind: 'boolean',
          extractionHints: ['mérule', 'champignon', 'lignivore', 'pourriture cubique'],
        },
        {
          path: 'autres_agents_destructeurs.insectes_xylophages',
          label: 'Insectes xylophages identifiés',
          kind: 'array',
          extractionHints: [
            'capricorne',
            'vrillette',
            'lyctus',
            'sirex',
            'hespérophane',
            'xylophage',
          ],
        },
      ],
    },
    {
      id: 'synthese',
      label: 'Synthèse parasitaire',
      fields: [
        {
          path: 'synthese.presence_termites_confirmee',
          label: 'Présence de termites confirmée ?',
          kind: 'boolean',
          // Si oui : obligation de déclaration en mairie (art. L133-5 CCH).
          needsRegulatoryValidation: true,
          extractionHints: ['termites confirmés', 'présence avérée', 'déclaration mairie'],
        },
        {
          path: 'synthese.traitement_recommande',
          label: 'Traitement recommandé ?',
          kind: 'boolean',
          extractionHints: ['traitement', 'traitement curatif', 'éradication'],
        },
        {
          path: 'synthese.urgence_traitement',
          label: 'Urgence du traitement',
          kind: 'enum',
          options: [
            { value: 'aucune', label: 'Aucune' },
            { value: 'recommandee', label: 'Recommandée' },
            { value: 'urgente', label: 'Urgente' },
          ],
          needsRegulatoryValidation: true,
          extractionHints: ['urgent', 'recommandé', 'sans urgence'],
        },
      ],
    },
  ],
}

// ============================================
// CARREZ — Mesurage Loi Carrez / Boutin
// ============================================
// Référentiel Carrez : loi du 18/12/1996 (modifiant loi 10/07/1965), décret 17/05/1997.
// Référentiel Boutin : loi du 25/03/2009 (loi Molle), art. R111-2 CCH.
// Tolérance Carrez : ± 5% obligatoire.

export const CARREZ_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'CARREZ',
  version: '2025.1',
  description:
    'Collecte terrain mesurage Loi Carrez (vente lot copro > 8m²) / Loi Boutin (location vide non meublée). Carrez exclut surfaces sous plafond < 1,80 m ; Boutin exclut en plus balcons/loggias et surfaces utilitaires.',
  sections: [
    {
      id: 'donnees_generales',
      label: 'Données générales',
      fields: [
        {
          path: 'donnees_generales.type_mesurage',
          label: 'Type de mesurage demandé',
          kind: 'enum',
          required: true,
          options: [
            { value: 'carrez', label: 'Loi Carrez (vente)' },
            { value: 'boutin', label: 'Loi Boutin (location)' },
            { value: 'les_deux', label: 'Carrez + Boutin' },
          ],
          extractionHints: ['Carrez', 'Boutin', 'mesurage', 'vente', 'location'],
        },
        {
          path: 'donnees_generales.bien_en_copropriete',
          label: 'Bien en copropriété ?',
          kind: 'boolean',
          description: "La Loi Carrez ne s'applique qu'aux lots de copropriété > 8 m².",
          extractionHints: ['copropriété', 'lot', 'syndic'],
        },
        {
          path: 'donnees_generales.surface_totale_au_sol_m2',
          label: 'Surface totale au sol (m²)',
          kind: 'number',
          unit: 'm²',
          min: 0,
          max: 10000,
          extractionHints: ['surface totale', 'au sol', 'plancher'],
        },
      ],
    },
    {
      id: 'pieces_mesurees',
      label: 'Pièces mesurées',
      description:
        'Tableau pièce par pièce avec surfaces au sol, sous plafond < 1,80m, et calculs Carrez/Boutin.',
      fields: [
        {
          path: 'pieces_mesurees.list',
          label: 'Liste des pièces',
          kind: 'array',
          extractionHints: ['pièce', 'salon', 'chambre', 'cuisine'],
        },
        {
          path: 'pieces_mesurees.piece.nom',
          label: 'Nom de la pièce',
          kind: 'string',
          required: true,
          extractionHints: ['salon', 'séjour', 'chambre 1', 'chambre 2', 'cuisine', 'sdb', 'wc'],
        },
        {
          path: 'pieces_mesurees.piece.type_piece',
          label: 'Type de pièce',
          kind: 'enum',
          options: [
            { value: 'salon', label: 'Salon / séjour' },
            { value: 'chambre', label: 'Chambre' },
            { value: 'cuisine', label: 'Cuisine' },
            { value: 'sdb', label: 'Salle de bain' },
            { value: 'wc', label: 'WC' },
            { value: 'dressing', label: 'Dressing' },
            { value: 'couloir', label: 'Couloir / dégagement' },
            { value: 'autre', label: 'Autre' },
          ],
          extractionHints: ['salon', 'chambre', 'cuisine', 'sdb', 'wc'],
        },
        {
          path: 'pieces_mesurees.piece.surface_au_sol_m2',
          label: 'Surface au sol (m²)',
          kind: 'number',
          unit: 'm²',
          required: true,
          min: 0,
          max: 1000,
          extractionHints: ['surface', 'au sol', 'm²'],
        },
        {
          path: 'pieces_mesurees.piece.hauteur_sous_plafond_moyenne_m',
          label: 'Hauteur sous plafond moyenne (m)',
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 10,
          extractionHints: ['hauteur', 'sous plafond', 'HSP'],
        },
        {
          path: 'pieces_mesurees.piece.surface_sous_plafond_inferieur_180cm_m2',
          label: 'Surface sous plafond < 1,80 m (m²)',
          kind: 'number',
          unit: 'm²',
          min: 0,
          max: 1000,
          description: 'Exclue du calcul Carrez (et Boutin).',
          // Seuil 1,80 m est réglementaire (loi Carrez art. 4-1).
          needsRegulatoryValidation: true,
          extractionHints: ['sous-pente', 'mansardé', '1,80', '180 cm'],
        },
        {
          path: 'pieces_mesurees.piece.surface_loi_carrez_m2',
          label: 'Surface Loi Carrez (m²)',
          kind: 'number',
          unit: 'm²',
          min: 0,
          max: 1000,
          description: 'Surface au sol - surface sous plafond < 1,80 m.',
          needsRegulatoryValidation: true,
          extractionHints: ['Carrez', 'surface Carrez'],
        },
        {
          path: 'pieces_mesurees.piece.surface_loi_boutin_m2',
          label: 'Surface Loi Boutin (m²)',
          kind: 'number',
          unit: 'm²',
          min: 0,
          max: 1000,
          description: 'Surface Carrez modifiée : exclut sdb < 1,80 m², balcons, loggias.',
          needsRegulatoryValidation: true,
          extractionHints: ['Boutin', 'surface Boutin', 'habitable'],
        },
        {
          path: 'pieces_mesurees.piece.notes',
          label: 'Notes',
          kind: 'text',
          extractionHints: ['note', 'observation'],
        },
      ],
    },
    {
      id: 'espaces_non_mesures',
      label: 'Espaces non mesurés',
      description: 'Caves, balcons, garages, terrasses, parkings (exclus Carrez et Boutin).',
      fields: [
        {
          path: 'espaces_non_mesures.liste',
          label: 'Liste des espaces non mesurés',
          kind: 'array',
          extractionHints: ['cave', 'balcon', 'terrasse', 'garage', 'parking', 'loggia', 'véranda'],
        },
      ],
    },
    {
      id: 'synthese',
      label: 'Synthèse mesurage',
      fields: [
        {
          path: 'synthese.surface_carrez_totale_m2',
          label: 'Surface Carrez totale (m²)',
          kind: 'number',
          unit: 'm²',
          min: 0,
          max: 10000,
          needsRegulatoryValidation: true,
          extractionHints: ['Carrez total', 'surface Carrez'],
        },
        {
          path: 'synthese.surface_boutin_totale_m2',
          label: 'Surface Boutin totale (m²)',
          kind: 'number',
          unit: 'm²',
          min: 0,
          max: 10000,
          needsRegulatoryValidation: true,
          extractionHints: ['Boutin total', 'surface habitable'],
        },
        {
          path: 'synthese.nombre_pieces_principales',
          label: 'Nombre de pièces principales',
          kind: 'integer',
          min: 0,
          max: 50,
          extractionHints: ['T1', 'T2', 'T3', 'T4', 'T5', 'pièces principales'],
        },
        {
          path: 'synthese.tolerance_mesurage',
          label: 'Tolérance appliquée',
          kind: 'enum',
          options: [
            { value: '0_5_pct', label: '± 5% (Carrez obligatoire)' },
            { value: 'superieur', label: 'Supérieure (justifier)' },
          ],
          description: 'Tolérance de 5% obligatoire pour Loi Carrez (art. 46 loi 1965).',
          needsRegulatoryValidation: true,
          extractionHints: ['tolérance', '5%', 'marge'],
        },
      ],
    },
  ],
}

// ============================================
// ERP — État des Risques et Pollutions
// ============================================
// Référentiel : art. L125-5 et R125-23 à R125-27 Code Environnement.
// Depuis 01/01/2023 : remplace l'ESRIS / ERNMT et intègre radon + bruit + pollution sols.
// Source unique : Géorisques (georisques.gouv.fr) + arrêtés préfectoraux + IRSN radon.
// Validité : 6 mois avant la signature de l'acte.

export const ERP_SCHEMA: DiagnosticSchema = {
  diagnosticType: 'ERP',
  version: '2025.1',
  description:
    'Collecte État des Risques et Pollutions — Phase 1 KOVAS. Document obligatoire pour tout bien en vente ou location (art. L125-5 C. Env). Source Géorisques + arrêtés préfectoraux. Validité 6 mois.',
  sections: [
    {
      id: 'donnees_generales',
      label: 'Données générales',
      fields: [
        {
          path: 'donnees_generales.commune_insee',
          label: 'Code INSEE de la commune',
          kind: 'string',
          required: true,
          extractionHints: ['INSEE', 'code commune', 'commune'],
        },
        {
          path: 'donnees_generales.date_etablissement_etat',
          label: "Date d'établissement de l'état",
          kind: 'date',
          required: true,
          extractionHints: ['date', 'établi le'],
        },
        {
          path: 'donnees_generales.etat_valide_6_mois',
          label: 'État établi depuis moins de 6 mois ?',
          kind: 'boolean',
          // Validité réglementaire 6 mois (art. R125-26).
          needsRegulatoryValidation: true,
          extractionHints: ['6 mois', 'validité', 'périmé'],
        },
      ],
    },
    {
      id: 'risques_naturels',
      label: 'Risques naturels',
      description:
        'Inondation, séisme, mouvement terrain, argile, submersion, cyclone, feux forêt, volcanique, avalanche.',
      fields: [
        {
          path: 'risques_naturels.inondation_concernee',
          label: 'Bien concerné par risque inondation ?',
          kind: 'boolean',
          extractionHints: ['inondation', 'PPRI', 'crue', 'débordement'],
        },
        {
          path: 'risques_naturels.seisme_zone',
          label: 'Zone sismique',
          kind: 'enum',
          options: [
            { value: '1', label: 'Zone 1 (très faible)' },
            { value: '2', label: 'Zone 2 (faible)' },
            { value: '3', label: 'Zone 3 (modérée)' },
            { value: '4', label: 'Zone 4 (moyenne)' },
            { value: '5', label: 'Zone 5 (forte)' },
          ],
          // Zonage sismique décret 2010-1255 : valeur réglementaire stricte par commune.
          needsRegulatoryValidation: true,
          extractionHints: ['sismique', 'séisme', 'zone 1', 'zone 2', 'zone 3', 'zone 4', 'zone 5'],
        },
        {
          path: 'risques_naturels.mouvement_terrain',
          label: 'Mouvement de terrain ?',
          kind: 'boolean',
          extractionHints: ['mouvement terrain', 'glissement', 'éboulement', 'cavité'],
        },
        {
          path: 'risques_naturels.argile_concerne',
          label: 'Retrait-gonflement des argiles ?',
          kind: 'boolean',
          extractionHints: ['argile', 'retrait gonflement', 'RGA'],
        },
        {
          path: 'risques_naturels.submersion_marine',
          label: 'Submersion marine ?',
          kind: 'boolean',
          extractionHints: ['submersion', 'marine', 'littoral'],
        },
        {
          path: 'risques_naturels.cyclone',
          label: 'Cyclone (DOM) ?',
          kind: 'boolean',
          extractionHints: ['cyclone', 'ouragan', 'DOM'],
        },
        {
          path: 'risques_naturels.feux_foret',
          label: 'Feux de forêt ?',
          kind: 'boolean',
          extractionHints: ['feux forêt', 'incendie forêt', 'OLD'],
        },
        {
          path: 'risques_naturels.volcanique',
          label: 'Risque volcanique ?',
          kind: 'boolean',
          extractionHints: ['volcan', 'volcanique', 'éruption'],
        },
        {
          path: 'risques_naturels.avalanche',
          label: 'Avalanche ?',
          kind: 'boolean',
          extractionHints: ['avalanche', 'PPR neige'],
        },
      ],
    },
    {
      id: 'risques_miniers',
      label: 'Risques miniers',
      fields: [
        {
          path: 'risques_miniers.concerne',
          label: 'Bien concerné par risque minier ?',
          kind: 'boolean',
          extractionHints: ['minier', 'mine', 'PPRM', 'galerie', 'affaissement'],
        },
        {
          path: 'risques_miniers.type_minier',
          label: 'Type de risque minier',
          kind: 'enum',
          options: [
            { value: 'houiller', label: 'Houiller (charbon)' },
            { value: 'salin', label: 'Salin' },
            { value: 'ardoisier', label: 'Ardoisier' },
            { value: 'autre', label: 'Autre' },
          ],
          extractionHints: ['houiller', 'charbon', 'sel', 'ardoise'],
        },
      ],
    },
    {
      id: 'risques_technologiques',
      label: 'Risques technologiques',
      description: 'PPRT, sites Seveso, nucléaire, transport matières dangereuses.',
      fields: [
        {
          path: 'risques_technologiques.pprt_concerne',
          label: 'Plan de Prévention des Risques Technologiques (PPRT) ?',
          kind: 'boolean',
          extractionHints: ['PPRT', 'risque technologique', 'industriel'],
        },
        {
          path: 'risques_technologiques.seveso_proximite_km',
          label: 'Distance site Seveso le plus proche (km)',
          kind: 'number',
          unit: 'km',
          min: 0,
          max: 1000,
          extractionHints: ['Seveso', 'industriel', 'SH', 'SB'],
        },
        {
          path: 'risques_technologiques.nucleaire_proximite_km',
          label: 'Distance installation nucléaire la plus proche (km)',
          kind: 'number',
          unit: 'km',
          min: 0,
          max: 1000,
          extractionHints: ['nucléaire', 'centrale', 'INB', 'ASN'],
        },
        {
          path: 'risques_technologiques.transport_matieres_dangereuses',
          label: 'Transport de matières dangereuses (TMD) ?',
          kind: 'boolean',
          extractionHints: ['TMD', 'matières dangereuses', 'pipeline', 'gazoduc'],
        },
      ],
    },
    {
      id: 'pollution_sols',
      label: 'Pollution des sols',
      description: "Secteurs d'Information sur les Sols (SIS) + installations classées (ICPE).",
      fields: [
        {
          path: 'pollution_sols.secteur_sis_concerne',
          label: "Secteur d'Information sur les Sols (SIS) ?",
          kind: 'boolean',
          // SIS = secteur réglementaire défini par arrêté préfectoral (art. L125-6 C. Env).
          needsRegulatoryValidation: true,
          extractionHints: ['SIS', 'pollution sols', 'secteur information sols'],
        },
        {
          path: 'pollution_sols.installations_classees_proximite',
          label: 'Installations classées (ICPE) à proximité ?',
          kind: 'boolean',
          extractionHints: ['ICPE', 'installation classée', 'BASOL', 'BASIAS'],
        },
      ],
    },
    {
      id: 'radon',
      label: 'Radon',
      description: 'Potentiel radon de la commune (catégories 1 à 3 selon IRSN).',
      fields: [
        {
          path: 'radon.potentiel_radon_categorie',
          label: 'Catégorie de potentiel radon',
          kind: 'enum',
          options: [
            { value: '1', label: 'Catégorie 1 (faible)' },
            { value: '2', label: 'Catégorie 2 (intermédiaire)' },
            { value: '3', label: 'Catégorie 3 (significatif)' },
          ],
          description: "Catégorie 3 = obligation d'information dans l'ERP.",
          // Catégorisation IRSN officielle (arrêté du 27/06/2018).
          needsRegulatoryValidation: true,
          extractionHints: ['radon', 'catégorie 1', 'catégorie 2', 'catégorie 3', 'IRSN'],
        },
      ],
    },
    {
      id: 'bruit',
      label: 'Bruit',
      description: "Zone d'exposition au bruit des aérodromes (plan de gêne sonore PGS).",
      fields: [
        {
          path: 'bruit.zone_exposition_bruit_aerodrome',
          label: "Zone d'exposition au bruit aérodrome",
          kind: 'enum',
          options: [
            { value: 'A', label: 'Zone A (très forte exposition)' },
            { value: 'B', label: 'Zone B (forte)' },
            { value: 'C', label: 'Zone C (modérée)' },
            { value: 'D', label: 'Zone D (faible)' },
            { value: 'hors_zone', label: 'Hors zone' },
          ],
          // Zones A/B/C/D définies par arrêté PEB (art. L112-6 C. Urb).
          needsRegulatoryValidation: true,
          extractionHints: ['bruit', 'aérodrome', 'PEB', 'zone A', 'zone B', 'zone C', 'zone D'],
        },
      ],
    },
    {
      id: 'synthese',
      label: 'Synthèse ERP',
      fields: [
        {
          path: 'synthese.nombre_risques_concernes',
          label: 'Nombre de risques concernés',
          kind: 'integer',
          min: 0,
          max: 100,
          extractionHints: ['risques concernés', 'total risques'],
        },
        {
          path: 'synthese.obligations_information',
          label: "Obligations d'information actives ?",
          kind: 'boolean',
          needsRegulatoryValidation: true,
          extractionHints: ['obligation information', 'IAL', 'acquéreur'],
        },
        {
          path: 'synthese.sinistre_indemnisable_declare',
          label: 'Sinistre indemnisable déclaré (CatNat) ?',
          kind: 'boolean',
          description: "Si oui : clause obligatoire dans l'acte (art. L125-5 IV C. Env).",
          // Déclaration obligatoire si bien a fait l'objet d'une indemnisation CatNat.
          needsRegulatoryValidation: true,
          extractionHints: ['sinistre', 'CatNat', 'catastrophe naturelle', 'indemnisation'],
        },
      ],
    },
  ],
}

// ============================================
// Mapping global — schémas par type de diagnostic
// ============================================
// Itération 6 : couverture complète des 8 diagnostics MVP V1.5 (CLAUDE.md §3).
// Les champs marqués `needsRegulatoryValidation: true` doivent être validés par
// l'advisor diagnostiqueur (CLAUDE.md §18) avant la génération de rapports clients.

export const SCHEMAS_BY_DIAGNOSTIC: Record<DiagnosticType, DiagnosticSchema> = {
  DPE: DPE_SCHEMA,
  AMIANTE: AMIANTE_SCHEMA,
  PLOMB: PLOMB_SCHEMA,
  GAZ: GAZ_SCHEMA,
  ELEC: ELEC_SCHEMA,
  TERMITES: TERMITES_SCHEMA,
  CARREZ: CARREZ_SCHEMA,
  ERP: ERP_SCHEMA,
}

/**
 * Retourne le schéma d'un diagnostic. Avec les 8 types couverts (itération 6),
 * ce helper retourne toujours un schéma non-null pour tout `DiagnosticType` valide.
 */
export function getDiagnosticSchema(type: DiagnosticType): DiagnosticSchema {
  return SCHEMAS_BY_DIAGNOSTIC[type]
}
