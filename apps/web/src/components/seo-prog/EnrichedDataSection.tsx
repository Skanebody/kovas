import { Card } from '@/components/ui/card'
import type { City } from '@/lib/cities/registry'
import type { EnrichedDataPoints } from '@/lib/seo-content/enriched-data'

/**
 * Bloc de 5 data points uniques par page programmatique (Refonte Acqui-Target).
 *
 *  1. Prix moyen DVF
 *  2. Taux passoires F/G ADEME
 *  3. Délai vente moyen
 *  4. Nombre diagnostiqueurs actifs (rayon 30 km)
 *  5. Quote dynamique (témoignage + stat verbalisée)
 *
 * Brand V5 stricte (cf. CLAUDE.md §9) :
 *  - Aucun gradient/ombre/effet de profondeur (Card variant flat)
 *  - Bordures 1px max (rule)
 *  - Typo Urbanist body, JetBrains Mono labels, Instrument Serif italic KPI
 *  - Tracking 0.15em uppercase pour les labels mono
 *  - Mobile-first responsive 320 → 1440
 */

export interface EnrichedDataSectionProps {
  readonly city: City
  readonly data: EnrichedDataPoints
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

export function EnrichedDataSection({ city, data }: EnrichedDataSectionProps) {
  const { dvf, ademe, diagnosticians, quote } = data

  return (
    <section
      className="mb-12 space-y-6"
      aria-labelledby="enriched-data-heading"
      data-testid="enriched-data-section"
    >
      <h2
        id="enriched-data-heading"
        className="font-sans font-bold text-2xl md:text-3xl tracking-tight text-ink max-w-3xl"
      >
        {city.name} en chiffres : marché immobilier et diagnostics
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Prix moyen DVF */}
        <Card className="p-5" data-testid="data-point-dvf-price">
          <p className="text-[11px] uppercase tracking-[0.15em] font-mono text-ink-mute">
            Prix médian m² · DVF
          </p>
          <p className="font-serif italic text-3xl text-ink mt-3">
            {formatNumber(dvf.medianPricePerSqm)} €
          </p>
          <p className="text-xs text-ink-faint mt-2 leading-relaxed">
            {formatNumber(dvf.transactionCount12m)} transactions sur 12 mois · Source DVF
          </p>
        </Card>

        {/* 2. Taux passoires F/G ADEME */}
        <Card className="p-5" data-testid="data-point-ademe-fg">
          <p className="text-[11px] uppercase tracking-[0.15em] font-mono text-ink-mute">
            Passoires F/G · ADEME
          </p>
          <p className="font-serif italic text-3xl text-ink mt-3">{ademe.fgRatePct} %</p>
          <p className="text-xs text-ink-faint mt-2 leading-relaxed">
            {ademe.abcRatePct} % ABC · {ademe.deRatePct} % DE · Source Observatoire DPE
          </p>
        </Card>

        {/* 3. Délai vente moyen */}
        <Card className="p-5" data-testid="data-point-sale-delay">
          <p className="text-[11px] uppercase tracking-[0.15em] font-mono text-ink-mute">
            Délai vente · DVF
          </p>
          <p className="font-serif italic text-3xl text-ink mt-3">
            {dvf.medianSaleDelayDays} <span className="text-base">j</span>
          </p>
          <p className="text-xs text-ink-faint mt-2 leading-relaxed">
            Médiane mandat → signature · Mise à jour {dvf.snapshotDate}
          </p>
        </Card>

        {/* 4. Nombre diagnostiqueurs actifs */}
        <Card className="p-5" data-testid="data-point-diagnosticians">
          <p className="text-[11px] uppercase tracking-[0.15em] font-mono text-ink-mute">
            Diagnostiqueurs · 30 km
          </p>
          <p className="font-serif italic text-3xl text-ink mt-3">
            {formatNumber(diagnosticians.count30km)}
          </p>
          <p className="text-xs text-ink-faint mt-2 leading-relaxed">
            RDV sous {diagnosticians.avgAppointmentDelayDays} j ouvrés en moyenne · Source KOVAS
          </p>
        </Card>
      </div>

      {/* 5. Quote dynamique : témoignage + stat verbalisée */}
      <Card className="p-6 md:p-8" data-testid="data-point-quote">
        <p className="text-[11px] uppercase tracking-[0.15em] font-mono text-ink-mute mb-4">
          Témoignage local · {quote.source}
        </p>
        <blockquote className="space-y-4">
          <p className="font-serif italic text-xl md:text-2xl text-ink leading-snug">
            « {quote.testimonial} »
          </p>
          <footer className="text-sm text-ink-mute">— {quote.author}</footer>
        </blockquote>
        <div className="mt-6 pt-6 border-t border-rule/60">
          <p className="text-sm text-ink-soft leading-relaxed">{quote.verbalizedStat}</p>
        </div>
      </Card>
    </section>
  )
}
