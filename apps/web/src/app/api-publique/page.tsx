import { ApiWaitlistForm } from '@/components/public/pros/ApiWaitlistForm'
import { JsonLd } from '@/components/seo/JsonLd'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { buildMetadata } from '@/lib/seo/metadata'
import { KOVAS_BASE_URL, buildBreadcrumbList } from '@/lib/seo/schema-org'
import {
  BarChart3,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  ListChecks,
  MapPin,
  Mic,
  Terminal,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildMetadata({
  title: 'API publique diagnostic immobilier open data | KOVAS',
  description:
    'API publique KOVAS open data : adresses BAN, cadastre IGN, DPE ADEME, DVF, risques ERP, observatoire profession. OpenAPI 3.1, CC-BY 4.0, rate-limit 60/600 req/min.',
  path: '/api-publique',
  ogImage: '/og-images/api-publique.png',
})

interface LiveEndpoint {
  icon: typeof ListChecks
  method: 'GET'
  path: string
  description: string
  example_curl: string
  source: string
}

interface Endpoint {
  icon: typeof ListChecks
  method: 'GET'
  path: string
  description: string
}

const LIVE_ENDPOINTS: LiveEndpoint[] = [
  {
    icon: Building2,
    method: 'GET',
    path: '/api/public/v1/property/{banId}',
    description:
      'Profil unifié propriété — adresse BAN + cadastre IGN + transactions DVF 10 ans + historique DPE ADEME + risques ERP Géorisques. Cache 7 j.',
    example_curl: 'curl https://kovas.fr/api/public/v1/property/76217_0250_00012',
    source: 'BAN + IGN + DVF + ADEME + Géorisques',
  },
  {
    icon: ListChecks,
    method: 'GET',
    path: '/api/public/v1/observatoire/profession',
    description:
      'État de la profession du diagnostic immobilier en France — total DHUP, % SIRENE actif, % activité élevée, distribution par département (top 20). Aucune PII.',
    example_curl: 'curl https://kovas.fr/api/public/v1/observatoire/profession',
    source: 'DHUP + INSEE Sirene + scoring KOVAS interne',
  },
  {
    icon: MapPin,
    method: 'GET',
    path: '/api/public/v1/commune/{inseeCode}',
    description:
      'Statistiques DPE + DVF agrégées par commune (code INSEE) : % passoires F-G, volume DPE 24 mois, prix médian, avg €/m² 12 mois.',
    example_curl: 'curl https://kovas.fr/api/public/v1/commune/75056',
    source: 'ADEME ademe_dpe + Etalab DVF',
  },
  {
    icon: BarChart3,
    method: 'GET',
    path: '/api/public/v1/department/{deptCode}',
    description:
      'Distribution DPE par classe (A-G) sur 24 mois pour un département (01-95, 2A/2B Corse, 971-976 outre-mer).',
    example_curl: 'curl https://kovas.fr/api/public/v1/department/75',
    source: 'ADEME ademe_dpe (agg INSEE prefix)',
  },
]

const ENDPOINTS: Endpoint[] = [
  {
    icon: ListChecks,
    method: 'GET',
    path: '/api/v1/missions',
    description:
      'Liste paginée des missions du compte authentifié. Filtres par type de diagnostic, statut, date.',
  },
  {
    icon: ListChecks,
    method: 'GET',
    path: '/api/v1/missions/:id',
    description: "Détail complet d'une mission, incluant rooms, équipements, validations.",
  },
  {
    icon: Camera,
    method: 'GET',
    path: '/api/v1/missions/:id/photos',
    description:
      "Liste des photos d'une mission avec géolocalisation EXIF, URL signée 24h pour le téléchargement.",
  },
  {
    icon: Mic,
    method: 'GET',
    path: '/api/v1/missions/:id/voice-notes',
    description:
      'Notes vocales transcrites et structurées par pièce. Métadonnées Whisper + structuration Claude Haiku.',
  },
  {
    icon: Download,
    method: 'GET',
    path: '/api/v1/missions/:id/exports/:format',
    description:
      "Téléchargement de l'export généré (pdf, docx, csv, json, zip-liciel, xml-import). URL signée 1h.",
  },
  {
    icon: FileText,
    method: 'GET',
    path: '/api/v1/dossiers',
    description:
      'Liste des dossiers regroupant plusieurs missions (résidence, copropriété, multi-lots).',
  },
]

export default function ApiPage() {
  const breadcrumb = buildBreadcrumbList([
    { name: 'Accueil', path: '/' },
    { name: 'API publique', path: '/api-publique' },
  ])

  // WebAPI Schema.org — décrit l'API publique KOVAS
  const webApiSchema = {
    '@context': 'https://schema.org' as const,
    '@type': 'WebAPI' as const,
    '@id': `${KOVAS_BASE_URL}/api-publique#webapi`,
    name: 'API publique KOVAS — open data diagnostic immobilier',
    description:
      'API REST publique exposant des jeux de données ouverts sur le diagnostic immobilier français : profil propriété unifié (BAN + IGN + DVF + ADEME + Géorisques), observatoire de la profession, statistiques DPE par commune et département.',
    url: `${KOVAS_BASE_URL}/api-publique`,
    documentation: `${KOVAS_BASE_URL}/api/public/v1/openapi.json`,
    provider: { '@id': `${KOVAS_BASE_URL}/#organization` },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    inLanguage: 'fr-FR' as const,
  }

  // DataCatalog regroupant les 4 endpoints LIVE en datasets exposés
  const dataCatalogSchema = {
    '@context': 'https://schema.org' as const,
    '@type': 'DataCatalog' as const,
    '@id': `${KOVAS_BASE_URL}/api-publique#datacatalog`,
    name: 'KOVAS Open Data — catalogue diagnostic immobilier',
    description:
      'Catalogue de jeux de données ouverts dérivés des sources publiques officielles françaises (BAN, IGN, DVF, ADEME, DHUP, Géorisques).',
    publisher: { '@id': `${KOVAS_BASE_URL}/#organization` },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    inLanguage: 'fr-FR' as const,
    dataset: LIVE_ENDPOINTS.map((endpoint) => ({
      '@type': 'Dataset' as const,
      name: endpoint.path,
      description: endpoint.description,
      url: `${KOVAS_BASE_URL}${endpoint.path}`,
      keywords: endpoint.source,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@id': `${KOVAS_BASE_URL}/#organization` },
    })),
  }

  return (
    <div className="px-6 py-16">
      <JsonLd data={[webApiSchema, dataCatalogSchema, breadcrumb]} id="api-publique" />
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="green">V1 open data · LIVE</Badge>
          <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
            L&apos;API publique{' '}
            <span className="text-display-serif text-chartreuse-deep">KOVAS</span>
          </h1>
          <p className="text-ink-mute">
            Connectez vos outils tiers aux données KOVAS. Open data en libre accès aujourd&apos;hui,
            endpoints comptes authentifiés en Phase 2.
          </p>
        </div>

        {/* SECTION LIVE — V1 OPEN DATA */}
        <section className="space-y-6">
          <div className="space-y-2 text-center">
            <Badge variant="green" className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Disponible aujourd&apos;hui
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight">Endpoints V1 open data</h2>
            <p className="text-sm text-ink-mute max-w-2xl mx-auto">
              Données 100% open data agrégées (BAN, IGN, DVF, ADEME, DHUP). Aucune authentification
              requise. Rate-limit 60 req/min anonyme, 600 req/min avec une clé API.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {LIVE_ENDPOINTS.map((endpoint) => (
              <Card key={endpoint.path} variant="opaque" padding="default" className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-chartreuse text-ink shrink-0">
                    <endpoint.icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="green" className="font-mono">
                        {endpoint.method}
                      </Badge>
                      <code className="font-mono text-[12px] text-ink-soft break-all">
                        {endpoint.path}
                      </code>
                    </div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute">
                      Source : {endpoint.source}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-ink-mute leading-relaxed">{endpoint.description}</p>
                <div className="rounded-md bg-ink/5 px-3 py-2 font-mono text-[11px] text-ink-soft overflow-x-auto">
                  {endpoint.example_curl}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild variant="default" size="sm">
              <a href="/api/public/v1/openapi.json" target="_blank" rel="noreferrer noopener">
                <BookOpen className="size-3.5" />
                Spec OpenAPI 3.1
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href="/api/public/v1/observatoire/profession"
                target="_blank"
                rel="noreferrer noopener"
              >
                <Terminal className="size-3.5" />
                Essayer observatoire/profession
              </a>
            </Button>
          </div>

          <Card variant="opaque" padding="default" className="mx-auto max-w-3xl space-y-2">
            <h3 className="text-sm font-semibold text-ink">Licence et conditions</h3>
            <p className="text-[13px] text-ink-mute leading-relaxed">
              Données publiées sous licence <strong>CC-BY 4.0</strong>. Réutilisation libre y
              compris commerciale, avec attribution &quot;KOVAS Observatoire&quot; et lien vers{' '}
              <a href="https://kovas.fr/observatoire" className="underline">
                kovas.fr/observatoire
              </a>
              . Headers de rate-limit retournés sur chaque réponse :{' '}
              <code className="font-mono text-[11px]">X-RateLimit-Limit/Remaining/Reset</code>.
            </p>
          </Card>
        </section>

        {/* SECTION V2 — ROADMAP COMPTES AUTHENTIFIÉS */}
        <Card variant="warm" padding="default" className="mx-auto max-w-3xl space-y-2 text-center">
          <Badge variant="muted">V2 — roadmap Phase 2</Badge>
          <h2 className="text-base font-semibold">Endpoints comptes authentifiés</h2>
          <p className="text-sm text-ink-soft">
            Les endpoints sur vos missions, photos, exports — sous token Bearer — arriveront en{' '}
            <strong>Phase 2 (M10+)</strong>, après la certification ADEME 3CL-2021. Lecture seule
            d&apos;abord, écriture en Phase 3.
          </p>
        </Card>

        <section className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">Catalog endpoints prévus</h2>
            <p className="text-sm text-ink-mute">
              Liste indicative. Endpoints stables documentés via OpenAPI au lancement V2.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ENDPOINTS.map((endpoint) => (
              <Card key={endpoint.path} variant="opaque" padding="default" className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-chartreuse-soft text-ink">
                    <endpoint.icon className="size-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="green" className="font-mono">
                      {endpoint.method}
                    </Badge>
                    <code className="font-mono text-[12px] text-ink-soft">{endpoint.path}</code>
                  </div>
                </div>
                <p className="text-sm text-ink-mute">{endpoint.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card variant="opaque" padding="lg" className="mx-auto max-w-3xl">
          <ApiWaitlistForm />
        </Card>

        {/* Maillage interne SEO */}
        <nav
          aria-label="Aller plus loin"
          className="mx-auto max-w-3xl border-t border-ink/10 pt-8 text-center text-sm text-ink-mute"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider">Aller plus loin</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <li>
              <Link
                href="/observatoire"
                className="hover:text-ink underline-offset-2 hover:underline"
              >
                Observatoire DPE
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li>
              <Link href="/tarifs" className="hover:text-ink underline-offset-2 hover:underline">
                Tarifs KOVAS
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li>
              <Link href="/aide" className="hover:text-ink underline-offset-2 hover:underline">
                Centre d&apos;aide
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li>
              <Link href="/a-propos" className="hover:text-ink underline-offset-2 hover:underline">
                À propos
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
