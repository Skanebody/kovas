import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getExtendedRisks } from '@/lib/opendata/georisques-cache'
import { ArrowLeft, ExternalLink, FileDown } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Risques étendus — Dossier' }

/**
 * Page Risques étendus d'un bien (lot Géorisques étendu).
 *
 * Affiche la photographie complète des risques pour la fiche dossier :
 *   - Radon (commune)
 *   - PPRI (commune)
 *   - Argiles (point GPS)
 *   - Cavités souterraines (rayon 500m autour du point GPS)
 *
 * Source unique : Géorisques.gouv.fr (État). Vouvoiement sobre, pas d'IA.
 * Carte avec marqueurs : V2 (composant Leaflet à brancher quand on ajoutera
 * la lib visuelle — actuellement seul l'inventaire structurel est exposé).
 */

function radonBadge(classe: 1 | 2 | 3): 'green' | 'yellow' | 'red' {
  if (classe === 3) return 'red'
  if (classe === 2) return 'yellow'
  return 'green'
}

function argilesBadge(alea: 'faible' | 'moyen' | 'fort'): 'green' | 'yellow' | 'red' {
  if (alea === 'fort') return 'red'
  if (alea === 'moyen') return 'yellow'
  return 'green'
}

export default async function DossierRisquesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: dossier } = await supabase
    .from('dossiers')
    .select(
      'id, reference, property_id, properties(id, address, postal_code, city, insee_code, location)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossier) notFound()

  const propAny = (Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties) as
    | {
        id: string
        address: string | null
        postal_code: string | null
        city: string | null
        insee_code: string | null
        location: { coordinates?: [number, number] } | string | null
      }
    | null
    | undefined

  const inseeCode = propAny?.insee_code ?? null
  let lat: number | null = null
  let lng: number | null = null
  if (propAny?.location && typeof propAny.location === 'object') {
    const coords = (propAny.location as { coordinates?: [number, number] }).coordinates
    if (Array.isArray(coords) && coords.length === 2) {
      lng = coords[0] ?? null
      lat = coords[1] ?? null
    }
  }

  const bundle =
    inseeCode || (lat !== null && lng !== null)
      ? await getExtendedRisks(inseeCode, lat, lng).catch(() => null)
      : null

  const fullAddress = propAny
    ? [propAny.address, [propAny.postal_code, propAny.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-6 md:py-6 space-y-6">
      <div className="flex items-center gap-2 text-[12px] text-[#0F1419]/72">
        <Button variant="ghost" size="sm" asChild className="h-8 -ml-2">
          <Link href={`/dashboard/dossiers/${id}`}>
            <ArrowLeft className="size-4 mr-1" />
            Retour au dossier
          </Link>
        </Button>
      </div>

      <AppPageHeader
        eyebrow={`Dossier ${dossier.reference}`}
        title="Risques"
        accent="étendus"
        description={
          fullAddress
            ? `Photographie des risques pour ${fullAddress}.`
            : 'Photographie des risques pour ce bien.'
        }
        action={
          <Button variant="outline" size="sm" disabled aria-label="Export PDF — bientôt disponible">
            <FileDown className="size-4 mr-1.5" />
            Annexe PDF
          </Button>
        }
      />

      {!bundle ? (
        <Card variant="flat" padding="default">
          <p className="text-[13px] text-[#0F1419]/82">
            Adresse insuffisamment géolocalisée pour récupérer les risques étendus. Renseignez le
            code INSEE et la position GPS du bien.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* ─── Radon ─────────────────────────────────────────────── */}
          <Card variant="flat" padding="default" className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[#0F1419]">Radon</h2>
              {bundle.radon ? (
                <Badge variant={radonBadge(bundle.radon.classe)}>
                  Classe {bundle.radon.classe}
                </Badge>
              ) : (
                <Badge variant="muted">Donnée non disponible</Badge>
              )}
            </div>
            {bundle.radon ? (
              <p className="text-[13px] text-[#0F1419]/82">
                {bundle.radon.classe === 3
                  ? 'Commune classée en potentiel radon significatif (classe 3). Information acquéreur/locataire obligatoire (arrêté 27/06/2018).'
                  : bundle.radon.classe === 2
                    ? 'Commune classée en potentiel radon modéré (classe 2). Vigilance recommandée mais pas d’obligation IAL.'
                    : 'Commune classée en potentiel radon faible (classe 1). Pas d’obligation IAL.'}
              </p>
            ) : (
              <p className="text-[13px] text-[#0F1419]/72">
                Le potentiel radon de la commune n’a pas pu être récupéré.
              </p>
            )}
            <p className="text-[11px] text-[#0F1419]/55">
              Source : Géorisques.gouv.fr / IRSN — État.
            </p>
          </Card>

          {/* ─── PPRI ──────────────────────────────────────────────── */}
          <Card variant="flat" padding="default" className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[#0F1419]">
                Plans de prévention risque inondation (PPRI)
              </h2>
              {bundle.ppri.length > 0 ? (
                <Badge variant="yellow">
                  {bundle.ppri.length} plan{bundle.ppri.length > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge variant="green">Aucun</Badge>
              )}
            </div>
            {bundle.ppri.length > 0 ? (
              <ul className="space-y-1.5">
                {bundle.ppri.map((p) => (
                  <li
                    key={p.id}
                    className="text-[13px] text-[#0F1419]/82 leading-snug flex flex-wrap items-baseline gap-x-2"
                  >
                    <span className="font-medium text-[#0F1419]">{p.libelle}</span>
                    <span className="text-[#0F1419]/55">{p.etat}</span>
                    {p.dateApprobation ? (
                      <span className="text-[#0F1419]/55">· {p.dateApprobation}</span>
                    ) : null}
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[12px] text-[#0F1419]/72 hover:text-[#0F1419] underline-offset-2 hover:underline"
                      >
                        Fiche officielle
                        <ExternalLink className="ml-1 size-3" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[#0F1419]/72">
                Aucun plan PPRI applicable à cette commune au moment de la consultation.
              </p>
            )}
            <p className="text-[11px] text-[#0F1419]/55">
              Source : Géorisques.gouv.fr (base Gaspar) — État.
            </p>
          </Card>

          {/* ─── Argiles ───────────────────────────────────────────── */}
          <Card variant="flat" padding="default" className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[#0F1419]">
                Retrait-gonflement des argiles
              </h2>
              {bundle.argiles ? (
                <Badge variant={argilesBadge(bundle.argiles.alea)}>
                  Aléa {bundle.argiles.alea}
                </Badge>
              ) : (
                <Badge variant="muted">Donnée non disponible</Badge>
              )}
            </div>
            {bundle.argiles ? (
              <p className="text-[13px] text-[#0F1419]/82">
                {bundle.argiles.obligationIAL
                  ? `Aléa ${bundle.argiles.alea} : Information acquéreur/locataire obligatoire (loi ELAN 23/11/2018).`
                  : 'Aléa faible : pas d’obligation IAL.'}
              </p>
            ) : (
              <p className="text-[13px] text-[#0F1419]/72">
                L’aléa retrait-gonflement n’a pas pu être récupéré pour cette adresse.
              </p>
            )}
            <p className="text-[11px] text-[#0F1419]/55">
              Source : Géorisques.gouv.fr / BRGM — État.
            </p>
          </Card>

          {/* ─── Cavités ───────────────────────────────────────────── */}
          <Card variant="flat" padding="default" className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[#0F1419]">
                Cavités souterraines connues
              </h2>
              {bundle.cavites.length > 0 ? (
                <Badge variant="yellow">
                  {bundle.cavites.length} dans un rayon de 500&nbsp;m
                </Badge>
              ) : (
                <Badge variant="green">Aucune connue</Badge>
              )}
            </div>
            {bundle.cavites.length > 0 ? (
              <ul className="space-y-1.5">
                {bundle.cavites.map((c) => (
                  <li
                    key={c.id}
                    className="text-[13px] text-[#0F1419]/82 leading-snug flex flex-wrap items-baseline gap-x-2"
                  >
                    <span className="font-medium text-[#0F1419]">
                      {c.libelle ?? c.type ?? 'Cavité'}
                    </span>
                    {c.distanceM !== null ? (
                      <span className="text-[#0F1419]/55">
                        à {Math.round(c.distanceM)}&nbsp;m
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[#0F1419]/72">
                Aucune cavité souterraine connue dans un rayon de 500&nbsp;m autour du bien.
              </p>
            )}
            <p className="text-[11px] text-[#0F1419]/55">
              Source : Géorisques.gouv.fr / BRGM — État.
            </p>
          </Card>

          {/* ─── Note méthodologique ───────────────────────────────── */}
          <Card variant="flat" padding="default">
            <p className="text-[12px] text-[#0F1419]/72 leading-relaxed">
              Ces informations sont issues des données ouvertes publiées par l’État sur
              Géorisques.gouv.fr et mises à jour périodiquement. Elles complètent — sans s’y
              substituer — l’État des Risques et Pollutions (ERP) réglementaire. La carte des
              cavités et l’export PDF d’annexe seront ajoutés prochainement.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
