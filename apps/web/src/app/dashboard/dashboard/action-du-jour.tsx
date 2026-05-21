import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { parisDayBounds } from '@/lib/paris-dates'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

/**
 * Sélection de l'action unique du jour.
 *
 * Algorithme priorité décroissante :
 *  1. Mission planifiée aujourd'hui avec horaire < 2h
 *  2. Lead non répondu le plus ancien (table absente V1 → skip)
 *  3. Facture en retard la plus ancienne
 *  4. Devis en attente signature > 7j
 *  5. Fallback positif : « tout est à jour »
 */
interface ActionContent {
  eyebrow: string
  title: string
  subtitle: string
  ctaLabel: string
  href: string
}

const DEFAULT_ACTION: ActionContent = {
  eyebrow: 'ACTION DU JOUR',
  title: 'Excellent — tout est à jour',
  subtitle: 'Profitez-en pour préparer la semaine ou avancer sur vos exports.',
  ctaLabel: 'Voir la semaine',
  href: '/dashboard/calendar',
}

function formatTimeParis(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
}

export async function ActionDuJour() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = parisDayBounds()
  const now = new Date()

  // 1) Mission planifiée aujourd'hui dans les 2 prochaines heures
  const { data: upcomingTodayList } = await supabase
    .from('dossiers')
    .select('id, scheduled_at, clients(display_name), properties(address, city)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .gte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)

  const upcomingToday = upcomingTodayList?.[0]
  if (upcomingToday?.scheduled_at) {
    const scheduledMs = new Date(upcomingToday.scheduled_at).getTime()
    const minutesUntil = (scheduledMs - now.getTime()) / 60_000
    if (minutesUntil >= 0 && minutesUntil <= 120) {
      const time = formatTimeParis(upcomingToday.scheduled_at)
      const clientRow = Array.isArray(upcomingToday.clients)
        ? upcomingToday.clients[0]
        : upcomingToday.clients
      const propRow = Array.isArray(upcomingToday.properties)
        ? upcomingToday.properties[0]
        : upcomingToday.properties
      const who = clientRow?.display_name ?? 'votre prochain rendez-vous'
      const where = propRow ? [propRow.address, propRow.city].filter(Boolean).join(', ') : ''
      return (
        <ActionCard
          content={{
            eyebrow: 'ACTION DU JOUR',
            title: `Préparer votre intervention ${time} chez ${who}`,
            subtitle: where || 'Vérifiez documents propriétaire et matériel avant le départ.',
            ctaLabel: 'Préparer',
            href: `/dashboard/dossiers/${upcomingToday.id}`,
          }}
        />
      )
    }
  }

  // 2) Lead non répondu — pas de table en V1, on saute.

  // 3) Facture en retard la plus ancienne (statut 'overdue' ou 'sent' due_date passée)
  try {
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('id, reference, due_date, issued_at, status')
      .eq('organization_id', orgId)
      .in('status', ['overdue', 'sent', 'late'])
      .lt('due_date', now.toISOString())
      .order('due_date', { ascending: true })
      .limit(1)

    const overdueInvoice = overdueInvoices?.[0]
    if (overdueInvoice?.due_date) {
      const delay = daysSince(overdueInvoice.due_date)
      if (delay > 0) {
        return (
          <ActionCard
            content={{
              eyebrow: 'ACTION DU JOUR',
              title: `Relancer la facture ${overdueInvoice.reference}`,
              subtitle: `Échue depuis ${delay} jour${delay > 1 ? 's' : ''}. Un appel ou un email suffit souvent.`,
              ctaLabel: 'Relancer',
              href: '/dashboard/facturation',
            }}
          />
        )
      }
    }
  } catch {
    // Table absente ou colonne manquante → on saute proprement
  }

  // 4) Devis envoyé depuis > 7j sans signature
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: staleQuotes } = await supabase
      .from('quotes')
      .select('id, reference, issued_at, clients(display_name)')
      .eq('organization_id', orgId)
      .eq('status', 'sent')
      .is('accepted_at', null)
      .lt('issued_at', sevenDaysAgo)
      .order('issued_at', { ascending: true })
      .limit(1)

    const staleQuote = staleQuotes?.[0]
    if (staleQuote?.issued_at) {
      const delay = daysSince(staleQuote.issued_at)
      const clientRow = Array.isArray(staleQuote.clients)
        ? staleQuote.clients[0]
        : staleQuote.clients
      const who = clientRow?.display_name ?? 'votre prospect'
      return (
        <ActionCard
          content={{
            eyebrow: 'ACTION DU JOUR',
            title: `Relancer le devis envoyé il y a ${delay}j à ${who}`,
            subtitle: `Référence ${staleQuote.reference}. Un rappel poli relance souvent la conversation.`,
            ctaLabel: 'Voir',
            href: '/dashboard/facturation',
          }}
        />
      )
    }
  } catch {
    // Table absente ou colonne manquante → on saute proprement
  }

  // 5) Fallback : tout est à jour
  return <ActionCard content={DEFAULT_ACTION} />
}

function ActionCard({ content }: { content: ActionContent }) {
  return (
    <Card
      variant="opaque"
      padding="lg"
      className="border-l-4 border-l-chartreuse"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute mb-3">
        {content.eyebrow}
      </p>
      <h2 className="font-serif italic text-[28px] leading-tight text-ink mb-2">
        {content.title}
      </h2>
      <p className="text-[14px] text-ink-mute leading-relaxed mb-6 max-w-2xl">
        {content.subtitle}
      </p>
      <Button variant="accent" size="lg" asChild>
        <Link href={content.href}>
          {content.ctaLabel} <ArrowRight className="size-4" />
        </Link>
      </Button>
    </Card>
  )
}
