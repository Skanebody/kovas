import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface PriorityAlert {
  key: string
  priority: 'P1' | 'P2' | 'P3'
  title: string
  meta: string
  cta: string
  href: string
}

/**
 * Section 06 — Priorités.
 *
 * Agrège des alertes multi-sources en 3 niveaux de priorité (P1 critique /
 * P2 important / P3 info utile). Style mockup data-dense : grid 3 colonnes
 * (badge priority / content / action) avec bordures 1px entre items.
 *
 * Sources :
 *   P1 — regulatory_notifications.priority='critical' non lue,
 *        litigation_workflows.status IN ('opened','in_progress') >48h,
 *        ademe_prevalidations.verdict='red' non décidée
 *   P2 — quotes.status='sent' avec valid_until -7j,
 *        missions.status='to_review' >24h,
 *        dossiers RDV J+1/J+2 sans owner_documents
 *   P3 — prescriber_relationships silencieux >30j,
 *        module_trials.trial_ends_at <7j
 *
 * Tri : P1 d'abord, puis P2, puis P3. Limite 6 items totaux pour ne pas
 * surcharger. Si 0 alerte : état vide sobre "Aucune priorité — vous êtes à jour."
 */
export async function PrioritiesAlerts() {
  const { supabase, orgId, user } = await getCurrentUser()
  const now = Date.now()
  const dayMs = 24 * 3600 * 1000

  const [
    regCriticalRes,
    litOpenRes,
    prevalidRedRes,
    quotesExpiringRes,
    missionsToReviewRes,
    prescribersSilentRes,
    trialsExpiringRes,
  ] = await Promise.all([
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col1: string, val1: string) => {
              eq: (col2: string, val2: string) => {
                is: (col: string, val: null) => Promise<{
                  data: { id: string; document_id: string; title: string; created_at: string }[] | null
                }>
              }
            }
          }
        }
      }
    )
      .from('regulatory_notifications')
      .select('id, document_id, title, created_at')
      .eq('user_id', user.id)
      .eq('priority', 'critical')
      .is('read_at', null),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              in: (col: string, vals: string[]) => {
                lte: (col: string, val: string) => Promise<{
                  data: { id: string; mission_id: string; opened_at: string }[] | null
                }>
              }
            }
          }
        }
      }
    )
      .from('litigation_workflows')
      .select('id, mission_id, opened_at')
      .eq('organization_id', orgId)
      .in('status', ['opened', 'in_progress'])
      .lte('opened_at', new Date(now - 2 * dayMs).toISOString()),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col1: string, val1: string) => {
              eq: (col2: string, val2: string) => {
                is: (col: string, val: null) => Promise<{
                  data: { id: string; mission_id: string; address_label?: string }[] | null
                }>
              }
            }
          }
        }
      }
    )
      .from('ademe_prevalidations')
      .select('id, mission_id, address_label')
      .eq('organization_id', orgId)
      .eq('verdict', 'red')
      .is('decision', null),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col1: string, val1: string) => {
              eq: (col2: string, val2: string) => {
                lte: (col: string, val: string) => {
                  order: (col: string, opts: { ascending: boolean }) => {
                    limit: (n: number) => Promise<{
                      data: {
                        id: string
                        reference: string
                        valid_until: string
                        total_ht_cents: number
                        contact: { display_name?: string } | null
                      }[] | null
                    }>
                  }
                }
              }
            }
          }
        }
      }
    )
      .from('quotes')
      .select('id, reference, valid_until, total_ht_cents, contact:contacts(display_name)')
      .eq('organization_id', orgId)
      .eq('status', 'sent')
      .lte('valid_until', new Date(now + 7 * dayMs).toISOString())
      .order('valid_until', { ascending: true })
      .limit(3),
    supabase
      .from('missions')
      .select('id, dossier_id, type', { count: 'exact' })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'to_review')
      .lte('updated_at', new Date(now - dayMs).toISOString())
      .limit(3),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              gte: (col: string, val: number) => {
                order: (col: string, opts: { ascending: boolean }) => {
                  limit: (n: number) => Promise<{
                    data: {
                      id: string
                      silent_since_days: number
                      total_revenue: number
                      tier: string | null
                      contact: { display_name?: string } | null
                    }[] | null
                  }>
                }
              }
            }
          }
        }
      }
    )
      .from('prescriber_relationships')
      .select(
        'id, silent_since_days, total_revenue, tier, contact:contacts(display_name)',
      )
      .eq('organization_id', orgId)
      .gte('silent_since_days', 30)
      .order('total_revenue', { ascending: false })
      .limit(2),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col1: string, val1: string) => {
              eq: (col2: string, val2: string) => {
                lte: (col: string, val: string) => Promise<{
                  data: {
                    id: string
                    trial_ends_at: string
                    module: { display_name?: string } | null
                  }[] | null
                }>
              }
            }
          }
        }
      }
    )
      .from('module_trials')
      .select(
        'id, trial_ends_at, module:addon_modules(display_name)',
      )
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .lte('trial_ends_at', new Date(now + 7 * dayMs).toISOString()),
  ])

  const alerts: PriorityAlert[] = []

  // P1
  for (const n of regCriticalRes.data ?? []) {
    alerts.push({
      key: `reg-${n.id}`,
      priority: 'P1',
      title: 'Nouveau document réglementaire critique',
      meta: n.title,
      cta: 'Lire',
      href: `/app/veille/${n.document_id}`,
    })
  }
  for (const l of litOpenRes.data ?? []) {
    alerts.push({
      key: `lit-${l.id}`,
      priority: 'P1',
      title: 'Litige ouvert non traité',
      meta: `Ouvert il y a ${Math.floor((now - new Date(l.opened_at).getTime()) / dayMs)} jours`,
      cta: 'Traiter',
      href: `/app/dossiers/${l.mission_id}/litigation`,
    })
  }
  for (const p of prevalidRedRes.data ?? []) {
    alerts.push({
      key: `prev-${p.id}`,
      priority: 'P1',
      title: 'Pré-validation ADEME en rouge',
      meta: p.address_label ?? 'À ne pas publier en l\'état',
      cta: 'Voir',
      href: `/app/dossiers/${p.mission_id}/prevalidation`,
    })
  }

  // P2
  for (const q of quotesExpiringRes.data ?? []) {
    const days = Math.max(
      0,
      Math.ceil((new Date(q.valid_until).getTime() - now) / dayMs),
    )
    const eur = (q.total_ht_cents / 100).toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
    })
    alerts.push({
      key: `quote-${q.id}`,
      priority: 'P2',
      title: `Devis ${q.reference} expire dans ${days} jour${days > 1 ? 's' : ''}`,
      meta: `Client : ${q.contact?.display_name ?? '—'} · ${eur} € HT`,
      cta: 'Relancer',
      href: '/app/dossiers',
    })
  }
  const toReviewCount = missionsToReviewRes.count ?? 0
  if (toReviewCount > 0) {
    alerts.push({
      key: 'missions-review',
      priority: 'P2',
      title: `${toReviewCount} mission${toReviewCount > 1 ? 's' : ''} à relire`,
      meta: 'Validation cohérence avant export',
      cta: 'Relire',
      href: '/app/dossiers?status=to_review',
    })
  }

  // P3
  for (const p of prescribersSilentRes.data ?? []) {
    const eur = p.total_revenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    alerts.push({
      key: `presc-${p.id}`,
      priority: 'P3',
      title: `${p.contact?.display_name ?? 'Prescripteur'} silencieux depuis ${p.silent_since_days} jours`,
      meta: `CA total : ${eur} €${p.tier ? ` · Tier : ${p.tier}` : ''}`,
      cta: 'Programmer',
      href: '/app/prescripteurs',
    })
  }
  for (const t of trialsExpiringRes.data ?? []) {
    const days = Math.max(
      0,
      Math.ceil((new Date(t.trial_ends_at).getTime() - now) / dayMs),
    )
    alerts.push({
      key: `trial-${t.id}`,
      priority: 'P3',
      title: `Essai ${t.module?.display_name ?? 'module'} : ${days}j restants`,
      meta: 'Conversion automatique sinon désactivation',
      cta: 'Décider',
      href: '/app/account',
    })
  }

  // Tri par priorité puis limite 6
  const order = { P1: 0, P2: 1, P3: 2 } as const
  const sorted = alerts.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 6)

  if (sorted.length === 0) {
    return (
      <div className="border border-rule/60 px-5 py-10 flex flex-col items-center justify-center gap-2.5">
        <CheckCircle2 className="size-6 text-accent-green" aria-hidden />
        <p className="text-sm text-ink font-medium">Aucune priorité.</p>
        <p className="text-xs text-ink-mute max-w-[300px] text-center">
          Vous êtes à jour. Profitez-en pour préparer demain.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-rule/60">
      {sorted.map((alert, idx) => (
        <div
          key={alert.key}
          className={cn(
            'grid grid-cols-[36px_1fr_auto] gap-4 items-center px-5 py-3.5',
            idx < sorted.length - 1 && 'border-b border-rule/60',
          )}
        >
          <span
            className={cn(
              'font-mono text-[10px] font-bold uppercase tracking-[0.05em]',
              alert.priority === 'P1' && 'text-accent-red',
              alert.priority === 'P2' && 'text-ink',
              alert.priority === 'P3' && 'text-ink-mute',
            )}
          >
            {alert.priority}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink leading-snug">{alert.title}</p>
            <p className="font-mono text-[11px] text-ink-mute mt-0.5 truncate">{alert.meta}</p>
          </div>
          <Link
            href={alert.href}
            className="font-mono text-[11px] text-ink border-b border-ink pb-0.5 hover:opacity-70 inline-flex items-center gap-1 transition-opacity"
          >
            {alert.cta} <ArrowRight className="size-3" />
          </Link>
        </div>
      ))}
    </div>
  )
}
