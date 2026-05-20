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
// Mapping global — schémas par type de diagnostic
// ============================================
// Iteration 1 : seuls DPE + AMIANTE sont implémentés.
// Les 6 autres (PLOMB, GAZ, ELEC, TERMITES, CARREZ, ERP) viendront dans les itérations
// suivantes selon le plan de couverture progressive (CLAUDE.md §3, Sprints 3-7).

export const SCHEMAS_BY_DIAGNOSTIC: Partial<Record<DiagnosticType, DiagnosticSchema>> = {
  DPE: DPE_SCHEMA,
  AMIANTE: AMIANTE_SCHEMA,
}

/**
 * Retourne le schéma d'un diagnostic, ou null s'il n'est pas encore implémenté.
 * Utile pour les composants UI qui doivent afficher un placeholder
 * sur les diagnostics pas encore couverts (PLOMB / GAZ / ELEC / TERMITES / CARREZ / ERP).
 */
export function getDiagnosticSchema(type: DiagnosticType): DiagnosticSchema | null {
  return SCHEMAS_BY_DIAGNOSTIC[type] ?? null
}
