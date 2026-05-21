/**
 * KOVAS — Types canoniques du module Devis (P2).
 *
 * Tous les montants sont stockés en euros (numeric(10,2)) côté DB et
 * manipulés en `number` côté app — pas de centimes integer ici, l'usage
 * historique du schéma `quotes` est en euros (cf. init_schema 18/05).
 */

/** 8 diagnostics standards + BOUTIN aligné sur la grille pricing. */
export const QUOTE_DIAGNOSTIC_TYPES = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'BOUTIN',
  'ERP',
] as const

export type QuoteDiagnosticType = (typeof QUOTE_DIAGNOSTIC_TYPES)[number]

export const QUOTE_DIAGNOSTIC_LABELS: Record<QuoteDiagnosticType, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb CREP',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Surface Carrez',
  BOUTIN: 'Surface Boutin',
  ERP: 'État des Risques (ERP)',
}

export type QuoteLineKind = 'diagnostic' | 'pack' | 'travel' | 'majoration' | 'custom'

export interface QuoteLineItem {
  /** Identifiant client-side (uuid local ou `tmp-xxx`). Persisté tel quel dans jsonb. */
  id: string
  kind: QuoteLineKind
  /** Désignation visible sur PDF (« DPE — appartement 65 m² »). */
  designation: string
  /** Quantité (1 sauf prestations multi-jours / lots). */
  quantity: number
  /** Prix unitaire HT en euros, 2 décimales max. */
  unitPriceHt: number
  /** Taux TVA en pourcent (20 = 20%). */
  tvaRate: number
  /** Code diagnostic associé (si kind=diagnostic). */
  diagnosticType?: QuoteDiagnosticType
  /** Identifiant du pack user (si kind=pack). */
  packId?: string
  /** Kind de majoration (si kind=majoration). */
  majorationKind?: 'urgency' | 'weekend' | 'evening'
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'expired'

export type QuotePaymentMethod = 'virement' | 'sepa' | 'cheque' | 'especes' | 'cb'

export const QUOTE_PAYMENT_METHOD_LABELS: Record<QuotePaymentMethod, string> = {
  virement: 'Virement bancaire',
  sepa: 'Prélèvement SEPA',
  cheque: 'Chèque',
  especes: 'Espèces',
  cb: 'Carte bancaire',
}

export const QUOTE_PAYMENT_TERMS_OPTIONS = [
  { value: 15, label: '15 jours' },
  { value: 30, label: '30 jours' },
  { value: 45, label: '45 jours' },
  { value: 60, label: '60 jours' },
] as const

/**
 * Snapshot client figé à l'envoi du devis. Sert de source de vérité
 * pour le rendu PDF et l'audit RGPD 10 ans (Code Commerce L123-22).
 */
export interface QuoteClientSnapshot {
  displayName: string
  email: string | null
  phone: string | null
  companyName: string | null
  siret: string | null
  address: string | null
  city: string | null
  postalCode: string | null
}

/**
 * Snapshot émetteur (cabinet) figé au moment de l'envoi.
 * Permet de rendre un PDF cohérent même si l'organisation a changé d'adresse.
 */
export interface QuoteOrganizationSnapshot {
  name: string
  siret: string | null
  vatNumber: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string
  certificationN: string | null
}

/**
 * Totaux d'un devis (recomputés à chaque édition).
 */
export interface QuoteTotals {
  subtotalHt: number
  totalTva: number
  totalTtc: number
}

export function computeQuoteTotals(lines: QuoteLineItem[]): QuoteTotals {
  let subtotalHt = 0
  let totalTva = 0
  for (const line of lines) {
    const lineHt = round2(line.quantity * line.unitPriceHt)
    const lineTva = round2(lineHt * (line.tvaRate / 100))
    subtotalHt += lineHt
    totalTva += lineTva
  }
  subtotalHt = round2(subtotalHt)
  totalTva = round2(totalTva)
  return {
    subtotalHt,
    totalTva,
    totalTtc: round2(subtotalHt + totalTva),
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Formatte un montant en euros au format FR (« 1 234,56 € »).
 */
export function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

/**
 * Formatte une date ISO en jour court FR (« 27 mai 2026 »).
 */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
