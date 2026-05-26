import type { MissionBriefingPayload } from '@/lib/ai/mission-briefing'
import { AlertTriangle, CheckSquare, Clock, FileText } from 'lucide-react'

interface MissionBriefingCardProps {
  briefing: MissionBriefingPayload
  /**
   * Variant d'affichage :
   * - `default` : carte pleine avec toutes les sections
   * - `compact` : version condensée pour intégration sidebar / drawer mode mission
   */
  variant?: 'default' | 'compact'
}

/**
 * Card React affichant le briefing IA pré-mission généré par l'Edge Function
 * `generate-mission-briefing` (Altman use case IA #11, Strategic Playbook §16).
 *
 * Server Component compatible. Aucune interactivité côté client.
 *
 * Style DS v5 : navy `#0F1419` + sage `#F5F7F4` + JetBrains Mono pour les
 * labels mono. Pas de chartreuse (ce composant n'est pas une célébration).
 */
export function MissionBriefingCard({ briefing, variant = 'default' }: MissionBriefingCardProps) {
  const isCompact = variant === 'compact'

  return (
    <article
      aria-label="Briefing IA pré-mission"
      className={`rounded-2xl border border-rule bg-paper ${
        isCompact ? 'p-4 space-y-3' : 'p-6 space-y-5'
      }`}
    >
      {/* Eyebrow + headline */}
      <header className="space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
          Briefing pré-mission
        </p>
        <h3
          className={`font-medium text-ink leading-snug ${
            isCompact ? 'text-base' : 'text-lg sm:text-xl'
          }`}
        >
          {briefing.headline}
        </h3>
      </header>

      {/* Context */}
      {briefing.context ? (
        <section className="flex gap-3">
          <FileText className="size-4 text-ink-mute shrink-0 mt-0.5" aria-hidden />
          <p
            className={`text-ink-soft leading-relaxed ${isCompact ? 'text-sm' : 'text-sm sm:text-[15px]'}`}
          >
            {briefing.context}
          </p>
        </section>
      ) : null}

      {/* Risks */}
      {briefing.risks.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-accent-yellow" aria-hidden />
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
              Risques à vérifier
            </p>
          </div>
          <ul className={`space-y-1.5 ${isCompact ? 'text-sm' : 'text-sm sm:text-[15px]'}`}>
            {briefing.risks.map((risk, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: liste statique courte (1-3 items) sans réordonnancement
                key={`risk-${i}`}
                className="flex gap-2 text-ink-soft leading-relaxed"
              >
                <span aria-hidden className="text-accent-yellow shrink-0 mt-0.5">
                  →
                </span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Checklist */}
      {briefing.checklist.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-4 text-ink-mute" aria-hidden />
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
              À ne pas oublier sur place
            </p>
          </div>
          <ul className={`space-y-1.5 ${isCompact ? 'text-sm' : 'text-sm sm:text-[15px]'}`}>
            {briefing.checklist.map((item, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: liste statique courte (3-5 items) sans réordonnancement
                key={`check-${i}`}
                className="flex gap-2 text-ink-soft leading-relaxed"
              >
                <span aria-hidden className="text-ink-mute shrink-0 mt-0.5">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Footer mono */}
      <footer className="pt-3 border-t border-rule/80 flex items-center gap-2 text-ink-faint">
        <Clock className="size-3.5" aria-hidden />
        <p className="font-mono text-[11px] tabular-nums">
          Durée estimée · {briefing.duration_estimate_minutes} min
        </p>
      </footer>
    </article>
  )
}

/**
 * Variant skeleton (pendant le fetch IA, qui prend 3-6 secondes côté Claude
 * Haiku). À afficher avec un Suspense / useState `loading`.
 */
export function MissionBriefingCardSkeleton({
  variant = 'default',
}: { variant?: 'default' | 'compact' }) {
  const isCompact = variant === 'compact'
  return (
    <article
      aria-busy="true"
      aria-label="Génération du briefing IA en cours"
      className={`rounded-2xl border border-rule bg-paper animate-pulse-soft ${
        isCompact ? 'p-4 space-y-3' : 'p-6 space-y-4'
      }`}
    >
      <div className="space-y-2">
        <div className="h-3 w-32 bg-ink/10 rounded" />
        <div className="h-5 w-3/4 bg-ink/10 rounded" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-ink/10 rounded" />
        <div className="h-3 w-5/6 bg-ink/10 rounded" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-2/3 bg-ink/10 rounded" />
        <div className="h-3 w-1/2 bg-ink/10 rounded" />
      </div>
    </article>
  )
}
