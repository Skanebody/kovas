/**
 * KOVAS — Règles de transition entre régimes réglementaires (mai 2026).
 *
 * Utilisé pour expliquer au diagnostiqueur les "patchs" successifs (ex. DPE
 * 2018-2021 → renouvellement 3CL-2021) lorsqu'il consulte un diag existant.
 *
 * Pas de logique pure — pure exposition de notices textuelles courtes pour l'UI.
 */

import type { DiagnosticType } from '@/lib/mission/types'

export interface TransitionNote {
  appliesTo: DiagnosticType
  period: string
  note: string
  /** Référence réglementaire affichée. */
  referenceRule: string
}

export const TRANSITION_NOTES: readonly TransitionNote[] = [
  {
    appliesTo: 'DPE',
    period: 'Avant 2013',
    note: 'DPE pré-2013 réputé non opposable — obligation de refaire en 3CL-2021.',
    referenceRule: 'Arrêté du 31/03/2021',
  },
  {
    appliesTo: 'DPE',
    period: '2013 – 2017',
    note: 'DPE ancienne génération expirés au 31/12/2022.',
    referenceRule: 'Décret 2020-1610',
  },
  {
    appliesTo: 'DPE',
    period: '01/01/2018 – 30/06/2021',
    note: 'DPE selon méthode pré-2021 — expirés au 31/12/2024.',
    referenceRule: 'Décret 2020-1610',
  },
  {
    appliesTo: 'DPE',
    period: 'À partir du 01/07/2021',
    note: 'DPE 3CL-2021 opposable, validité 10 ans.',
    referenceRule: 'Arrêté du 31/03/2021',
  },
  {
    appliesTo: 'AMIANTE',
    period: 'Avant 2013',
    note: 'Repérages antérieurs à refaire selon norme actuelle.',
    referenceRule: 'Décret 2011-629',
  },
  {
    appliesTo: 'AMIANTE',
    period: 'À partir de 2013',
    note: 'Si négatif : illimité. Si positif : contrôle visuel tous les 3 ans.',
    referenceRule: 'CSP R.1334-15',
  },
]

export function getTransitionNotes(diagnosticType: DiagnosticType): readonly TransitionNote[] {
  return TRANSITION_NOTES.filter((n) => n.appliesTo === diagnosticType)
}
