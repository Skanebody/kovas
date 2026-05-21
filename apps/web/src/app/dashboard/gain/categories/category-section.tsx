import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Couleurs catégorielles Apple Santé adaptées DS v5 — accents discrets uniquement. */
export const CATEGORY_COLORS = {
  productivity: '#34C759', // green Apple Activity
  revenue: '#007AFF', // blue Apple Mindfulness
  quality: '#FF9500', // orange Apple Workout
  cabinet: '#AF52DE', // purple Apple Sleep
  ademe: '#8E8E93', // gray Apple
} as const

export type CategoryKey = keyof typeof CATEGORY_COLORS

interface CategorySectionProps {
  /** Clé catégorielle — détermine la couleur d'accent. */
  category: CategoryKey
  /** Icône Lucide affichée dans le rond couleur. */
  icon: LucideIcon
  /** Titre uppercase de la section. */
  title: string
  /** Cible facultative pour le lien "Tout afficher" → href. */
  seeAllHref?: string
  /** Cards intérieures (2-3 cards mini côte à côte). */
  children: ReactNode
}

/**
 * Section catégorielle — pattern Apple Santé Résumé.
 *
 * Header : icon rond 28×28 bg couleur catégorielle pleine (icon blanc dedans)
 *   + titre uppercase mono + lien "Tout afficher →" à droite en mono mute.
 * Body : grille 1/2/3 cols pour cards mini (chaque card a un mini-trend + valeur).
 *
 * Accent couleur appliqué UNIQUEMENT sur l'icon background.
 * Les cards intérieures restent DS v5 sobre (paper + rule).
 */
export function CategorySection({
  category,
  icon: Icon,
  title,
  seeAllHref,
  children,
}: CategorySectionProps) {
  const color = CATEGORY_COLORS[category]

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div
          aria-hidden
          className="size-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: color }}
        >
          <Icon className="size-3.5 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-ink">
          {title}
        </h2>
        {seeAllHref && (
          <a
            href={seeAllHref}
            className="ml-auto font-mono text-[11px] text-ink-mute hover:text-ink tracking-[0.05em] transition-colors"
          >
            Tout afficher →
          </a>
        )}
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">{children}</div>
    </section>
  )
}

interface CategoryMiniCardProps {
  /** Couleur catégorielle (clé) — applique border-left 3px discrète. */
  category: CategoryKey
  /** Label mono uppercase. */
  label: string
  /** Valeur principale (texte ou chiffre). */
  value: string
  /** Unité optionnelle plus petite. */
  unit?: string
  /** Sous-texte explicatif optionnel (mono mute). */
  hint?: string
  /** Mini-trend badge optionnel "+12%" + direction. */
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' }
  /** Spanning grid optionnel (default 1 col, peut prendre 2 ou 3). */
  span?: 1 | 2 | 3
}

/**
 * Card mini Apple Santé — bloc compact avec border-left accent catégoriel.
 *
 * Fond paper opaque, radius 16, border-left 3px couleur catégorielle subtile.
 * Padding aéré 16-20px, valeur en serif italic 28-32px, trend badge mono.
 */
export function CategoryMiniCard({
  category,
  label,
  value,
  unit,
  hint,
  trend,
  span = 1,
}: CategoryMiniCardProps) {
  const color = CATEGORY_COLORS[category]

  return (
    <div
      className={cn(
        'rounded-[16px] bg-paper p-5 relative overflow-hidden',
        'border border-rule/60',
        span === 2 && 'md:col-span-2',
        span === 3 && 'md:col-span-3',
      )}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute mb-3">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <p className="font-serif italic font-normal leading-none tracking-tight text-ink text-[28px] sm:text-[32px] tabular-nums">
          {value}
        </p>
        {unit && (
          <span className="font-sans not-italic font-normal text-sm text-ink-mute">
            {unit}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[10px] tracking-[0.05em]',
              trend.direction === 'up' && 'bg-accent-green/10 text-accent-green',
              trend.direction === 'down' && 'bg-accent-red/10 text-accent-red',
              trend.direction === 'neutral' && 'bg-rule/40 text-ink-mute',
            )}
          >
            <span aria-hidden>
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '·'}
            </span>
            {trend.value}
          </span>
        )}
        {hint && (
          <p className="font-mono text-[11px] text-ink-mute leading-tight">{hint}</p>
        )}
      </div>
    </div>
  )
}
