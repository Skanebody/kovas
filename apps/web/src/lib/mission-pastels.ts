import type { MissionType } from '@kovas/shared'

/**
 * Label chips diagnostics — KOVAS Design System v3 (kovas-design-system.mdc §2.6).
 */
export const MISSION_PASTEL_CLASS: Record<MissionType, string> = {
  dpe_vente: 'bg-blue-mist text-[#1E3A8A]',
  dpe_location: 'bg-blue-mist text-[#1E3A8A]',
  amiante_vente: 'bg-orange-mist text-[#7C3F0A]',
  amiante_avant_travaux: 'bg-orange-mist text-[#7C3F0A]',
  plomb_crep: 'bg-coral-mist text-[#8B1414]',
  gaz: 'bg-lime-mist text-[#2D4015]',
  electricite: 'bg-[#E8E0F5] text-[#2F1F5A]',
  termites: 'bg-cream-deep text-ink-mute',
  carrez_boutin: 'bg-blue-mist text-[#1E3A8A]',
  erp: 'bg-orange-mist text-[#7C3F0A]',
  copropriete: 'bg-[#E8E0F5] text-[#2F1F5A]',
}

export const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  dpe_vente: 'DPE',
  dpe_location: 'DPE LOC',
  amiante_vente: 'AMIANTE',
  amiante_avant_travaux: 'AMIANTE AT',
  plomb_crep: 'PLOMB',
  gaz: 'GAZ',
  electricite: 'ÉLEC',
  termites: 'TERMITES',
  carrez_boutin: 'CARREZ',
  erp: 'ERP',
  copropriete: 'COPRO',
}
