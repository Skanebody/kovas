import type { GuideSource } from '@/lib/guides/types'
import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

interface GuideSourcesProps {
  readonly sources: ReadonlyArray<GuideSource>
  readonly className?: string
}

/**
 * Section "Sources" affichée en bas d'un guide long (méthode E-E-A-T).
 *
 * Chaque entrée :
 *  - numéro [N] en JetBrains Mono (correspond à la note `[N]` dans le corps) ;
 *  - titre du document + organisme émetteur (ADEME, INSEE, DHUP, etc.) ;
 *  - lien externe `target="_blank"` `rel="noopener noreferrer"` ;
 *  - date de consultation pour traçabilité.
 *
 * Server Component pur — sourcing 100% statique au build, pas de fetch.
 *
 * Style sobre V5 : navy soft sur les liens, séparateurs `rule/40`, fond
 * paper. Aucun glow, aucune décoration : c'est une page de sources, on
 * privilégie la lisibilité.
 */
export function GuideSources({ sources, className }: GuideSourcesProps) {
  if (sources.length === 0) return null

  return (
    <section
      id="sources"
      aria-labelledby="sources-heading"
      className={cn(
        'mt-16 scroll-mt-28 rounded-lg border border-rule/40 bg-paper p-6 md:p-8',
        className,
      )}
    >
      <h2 id="sources-heading" className="font-display text-xl font-bold text-ink md:text-2xl">
        <span className="mr-3 font-mono text-sm font-medium text-ink-faint">
          {String(sources.length).padStart(2, '0')}
        </span>
        Sources
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mute">
        Les chiffres et règles cités dans ce guide proviennent exclusivement d&apos;organismes
        publics français (ministères, agences d&apos;État, observatoires officiels, journaux
        officiels).
      </p>

      <ol className="mt-6 space-y-3.5">
        {sources.map((source) => (
          <li
            key={source.id}
            className="flex items-start gap-3 border-t border-rule/30 pt-3.5 first:border-t-0 first:pt-0"
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-rule/60 bg-sage font-mono text-xs font-semibold text-ink"
            >
              {source.id}
            </span>
            <div className="flex-1">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-baseline gap-1.5 text-[15px] font-medium leading-snug text-ink underline decoration-rule decoration-1 underline-offset-4 transition-colors hover:text-navy-700 hover:decoration-navy-700"
              >
                <span>{source.title}</span>
                <ExternalLink
                  className="size-3 shrink-0 translate-y-px text-ink-faint transition-colors group-hover:text-navy-700"
                  aria-hidden
                />
              </a>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-mute">
                {source.organization}
                <span aria-hidden className="mx-2 text-ink-faint">
                  ·
                </span>
                <span aria-label="Date de consultation">
                  Consulté le {formatAccessedAt(source.accessedAt)}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Formate une date ISO 8601 (`YYYY-MM-DD`) en libellé FR court
 * ("22 mai 2026"). Sûr face aux strings invalides : retourne tel quel.
 */
function formatAccessedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
