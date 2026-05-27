/**
 * Checklist Loi Boutin (surface habitable pour location).
 *
 * Périmètre : logements donnés en location nue ou meublée (résidence
 * principale). Mesurage selon art. R.156-1 CCH : surface habitable
 * = plancher après déduction murs, gaines, sous-pentes < 1,80 m.
 *
 * 9 items répartis sur 3 sections.
 */

import { type DiagnosticChecklist, TRIGGER_DELAYS } from './types'

export const BOUTIN_CHECKLIST: DiagnosticChecklist = {
  diagnostic: 'boutin',
  short_label: 'BOUTIN',
  long_label: 'Surface habitable Loi Boutin',
  sections: [
    {
      id: 'scope',
      label: 'Périmètre du mesurage',
      items: [
        {
          id: 'boutin_purpose',
          field_name: 'boutin.purpose',
          description_short: 'Type de location (nue/meublée)',
          description_full:
            'Location nue, meublée ou bail commercial — impact sur clauses obligatoires.',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.fast,
          trigger_question_text: "S'agit-il d'une location nue ou meublée ?",
          keywords: ['location', 'nue', 'meublée', 'bail', 'résidence principale'],
          diagnostic: 'boutin',
        },
        {
          id: 'boutin_norm_reference',
          field_name: 'boutin.norm_reference',
          description_short: 'Référence article R.156-1 CCH',
          description_full: "Mesurage conforme à l'article R.156-1 du Code de la construction.",
          scope: 'global',
          required: true,
          severity: 'important',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text: "Le mesurage est-il bien conforme à l'article R.156-1 CCH ?",
          keywords: ['r.156-1', 'cch', 'code construction', 'article'],
          diagnostic: 'boutin',
        },
      ],
    },
    {
      id: 'measurement',
      label: 'Mesurage par pièce',
      items: [
        {
          id: 'boutin_room_surface',
          field_name: 'boutin.room_surface',
          description_short: 'Surface habitable de la pièce',
          description_full: 'Surface plancher après déduction murs, cloisons, gaines, embrasures.',
          scope: 'per_room',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text: 'Quelle est la surface habitable mesurée de cette pièce ?',
          keywords: ['surface', 'm²', 'mesure', 'habitable', 'plancher'],
          diagnostic: 'boutin',
        },
        {
          id: 'boutin_room_height',
          field_name: 'boutin.room_height',
          description_short: 'Hauteur sous plafond ≥ 1,80 m',
          description_full: 'Sous-pentes < 1,80 m exclues du calcul habitable.',
          scope: 'per_room',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text: 'La hauteur sous plafond est-elle ≥ 1,80 m ?',
          keywords: ['hauteur', '1,80 m', 'sous-pente', 'mansardé'],
          diagnostic: 'boutin',
        },
        {
          id: 'boutin_exclusions',
          field_name: 'boutin.exclusions',
          description_short: 'Exclusions (annexes, balcons)',
          description_full: 'Caves, garages, balcons, terrasses, vérandas non chauffées exclues.',
          scope: 'global',
          required: true,
          severity: 'important',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text:
            'Avez-vous bien exclu caves, garages, balcons, vérandas non chauffées ?',
          keywords: ['cave', 'garage', 'balcon', 'véranda', 'terrasse', 'exclu'],
          diagnostic: 'boutin',
        },
      ],
    },
    {
      id: 'totaux',
      label: 'Totaux et plans',
      items: [
        {
          id: 'boutin_total_surface',
          field_name: 'boutin.total_surface',
          description_short: 'Surface habitable totale',
          description_full: 'Total surface habitable au sens R.156-1 CCH.',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Quelle est la surface habitable totale ?',
          keywords: ['total', 'surface habitable', 'cumul'],
          diagnostic: 'boutin',
        },
        {
          id: 'boutin_difference_carrez',
          field_name: 'boutin.diff_carrez',
          description_short: 'Différence vs Carrez si applicable',
          description_full:
            'Mention différence Carrez/Boutin (Boutin exclut généralement certaines annexes).',
          scope: 'global',
          required: false,
          severity: 'optional',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.extended,
          trigger_question_text: 'Si Carrez aussi fourni, la différence est-elle expliquée ?',
          keywords: ['carrez', 'différence', 'écart', 'comparaison'],
          diagnostic: 'boutin',
        },
        {
          id: 'boutin_plan',
          field_name: 'boutin.attached_plan',
          description_short: 'Plan coté joint',
          description_full: 'Croquis coté du logement joint au certificat (recommandé).',
          scope: 'global',
          required: false,
          severity: 'optional',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.extended,
          trigger_question_text: 'Avez-vous joint un croquis du logement ?',
          keywords: ['plan', 'croquis', 'schéma'],
          diagnostic: 'boutin',
        },
      ],
    },
  ],
}
