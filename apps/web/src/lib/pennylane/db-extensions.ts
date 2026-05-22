/**
 * Helpers de typage pour les tables/colonnes ajoutées par la migration
 * `20260522100000_pennylane_connector.sql`.
 *
 * Approche :
 *  - On déclare les rows attendus (`AccountingConnectorRow`, `InvoicePennylaneRow`, etc.)
 *  - On encapsule chaque opération Supabase dans un helper qui caste le résultat
 *  - Aucun `any` n'est exposé en surface : les helpers retournent des types stricts
 *
 * Après regénération `pnpm db:gen-types`, ce fichier peut être progressivement remplacé
 * par les types auto-générés.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types métier (rows + insert/update)
// ============================================

export type ConnectorStatus = 'inactive' | 'active' | 'error'

export interface AccountingConnectorRow {
  id: string
  organization_id: string
  provider: string
  status: ConnectorStatus
  encrypted_token: string | null
  metadata: Record<string, unknown> | null
  last_test_at: string | null
  last_test_status: 'success' | 'failure' | null
  last_test_error: string | null
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface AccountingConnectorInsert {
  organization_id: string
  provider: string
  status?: ConnectorStatus
  encrypted_token?: string | null
  metadata?: Record<string, unknown> | null
  last_test_at?: string | null
  last_test_status?: 'success' | 'failure' | null
  last_test_error?: string | null
  last_sync_at?: string | null
  updated_at?: string
}

export interface AccountingConnectorUpdate {
  status?: ConnectorStatus
  encrypted_token?: string | null
  metadata?: Record<string, unknown> | null
  last_test_at?: string | null
  last_test_status?: 'success' | 'failure' | null
  last_test_error?: string | null
  last_sync_at?: string | null
  updated_at?: string
}

export interface InvoicePennylaneFields {
  pennylane_invoice_id: string | null
  pennylane_customer_id: string | null
  pennylane_synced_at: string | null
  pennylane_public_url: string | null
}

export interface QuotePennylaneFields {
  pennylane_quote_id: string | null
  pennylane_customer_id: string | null
  pennylane_synced_at: string | null
}

export interface ClientPennylaneFields {
  pennylane_customer_id: string | null
  pennylane_synced_at: string | null
}

// ============================================
// Type d'accès "sans rails" — local au connecteur Pennylane.
// On caste le client typé Database vers un sous-ensemble libre sur ces tables uniquement.
// ============================================

/**
 * Représentation minimale d'un query builder Supabase pour les opérations Pennylane.
 * Le typage des opérations spécifiques (select/insert/update/delete/upsert) est volontairement
 * permissif ici — l'enveloppe `pennylaneDb()` ré-applique des types stricts par opération via
 * les wrappers ci-dessous (cf. `selectConnector`, `updateInvoicePennylaneFields`, etc.).
 */
interface LooseQueryBuilder {
  select(columns?: string): LooseFilterBuilder
  insert(values: unknown): LooseFilterBuilder
  update(values: unknown): LooseFilterBuilder
  upsert(values: unknown, options?: { onConflict?: string }): LooseFilterBuilder
  delete(): LooseFilterBuilder
}

interface LooseFilterBuilder {
  eq(column: string, value: unknown): LooseFilterBuilder
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>
  single(): Promise<{ data: unknown; error: { message: string } | null }>
  then<TResult>(
    onfulfilled: (value: { data: unknown; error: { message: string } | null }) => TResult,
  ): Promise<TResult>
}

interface LooseDb {
  from(table: string): LooseQueryBuilder
}

/**
 * Vue "lâche" du client Supabase, scopée aux opérations Pennylane.
 * Utilise un double-cast contrôlé : l'extérieur du fichier ne voit que des helpers typés.
 */
function loose(supabase: SupabaseClient<Database>): LooseDb {
  return supabase as unknown as LooseDb
}

// ============================================
// Helpers SELECT
// ============================================

export async function selectConnector(
  supabase: SupabaseClient<Database>,
  orgId: string,
  provider: string,
): Promise<AccountingConnectorRow | null> {
  const res = await loose(supabase)
    .from('accounting_connectors')
    .select('*')
    .eq('organization_id', orgId)
    .eq('provider', provider)
    .maybeSingle()

  if (res.error) throw new Error(`selectConnector: ${res.error.message}`)
  return (res.data as AccountingConnectorRow | null) ?? null
}

export async function selectActiveConnectorToken(
  supabase: SupabaseClient<Database>,
  orgId: string,
  provider: string,
): Promise<string | null> {
  const res = await loose(supabase)
    .from('accounting_connectors')
    .select('encrypted_token')
    .eq('organization_id', orgId)
    .eq('provider', provider)
    .eq('status', 'active')
    .maybeSingle()

  if (res.error) throw new Error(`selectActiveConnectorToken: ${res.error.message}`)
  const row = res.data as { encrypted_token: string | null } | null
  return row?.encrypted_token ?? null
}

