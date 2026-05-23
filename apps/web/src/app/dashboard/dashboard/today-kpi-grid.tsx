import { getCurrentUser } from '@/lib/auth/current-user'
import { planAtLeast } from '@/lib/billing/feature-gates'
import { parisDayBounds, parisMonthBounds } from '@/lib/paris-dates'
import { cn } from '@/lib/utils'

interface Kpi {
  label: string
  value: string
  unit?: string
  delta?: string
  deltaDirection?: 'up' | 'down' | 'neutral'
  status?: { label: string; color: 'green' | 'amber' | 'red' | 'ink' }
}

/**
 * Section 01 — Performance du jour.
 *
 * Grille 4 KPI data-dense (style mockup) avec bordures internes 1px,
 * sans gap. Chaque KPI affiche label mono uppercase + valeur en grand
 * Instrument Serif italic (signature KOVAS pour les KPIs hero).
 *
 * KPIs :
 *   1. Missions aujourd'hui (count completed + scheduled)
 *   2. Devis en attente (status sent depuis 7j)
 *   3. CA Mois HT (sum invoices.total_ht)
 *   4. Risque ADEME (snapshot risk_level) — placeholder si pas gated/configuré
 *
 * Gating KPI 4 : si plan < Découverte → "—" + label "Disponible avec Pack Découverte"
 * Si plan OK mais pas de snapshot → "—" + label "Configurer le cockpit"
 */
