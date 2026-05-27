import type { GuideSection as GuideSectionType } from '@/lib/guides/types'
import { cn } from '@/lib/utils'
import { Info, Lightbulb, TriangleAlert } from 'lucide-react'

interface GuideSectionProps {
  readonly section: GuideSectionType
  readonly index: number
  readonly className?: string
}

/**
 * Bloc section narrative d'un guide.
 *
 * - H2 ancré (`id`) pour les liens TOC + cible URL `#id`
 * - Paragraphes typés en font-sans, prose-like via classes utilitaires
 * - Liste optionnelle `bullets` rendue en `<ul>`
 * - Callout optionnel (info/warning/tip) avec icône Lucide
 * - `howToSteps`, si présents, génèrent une `<ol>` numérotée
 *
 * Aucun `prose` Tailwind ici — on contrôle finement la typographie pour
 * coller au design system v5 (Urbanist + Instrument Serif + JetBrains Mono).
 */
export function GuideSection({ section, index, className }: GuideSectionProps) {
  const Heading = section.level === 2 ? 'h2' : 'h3'

  return (
    <section
      id={section.id}
      className={cn('scroll-mt-28', className)}
      aria-labelledby={`${section.id}-heading`}
    >
      <Heading
        id={`${section.id}-heading`}
        className={cn(
          section.level === 2
            ? 'mt-16 font-display text-2xl font-bold leading-tight tracking-tight text-ink first:mt-0 sm:text-3xl md:text-4xl'
            : 'mt-10 font-display text-xl font-semibold leading-snug text-ink sm:text-2xl',
        )}
      >
        {section.level === 2 && (
          <span className="mr-3 font-mono text-sm font-medium text-ink-faint">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        {section.title}
      </Heading>

      <div className="mt-5 space-y-5">
        {section.paragraphs.map((paragraph, pIdx) => (
          <p
            // eslint-disable-next-line react/no-array-index-key -- contenu statique ordonné
            key={pIdx}
            className="text-base leading-[1.75] text-ink-soft md:text-[17px]"
          >
            {paragraph}
          </p>
        ))}
      </div>

      {section.bullets && section.bullets.length > 0 && (
        <ul className="mt-6 space-y-2.5 rounded-lg border border-rule/40 bg-paper/60 p-5">
          {section.bullets.map((bullet, bIdx) => (
            <li
              // eslint-disable-next-line react/no-array-index-key -- contenu statique ordonné
              key={bIdx}
              className="flex items-start gap-3 text-[15px] leading-relaxed text-ink-soft"
            >
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-chartreuse-deep"
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {section.callout && (
        <SectionCallout type={section.callout.type} text={section.callout.text} />
      )}

      {section.howToSteps && section.howToSteps.length > 0 && (
        <ol className="mt-8 space-y-4">
          {section.howToSteps.map((step) => (
            <li key={step.position} className="rounded-lg border border-rule/40 bg-paper p-5">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-sm font-semibold text-paper"
                >
                  {step.position}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-base font-semibold text-ink">{step.name}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{step.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

interface SectionCalloutProps {
  readonly type: 'info' | 'warning' | 'tip'
  readonly text: string
}

function SectionCallout({ type, text }: SectionCalloutProps) {
  const config = {
    info: {
      Icon: Info,
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      text: 'text-sky-900',
      iconColor: 'text-sky-600',
      label: 'Bon à savoir',
    },
    warning: {
      Icon: TriangleAlert,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      iconColor: 'text-amber-600',
      label: 'Point d’attention',
    },
    tip: {
      Icon: Lightbulb,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      iconColor: 'text-emerald-600',
      label: 'Conseil',
    },
  }[type]
  const Icon = config.Icon

  return (
    <aside
      className={cn('mt-6 flex gap-3 rounded-lg border p-5', config.bg, config.border)}
      aria-label={config.label}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', config.iconColor)} aria-hidden />
      <div className="flex-1">
        <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
          {config.label}
        </p>
        <p className={cn('text-[15px] leading-relaxed', config.text)}>{text}</p>
      </div>
    </aside>
  )
}
