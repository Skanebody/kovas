import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { FileCheck2, Receipt, Inbox, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'

/**
 * Section « À traiter » — 3 compteurs cliquables sans décor.
 * Sources V1 :
 *  - Leads : table absente V1 → fallback 0 (slot prêt pour V1.5)
 *  - Devis sans réponse : quotes status='sent' AND accepted_at IS NULL
 *  - Factures impayées : invoices status in ('overdue', 'sent') AND due_date passée
 * Si tables absentes ou colonnes non câblées, fallback 0 silencieux.
 */
interface TileSpec {
  key: string
  icon: ComponentType<{ className?: string }>
  label: string
  count: number
  href: string
}

async function fetchCounts(): Promise<Record<'leads' | 'quotes' | 'invoices', number>> {
  const { supabase, orgId } = await getCurrentUser()
  const nowIso = new Date().toISOString()

  // Leads : aucune table dédiée en V1
  const leads = 0

  let quotes = 0
  try {
    const { count } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'sent')
      .is('accepted_at', null)
    quotes = count ?? 0
  } catch {
    quotes = 0
  }

  let invoices = 0
  try {
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['overdue', 'sent', 'late'])
      .lt('due_date', nowIso)
    invoices = count ?? 0
  } catch {
    invoices = 0
  }

  return { leads, quotes, invoices }
}

export async function ATraiterSection() {
  const counts = await fetchCounts()

  const tiles: TileSpec[] = [
    {
      key: 'leads',
      icon: Inbox,
      label: 'Leads non répondus',
      count: counts.leads,
      href: '/dashboard/messages',
    },
    {
      key: 'quotes',
      icon: FileCheck2,
      label: 'Devis sans réponse',
      count: counts.quotes,
      href: '/dashboard/facturation',
    },
    {
      key: 'invoices',
      icon: Receipt,
      label: 'Factures impayées',
      count: counts.invoices,
      href: '/dashboard/facturation',
    },
  ]

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute mb-3">
        À TRAITER
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <Button
            key={tile.key}
            asChild
            variant="ghost"
            className="h-auto justify-between rounded-xl border border-rule/40 bg-paper/60 px-4 py-3 text-left hover:bg-ink/5 hover:border-rule"
          >
            <Link href={tile.href}>
              <span className="flex items-center gap-2.5 min-w-0">
                <tile.icon className="size-4 shrink-0 text-ink-mute" />
                <span className="text-[13px] text-ink truncate font-normal">{tile.label}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono tabular-nums text-[18px] font-semibold text-ink">
                  {tile.count}
                </span>
                <ArrowRight className="size-3.5 text-ink-mute" />
              </span>
            </Link>
          </Button>
        ))}
      </div>
    </section>
  )
}
