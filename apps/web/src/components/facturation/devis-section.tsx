/**
 * KOVAS — Section Devis pour la page Facturation unifiée.
 *
 * Server Component qui charge les 3 listes urgence (à envoyer / en attente /
 * refusés-expirés) et délègue le rendu aux sous-composants existants
 * (`DevisUrgencySection`). Réutilise exactement la logique de la page
 * `/dashboard/devis` historique afin de ne pas dupliquer la query Supabase.
 */

import { type DevisUrgencyRow, DevisUrgencySection } from '@/components/devis/DevisUrgencySection'
import { getCurrentUser } from '@/lib/auth/current-user'

interface QuoteDbRow {
  id: string
  reference: string
  status: string
  amount_ttc: number
  issued_at: string | null
  expires_at: string | null
  client_id: string | null
  client_snapshot: { displayName?: string; city?: string | null } | null
  clients: { display_name: string | null; city: string | null } | null
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  }).format(d)
}

function toRow(q: QuoteDbRow): DevisUrgencyRow {
  const displayName = q.clients?.display_name ?? q.client_snapshot?.displayName ?? 'Client retiré'
  const city = q.clients?.city ?? q.client_snapshot?.city ?? null
  const referenceDate = q.issued_at ?? q.expires_at ?? null
  return {
    id: q.id,
    dateShort: formatDateShort(referenceDate),
    clientName: displayName,
    clientCity: city,
    amountTtcEur: Number(q.amount_ttc),
    reference: q.reference,
  }
}

export async function DevisSectionLive() {
  const { supabase, orgId } = await getCurrentUser()

  const baseSelect =
    'id, reference, status, amount_ttc, issued_at, expires_at, client_id, client_snapshot, clients(display_name, city)'

  const [draftQ, sentQ, refusedQ] = await Promise.all([
    supabase
      .from('quotes')
      .select(baseSelect)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('quotes')
      .select(baseSelect)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('quotes')
      .select(baseSelect)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['refused', 'expired'])
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const toSend = ((draftQ.data ?? []) as unknown as QuoteDbRow[]).map(toRow)
  const pendingSignature = ((sentQ.data ?? []) as unknown as QuoteDbRow[]).map(toRow)
  const refusedExpired = ((refusedQ.data ?? []) as unknown as QuoteDbRow[]).map(toRow)

  return (
    <div className="space-y-8">
      <DevisUrgencySection kind="to_send" rows={toSend} />
      <DevisUrgencySection kind="pending_signature" rows={pendingSignature} />
      <DevisUrgencySection kind="refused_expired" rows={refusedExpired} />
    </div>
  )
}
