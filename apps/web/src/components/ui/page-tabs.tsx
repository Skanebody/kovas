import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

export type PageTab = {
  /** Slug technique (utilisé en valeur du param URL `?tab=`) */
  key: string
  /** Libellé affiché */
  label: string
  /** Icône Lucide optionnelle (mobile-first compact) */
  icon?: LucideIcon
  /** Compteur affiché à droite du label (ex: 12 devis) */
  count?: number
}

type PageTabsProps = {
  /** Base href de la page (sans query). Ex: `/app/clients/abc-123` */
  basePath: string
  /** Liste des onglets */
  tabs: readonly PageTab[]
  /** Onglet actif courant */
  active: string
  /** Nom du param URL (default: `tab`) */
  paramName?: string
  className?: string
}

/**
 * PageTabs — navigation tabs pillules pour vues détail (fiche client, dossier, etc.).
 *
 * Composant server-friendly (links pures, pas de state client). Le SSR
 * lit le param URL `?tab=` côté page parente et passe `active`.
 *
 * Inspiration Qonto fiche contact : pill + underline subtle + compteurs mono.
 */
export function PageTabs({ basePath, tabs, active, paramName = 'tab', className }: PageTabsProps) {
  return (
    <nav
      aria-label="Sections"
      className={cn(
        'flex items-center gap-1 overflow-x-auto rounded-pill border border-rule/60 bg-paper/85 p-1 shadow-glass-sm backdrop-blur-xl',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const Icon = tab.icon
        return (
          <Link
            key={tab.key}
            href={`${basePath}?${paramName}=${tab.key}`}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-navy text-paper font-semibold shadow-accent'
                : 'text-ink-mute hover:text-ink font-medium',
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0" /> : null}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums',
                  isActive ? 'text-paper/80' : 'text-ink-mute/70',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
