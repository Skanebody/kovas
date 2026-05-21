import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface PipelineStage {
  key: string
  label: string
  count: number
  valueCents?: number
  valueOverride?: string
}

function formatEurosCompact(cents: number): string {
  const eur = cents / 100
  return `${eur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € HT`
}

/**
 * Section 04 — Pipeline commercial.
 *
 * Refonte stages-grid style mockup. 4 stages côte à côte :
 *   1. Devis envoyés (quotes status='sent' depuis 30j)
 *   2. Devis consultés (proxy 65% — vrai tracking V1.5)
 *   3. Devis signés (quotes status='accepted' depuis 30j)
 *   4. RDV planifiés (dossiers scheduled 7 jours à venir)
 *
 * Chaque stage : label mono uppercase + count en mono 28px + valeur HT en mono
 * 11px + barre proportionnelle (max = 100%, autres relatifs).
 */
export async function DashboardPipeline() {
  const { supabase, orgId } = await getCurrentUser()
  const now = Date.now()
  const dayMs = 24 * 3600 * 1000
  const thirtyDaysAgo = new Date(now - 30 * dayMs).toISOString()
  const sevenDaysAhead = new Date(now + 7 * dayMs).toISOString()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  type QuoteRow = { total_ht_cents: number }

  const [sentRes, signedRes, scheduledRes] = await Promise.all([
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col2: string, val2: string) => {
                gte: (col: string, val: string) => Promise<{ data: QuoteRow[] | null }>
              }
            }
          }
        }
      }
    )
      .from('quotes')
      .select('total_ht_cents')
      .eq('organization_id', orgId)
      .eq('status', 'sent')
      .gte('sent_at', thirtyDaysAgo),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col2: string, val2: string) => {
                gte: (col: string, val: string) => Promise<{ data: QuoteRow[] | null }>
              }
            }
          }
        }
      }
    )
      .from('quotes')
      .select('total_ht_cents')
      .eq('organization_id', orgId)
      .eq('status', 'accepted')
      .gte('accepted_at', thirtyDaysAgo),
    supabase
      .from('dossiers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', sevenDaysAhead),
  ])

  const sentRows = sentRes.data ?? []
  const sentCount = sentRows.length
  const sentSum = sentRows.reduce((a, r) => a + (r.total_ht_cents ?? 0), 0)

  // V1 : "Consultés" = proxy 65% des envoyés (taux ouverture B2B moyen).
  // TODO V1.5 : remplacer par vrai tracking viewed_at sur quotes.
  const consultedCount = Math.round(sentCount * 0.65)
  const consultedSum = Math.round(sentSum * 0.65)

  const signedRows = signedRes.data ?? []
  const signedCount = signedRows.length
  const signedSum = signedRows.reduce((a, r) => a + (r.total_ht_cents ?? 0), 0)

  const rdvCount = scheduledRes.count ?? 0

  const stages: PipelineStage[] = [
    { key: 'sent', label: 'Devis envoyés', count: sentCount, valueCents: sentSum },
    { key: 'consulted', label: 'Consultés', count: consultedCount, valueCents: consultedSum },
    { key: 'signed', label: 'Signés', count: signedCount, valueCents: signedSum },
    {
      key: 'scheduled',
      label: 'RDV planifiés',
      count: rdvCount,
      valueOverride: 'cette semaine',
    },
  ]

  const maxCount = Math.max(1, ...stages.map((s) => s.count))

  return (
    <Card variant="opaque" padding="none" className="flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-rule/60 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink">
          <span className="text-ink-mute">04 ·</span> Pipeline commercial
        </p>
        <Link
          href="/dashboard/dossiers"
          className="font-mono text-[11px] text-ink-mute border-b border-rule pb-0.5 hover:text-ink hover:border-ink transition-colors inline-flex items-center gap-1"
        >
          Voir les dossiers <ArrowRight className="size-3" />
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4">
        {stages.map((stage, idx) => {
          const pct = (stage.count / maxCount) * 100
          const isLast = idx === stages.length - 1
          const valueLabel =
            stage.valueOverride ??
            (stage.valueCents !== undefined ? formatEurosCompact(stage.valueCents) : '')
          return (
            <div
              key={stage.key}
              className={cn(
                'p-4',
                !isLast && idx % 2 === 0 && 'border-r border-rule/60',
                !isLast && idx % 2 === 1 && 'md:border-r border-rule/60',
                idx < 2 && 'border-b md:border-b-0 border-rule/60',
              )}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute mb-3 min-h-[14px]">
                {stage.label}
              </p>
              <p className="font-mono text-[28px] font-medium text-ink leading-none tabular-nums">
                {stage.count}
              </p>
              <p className="font-mono text-[11px] text-ink-mute mt-2">{valueLabel}</p>
              <div className="mt-3 h-[2px] bg-rule/40 overflow-hidden">
                <div
                  className="h-full bg-[#0F1419] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
