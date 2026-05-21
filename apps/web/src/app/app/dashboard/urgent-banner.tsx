import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { AlertTriangle, ArrowRight, CreditCard, Gavel, ShieldAlert, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface UrgentItem {
  key: string
  icon: LucideIcon
  title: string
  description: string
  cta: string
  href: string
}

/**
 * Bandeau d'urgence affiché EN HAUT du dashboard si une action critique nécessite
 * l'attention immédiate de l'utilisateur. 4 sources possibles :
 *   1. Paiement Stripe échoué (subscription.status='past_due')
 *   2. Résiliation programmée (subscription.cancel_at_period_end=true)
 *   3. Litige ouvert non traité (litigation_workflows status='opened')
 *   4. Demande RGPD avec deadline proche (dsar_requests status='pending' deadline <7j)
 *
 * Si aucune urgence : render `null` (pas d'espace pris).
 *
 * Style : fond dark + bordure latérale chartreuse pour urgences traitables,
 * bordure rouge danger pour urgences critiques non-différables (paiement).
 */
export async function UrgentBanner() {
  const { supabase, orgId, user } = await getCurrentUser()

  // Cast strict : 4 tables non encore régénérées dans Database types (litigation_workflows,
  // dsar_requests, subscriptions étendue post-pivot 5 forfaits).
  type SubRow = { status: string; cancel_at_period_end: boolean; current_period_end: string | null }
  type LitRow = { id: string; mission_id: string; opened_at: string }
  type DsarRow = { id: string; type: string; deadline: string }

  const [subRes, litRes, dsarRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, cancel_at_period_end, current_period_end')
      .eq('organization_id', orgId)
      .maybeSingle() as unknown as Promise<{ data: SubRow | null }>,
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              in: (col: string, vals: string[]) => {
                order: (col: string, opts: { ascending: boolean }) => {
                  limit: (n: number) => Promise<{ data: LitRow[] | null }>
                }
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
      .order('opened_at', { ascending: true })
      .limit(1),
    (
      supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (col1: string, val1: string) => {
              in: (col: string, vals: string[]) => {
                lte: (col: string, val: string) => {
                  order: (col: string, opts: { ascending: boolean }) => {
                    limit: (n: number) => Promise<{ data: DsarRow[] | null }>
                  }
                }
              }
            }
          }
        }
      }
    )
      .from('dsar_requests')
      .select('id, type, deadline')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .lte('deadline', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('deadline', { ascending: true })
      .limit(1),
  ])

  const items: UrgentItem[] = []
  const sub = subRes.data

  if (sub?.status === 'past_due') {
    items.push({
      key: 'payment_failed',
      icon: CreditCard,
      title: 'Paiement échoué',
      description:
        "Votre dernier prélèvement n'a pas abouti. Mettez à jour votre moyen de paiement pour éviter la suspension du compte.",
      cta: 'Régulariser',
      href: '/app/account',
    })
  }

  if (sub?.cancel_at_period_end && sub.current_period_end) {
    const endDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(
      new Date(sub.current_period_end),
    )
    items.push({
      key: 'cancel_pending',
      icon: XCircle,
      title: 'Résiliation programmée',
      description: `Votre abonnement prend fin le ${endDate}. Vous pouvez encore reprendre votre abonnement à tout moment.`,
      cta: "Reprendre l'abonnement",
      href: '/app/account',
    })
  }

  const litigation = litRes?.data?.[0]
  if (litigation) {
    items.push({
      key: 'litigation_open',
      icon: Gavel,
      title: 'Mise en cause à traiter',
      description:
        'Un litige a été ouvert et nécessite votre réponse. Le bouclier de défense a préparé un brouillon.',
      cta: 'Voir le litige',
      href: `/app/dossiers/${litigation.mission_id}/litigation`,
    })
  }

  const dsar = dsarRes?.data?.[0]
  if (dsar) {
    const deadlineDate = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    }).format(new Date(dsar.deadline))
    items.push({
      key: 'dsar_pending',
      icon: ShieldAlert,
      title: 'Demande RGPD à traiter',
      description: `Demande "${dsar.type === 'export' ? "d'export" : 'd\'effacement'}" avec échéance le ${deadlineDate}. Obligation légale 30 jours max.`,
      cta: 'Traiter',
      href: '/admin/rgpd',
    })
  }

  if (items.length === 0) return null

  return (
    <section
      aria-label="Actions urgentes"
      className="bg-[#0F1419] text-white rounded-[24px] p-5 sm:p-6 border-l-[3px] border-l-chartreuse space-y-3"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-chartreuse" aria-hidden />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-chartreuse font-bold">
          {items.length} action{items.length > 1 ? 's' : ''} urgente{items.length > 1 ? 's' : ''}
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span
                aria-hidden
                className="size-9 shrink-0 rounded-md bg-white/[0.08] flex items-center justify-center"
              >
                <item.icon className="size-4 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-white leading-tight">{item.title}</p>
                <p className="text-[13px] text-white/70 leading-snug mt-1">{item.description}</p>
              </div>
            </div>
            <Button
              asChild
              variant="accent"
              size="sm"
              className="shrink-0 self-start sm:self-center"
            >
              <Link href={item.href}>
                {item.cta} <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
