import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { planAtLeast } from '@/lib/billing/feature-gates'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { UpsellCard } from './upsell-card'

interface NotifRow {
  id: string
  document_id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  body: string
  created_at: string
}

const PRIORITY_DOT: Record<NotifRow['priority'], string> = {
  critical: 'bg-accent-red',
  high: 'bg-accent-warm',
  medium: 'bg-accent-yellow',
  low: 'bg-ink/30',
}

const PRIORITY_LABEL: Record<NotifRow['priority'], string> = {
  critical: 'Critique',
  high: 'Important',
  medium: 'À lire',
  low: 'Info',
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.round(diff / 3_600_000)
  if (h < 1) return "à l'instant"
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/**
 * Mini panneau veille réglementaire — style panel-style data-dense.
 *
 * 2 états :
 *   1. Plan < All Inclusive → UpsellCard (veille IA + chatbot RAG)
 *   2. Plan OK → render notifs récentes non lues (panel-style numéroté 05)
 *      ou render null si 0 notif (pas d'espace inutile)
 */
export async function RegulatoryNotificationsMini() {
  const { supabase, orgId, user } = await getCurrentUser()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .eq('organization_id', orgId)
    .maybeSingle()

  const subTyped = sub as { plan_code?: string } | null

  if (!planAtLeast(subTyped?.plan_code, 'all_inclusive')) {
    return (
      <UpsellCard
        sectionNumber="05"
        sectionTitle="Veille IA"
        moduleName="Veille réglementaire + chatbot méthodo"
        description="Surveillance automatique de 9 sources (Légifrance, ADEME, DHUP, Cerema, Quotidiag...) avec analyse IA. Notifications ciblées sur tes diagnostics + assistant méthodologique conversationnel."
        requiredPlanOrAddon="Pack All Inclusive"
        priceLabel="à partir de 49 € HT/mois"
        activateHref="/pricing"
        ctaLabel="Découvrir"
      />
    )
  }

  const { data: notifs } = (await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            is: (
              col: string,
              val: null,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: NotifRow[] | null }>
              }
            }
          }
        }
      }
    }
  )
    .from('regulatory_notifications')
    .select('id, document_id, priority, title, body, created_at')
    .eq('user_id', user.id)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(3)) as { data: NotifRow[] | null }

  const notifications = notifs ?? []
  if (notifications.length === 0) return null

  return (
    <Card variant="opaque" padding="none" className="flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-rule/60 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink">
          <span className="text-ink-mute">05 ·</span> Veille réglementaire
        </p>
        <Link
          href="/dashboard/veille"
          className="font-mono text-[11px] text-ink-mute border-b border-rule pb-0.5 hover:text-ink hover:border-ink transition-colors inline-flex items-center gap-1"
        >
          Voir la veille <ArrowRight className="size-3" />
        </Link>
      </header>

      <ul>
        {notifications.map((notif, idx) => (
          <li
            key={notif.id}
            className={idx < notifications.length - 1 ? 'border-b border-rule/60' : ''}
          >
            <Link
              href={`/dashboard/veille/${notif.document_id}`}
              className="block px-5 py-3.5 hover:bg-sage/40 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={`size-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[notif.priority]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink truncate">{notif.title}</p>
                    <span className="font-mono text-[10px] text-ink-mute tabular-nums shrink-0">
                      {timeAgoShort(notif.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                      {PRIORITY_LABEL[notif.priority]}
                    </span>
                    <span className="text-[11px] text-ink-mute truncate flex-1 min-w-0">
                      {notif.body}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
