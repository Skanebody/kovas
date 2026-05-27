/**
 * Checklist Loi Carrez (mesurage copropriété).
 *
 * Périmètre : lots à vendre en copropriété (≥ 8 m²). Mesurage des
 * superficies privatives au sens de la loi n° 96-1107 du 18/12/1996.
 *
 * 9 items répartis sur 3 sections : périmètre / mesurage par pièce / total + annexes.
 */

import { type DiagnosticChecklist, TRIGGER_DELAYS } from './types'

export const CARREZ_CHECKLIST: DiagnosticChecklist = {
  diagnostic: 'carrez',
  short_label: 'CARREZ',
  long_label: 'Mesurage Loi Carrez',
  sections: [
    {
      id: 'scope',
      label: 'Périmètre du mesurage',
      items: [
        {
          id: 'carrez_lot_number',
          field_name: 'carrez.lot_number',
          description_short: 'Numéro de lot copropriété',
          description_full: 'N° de lot au règlement de copropriété (référence acte authentique).',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.fast,
          trigger_question_text: 'Quel est le numéro de lot de la copropriété ?',
          keywords: ['lot', 'numéro', 'copropriété', 'règlement'],
          diagnostic: 'carrez',
        },
        {
          id: 'carrez_minimum_threshold',
          field_name: 'carrez.threshold_check',
          description_short: 'Seuil 8 m² respecté',
          description_full: 'Lot ≥ 8 m² et hauteur sous plafond ≥ 1,80 m (sinon non comptabilisé).',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text: 'Le lot atteint-il bien le seuil 8 m² minimum ?',
          keywords: ['8 m²', '1,80 m', 'seuil', 'minimum', 'hauteur'],
          diagnostic: 'carrez',
        },
      ],
    },
    {
      id: 'measurement',
      label: 'Mesurage par pièce',
      items: [
        {
          id: 'carrez_room_measurement',
          field_name: 'carrez.room_surface',
          description_short: 'Surface mesurée de la pièce',
          description_full: 'Mesure laser ou décamètre, déduction trémies cheminée, gaines, murs.',
          scope: 'per_room',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text: 'Quelle est la surface Carrez mesurée de cette pièce ?',
          keywords: ['surface', 'mesure', 'm²', 'longueur', 'largeur', 'laser', 'décamètre'],
          diagnostic: 'carrez',
        },
        {
          id: 'carrez_room_height',
          field_name: 'carrez.room_height',
          description_short: 'Hauteur sous plafond ≥ 1,80 m',
          description_full:
            'Hauteur sous plafond vérifiée — sous-pentes < 1,80 m exclues du calcul.',
          scope: 'per_room',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.short,
          trigger_question_text: 'La hauteur sous plafond est-elle ≥ 1,80 m partout ?',
          keywords: ['hauteur', '1,80 m', 'sous plafond', 'sous-pente', 'mansardé'],
          diagnostic: 'carrez',
        },
        {
          id: 'carrez_deductions',
          field_name: 'carrez.deductions',
          description_short: 'Déductions (trémies, gaines)',
          description_full:
            'Déduction trémies cheminée, escaliers, gaines techniques, cloisons épaisses.',
          scope: 'per_room',
          required: true,
          severity: 'important',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Avez-vous déduit trémies cheminée, gaines et escaliers ?',
          keywords: ['déduction', 'trémie', 'cheminée', 'escalier', 'gaine'],
          diagnostic: 'carrez',
        },
      ],
    },
    {
      id: 'total_annexes',
      label: 'Total et annexes',
      items: [
        {
          id: 'carrez_total',
          field_name: 'carrez.total_surface',
          description_short: 'Surface Carrez totale',
          description_full: 'Cumul total surface Carrez du lot principal (hors annexes).',
          scope: 'global',
          required: true,
          severity: 'critical',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Quelle est la surface Carrez totale du lot ?',
          keywords: ['total', 'surface carrez', 'cumul'],
          diagnostic: 'carrez',
        },
        {
          id: 'carrez_excluded_annexes',
          field_name: 'carrez.excluded_annexes',
          description_short: 'Annexes hors Carrez listées',
          description_full:
            'Liste des annexes exclues du Carrez (cave, balcon, terrasse, parking).',
          scope: 'global',
          required: false,
          severity: 'important',
          requires_photo: false,
          trigger_question_after_ms: TRIGGER_DELAYS.medium,
          trigger_question_text: 'Avez-vous listé les annexes (cave, balcon, parking) exclues ?',
          keywords: ['annexe', 'cave', 'balcon', 'terrasse', 'parking', 'box'],
          diagnostic: 'carrez',
        },
        {
          id: 'carrez_plans',
          field_name: 'carrez.attached_plan',
          description_short: 'Plan croquis joint',
          description_full:
            'Croquis coté joint au certificat (recommandé même si non obligatoire).',
          scope: 'global',
          required: false,
          severity: 'optional',
          requires_photo: true,
          trigger_question_after_ms: TRIGGER_DELAYS.extended,
          trigger_question_text: 'Avez-vous joint un croquis coté du lot ?',
          keywords: ['plan', 'croquis', 'schéma', 'coté'],
          diagnostic: 'carrez',
        },
      ],
    },
  ],
}
