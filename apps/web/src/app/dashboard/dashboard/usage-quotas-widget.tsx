import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { parisMonthBounds } from '@/lib/paris-dates'
import { isLegacyPlan } from '@/lib/pricing-plans'
import { getStorageUsage } from '@/lib/storage/quota'
import { cn } from '@/lib/utils'
import { Activity, ArrowRight, HardDrive, MessageCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface QuotaJauge {
  key: string
  icon: LucideIcon
  label: string
  used: number
  /** quota dur (cap fair-use ou storage) — null = illimité (legacy unlimited). */
  quota: number | null
  unit: string
  /** Pour les nouveaux plans : description du cap fair-use (info, pas blocant). */
  fairUseLabel?: string
}

interface QuotaRow {
  missions_used: number
  missions_quota: number
  chatbot_messages_used: number
  chatbot_messages_quota: number
}

interface SubscriptionRow {
  tier: string | null
  is_grandfathered: boolean | null
  fair_use_cap_missions: number | null
}

function pctOf(used: number, quota: number | null): number {
  if (!quota || quota < 0) return 0 // illimité
  return Math.min(100, Math.round((used / quota) * 100))
}

function formatGb(bytes: bigint | number): string {
  const gb = Number(bytes) / (1024 * 1024 * 1024)
  return gb < 1 ? `${(gb * 1024).toFixed(0)} Mo` : `${gb.toFixed(1)} Go`
}

/**
 * Widget consommation mensuelle (refonte P9 — 2026-05-28).
 *
 * Deux comportements selon l'abonnement :
 *
 *   1. Plan grandfathered (anciens users) → affichage HISTORIQUE :
 *      missions x/y avec barre de progression, surplus calculé comme avant.
 *
 *   2. Nouveau plan all-you-can-eat → affichage INFORMATIONNEL :
 *      "142 missions ce mois · Forfait illimité ✓" + petite mention fair-use
 *      sobre. Jauge optionnelle indicative (sans alerte rouge).
 *
 * Storage : identique dans les deux cas (cap dur).
 */
export async function UsageQuotasWidget() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso: monthStartIso } = parisMonthBounds()
  const periodMonth = monthStartIso.slice(0, 10)

  const [quotaRes, storageUsage, subRes] = await Promise.all([
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              eq: (
                col2: string,
                val2: string,
              ) => {
                maybeSingle: () => Promise<{ data: QuotaRow | null }>
              }
            }
          }
        }
      }
    )
      .from('user_usage_quotas')
      .select('missions_used, missions_quota, chatbot_messages_used, chatbot_messages_quota')
      .eq('organization_id', orgId)
      .eq('period_month', periodMonth)
      .maybeSingle(),
    getStorageUsage(supabase, orgId).catch(() => null),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              maybeSingle: () => Promise<{ data: SubscriptionRow | null }>
            }
          }
        }
      }
    )
      .from('subscriptions')
      .select('tier, is_grandfathered, fair_use_cap_missions')
      .eq('organization_id', orgId)
      .maybeSingle(),
  ])

  const quota = quotaRes.data
  const sub = subRes.data
  const isGrandfathered =
    sub?.is_grandfathered === true || (sub?.tier ? isLegacyPlan(sub.tier) : false)
  const fairUseCap = sub?.fair_use_cap_missions ?? null

  if (!quota && !storageUsage) return null

  const jauges: QuotaJauge[] = []

  if (quota) {
    if (isGrandfathered) {
      // Comportement historique : barre missions used/quota
      jauges.push({
        key: 'missions',
        icon: Activity,
        label: 'Missions ce mois',
        used: quota.missions_used,
        quota: quota.missions_quota === -1 ? null : quota.missions_quota,
        unit: 'missions',
      })
      jauges.push({
        key: 'chatbot',
        icon: MessageCircle,
        label: 'Chatbot IA',
        used: quota.chatbot_messages_used,
        quota: quota.chatbot_messages_quota === -1 ? null : quota.chatbot_messages_quota,
        unit: 'messages',
      })
    } else {
      // Nouveau modèle all-you-can-eat : juste informationnel + mention fair-use
      jauges.push({
        key: 'missions',
        icon: Activity,
        label: 'Missions ce mois',
        used: quota.missions_used,
        quota: null, // illimité
        unit: 'missions',
        fairUseLabel:
          fairUseCap !== null
            ? `Forfait illimité (cap fair-use ${fairUseCap}/mois)`
            : 'Forfait illimité',
      })
      jauges.push({
        key: 'chatbot',
        icon: MessageCircle,
        label: 'Chatbot IA',
        used: quota.chatbot_messages_used,
        quota: null, // chatbot non-rationné dans le nouveau modèle (sous fair-use global)
        unit: 'messages',
      })
    }
  }

  if (storageUsage) {
    jauges.push({
      key: 'storage',
      icon: HardDrive,
      label: 'Stockage',
      used: Number(storageUsage.usedBytes),
      quota: Number(storageUsage.quotaBytes),
      unit: 'Go',
    })
  }

  if (jauges.length === 0) return null

  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute font-semibold">
          Consommation du mois
        </p>
        <Link
          href="/dashboard/account"
          className="text-[12px] text-ink-mute hover:text-ink transition-colors inline-flex items-center gap-1"
        >
          Détails <ArrowRight className="size-3" />
        </Link>
      </div>

      <ul className="space-y-3.5">
        {jauges.map((j) => {
          const pct = pctOf(j.used, j.quota)
          const isUnlimited = j.quota === null

          const barColor =
            pct >= 100
              ? 'bg-accent-red'
              : pct >= 80
                ? 'bg-accent-warm'
                : pct >= 60
                  ? 'bg-chartreuse'
                  : 'bg-accent-green'

          let usedDisplay: string
          let quotaDisplay: string
          if (j.key === 'storage') {
            usedDisplay = formatGb(j.used)
            quotaDisplay = j.quota ? formatGb(j.quota) : '∞'
          } else {
            usedDisplay = j.used.toLocaleString('fr-FR')
            quotaDisplay = j.quota ? j.quota.toLocaleString('fr-FR') : '∞'
          }

          return (
            <li key={j.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-ink">
                  <j.icon className="size-3.5 text-ink-mute" aria-hidden />
                  {j.label}
                </span>
                <span className="font-mono tabular-nums text-[12px] text-ink-mute">
                  <span className={cn('font-semibold', pct >= 80 && 'text-ink')}>
                    {usedDisplay}
                  </span>
                  <span className="text-ink-faint mx-1">/</span>
                  {quotaDisplay}
                </span>
              </div>
              {!isUnlimited && (
                <div className="h-1.5 rounded-full bg-sage-alt overflow-hidden">
                  <div
                    className={cn('h-full transition-all', barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {isUnlimited && (
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                  {j.fairUseLabel ?? 'Illimité'}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
