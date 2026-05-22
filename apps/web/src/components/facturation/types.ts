/**
 * Types facturation v1.5 (post-MVP V1).
 * Tables Supabase à créer : quotes, invoices, products. En attendant
 * la migration, ces types décrivent la forme attendue côté UI.
 */

export type FacturationTab = 'devis' | 'factures' | 'tarifs'

export const FACTURATION_TABS: readonly FacturationTab[] = ['devis', 'factures', 'tarifs'] as const

export function isFacturationTab(value: string | undefined | null): value is FacturationTab {
  if (!value) return false
  return (FACTURATION_TABS as readonly string[]).includes(value)
}

/* ---------------- Devis ---------------- */

export type DevisStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'expired'

export const DEVIS_STATUS_LABELS: Record<DevisStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
}

export const DEVIS_STATUS_VARIANT: Record<
  DevisStatus,
  'muted' | 'blue' | 'green' | 'red' | 'orange'
> = {
  draft: 'muted',
  sent: 'blue',
  accepted: 'green',
  refused: 'red',
  expired: 'orange',
}

export interface DevisRow {
  id: string
  reference: string
  clientName: string
  amountCents: number
  status: DevisStatus
  /** ISO date issued */
  issuedAt: string
  /** ISO date expiration */
  expiresAt: string | null
}

/* ---------------- Factures ---------------- */

export type FactureStatus = 'draft' | 'issued' | 'pending' | 'paid' | 'overdue' | 'cancelled'

export const FACTURE_STATUS_LABELS: Record<FactureStatus, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  pending: 'En attente',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
}

export const FACTURE_STATUS_VARIANT: Record<
  FactureStatus,
  'muted' | 'blue' | 'green' | 'red' | 'orange'
> = {
  draft: 'muted',
  issued: 'blue',
  pending: 'orange',
  paid: 'green',
  overdue: 'red',
  cancelled: 'muted',
}

export interface FactureRow {
  id: string
  reference: string
  clientName: string
  amountCents: number
  status: FactureStatus
  /** ISO date émission */
  issuedAt: string
  /** ISO due date */
  dueAt: string | null
  /** ISO date paiement (si payée) */
  paidAt: string | null
}

/* ---------------- Tarifs (catalogue produits/services) ---------------- */

export type TarifCategory = 'diagnostic' | 'pack' | 'option' | 'autre'

export const TARIF_CATEGORY_LABELS: Record<TarifCategory, string> = {
  diagnostic: 'Diagnostic',
  pack: 'Pack',
  option: 'Option',
  autre: 'Autre',
}

export interface TarifRow {
  id: string
  name: string
  description: string | null
  priceCents: number
  category: TarifCategory
  /** Nombre d'utilisations cumulées (sur devis + factures) */
  usageCount: number
  archived: boolean
}

/* ---------------- KPI summaries ---------------- */

export interface DevisKpi {
  pendingCount: number
  acceptedMonthCount: number
  refusedCount: number
  totalCount: number
}

export interface FactureKpi {
  unpaidCount: number
  paidMonthCount: number
  overdueCount: number
  revenueMonthCents: number
}

export interface TarifKpi {
  activeCount: number
  archivedCount: number
}