// ============================================
// Helpers INSERT / UPDATE / DELETE — accounting_connectors
// ============================================

export async function upsertConnector(
  supabase: SupabaseClient<Database>,
  values: AccountingConnectorInsert,
): Promise<{ error: { message: string } | null }> {
  const res = await loose(supabase)
    .from('accounting_connectors')
    .upsert(values, { onConflict: 'organization_id,provider' })
  return { error: res.error }
}

export async function updateConnector(
  supabase: SupabaseClient<Database>,
  orgId: string,
  provider: string,
  patch: AccountingConnectorUpdate,
): Promise<{ error: { message: string } | null }> {
  const res = await loose(supabase)
    .from('accounting_connectors')
    .update(patch)
    .eq('organization_id', orgId)
    .eq('provider', provider)
  return { error: res.error }
}

export async function deleteConnector(
  supabase: SupabaseClient<Database>,
  orgId: string,
  provider: string,
): Promise<{ error: { message: string } | null }> {
  const res = await loose(supabase)
    .from('accounting_connectors')
    .delete()
    .eq('organization_id', orgId)
    .eq('provider', provider)
  return { error: res.error }
}

export async function touchConnectorSyncedAt(
  supabase: SupabaseClient<Database>,
  orgId: string,
  provider: string,
  now: string,
): Promise<void> {
  await loose(supabase)
    .from('accounting_connectors')
    .update({ last_sync_at: now })
    .eq('organization_id', orgId)
    .eq('provider', provider)
}

// ============================================
// Helpers UPDATE Pennylane fields sur invoices/quotes/clients
// ============================================

export async function updateInvoicePennylaneFields(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  patch: InvoicePennylaneFields,
): Promise<void> {
  await loose(supabase).from('invoices').update(patch).eq('id', invoiceId)
}

export async function updateQuotePennylaneFields(
  supabase: SupabaseClient<Database>,
  quoteId: string,
  patch: QuotePennylaneFields,
): Promise<void> {
  await loose(supabase).from('quotes').update(patch).eq('id', quoteId)
}

export async function updateClientPennylaneFields(
  supabase: SupabaseClient<Database>,
  clientId: string,
  patch: ClientPennylaneFields,
): Promise<void> {
  await loose(supabase).from('clients').update(patch).eq('id', clientId)
}

// ============================================
// Helpers SELECT enrichis (lit aussi les colonnes Pennylane non typées)
// ============================================

export interface InvoiceWithPennylane {
  id: string
  reference: string
  issued_at: string | null
  due_date: string | null
  tva_rate: number | null
  line_items: unknown
  client_id: string | null
  pennylane_invoice_id: string | null
  pennylane_customer_id: string | null
}

export async function selectInvoiceForSync(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  orgId: string,
): Promise<{ data: InvoiceWithPennylane | null; error: { message: string } | null }> {
  const res = await loose(supabase)
    .from('invoices')
    .select(
      'id, reference, issued_at, due_date, tva_rate, line_items, client_id, pennylane_invoice_id, pennylane_customer_id',
    )
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return {
    data: (res.data as InvoiceWithPennylane | null) ?? null,
    error: res.error,
  }
}

export interface QuoteWithPennylane {
  id: string
  reference: string
  issued_at: string | null
  expires_at: string | null
  tva_rate: number | null
  line_items: unknown
  client_id: string | null
  pennylane_quote_id: string | null
  pennylane_customer_id: string | null
}

export async function selectQuoteForSync(
  supabase: SupabaseClient<Database>,
  quoteId: string,
  orgId: string,
): Promise<{ data: QuoteWithPennylane | null; error: { message: string } | null }> {
  const res = await loose(supabase)
    .from('quotes')
    .select(
      'id, reference, issued_at, expires_at, tva_rate, line_items, client_id, pennylane_quote_id, pennylane_customer_id',
    )
    .eq('id', quoteId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return {
    data: (res.data as QuoteWithPennylane | null) ?? null,
    error: res.error,
  }
}

export interface ClientWithPennylane {
  id: string
  display_name: string
  type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  siret: string | null
  pennylane_customer_id: string | null
}

export async function selectClientForSync(
  supabase: SupabaseClient<Database>,
  clientId: string,
  orgId: string,
): Promise<{ data: ClientWithPennylane | null; error: { message: string } | null }> {
  const res = await loose(supabase)
    .from('clients')
    .select(
      'id, display_name, type, first_name, last_name, company_name, email, phone, address, postal_code, city, country, siret, pennylane_customer_id',
    )
    .eq('id', clientId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return {
    data: (res.data as ClientWithPennylane | null) ?? null,
    error: res.error,
  }
}
