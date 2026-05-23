import { PRESS_MENTIONS } from '@/lib/institutional/press-mentions'

/**
 * Section 6 — Mentions presse de l'observatoire.
 *
 * Lot #153 SITE-POLISH (2026-05-23) : refonte pour partager la même source
 * de vérité (`@/lib/institutional/press-mentions`) avec la page `/presse`.
 *
 * - Logos SVG sobres dans `/public/press/logos/` (typo monochrome `#7E8AA4`,
 *   créés en interne pour éviter toute reproduction de logo officiel).
 * - Chaque mention est cliquable si `url` est renseigné. Sinon : non-cliquable
 *   avec attribut `data-status="placeholder"` + tooltip "Article à venir".
 *   Ne jamais inventer d'URL vers un journal (interdit propriété intellectuelle).
 */
export function PressMentions() {
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-center text-[15px] sm:text-[17px] text-ink/72 max-w-[600px]">
        Ces données sont régulièrement citées et reprises par la presse économique et la presse
        spécialisée immobilier en France.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-10 gap-y-8 items-center justify-items-center w-full max-w-[1000px]">
        {PRESS_MENTIONS.map((logo) => {
          const isLink = logo.url !== null
          const inner = (
            <>
              <img
                src={logo.logoPath}
                alt={`Logo ${logo.name}`}
                className="h-10 max-w-[140px] object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                loading="lazy"
                decoding="async"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
                {logo.name}
              </span>
            </>
          )

          return isLink ? (
            <a
              key={logo.id}
              href={logo.url ?? '#'}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex flex-col items-center gap-2 transition-opacity"
            >
              {inner}
            </a>
          ) : (
            <span
              key={logo.id}
              data-status="placeholder"
              title="Article à venir"
              aria-label={`${logo.name} — article à venir`}
              className="group flex flex-col items-center gap-2 cursor-help"
            >
              {inner}
            </span>
          )
        })}
      </div>
    </div>
  )
}
