import { cn } from '@/lib/utils'
import type { MissionType } from '@kovas/shared'
import type { HTMLAttributes } from 'react'

/**
 * DiagChip — identification visuelle par type de diagnostic.
 * Canonique v4 (cf. docs/design/KOVAS_UIUX_App_Complete_v4.md §6.3).
 *
 * 8 types figés avec mapping pastel mist + texte saturé :
 * - DPE      → blue-mist #DBEAFE / texte #1E40AF
 * - AMIANTE  → orange-mist #FED7AA / texte #C2410C
 * - PLOMB    → coral-mist #FECACA / texte #B91C1C
 * - GAZ      → lime-mist #D9F99D / texte #4D7C0F
 * - ELEC     → violet-mist #DDD6FE / texte #5B21B6
 * - TERMITES → cream #FEF3C7 / texte #92400E
 * - CARREZ   → indigo-mist #E0E7FF / texte #3730A3
 * - ERP      → pink-mist #FED7E2 / texte #9D174D
 *
 * Format : pill 11px uppercase 700 weight, padding 2px 8px, border-radius full.
 */

export type DiagType =
  | 'DPE'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELECTRICITE'
  | 'TERMITES'
  | 'CARREZ'
  | 'ERP'

const DIAG_STYLES: Record<DiagType, { bg: string; text: string }> = {
  DPE: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]' },
  AMIANTE: { bg: 'bg-[#FED7AA]', text: 'text-[#C2410C]' },
  PLOMB: { bg: 'bg-[#FECACA]', text: 'text-[#B91C1C]' },
  GAZ: { bg: 'bg-[#D9F99D]', text: 'text-[#4D7C0F]' },
  ELECTRICITE: { bg: 'bg-[#DDD6FE]', text: 'text-[#5B21B6]' },
  TERMITES: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]' },
  CARREZ: { bg: 'bg-[#E0E7FF]', text: 'text-[#3730A3]' },
  ERP: { bg: 'bg-[#FED7E2]', text: 'text-[#9D174D]' },
}

const DIAG_LABELS_SHORT: Record<DiagType, string> = {
  DPE: 'DPE',
  AMIANTE: 'AMIANTE',
  PLOMB: 'PLOMB',
  GAZ: 'GAZ',
  ELECTRICITE: 'ÉLEC',
  TERMITES: 'TERMITES',
  CARREZ: 'CARREZ',
  ERP: 'ERP',
}

const DIAG_LABELS_FULL: Record<DiagType, string> = {
  DPE: 'DPE',
  AMIANTE: 'AMIANTE',
  PLOMB: 'PLOMB',
  GAZ: 'GAZ',
  ELECTRICITE: 'ÉLECTRICITÉ',
  TERMITES: 'TERMITES',
  CARREZ: 'CARREZ',
  ERP: 'ERP',
}

/**
 * Mapping MissionType (Supabase enum) → DiagType (UI).
 */
const MISSION_TYPE_TO_DIAG: Record<MissionType, DiagType> = {
  dpe_vente: 'DPE',
  dpe_location: 'DPE',
  copropriete: 'DPE',
  amiante_vente: 'AMIANTE',
  amiante_avant_travaux: 'AMIANTE',
  plomb_crep: 'PLOMB',
  gaz: 'GAZ',
  electricite: 'ELECTRICITE',
  termites: 'TERMITES',
  carrez_boutin: 'CARREZ',
  erp: 'ERP',
}

interface DiagChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Type de diagnostic canonique (UI) ou MissionType (Supabase). */
  type: DiagType | MissionType
  /** Affichage compact (ÉLEC au lieu d'ÉLECTRICITÉ). Défaut : true. */
  short?: boolean
}

function resolveDiagType(type: DiagType | MissionType): DiagType {
  // DiagType direct si déjà uppercase known
  if (type in DIAG_STYLES) return type as DiagType
  // Sinon mapping MissionType → DiagType
  return MISSION_TYPE_TO_DIAG[type as MissionType] ?? 'DPE'
}

export function DiagChip({ type, short = true, className, ...props }: DiagChipProps) {
  const diag = resolveDiagType(type)
  const style = DIAG_STYLES[diag]
  const label = (short ? DIAG_LABELS_SHORT : DIAG_LABELS_FULL)[diag]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5',
        'font-mono text-[10px] font-bold uppercase tracking-[0.05em]',
        style.bg,
        style.text,
        className,
      )}
      {...props}
    >
      {label}
    </span>
  )
}

/** Helper public : convertir une MissionType en DiagType. */
export function missionTypeToDiag(type: MissionType): DiagType {
  return MISSION_TYPE_TO_DIAG[type] ?? 'DPE'
}
