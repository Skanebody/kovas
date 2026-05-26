import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

export type KpiHeroProps = {
  /** Valeur affichée en grand serif italic (Instrument Serif). */
  value: string | number
  /** Label court en mono uppercase au-dessus de la valeur. */
  label: string
  /** Phrase d'aide additionnelle sous le KPI. */
  hint?: string
  /** Variation % vs période précédente (null = masqué). */
  trend?: number | null
  className?: string
  /** Mise en avant visuelle hero (cocon grand format, KPI dramatisé pleine page). */
  featured?: boolean
  /** Variante "naked" sans bordure ni glass-opaque (pour intégrer dans une carte parente). */
  variant?: 'card' | 'naked'
}

/**
 * KpiHero — composant signature v5 (KPI dramatisé).
 *
 * Pattern : label mono uppercase (eyebrow) + chiffre énorme Instrument Serif
 * italic 60-120px (utilitaire .kpi-hero). Pendant éditorial du dashboard
 * cockpit + cards conversion / gain tracker.
 *
 * Exemple :
 *   <KpiHero label="CHIFFRE D'AFFAIRES MENSUEL" value="12 450 €" />
 *
 * Variant "naked" : pas de fond/bordure (à utiliser dans une Card<accent>).
 */
export function KpiHero({
  value,
  label,
  hint,
  trend,
  className,
  featured,
  variant = 'card',
}: KpiHeroProps) {
  return (
    <div
      className={cn(
        'min-w-0',
        variant === 'card' && 'rounded-2xl border border-[#0F1419]/[0.08] bg-paper p-4 sm:p-5',
        featured && variant === 'card' && 'md:col-span-2 md:row-span-2 md:p-8',
        className,
      )}
    >
      <p className="label-mono text-[#0F1419]/72 truncate">{label}</p>
      <p
        className={cn(
          'mt-2 hero-serif tracking-tight text-[#0F1419] leading-none break-words',
          featured
            ? 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl'
            : 'text-[28px] sm:text-4xl md:text-5xl lg:text-6xl',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-3 text-sm text-[#0F1419]/72">{hint}</p> : null}
      {trend !== null && trend !== undefined ? (
        <p
          className={cn(
            'mt-3 inline-flex items-center gap-1 text-xs font-medium rounded-pill px-2.5 py-1',
            trend >= 0
              ? 'bg-accent-green/15 text-accent-green'
              : 'bg-accent-red/15 text-accent-red',
          )}
        >
          {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {trend >= 0 ? '+' : ''}
          {trend}% vs semaine dernière
        </p>
      ) : null}
    </div>
  )
}
