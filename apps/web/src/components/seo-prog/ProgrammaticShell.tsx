import { FaqAnswer } from '@/components/faq-answer'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { City } from '@/lib/cities/registry'
import { DIAGNOSTIC_LABELS, type DiagnosticType } from '@/lib/diagnostics/types'
import type { FaqItem } from '@/lib/seo-content/template-generator'
import Link from 'next/link'
import Script from 'next/script'
import type { ReactNode } from 'react'

/**
 * Shell partagé pour les 6 templates SEO programmatiques.
 * Header sticky léger + main fluide + SiteFooter mutualisé.
 * Injection des JSON-LD via <Script type="application/ld+json">.
 */

export interface BreadcrumbCrumb {
  readonly label: string
  readonly href: string
}

export interface ProgrammaticShellProps {
  readonly city: City
  readonly breadcrumbs: ReadonlyArray<BreadcrumbCrumb>
  readonly jsonLd: ReadonlyArray<Record<string, unknown>>
  readonly children: ReactNode
}

export function ProgrammaticShell({ breadcrumbs, jsonLd, children }: ProgrammaticShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      {jsonLd.map((schema, idx) => {
        const tag = typeof schema['@type'] === 'string' ? schema['@type'] : 'unknown'
        const key = `seo-jsonld-${tag}-${idx}`
        return (
          <Script
            key={key}
            id={key}
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        )
      })}

      <PublicHeader />

      <nav aria-label="Fil d’Ariane" className="border-b border-rule/40 bg-paper/30">
        <ol className="mx-auto max-w-6xl px-6 py-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-mute">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {idx > 0 ? <span className="text-ink-faint">›</span> : null}
                {isLast ? (
                  <span className="text-ink font-medium" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-ink transition-colors underline-offset-4 hover:underline"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <main className="flex-1 mx-auto max-w-6xl px-6 py-12 w-full">{children}</main>

      <SiteFooter />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Sous-composants réutilisables
// ─────────────────────────────────────────────────────────────────────────

export interface SeoHeroProps {
  readonly eyebrow: string
  readonly titlePrefix: string
  readonly titleEm: string
  readonly titleSuffix?: string
  readonly lede: string
}

export function SeoHero({ eyebrow, titlePrefix, titleEm, titleSuffix, lede }: SeoHeroProps) {
  return (
    <section className="max-w-3xl mb-12 space-y-4">
      <p className="text-xs uppercase tracking-wider font-semibold text-ink-mute font-mono">
        {eyebrow}
      </p>
      <h1 className="font-sans font-bold text-4xl md:text-5xl tracking-tight text-ink leading-tight">
        {titlePrefix}{' '}
        <em className="font-serif italic font-normal text-chartreuse-deep">{titleEm}</em>
        {titleSuffix !== undefined && titleSuffix.length > 0 ? ` ${titleSuffix}` : null}
      </h1>
      <p className="text-ink-mute text-lg leading-relaxed">{lede}</p>
    </section>
  )
}

export interface SectionProps {
  readonly id?: string
  readonly title: string
  readonly children: ReactNode
}

export function SeoSection({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="mb-12 space-y-5 max-w-3xl">
      <h2 className="font-sans font-bold text-2xl md:text-3xl tracking-tight text-ink">{title}</h2>
      <div className="space-y-4 text-ink-soft leading-relaxed">{children}</div>
    </section>
  )
}

export interface FaqSectionProps {
  readonly faq: ReadonlyArray<FaqItem>
}

export function SeoFaqSection({ faq }: FaqSectionProps) {
  if (faq.length === 0) return null
  return (
    <section id="faq" className="mb-12 max-w-3xl space-y-4">
      <h2 className="font-sans font-bold text-2xl md:text-3xl tracking-tight text-ink">
        Questions fréquentes
      </h2>
      <div className="space-y-3">
        {faq.map((item, idx) => (
          <Card key={`${item.question}-${idx}`} className="p-5">
            <h3 className="font-semibold text-ink text-base mb-2">{item.question}</h3>
            <FaqAnswer markdown={item.answer} />
          </Card>
        ))}
      </div>
    </section>
  )
}

export interface InternalLinkingProps {
  readonly city: City
  readonly type?: DiagnosticType
  readonly otherTypes: ReadonlyArray<DiagnosticType>
  readonly neighborCities: ReadonlyArray<City>
  readonly basePath: string
}

export function SeoInternalLinking({
  city,
  type,
  otherTypes,
  neighborCities,
  basePath,
}: InternalLinkingProps) {
  return (
    <section className="mb-12 grid gap-8 md:grid-cols-2">
      {neighborCities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-mute font-mono">
            Villes voisines
          </h3>
          <ul className="space-y-1.5 text-sm">
            {neighborCities.map((neighbor) => (
              <li key={neighbor.slug}>
                <Link
                  href={
                    type !== undefined
                      ? `${basePath}/${type}/${neighbor.slug}`
                      : `${basePath}/${neighbor.slug}`
                  }
                  className="text-ink-soft hover:text-ink hover:underline underline-offset-4 transition-colors"
                >
                  {type !== undefined
                    ? `${DIAGNOSTIC_LABELS[type]} à ${neighbor.name}`
                    : `${neighbor.name} (${neighbor.postalCode})`}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {otherTypes.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-mute font-mono">
            Autres diagnostics à {city.name}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {otherTypes.map((otherType) => (
              <li key={otherType}>
                <Link
                  href={`/diagnostic/${otherType}/${city.slug}`}
                  className="text-ink-soft hover:text-ink hover:underline underline-offset-4 transition-colors"
                >
                  {DIAGNOSTIC_LABELS[otherType]} à {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export interface CtaBlockProps {
  readonly title: string
  readonly description?: string
  readonly primary: { label: string; href: string }
  readonly secondary?: { label: string; href: string }
}

export function SeoCtaBlock({ title, description, primary, secondary }: CtaBlockProps) {
  return (
    <Card className="p-8 md:p-10 mb-12 text-center space-y-5">
      <h2 className="font-sans font-bold text-2xl md:text-3xl tracking-tight text-ink">{title}</h2>
      {description !== undefined ? (
        <p className="text-ink-mute max-w-xl mx-auto leading-relaxed">{description}</p>
      ) : null}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Button asChild size="lg">
          <Link href={primary.href}>{primary.label}</Link>
        </Button>
        {secondary !== undefined ? (
          <Button asChild size="lg" variant="outline">
            <Link href={secondary.href}>{secondary.label}</Link>
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
