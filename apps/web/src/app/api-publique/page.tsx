/**
 * /api-publique — API publique KOVAS open data.
 *
 * B71 (2026-05-26) : harmonisation chrome au style home V5 sobre :
 *   - PublicHeader + SiteFooter
 *   - bg-sage + ink #0F1419 + sections px-5 sm:px-12 py-20 sm:py-28
 *   - H1 clamp(40,7vw,104) + H2 clamp(32,4vw,56) Urbanist medium + serif italic
 *   - eyebrow font-mono uppercase tracking-wider text-[11px]
 *   - cards rounded-2xl border [#0F1419]/[0.08] bg-paper
 *   - code blocks bg-[#0F1419] text-paper rounded-xl
 *
 * Préserve : JSON-LD WebAPI + DataCatalog (B68), ApiWaitlistForm,
 * endpoints LIVE et roadmap V2, OpenAPI spec link, CC-BY 4.0 license.
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { ApiWaitlistForm } from '@/components/public/pros/ApiWaitlistForm'
import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { buildMetadata } from '@/lib/seo/metadata'
import { KOVAS_BASE_URL, buildBreadcrumbList } from '@/lib/seo/schema-org'
import {
  BarChart3,
  BookOpen,
  Building2,
  Camera,
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
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <JsonLd data={[webApiSchema, dataCatalogSchema, breadcrumb]} id="api-publique" />
      <PublicHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              API publique · V1 open data · LIVE
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.02] max-w-[1100px]"
              style={{ fontSize: 'clamp(40px, 7vw, 104px)' }}
            >
              L&apos;API publique <span className="font-serif italic font-normal">KOVAS</span>.
            </h1>
            <p className="mt-8 max-w-2xl text-[15px] sm:text-[18px] text-[#0F1419]/72 leading-relaxed">
              Connecte tes outils tiers aux données KOVAS. Open data en libre accès
              aujourd&apos;hui, endpoints comptes authentifiés en Phase 2.
            </p>
          </div>
        </section>

        {/* Section LIVE — V1 OPEN DATA */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto space-y-12">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Disponible aujourd&apos;hui
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Endpoints V1 <span className="font-serif italic font-normal">open data</span>.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
                Données 100 % open data agrégées (BAN, IGN, DVF, ADEME, DHUP). Aucune
                authentification requise. Rate-limit 60 req/min anonyme, 600 req/min avec une clé
                API.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {LIVE_ENDPOINTS.map((endpoint) => (
                <article
                  key={endpoint.path}
                  className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-[#F5F7F4] text-[#0F1419] shrink-0">
                      <endpoint.icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-pill bg-[#0F1419] text-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
                          {endpoint.method}
                        </span>
                        <code className="font-mono text-[12px] text-[#0F1419] break-all">
                          {endpoint.path}
                        </code>
                      </div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                        Source : {endpoint.source}
                      </p>
                    </div>
                  </div>
                  <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">
                    {endpoint.description}
                  </p>
                  <pre className="bg-[#0F1419] text-paper font-mono text-[12px] rounded-xl px-4 py-3 overflow-x-auto">
                    {endpoint.example_curl}
                  </pre>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="default" size="default">
                <a href="/api/public/v1/openapi.json" target="_blank" rel="noreferrer noopener">
                  <BookOpen className="size-4" />
                  Spec OpenAPI 3.1
                </a>
              </Button>
              <Button asChild variant="outline" size="default">
                <a
                  href="/api/public/v1/observatoire/profession"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Terminal className="size-4" />
                  Essayer observatoire/profession
                </a>
              </Button>
            </div>

            <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-2 max-w-[920px]">
              <h3 className="text-base font-semibold text-[#0F1419] tracking-tight">
                Licence et conditions
              </h3>
              <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">
                Données publiées sous licence <strong>CC-BY 4.0</strong>. Réutilisation libre y
                compris commerciale, avec attribution «&nbsp;KOVAS Observatoire&nbsp;» et lien vers{' '}
                <a
                  href="https://kovas.fr/observatoire"
                  className="text-[#0F1419] underline underline-offset-2"
                >
                  kovas.fr/observatoire
                </a>
                . Headers de rate-limit retournés sur chaque réponse :{' '}
                <code className="font-mono text-[12px] text-[#0F1419]">
                  X-RateLimit-Limit/Remaining/Reset
                </code>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Section V2 — ROADMAP COMPTES AUTHENTIFIÉS */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-12">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                V2 · roadmap Phase 2
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Endpoints comptes{' '}
                <span className="font-serif italic font-normal">authentifiés</span>.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
                Les endpoints sur tes missions, photos, exports — sous token Bearer — arriveront en{' '}
                <strong>Phase 2 (M10+)</strong>, après la certification ADEME 3CL-2021. Lecture
                seule d&apos;abord, écriture en Phase 3. Liste indicative ci-dessous, endpoints
                stables documentés via OpenAPI au lancement V2.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {ENDPOINTS.map((endpoint) => (
                <article
                  key={endpoint.path}
                  className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-[#F5F7F4] text-[#0F1419]">
                      <endpoint.icon className="size-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-pill bg-[#0F1419] text-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
                        {endpoint.method}
                      </span>
                      <code className="font-mono text-[12px] text-[#0F1419]">{endpoint.path}</code>
                    </div>
                  </div>
                  <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">
                    {endpoint.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Section waitlist */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[920px] mx-auto">
            <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 sm:px-8 sm:py-9">
              <ApiWaitlistForm />
            </div>
          </div>
        </section>

        {/* Maillage interne SEO */}
        <section className="px-5 sm:px-12 py-16 border-t border-[#0F1419]/[0.08]">
          <nav aria-label="Aller plus loin" className="max-w-[920px] mx-auto text-center">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-4">
              Aller plus loin
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px] text-[#0F1419]/72">
              <li>
                <Link
                  href="/observatoire"
                  className="hover:text-[#0F1419] underline-offset-2 hover:underline"
                >
                  Observatoire DPE
                </Link>
              </li>
              <li aria-hidden>·</li>
              <li>
                <Link
                  href="/tarifs"
                  className="hover:text-[#0F1419] underline-offset-2 hover:underline"
                >
                  Tarifs KOVAS
                </Link>
              </li>
              <li aria-hidden>·</li>
              <li>
                <Link
                  href="/aide"
                  className="hover:text-[#0F1419] underline-offset-2 hover:underline"
                >
                  Centre d&apos;aide
                </Link>
              </li>
              <li aria-hidden>·</li>
              <li>
                <Link
                  href="/a-propos"
                  className="hover:text-[#0F1419] underline-offset-2 hover:underline"
                >
                  À propos
                </Link>
              </li>
            </ul>
          </nav>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
