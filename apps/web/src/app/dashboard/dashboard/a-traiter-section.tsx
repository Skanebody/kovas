import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight, FileCheck2, Inbox, Receipt } from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'

/**
 * Section « À traiter » — 3 compteurs cliquables.
 *
 * 2026-05-27 (FIX-ATRAITER) : refonte du rendu après signal Benjamin que les
 * tiles étaient illisibles. Cause : `Button asChild variant="ghost"` applique
 * `text-ink-mute` (#5B7088 gris bleuté) qui se propage via Radix Slot et
 * grisaillait label + count. Remplacé par `<Link>` direct avec classes
 * explicites — label et count en navy plein `#0F1419`, lisibilité garantie
 * sur bg-paper (#FDFBF6 cream).
 *
 * Sources V1 :
 *  - Leads : table absente V1 → fallback 0 (slot prêt pour V1.5)
 *  - Devis sans réponse : quotes status='sent' AND accepted_at IS NULL
 *  - Factures impayées : invoices status in ('overdue', 'issued') AND due_date passée
 * Si tables absentes ou colonnes non câblées, fallback 0 silencieux.
 *
 * AUDIT-B (2026-05-23) : `invoices.status` ne contient pas 'sent' ni 'late' —
 * contrainte CHECK : ('draft', 'issued', 'paid', 'partial', 'overdue', 'cancelled').
 * 'issued' = facture émise et envoyée mais pas encore en retard.
 */
interface TileSpec {
  key: string
  icon: ComponentType<{ className?: string }>
  /** Label court (1 mot, visible en grille étroite) */
  label: string
  /** Sous-label optionnel (plus descriptif, visible quand l'espace le permet) */
  sublabel?: string
  count: number
  href: string
  /** Couleur d'accent pour les tiles avec count > 0 */
  accent?: 'neutral' | 'amber' | 'red'
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
      .in('status', ['overdue', 'issued'])
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
      label: 'Leads',
      sublabel: 'non répondus',
      count: counts.leads,
      href: '/dashboard/leads',
      accent: counts.leads > 0 ? 'amber' : 'neutral',
    },
    {
      key: 'quotes',
      icon: FileCheck2,
      label: 'Devis',
      sublabel: 'sans réponse',
      count: counts.quotes,
      href: '/dashboard/facturation?tab=devis',
      accent: counts.quotes > 0 ? 'amber' : 'neutral',
    },
    {
      key: 'invoices',
      icon: Receipt,
      label: 'Factures',
      sublabel: 'impayées',
      count: counts.invoices,
      href: '/dashboard/facturation?tab=factures&filter=overdue',
      accent: counts.invoices > 0 ? 'red' : 'neutral',
    },
  ]

  const totalCount = tiles.reduce((sum, t) => sum + t.count, 0)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-sans text-[15px] font-semibold text-[#0F1419] tracking-tight">
          À traiter
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#0F1419]/55">
          {totalCount} item{totalCount > 1 ? 's' : ''}
        </p>
      </div>
      {/*
        Layout : grille 1 col mobile → 3 cols md+ (768px+).
        En md+, chaque tile fait au moins ~200px de large dans une colonne
        dashboard de 600-800px, ce qui suffit pour label court + sublabel
        + count gros + arrow.
        Layout vertical interne (stack icon + textes en haut, count + arrow
        en bas) pour éviter la troncature horizontale "L..." vue précédemment
        en grille trop dense.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {tiles.map((tile) => {
          const countColor =
            tile.count === 0
              ? 'text-[#0F1419]/40'
              : tile.accent === 'red'
                ? 'text-red-600'
                : tile.accent === 'amber'
                  ? 'text-amber-600'
                  : 'text-[#0F1419]'

          const Icon = tile.icon

          return (
            <Link
              key={tile.key}
              href={tile.href}
              className="group flex flex-col gap-2 rounded-xl border border-[#0F1419]/[0.08] bg-paper px-4 py-3 transition-colors hover:bg-[#0F1419]/[0.03] hover:border-[#0F1419]/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1419]/30 focus-visible:ring-offset-2"
              style={{ borderRadius: '12px' }}
            >
              {/* Ligne 1 — icon + label/sublabel (vertical stack si sublabel) */}
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className="size-4 shrink-0 mt-0.5 text-[#0F1419]/60" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1419] leading-tight">
                    {tile.label}
                  </p>
                  {tile.sublabel ? (
                    <p className="text-[11px] text-[#0F1419]/55 leading-tight mt-0.5">
                      {tile.sublabel}
                    </p>
                  ) : null}
                </div>
              </div>
              {/* Ligne 2 — count XXL + arrow droite */}
              <div className="flex items-end justify-between mt-1">
                <span
                  className={`font-mono tabular-nums text-[28px] font-semibold leading-none ${countColor}`}
                >
                  {tile.count}
                </span>
                <ArrowRight
                  className="size-4 text-[#0F1419]/30 group-hover:text-[#0F1419]/72 transition-colors mb-0.5"
                  aria-hidden
                />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
