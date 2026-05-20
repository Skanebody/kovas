/**
 * KOVAS — Calcul des majorations (Partition B).
 *
 * Trois majorations cumulables :
 *   - urgency  : intervention < 48h
 *   - weekend  : intervention le samedi ou dimanche
 *   - evening  : intervention après 18h en semaine
 *
 * Les montants sont des forfaits HT définis dans `MajorationsConfig`.
 */

import type { MajorationsConfig } from './pricing-templates'

export type MajorationKind = 'urgency' | 'weekend' | 'evening'

export interface Majoration {
  kind: MajorationKind
  label: string
  amountHt: number
}

export interface MajorationsFlags {
  isUrgent: boolean
  isWeekend: boolean
  isEvening: boolean
}

export interface MajorationsResult {
  totalAmountHt: number
  details: Majoration[]
}

const LABELS: Record<MajorationKind, string> = {
  urgency: 'Urgence (< 48h)',
  weekend: 'Weekend',
  evening: 'Soirée (après 18h)',
}

export function calculateMajorations(
  config: MajorationsConfig,
  flags: MajorationsFlags,
): MajorationsResult {
  const details: Majoration[] = []

  if (flags.isUrgent && config.urgency48h > 0) {
    details.push({ kind: 'urgency', label: LABELS.urgency, amountHt: round2(config.urgency48h) })
  }
  if (flags.isWeekend && config.weekend > 0) {
    details.push({ kind: 'weekend', label: LABELS.weekend, amountHt: round2(config.weekend) })
  }
  if (flags.isEvening && config.evening > 0) {
    details.push({ kind: 'evening', label: LABELS.evening, amountHt: round2(config.evening) })
  }

  const totalAmountHt = round2(details.reduce((sum, m) => sum + m.amountHt, 0))
  return { totalAmountHt, details }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
