/**
 * KOVAS — Conversion DiagnosticType (mission/types) → DiagType (ui/diag-chip).
 *
 * Les deux énumérations sont presque identiques, sauf `ELEC` (mission) qui
 * correspond à `ELECTRICITE` (UI). Helper isolé pour éviter d'avoir à le
 * recoder dans chaque composant.
 */

import type { DiagType } from '@/components/ui/diag-chip'
import type { DiagnosticType } from '@/lib/mission/types'

const MAPPING: Record<DiagnosticType, DiagType> = {
  DPE: 'DPE',
  AMIANTE: 'AMIANTE',
  PLOMB: 'PLOMB',
  GAZ: 'GAZ',
  ELEC: 'ELECTRICITE',
  TERMITES: 'TERMITES',
  CARREZ: 'CARREZ',
  ERP: 'ERP',
}

export function diagnosticToDiagChip(diag: DiagnosticType): DiagType {
  return MAPPING[diag]
}
