import { ApiWaitlistForm } from '@/components/public/pros/ApiWaitlistForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  ListChecks,
  Mic,
  Terminal,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API publique KOVAS',
  description:
    'API publique KOVAS — endpoints open data LIVE (property unifié, observatoire profession) + V2 roadmap (missions, photos, exports). OpenAPI 3.1 + rate-limit 60/600 req/min.',
}

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
  return (
    <div className="px-6 py-16">
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
      </div>
    </div>
  )
}
