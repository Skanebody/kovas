/**
 * StripeSyncStatus — indicateur ok / warning si le dernier webhook Stripe
 * date de plus d'une heure.
 *
 * Server component : data fetch côté serveur via createAdminClient(),
 * accepté car la page est déjà gated par verifyAdminAccess().
 *
 * V1 : on cherche dans la table `events` le dernier event_type qui commence
 * par 'stripe.'. Si rien → status 'never'. Si > 1h → warning. TODO V2 : log
 * dédié `stripe_webhooks` pour métrique plus fine.
 */

import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'

interface LastStripeEvent {
  created_at: string
  event_type: string
}

async function fetchLastStripeEvent(): Promise<LastStripeEvent | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('events')
    .select('event_type, created_at')
    .ilike('event_type', 'stripe.%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<LastStripeEvent>()

  if (error || !data) return null
  return data
}

function formatDelta(iso: string): { label: string; minutes: number } {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 1) return { label: "à l'instant", minutes }
  if (minutes < 60) return { label: `il y a ${minutes} min`, minutes }
  const hours = Math.round(minutes / 60)
  if (hours < 24) return { label: `il y a ${hours}h`, minutes }
  const days = Math.round(hours / 24)
  return { label: `il y a ${days}j`, minutes }
}

export async function StripeSyncStatus() {
  const last = await fetchLastStripeEvent()

  let status: 'ok' | 'warning' | 'never' = 'never'
  let label = 'Aucun webhook reçu'
  let detail = 'Stripe non synchronisé — vérifier la configuration webhook.'

  if (last) {
    const { label: delta, minutes } = formatDelta(last.created_at)
    if (minutes < 60) {
      status = 'ok'
      label = 'Sync OK'
      detail = `Dernier event ${delta} · ${last.event_type}`
    } else {
      status = 'warning'
      label = 'Sync en retard'
      detail = `Dernier event ${delta} · ${last.event_type} — vérifier webhook Stripe.`
    }
  }

  const dotClass =
    status === 'ok'
      ? 'bg-success shadow-[0_0_0_4px_rgba(16,185,129,0.16)] animate-pulse-soft'
      : status === 'warning'
        ? 'bg-warning shadow-[0_0_0_4px_rgba(245,158,11,0.16)]'
        : 'bg-danger shadow-[0_0_0_4px_rgba(239,68,68,0.16)]'

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Stripe · sync webhook
        </p>
      </header>
      <div className="flex items-center gap-3">
        <span aria-hidden className={`size-3 rounded-full ${dotClass}`} />
        <div className="flex-1">
          <p className="text-base font-semibold text-ink">{label}</p>
          <p className="text-[12px] text-ink-mute mt-0.5">{detail}</p>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-ink-faint">
        V1 estimation via events log · stripe_webhooks dédié V2.
      </p>
    </Card>
  )
}
