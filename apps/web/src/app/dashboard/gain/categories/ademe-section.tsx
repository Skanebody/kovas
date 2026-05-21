import { ShieldCheck } from 'lucide-react'
import { CATEGORY_COLORS, CategoryMiniCard, CategorySection } from './category-section'

export interface AdemeData {
  /** Compteur DPE 12 mois glissants (count). */
  dpeCount12m: number
  /** Limite légale (1000 DPE/an). */
  dpeLimit: number
  /** Projection annuelle linéaire (à ce rythme). */
  yearlyProjection: number
  /** Ratio % DPE notés F ou G (0-100). null = pas de DPE. */
  ratioFG: number | null
  /** Distance moyenne en km entre missions DPE (proxy efficacité tournée). null = pas mesuré. */
  avgDistanceKm: number | null
}

/**
 * Section Conformité ADEME — accent gris Apple #8E8E93.
 *
 * Layout :
 *  - Gauge volume 12 mois / 1000 (col span 2) avec barre progression
 *  - 1 card ratio F/G
 *  - 1 card distance moyenne
 *
 * Référence : DPE_LEGAL_LIMIT = 1000 (article R134-4-3 Code construction).
 * Cf. lib/dpe-counter.ts pour la logique source.
 */
export function AdemeSection({ data }: { data: AdemeData }) {
  return (
    <CategorySection
      category="ademe"
      icon={ShieldCheck}
      title="Conformité ADEME"
      seeAllHref="/dashboard/account"
    >
      <DpeGaugeCard
        count={data.dpeCount12m}
        limit={data.dpeLimit}
        projection={data.yearlyProjection}
      />
      <CategoryMiniCard
        category="ademe"
        label="Ratio F/G"
        value={data.ratioFG === null ? '—' : String(data.ratioFG)}
        unit={data.ratioFG === null ? undefined : '%'}
        hint="DPE classés F ou G"
      />
      <CategoryMiniCard
        category="ademe"
        label="Distance moyenne"
        value={data.avgDistanceKm === null ? '—' : String(data.avgDistanceKm)}
        unit={data.avgDistanceKm === null ? undefined : 'km'}
        hint="entre missions DPE"
      />
    </CategorySection>
  )
}

function DpeGaugeCard({
  count,
  limit,
  projection,
}: {
  count: number
  limit: number
  projection: number
}) {
  const color = CATEGORY_COLORS.ademe
  const pct = Math.min(100, Math.round((count / limit) * 100))
  const projectionPct = Math.round((projection / limit) * 100)

  const remaining = Math.max(0, limit - count)
  const projectionLabel =
    projection > 0
      ? `Projection ${projection.toLocaleString('fr-FR')} / an (${projectionPct}%)`
      : 'Projection non calculable'

  return (
    <div
      className="rounded-[16px] bg-paper p-5 border border-rule/60 md:col-span-2 relative overflow-hidden"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">
          Quota DPE annuel
        </p>
        <p className="font-mono text-[10px] text-ink-mute/80 tabular-nums">
          12 mois glissants
        </p>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <p className="font-serif italic font-normal leading-none tracking-tight text-ink text-[32px] tabular-nums">
          {count.toLocaleString('fr-FR')}
        </p>
        <span className="font-sans not-italic text-sm text-ink-mute">
          / {limit.toLocaleString('fr-FR')}
        </span>
        <span className="font-mono text-[11px] text-ink-mute ml-2 tabular-nums">
          {pct}%
        </span>
      </div>

      <div className="h-2 rounded-full bg-rule/40 overflow-hidden mb-2">
        <div
          className="h-full transition-all duration-500 ease-spring"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 90 ? 'hsl(var(--accent-red))' : color,
          }}
        />
      </div>

      <p className="font-mono text-[11px] text-ink-mute leading-tight">
        {remaining > 0
          ? `${remaining.toLocaleString('fr-FR')} restant · ${projectionLabel}`
          : 'Limite atteinte — action requise'}
      </p>
    </div>
  )
}
