/**
 * Checklist État termites / état parasitaire.
 *
 * Périmètre : départements déclarés à risque par arrêté préfectoral
 * (33, 64, 40, 47, 24, 17, 85, 44, 56, 29 et autres). Repérage de
 * tous les bois et matériaux dérivés accessibles, intérieur et extérieur.
 *
 * 11 items répartis sur 4 sections : périmètre / repérage par pièce /
 * indices et matériaux suspects / conclusion.
 */

import { type DiagnosticChecklist, TRIGGER_DELAYS } from './types'

export const TERMITES_CHECKLIST: DiagnosticChecklist = {
  diagnostic: 'termites',
  short_label: 'TERMITES',
  long_label: 'État relatif à la présence de termites',
  sections: [
    {
      id: 'scope',
      label: 'Périmètre du repérage',
      items: [
        {
          id: 'termites_departement',
          field_name: 'termites.dept_classified',
          description_short: 'Département en arrêté',
          description_full: 'Confirmation que le département est classé en arrêté préfectoral.',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.fast,
          trigger_question_text: 'Le département est-il bien sous arrêté préfectoral termites ?',
          keywords: ['département', 'arrêté', 'préfectoral', 'zone'],
          diagnostic: 'termites',
        },
        {
          id: 'termites_periphery',
          field_name: 'termites.periphery_check',
          description_short: 'Périphérie immédiate du bâtiment',
          description_full: 'Examen sol, arbres, clôtures, terrasses à proximité (5 m).',
          scope: 'global',
          required: true,
          severity: 'important',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Avez-vous inspecté la périphérie immédiate du bâti ?',
          keywords: ['périphérie', 'extérieur', 'jardin', 'clôture', 'arbres', 'terrain'],
          diagnostic: 'termites',
        },
      ],
    },
    {
      id: 'inspection_per_room',
      label: 'Inspection par pièce',
      items: [
        {
          id: 'termites_wood_elements',
          field_name: 'termites.wood_elements',
          description_short: 'Bois et dérivés inspectés',
          description_full: 'Poutres, solives, parquet, plinthes, encadrements, meubles encastrés.',
          scope: 'per_room',
          required: true,
          severity: 'critical',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text: 'Avez-vous inspecté tous les éléments en bois de cette pièce ?',
          keywords: ['bois', 'poutre', 'solive', 'parquet', 'plinthe', 'encadrement', 'huisserie'],
          diagnostic: 'termites',
        },
        {
          id: 'termites_sounding',
          field_name: 'termites.sounding_test',
          description_short: 'Sondage par poinçon',
          description_full: 'Test sondage non destructif sur bois accessibles (poinçon / pic).',
          scope: 'per_room',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text:
            'Avez-vous effectué un sondage par poinçon sur les bois suspects ?',
          keywords: ['poinçon', 'sondage', 'tester', 'pointe', 'pic'],
          diagnostic: 'termites',
        },
      ],
    },
    {
      id: 'indices',
      label: "Indices d'infestation",
      items: [
        {
          id: 'termites_cordonnets',
          field_name: 'termites.cordonnets',
          description_short: 'Cordonnets de terre',
          description_full: 'Galeries-tunnels de terre le long des murs (signe pathognomonique).',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Repérez-vous des cordonnets de terre le long des murs ?',
          keywords: ['cordonnet', 'galerie', 'terre', 'tube', 'tunnel'],
          diagnostic: 'termites',
        },
        {
          id: 'termites_galeries_bois',
          field_name: 'termites.galeries_in_wood',
          description_short: 'Galeries dans le bois',
          description_full: 'Galeries internes (bois miné, fines pelures, vermoulures).',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Y a-t-il des galeries visibles dans le bois ?',
          keywords: ['galerie', 'bois miné', 'vermoulure', 'pelure', 'trou'],
          diagnostic: 'termites',
        },
        {
          id: 'termites_swarmers',
          field_name: 'termites.swarmers',
          description_short: 'Essaimage / ailes',
          description_full: 'Présence ailes au sol, essaimage saisonnier.',
          scope: 'global',
          required: false,
          severity: 'important',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Avez-vous repéré des ailes au sol ou un essaimage récent ?',
          keywords: ['essaimage', 'aile', 'reproducteur', 'imago'],
          diagnostic: 'termites',
        },
        {
          id: 'termites_humidity',
          field_name: 'termites.humidity_zones',
          description_short: "Zones d'humidité",
          description_full: 'Repérage zones humides favorables (caves, vide sanitaire, sdb).',
          scope: 'global',
          required: true,
          severity: 'important',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text:
            'Avez-vous repéré les zones humides du bâti (cave, vide sanitaire, sdb) ?',
          keywords: ['humidité', 'cave', 'vide sanitaire', 'salle de bain', 'humide'],
          diagnostic: 'termites',
        },
      ],
    },
    {
      id: 'conclusion',
      label: 'Conclusion',
      items: [
        {
          id: 'termites_other_xylophages',
          field_name: 'termites.other_xylophages',
          description_short: 'Autres insectes xylophages',
          description_full: "Mention d'autres xylophages (capricorne, vrillette, lyctus, mérule).",
          scope: 'global',
          required: false,
          severity: 'important',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.long,
          trigger_question_text: "Présence d'autres xylophages (capricorne, vrillette, mérule) ?",
          keywords: ['capricorne', 'vrillette', 'lyctus', 'mérule', 'xylophage', 'champignon'],
          diagnostic: 'termites',
        },
        {
          id: 'termites_conclusion',
          field_name: 'termites.conclusion',
          description_short: 'Présence / absence formulée',
          description_full:
            'Conclusion claire : présence / absence de termites + traitement antérieur si visible.',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Présence ou absence de termites confirmée ?',
          keywords: ['présence', 'absence', 'pas de termite', 'positif', 'négatif'],
          diagnostic: 'termites',
        },
      ],
    },
  ],
}
