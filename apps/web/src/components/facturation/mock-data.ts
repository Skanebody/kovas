import type { DevisKpi, DevisRow, FactureKpi, FactureRow, TarifKpi, TarifRow } from './types'

/**
 * Mock data facturation v1.5 — placeholder en attendant les tables
 * Supabase (quotes/invoices/products). Le remplacement est mécanique :
 * substituer `MOCK_DEVIS` / `MOCK_FACTURES` / `MOCK_TARIFS` par les
 * vraies queries dans `apps/web/src/app/dashboard/facturation/page.tsx`.
 */

export const MOCK_DEVIS: readonly DevisRow[] = [
  {
    id: 'd-001',
    reference: 'DEV-2026-0042',
    clientName: 'Cabinet Notarial Dupont',
    amountCents: 35_000,
    status: 'sent',
    issuedAt: '2026-05-15T09:00:00Z',
    expiresAt: '2026-06-15T23:59:59Z',
  },
  {
    id: 'd-002',
    reference: 'DEV-2026-0041',
    clientName: 'Agence Foncia Le Havre',
    amountCents: 27_000,
    status: 'accepted',
    issuedAt: '2026-05-10T14:30:00Z',
    expiresAt: '2026-06-10T23:59:59Z',
  },
  {
    id: 'd-003',
    reference: 'DEV-2026-0040',
    clientName: 'M. et Mme Martin',
    amountCents: 18_500,
    status: 'draft',
    issuedAt: '2026-05-18T11:00:00Z',
    expiresAt: null,
  },
  {
    id: 'd-004',
    reference: 'DEV-2026-0039',
    clientName: 'SCI Les Tilleuls',
    amountCents: 89_000,
    status: 'refused',
    issuedAt: '2026-04-28T08:00:00Z',
    expiresAt: '2026-05-28T23:59:59Z',
  },
  {
    id: 'd-005',
    reference: 'DEV-2026-0038',
    clientName: 'Syndic Dauchel',
    amountCents: 145_000,
    status: 'expired',
    issuedAt: '2026-03-15T10:00:00Z',
    expiresAt: '2026-04-15T23:59:59Z',
  },
] as const

export const MOCK_FACTURES: readonly FactureRow[] = [
  {
    id: 'f-001',
    reference: 'FAC-2026-0118',
    clientName: 'Agence Foncia Le Havre',
    amountCents: 27_000,
    status: 'pending',
    issuedAt: '2026-05-12T09:00:00Z',
    dueAt: '2026-06-11T23:59:59Z',
    paidAt: null,
  },
  {
    id: 'f-002',
    reference: 'FAC-2026-0117',
    clientName: 'Cabinet Notarial Dupont',
    amountCents: 35_000,
    status: 'paid',
    issuedAt: '2026-05-08T09:00:00Z',
    dueAt: '2026-06-07T23:59:59Z',
    paidAt: '2026-05-17T15:30:00Z',
  },
  {
    id: 'f-003',
    reference: 'FAC-2026-0116',
    clientName: 'M. Petit Vincent',
    amountCents: 22_000,
    status: 'overdue',
    issuedAt: '2026-04-10T09:00:00Z',
    dueAt: '2026-05-10T23:59:59Z',
    paidAt: null,
  },
  {
    id: 'f-004',
    reference: 'FAC-2026-0115',
    clientName: 'SCI Les Tilleuls',
    amountCents: 89_000,
    status: 'issued',
    issuedAt: '2026-05-19T09:00:00Z',
    dueAt: '2026-06-18T23:59:59Z',
    paidAt: null,
  },
  {
    id: 'f-005',
    reference: 'FAC-2026-0114',
    clientName: 'Mme Lefebvre Caroline',
    amountCents: 16_500,
    status: 'paid',
    issuedAt: '2026-05-02T09:00:00Z',
    dueAt: '2026-06-01T23:59:59Z',
    paidAt: '2026-05-04T11:00:00Z',
  },
] as const

export const MOCK_TARIFS: readonly TarifRow[] = [
  {
    id: 't-001',
    name: 'DPE seul',
    description: 'Diagnostic de Performance Énergétique pour bien existant',
    priceCents: 12_000,
    category: 'diagnostic',
    usageCount: 47,
    archived: false,
  },
  {
    id: 't-002',
    name: 'Pack Vente complet',
    description: 'DPE + Amiante + Plomb + Termites + Carrez + ERP',
    priceCents: 35_000,
    category: 'pack',
    usageCount: 23,
    archived: false,
  },
  {
    id: 't-003',
    name: 'Pack Location',
    description: 'DPE + ERP + Plomb (logement < 1949)',
    priceCents: 18_500,
    category: 'pack',
    usageCount: 18,
    archived: false,
  },
  {
    id: 't-004',
    name: 'Amiante avant vente',
    description: 'Repérage amiante pour bien construit avant 1997',
    priceCents: 9_500,
    category: 'diagnostic',
    usageCount: 12,
    archived: false,
  },
  {
    id: 't-005',
    name: 'Mesurage Carrez/Boutin',
    description: 'Métré officiel surface privative',
    priceCents: 7_500,
    category: 'diagnostic',
    usageCount: 9,
    archived: false,
  },
  {
    id: 't-006',
    name: 'Rapport bilingue FR/EN',
    description: 'Option traduction rapport diagnostic',
    priceCents: 500,
    category: 'option',
    usageCount: 2,
    archived: false,
  },
] as const

export const MOCK_DEVIS_KPI: DevisKpi = {
  pendingCount: MOCK_DEVIS.filter((d) => d.status === 'sent').length,
  acceptedMonthCount: MOCK_DEVIS.filter((d) => d.status === 'accepted').length,
  refusedCount: MOCK_DEVIS.filter((d) => d.status === 'refused').length,
  totalCount: MOCK_DEVIS.length,
}

export const MOCK_FACTURE_KPI: FactureKpi = {
  unpaidCount: MOCK_FACTURES.filter((f) => f.status === 'pending' || f.status === 'issued').length,
  paidMonthCount: MOCK_FACTURES.filter((f) => f.status === 'paid').length,
  overdueCount: MOCK_FACTURES.filter((f) => f.status === 'overdue').length,
  revenueMonthCents: MOCK_FACTURES.filter((f) => f.status === 'paid').reduce(
    (sum, f) => sum + f.amountCents,
    0,
  ),
}

export const MOCK_TARIF_KPI: TarifKpi = {
  activeCount: MOCK_TARIFS.filter((t) => !t.archived).length,
  archivedCount: MOCK_TARIFS.filter((t) => t.archived).length,
}
