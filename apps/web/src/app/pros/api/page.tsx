import { ApiWaitlistForm } from '@/components/public/pros/ApiWaitlistForm'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Camera, Download, FileText, ListChecks, Mic } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API publique KOVAS',
  description:
    "Présentation de l'API publique KOVAS (V2 roadmap). Endpoints read-only missions, photos, voice-notes, exports. Liste d'attente ouverte.",
}

interface Endpoint {
  icon: typeof ListChecks
  method: 'GET'
  path: string
  description: string
}

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
          <Badge variant="muted">API publique · V2 roadmap</Badge>
          <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
            L&apos;API publique{' '}
            <span className="text-display-serif text-chartreuse-deep">KOVAS</span>
          </h1>
          <p className="text-ink-mute">
            Connectez vos outils tiers à vos données KOVAS. API REST authentifiée par token, JSON,
            versionnée, documentée OpenAPI.
          </p>
        </div>

        <Card variant="warm" padding="default" className="mx-auto max-w-3xl space-y-2 text-center">
          <h2 className="text-base font-semibold">Disponibilité</h2>
          <p className="text-sm text-ink-soft">
            L&apos;API publique sera disponible <strong>Phase 2 (M10+)</strong>, après la
            certification ADEME 3CL-2021. La V2 commence en lecture seule (GET) ; les écritures
            (POST/PATCH) suivront en Phase 3.
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
