/**
 * Point d'entrée du connecteur Pennylane.
 * Cf. /docs/connectors/PENNYLANE-INTEGRATION.md
 */

export { PennylaneClient } from './client'
export {
  PennylaneError,
  type PennylaneCustomer,
  type PennylaneCustomerCreatePayload,
  type PennylaneInvoice,
  type PennylaneInvoiceCreatePayload,
  type PennylaneInvoiceLineItem,
  type PennylaneQuote,
  type PennylaneQuoteCreatePayload,
} from './types'
export {
  centsToDecimalString,
  isoToCivilDate,
  mapClientToPennylaneCustomer,
  mapInvoiceToPennylanePayload,
  mapQuoteToPennylanePayload,
  normalizeLineItems,
  tvaRateToPennylaneCode,
  type KovasClientForPennylane,
  type KovasInvoiceForPennylane,
  type KovasLineItem,
  type KovasQuoteForPennylane,
} from './mapper'
export {
  deleteConnector,
  selectActiveConnectorToken,
  selectClientForSync,
  selectConnector,
  selectInvoiceForSync,
  selectQuoteForSync,
  touchConnectorSyncedAt,
  updateClientPennylaneFields,
  updateConnector,
  updateInvoicePennylaneFields,
  updateQuotePennylaneFields,
  upsertConnector,
  type AccountingConnectorInsert,
  type AccountingConnectorRow,
  type AccountingConnectorUpdate,
  type ClientPennylaneFields,
  type ClientWithPennylane,
  type ConnectorStatus,
  type InvoicePennylaneFields,
  type InvoiceWithPennylane,
  type QuotePennylaneFields,
  type QuoteWithPennylane,
} from './db-extensions'

/**
 * Helper haut-niveau : récupère le connecteur Pennylane actif d'une org
 * et instancie le client si configuré + activé.
 *
 * Retourne null si pas de connecteur actif.
 */
import { decryptSecret } from '@/lib/security/encrypt'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PennylaneClient } from './client'
import { selectActiveConnectorToken } from './db-extensions'

export async function getPennylaneClientForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<PennylaneClient | null> {
  const encrypted = await selectActiveConnectorToken(supabase, orgId, 'pennylane')
  if (!encrypted) return null
  return new PennylaneClient({ apiToken: decryptSecret(encrypted) })
}