export async function TodayKpiGrid() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso: todayStart, endIso: todayEnd } = parisDayBounds()
  const { startIso: monthStart, nextIso: monthNext } = parisMonthBounds()

  // Mois précédent pour delta CA
  const prevMonthStart = new Date(monthStart)
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

  const [
    { count: missionsTodayDone },
    { count: missionsTodayTotal },
    { count: quotesPending },
    { count: quotesThisWeek },
    invoicesMonthRes,
    invoicesPrevMonthRes,
    subRes,
    ademeRes,
  ] = await Promise.all([
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .gte('completed_at', todayStart)
      .lt('completed_at', todayEnd),
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', todayStart)
      .lt('scheduled_at', todayEnd),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (
            cols: string,
            opts: { count: 'exact'; head: true },
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              eq: (col2: string, val2: string) => Promise<{ count: number | null }>
            }
          }
        }
      }
    )
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'sent'),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (
            cols: string,
            opts: { count: 'exact'; head: true },
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              gte: (col: string, val: string) => Promise<{ count: number | null }>
            }
          }
        }
      }
    )
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              gte: (
                col: string,
                val: string,
              ) => {
                lt: (col: string, val: string) => Promise<{ data: { amount_ht: number }[] | null }>
              }
            }
          }
        }
      }
    )
      .from('invoices')
      .select('amount_ht')
      .eq('organization_id', orgId)
      .gte('issued_at', monthStart)
      .lt('issued_at', monthNext),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              gte: (
                col: string,
                val: string,
              ) => {
                lt: (col: string, val: string) => Promise<{ data: { amount_ht: number }[] | null }>
              }
            }
          }
        }
      }
    )
      .from('invoices')
      .select('amount_ht')
      .eq('organization_id', orgId)
      .gte('issued_at', prevMonthStart.toISOString())
      .lt('issued_at', monthStart),
    supabase.from('subscriptions').select('plan_code').eq('organization_id', orgId).maybeSingle(),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{
                    data: { risk_level: string } | null
                  }>
                }
              }
            }
          }
        }
      }
    )
      .from('ademe_kpi_snapshots')
      .select('risk_level')
      .eq('organization_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const planCode = (subRes.data as { plan_code?: string } | null)?.plan_code

  // KPI 1 — Missions
  const todayDone = missionsTodayDone ?? 0
  const todayTotal = missionsTodayTotal ?? 0
  const remaining = Math.max(0, todayTotal - todayDone)

  // KPI 2 — Devis
  const pending = quotesPending ?? 0
  const thisWeek = quotesThisWeek ?? 0

  // KPI 3 — CA mois
  const sumCents = (invoicesMonthRes.data ?? []).reduce((a, r) => a + (r.amount_ht ?? 0), 0)
  const sumPrevCents = (invoicesPrevMonthRes.data ?? []).reduce((a, r) => a + (r.amount_ht ?? 0), 0)
  const caMonth = sumCents / 100
  const caDeltaPct =
    sumPrevCents > 0 ? Math.round(((sumCents - sumPrevCents) / sumPrevCents) * 100) : null

  // KPI 4 — Risque ADEME (gated)
  const ademeGated = planAtLeast(planCode, 'decouverte')
  const ademeSnapshot = ademeRes.data
  const ademeLevel = ademeSnapshot?.risk_level
  let ademeKpi: Kpi
  if (!ademeGated) {
    ademeKpi = {
      label: 'Risque ADEME',
      value: '—',
      status: { label: 'Pack Découverte requis', color: 'ink' },
    }
  } else if (!ademeLevel) {
    ademeKpi = {
      label: 'Risque ADEME',
      value: '—',
      status: { label: 'À configurer', color: 'amber' },
    }
  } else {
    const labelByLevel: Record<string, string> = {
      safe: 'FAIBLE',
      watch: 'MODÉRÉ',
      alert: 'ÉLEVÉ',
      critical: 'CRITIQUE',
    }
    const colorByLevel: Record<string, Kpi['status'] extends infer S ? S : never> = {
      safe: { label: 'Surveillance active', color: 'green' },
      watch: { label: 'Vigilance accrue', color: 'amber' },
      alert: { label: 'Alerte active', color: 'red' },
      critical: { label: 'Action requise', color: 'red' },
    }
    ademeKpi = {
      label: 'Risque ADEME',
      value: labelByLevel[ademeLevel] ?? 'INCONNU',
      status: colorByLevel[ademeLevel],
    }
  }

  const kpis: Kpi[] = [
    {
      label: "Missions aujourd'hui",
      value: String(todayDone),
      unit: ` / ${todayTotal}`,
      delta:
        todayTotal > 0
          ? `${remaining} restante${remaining > 1 ? 's' : ''}`
          : 'Pas de mission planifiée',
    },
    {
      label: 'Devis en attente',
      value: String(pending),
      delta: thisWeek > 0 ? `${thisWeek} cette semaine` : 'Aucun cette semaine',
      deltaDirection: thisWeek > 0 ? 'up' : 'neutral',
    },
    {
      label: 'CA Mois (HT)',
      value: caMonth.toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
      unit: ' €',
      delta:
        caDeltaPct === null
          ? '—'
          : `${caDeltaPct >= 0 ? '+' : ''}${caDeltaPct} % vs mois précédent`,
      deltaDirection: caDeltaPct === null ? 'neutral' : caDeltaPct >= 0 ? 'up' : 'down',
    },
    ademeKpi,
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border border-rule/60">
      {kpis.map((k, idx) => {
        const isLast = idx === kpis.length - 1
        const isLastRow = idx >= 2
        const isText = !/^\d|^—/.test(k.value)
        return (
          <div
            key={k.label}
            className={cn(
              'p-5',
              !isLast &&
                (idx % 2 === 0 ? 'md:border-r border-rule/60' : 'md:border-r border-rule/60'),
              idx < 2 && 'border-b md:border-b-0 border-rule/60',
              !isLastRow && 'md:border-b-0',
              idx === 0 && 'border-r md:border-r border-rule/60',
              idx === 2 && 'border-r md:border-r-0 md:border-r border-rule/60',
            )}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute mb-3">
              {k.label}
            </p>
            <div className="flex items-baseline">
              <p
                className={cn(
                  'font-serif italic font-normal leading-none tracking-tight text-ink',
                  isText ? 'text-2xl' : 'text-4xl',
                )}
              >
                {k.value}
              </p>
              {k.unit && (
                <span className="font-sans not-italic font-normal text-sm text-ink-mute ml-1">
                  {k.unit}
                </span>
              )}
            </div>
            {k.delta && (
              <p
                className={cn(
                  'font-mono text-[11px] mt-2.5',
                  k.deltaDirection === 'up' && 'text-accent-green',
                  k.deltaDirection === 'down' && 'text-accent-red',
                  (!k.deltaDirection || k.deltaDirection === 'neutral') && 'text-ink-mute',
                )}
              >
                {k.deltaDirection === 'up' && '↑ '}
                {k.deltaDirection === 'down' && '↓ '}
                {k.delta}
              </p>
            )}
            {k.status && (
              <p
                className={cn(
                  'mt-2.5 text-[11px] font-medium tracking-[0.03em] inline-flex items-center gap-1.5',
                  k.status.color === 'green' && 'text-accent-green',
                  k.status.color === 'amber' && 'text-accent-warm',
                  k.status.color === 'red' && 'text-accent-red',
                  k.status.color === 'ink' && 'text-ink-mute',
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {k.status.label}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
