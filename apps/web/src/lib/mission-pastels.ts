import type { MissionType } from '@kovas/shared'

/**
 * Mapping pastels catégoriels par type de diagnostic.
 * KOVAS Design System v2 (2026-05-19) — pattern Ron Design Lab.
 *
 * 5 pastels disponibles, 8 diagnostics → certains partagent (par affinité métier).
 *
 * - butter   (#FFF0C5) → DPE (énergie, classement A-G) + ERP (info naturelle)
 * - lime     (#E5F0D5) → Électricité (vert tech)
 * - peach    (#FFE0D5) → Amiante + Termites (alerte sanitaire, bois)
 * - lavender (#E8E0F5) → Plomb (toxique, sérieux)
 * - sky      (#DAE8F5) → Carrez/Boutin + Gaz (mesure / atmosphère)
 */
export const MISSION_PASTEL_CLASS: Record<MissionType, string> = {
  dpe_vente: 'bg-pastel-butter text-foreground',
  dpe_location: 'bg-pastel-butter text-foreground',
  amiante_vente: 'bg-pastel-peach text-foreground',
  amiante_avant_travaux: 'bg-pastel-peach text-foreground',
  plomb_crep: 'bg-pastel-lavender text-foreground',
  gaz: 'bg-pastel-sky text-foreground',
  electricite: 'bg-pastel-lime text-foreground',
  termites: 'bg-pastel-peach text-foreground',
  carrez_boutin: 'bg-pastel-sky text-foreground',
  erp: 'bg-pastel-butter text-foreground',
  copropriete: 'bg-pastel-lavender text-foreground',
}

/**
 * Label court pour un type de mission (uppercase, format tag).
 */
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
