import { Info } from 'lucide-react'

interface ChartCaptionProps {
  /** Texte pédagogique d'aide à la lecture (2-3 phrases max) */
  howToRead: string
  /** Mention de source à afficher en pied de graphique */
  source: string
  /** Statut de la donnée — affichage discret du mode (live vs extrapolée) */
  dataStatus?: 'live' | 'fallback'
  /** Période couverte par la donnée (ex. "Mai 2026") */
  periodLabel?: string
  /** Unités explicites des axes (X / Y) */
  axes?: { x?: string; y?: string }
}

/**
 * Bloc sobre placé sous chaque graphique de l'observatoire.
 * Trois rôles :
 *   1. Aider à l'interprétation (« Comment lire ce graphique »)
 *   2. Indiquer la source précise (ADEME, INSEE, missions KOVAS…)
 *   3. Signaler honnêtement quand la donnée est extrapolée (fallback) plutôt
 *      que masquer le statut.
 *
 * Design : pas de couleur vive — texte 12px ink-mute, séparateur léger,
 * pictogramme Info discret. Cohérent DS v5 sobre.
 */
export function ChartCaption({
  howToRead,
  source,
  dataStatus = 'live',
  periodLabel,
  axes,
}: ChartCaptionProps) {
  return (
    <div className="flex flex-col gap-2 pt-4 border-t border-rule/40">
      <div className="flex items-start gap-2">
        <Info className="size-3.5 text-ink/45 mt-0.5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1 text-[12px] leading-relaxed text-ink-mute">
          <p>
            <span className="font-medium text-ink/80">Comment lire ce graphique —</span> {howToRead}
          </p>
          {axes ? (
            <p className="font-mono text-[11px] text-ink/55">
              {axes.x ? `Axe X : ${axes.x}` : ''}
              {axes.x && axes.y ? ' · ' : ''}
              {axes.y ? `Axe Y : ${axes.y}` : ''}
            </p>
          ) : null}
          <p>
            <span className="font-medium text-ink/80">Source —</span> {source}
            {periodLabel ? ` · Période ${periodLabel}` : ''}
            {dataStatus === 'fallback' ? (
              <span className="ml-2 inline-flex items-center rounded-pill bg-sage-alt px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
                Donnée extrapolée
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  )
}
