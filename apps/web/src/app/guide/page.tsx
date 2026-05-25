import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { GLOSSARY_KEYS } from '@/lib/glossary/diagnostic-terms'
import { GUIDES_LIST } from '@/lib/guides/registry'
import type { Guide, GuideCategory } from '@/lib/guides/types'
import { buildMetadata } from '@/lib/seo/metadata'
import { cn } from '@/lib/utils'
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  Bug,
  Clock,
  FileText,
  Flame,
  Home,
  MapPin,
  Ruler,
  Zap,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ComponentType } from 'react'

export const metadata: Metadata = buildMetadata({
  title: 'Guides du diagnostic immobilier : 9 guides complets (DPE, amiante, plomb…)',
  description:
    'Tout savoir sur les 9 diagnostics immobiliers obligatoires en France : DPE, amiante, plomb, gaz, électricité, termites, Carrez, ERP, audit énergétique.',
  path: '/guide',
  ogType: 'website',
})

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  vente: 'Vente',
  location: 'Location',
  travaux: 'Travaux',
  audit: 'Audit',
}

// Icône signature par diagnostic — choix Lucide cohérents avec le métier
// (FileText défaut pour les diagnostics doc-centric, Flame pour combustion,
// etc.). On évite les emojis pour respecter le brand v5.
const ICON_BY_TYPE: Record<Guide['type'], ComponentType<{ className?: string }>> = {
  dpe: Home,
  amiante: FileText,
  plomb: Activity,
  gaz: Flame,
  electricite: Zap,
  termites: Bug,
  carrez: Ruler,
  erp: MapPin,
  'audit-energetique': BatteryCharging,
}

export default function GuidesIndexPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://kovas.fr' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides du diagnostic immobilier',
        item: 'https://kovas.fr/guide',
      },
    ],
  }

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Guides du diagnostic immobilier',
    description:
      'Tout savoir sur les 9 diagnostics immobiliers obligatoires en France : DPE, amiante, plomb, gaz, électricité, termites, Carrez, ERP, audit énergétique.',
    url: 'https://kovas.fr/guide',
    inLanguage: 'fr-FR',
    hasPart: GUIDES_LIST.map((guide) => ({
      '@type': 'Article',
      headline: guide.title,
      url: `https://kovas.fr/guide/${guide.slug}`,
    })),
  }

  return (
    <>
      <JsonLd data={[breadcrumbSchema, collectionSchema]} id="guides-index" />

      <section className="border-b border-rule/40 bg-sage">
        <div className="mx-auto max-w-screen-xl px-4 py-16 md:px-6 md:py-24">
          <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
            9 guides experts
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-6xl">
            Guides du diagnostic{' '}
            <span className="block font-serif italic font-normal text-ink-soft">
              immobilier en France
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-mute">
            Tout ce qu’il faut savoir sur les 9 diagnostics immobiliers obligatoires : obligations,
            méthodes, prix, validité, travaux et aides. Mis à jour avec les règles 2026.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES_LIST.map((guide) => (
              <GuideCard key={guide.type} guide={guide} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

interface GuideCardProps {
  readonly guide: Guide
}

function GuideCard({ guide }: GuideCardProps) {
  const Icon = ICON_BY_TYPE[guide.type] ?? FileText
  const category = CATEGORY_LABELS[guide.category]
  // Match du slug du guide avec une entrée du glossaire (clés normalisées).
  // On expose un tooltip discret à côté du titre quand un terme existe.
  const glossaryKey = GLOSSARY_KEYS.includes(guide.type) ? guide.type : null

  return (
    <Card
      variant="opaque"
      padding="lg"
      className={cn(
        'group flex h-full flex-col transition-all hover:-translate-y-px hover:shadow-md',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-ink/10 text-ink"
        >
          <Icon className="size-5" />
        </span>
        <span className="rounded-pill border border-rule/60 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-mute">
          {category}
        </span>
      </div>
      <h2 className="mt-5 font-display text-xl font-bold leading-tight text-ink">
        {glossaryKey ? (
          <GlossaryTerm term={glossaryKey}>{guide.shortTitle}</GlossaryTerm>
        ) : (
          guide.shortTitle
        )}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{guide.teaser}</p>
      <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3" aria-hidden />
          {guide.readingTimeMinutes} min
        </span>
        <span aria-hidden>·</span>
        <span>{guide.wordCount.toLocaleString('fr-FR')} mots</span>
      </div>
      <div className="mt-6 flex-1" />
      <Button asChild variant="ghost" className="self-start" size="sm">
        <Link href={`/guide/${guide.slug}`}>
          Lire le guide
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </Button>
    </Card>
  )
}
