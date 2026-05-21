import { cn } from '@/lib/utils'
import type { MissionType } from '@kovas/shared'
import type { HTMLAttributes } from 'react'

/**
 * DiagnosticChip — v5 canonique.
 *
 * Chip de typage diagnostic (8 types figés) avec fond pastel chip-* (tokens
 * Tailwind v5) et label mono uppercase. Pendant complet de <DiagChip> avec une
 * API plus stricte ; les deux exports coexistent (DiagChip = legacy v4 avec
 * hex inline, DiagnosticChip = v5 avec tokens chip-* canoniques).
 *
 * Mapping 8 types (cf. KOVAS_UIUX_v5_Final.md §6.3) :
 * - DPE      → chip-dpe      (#DBEAFE)
 * - AMIANTE  → chip-amiante  (#FFE4C9)
 * - PLOMB    → chip-plomb    (#FECACA)
 * - GAZ      → chip-gaz      (#ECFCCB)
 * - ELEC     → chip-elec     (#DDD6FE)
 * - TERMITES → chip-termites (#FEF3C7)
 * - CARREZ   → chip-carrez   (#E0E7FF)
 * - ERP      → chip-erp      (#FCE7F3)
 *
 * Format pillule : padding 2px 8px, mono 10-11px font-bold uppercase
 * letter-spacing 0.05em.
 */

export type DiagnosticType =
  | 'DPE'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELEC'
  | 'TERMITES'
  | 'CARREZ'
  | 'ERP'

const CHIP_STYLES: Record<DiagnosticType, { bg: string; text: string }> = {
  DPE: { bg: 'bg-chip-dpe', text: 'text-[#1E40AF]' },
  AMIANTE: { bg: 'bg-chip-amiante', text: 'text-[#C2410C]' },
  PLOMB: { bg: 'bg-chip-plomb', text: 'text-[#B91C1C]' },
  GAZ: { bg: 'bg-chip-gaz', text: 'text-[#4D7C0F]' },
  ELEC: { bg: 'bg-chip-elec', text: 'text-[#5B21B6]' },
  TERMITES: { bg: 'bg-chip-termites', text: 'text-[#92400E]' },
  CARREZ: { bg: 'bg-chip-carrez', text: 'text-[#3730A3]' },
  ERP: { bg: 'bg-chip-erp', text: 'text-[#9D174D]' },
}

const CHIP_LABELS_SHORT: Record<DiagnosticType, string> = {
  DPE: 'DPE',
  AMIANTE: 'AMIANTE',
  PLOMB: 'PLOMB',
  GAZ: 'GAZ',
  ELEC: 'ÉLEC',
  TERMITES: 'TERMITES',
  CARREZ: 'CARREZ',
  ERP: 'ERP',
}

const CHIP_LABELS_FULL: Record<DiagnosticType, string> = {
  DPE: 'DPE',
  AMIANTE: 'AMIANTE',
  PLOMB: 'PLOMB',
  GAZ: 'GAZ',
  ELEC: 'ÉLECTRICITÉ',
  TERMITES: 'TERMITES',
  CARREZ: 'CARREZ',
  ERP: 'ERP',
}

/** Mapping MissionType (Supabase enum) → DiagnosticType (UI v5). */
const MISSION_TYPE_TO_DIAGNOSTIC: Record<MissionType, DiagnosticType> = {
  dpe_vente: 'DPE',
  dpe_location: 'DPE',
  copropriete: 'DPE',
  amiante_vente: 'AMIANTE',
  amiante_avant_travaux: 'AMIANTE',
  plomb_crep: 'PLOMB',
  gaz: 'GAZ',
  electricite: 'ELEC',
  termites: 'TERMITES',
  carrez_boutin: 'CARREZ',
  erp: 'ERP',
}

interface DiagnosticChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Type de diagnostic v5 (UI) ou MissionType (Supabase). */
  type: DiagnosticType | MissionType
  /** Affichage compact (ÉLEC au lieu d'ÉLECTRICITÉ). Défaut : true. */
  short?: boolean
}

function resolveDiagnosticType(type: DiagnosticType | MissionType): DiagnosticType {
  if (type in CHIP_STYLES) return type as DiagnosticType
  return MISSION_TYPE_TO_DIAGNOSTIC[type as MissionType] ?? 'DPE'
}

export function DiagnosticChip({ type, short = true, className, ...props }: DiagnosticChipProps) {
  const t = resolveDiagnosticType(type)
  const style = CHIP_STYLES[t]
  const label = (short ? CHIP_LABELS_SHORT : CHIP_LABELS_FULL)[t]

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

/** Helper public : convertir une MissionType en DiagnosticType v5. */
export function missionTypeToDiagnostic(type: MissionType): DiagnosticType {
  return MISSION_TYPE_TO_DIAGNOSTIC[type] ?? 'DPE'
}
