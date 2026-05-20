/**
 * KOVAS — Wrapper utility autour de calculateRequiredDiagnostics.
 * Permet d'ajouter du tracking côté call-site sans polluer la lib regulations.
 */

export {
  calculateRequiredDiagnostics,
  isTermitesDepartment,
  TERMITES_DEPARTMENTS,
} from '@/lib/regulations/diagnostic-requirements-2026'

export type {
  RequirementsInput,
  RequirementsResult,
  RequirementItem,
  RequirementCategory,
  PropertyType,
  OwnershipType,
  TransactionType,
  EnergyClass,
} from '@/lib/regulations/diagnostic-requirements-2026'
