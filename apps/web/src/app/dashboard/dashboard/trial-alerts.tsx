import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface TrialRow {
  id: string
  module_id: string
  trial_ends_at: string
  user_decision: 'keep' | 'cancel' | null
  // AUDIT-B (2026-05-23) : DB réelle = `name` + `monthly_price_cents`
  // (les anciens noms `display_name` / `price_monthly_cents` n'existent pas).
  module: {
    module_code: string
    name: string
    monthly_price_cents: number
  } | null
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000)))
}

/**
 * Alertes des modules en essai (trial 14j) se terminant dans moins de 7 jours.
 *
 * Condition d'affichage : au moins 1 trial actif avec `trial_ends_at <= now() + 7j`.
 * Sinon render `null` (composant invisible quand pas de trial en cours).
 *
 * Pour chaque trial : nom du module, date de fin, prix mensuel projeté,
 * lien rapide vers /app/account (page dédiée gestion essais).
 */
export async function TrialAlerts() {
  const { supabase, orgId } = await getCurrentUser()

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  const { data: trials } = (await (
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
              lte: (
                col: string,
                val: string,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => Promise<{
                  data: TrialRow[] | null
                }>
              }
            }
          }
        }
      }
    }
  )
    .from('module_trials')
    .select(
      'id, module_id, trial_ends_at, user_decision, module:addon_modules(module_code, name, monthly_price_cents)',
    )
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .lte('trial_ends_at', sevenDaysFromNow)
    .order('trial_ends_at', { ascending: true })) as { data: TrialRow[] | null }

  const items = trials ?? []
  if (items.length === 0) return null

  return (
    <Card
      variant="opaque"
      padding="default"
      className="space-y-4 border-l-[3px] border-l-chartreuse"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-ink-mute" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute font-semibold">
            Essais en cours
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/account">
            Gérer mes essais <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <h3 className="font-serif italic text-xl text-ink leading-tight">
        {items.length === 1
          ? 'Un module en essai bientôt facturé.'
          : `${items.length} modules en essai bientôt facturés.`}
      </h3>

      <ul className="space-y-2.5">
        {items.map((trial) => {
          const days = daysUntil(trial.trial_ends_at)
          const priceEur = (trial.module?.monthly_price_cents ?? 0) / 100
          return (
            <li
              key={trial.id}
              className="flex items-center gap-3 rounded-md bg-sage/60 px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-ink truncate">
                  {trial.module?.name ?? 'Module'}
                </p>
                <p className="text-[12px] text-ink-mute">
                  Premier prélèvement dans {days} jour{days > 1 ? 's' : ''} ·{' '}
                  <span className="tabular-nums">{priceEur.toFixed(0)} € HT / mois</span>
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/dashboard/account">Décider</Link>
              </Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
