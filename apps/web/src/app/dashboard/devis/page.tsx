import { AppPageHeader } from '@/components/app-page-header'
import {
  DevisUrgencySection,
  type DevisUrgencyRow,
} from '@/components/devis/DevisUrgencySection'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Devis' }
export const dynamic = 'force-dynamic'

/**
 * Page Devis refondue 2026-05-22 — focus URGENCE (3 sections empilées).
 *
 * Architecture :
 *   1. Section "À envoyer" (brouillons + reprogrammation) — actions chartreuse
 *   2. Section "En attente de signature" (envoyés sans réponse) — relancer
 *   3. Section "Refusés ou expirés" (à archiver) — action ghost
 *
 * Les devis acceptés disparaissent (deviennent missions / factures). Pas de
 * vue "Tous les devis" en défaut : on focalise l'attention sur l'action.
 * Recherche : Cmd+K (palette globale).
 */

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
  const displayName =
    q.clients?.display_name ?? q.client_snapshot?.displayName ?? 'Client retiré'
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

export default async function QuotesPage() {
  const { supabase, orgId } = await getCurrentUser()

  // 3 requêtes parallèles : draft (à envoyer), sent (en attente), refused/expired.
  // Limites larges (50) — les sections urgence sont des listes courtes par nature.
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
    <div className="space-y-8 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="devis"
        description="Trois sections par ordre d'urgence — à envoyer, en attente, à archiver."
        action={
          <Button asChild variant="accent">
            <Link href="/dashboard/devis/nouveau">
              <Plus className="size-4" />
              Nouveau devis
            </Link>
          </Button>
        }
      />

      <DevisUrgencySection kind="to_send" rows={toSend} />
      <DevisUrgencySection kind="pending_signature" rows={pendingSignature} />
      <DevisUrgencySection kind="refused_expired" rows={refusedExpired} />
    </div>
  )
}
