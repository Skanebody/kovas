/**
 * KOVAS — Page Dossier de défense d'une mission.
 *
 * Affiche :
 *   - État géolocalisation visite (timestamps + carte simple)
 *   - Photos contextuelles
 *   - Choix méthodologiques (tableau)
 *   - Documents joints
 *   - Boutons Générer / Télécharger le PDF
 *   - Statut horodatage SHA-256 + OpenTimestamps stub
 *
 * Tables backend (cf. spec) : `defense_dossiers` (1 par mission) + relations
 * `mission_sessions` (start/end timestamps) + `photos` filtrés contexte.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, Clock, FileCheck2, MapPin, ShieldCheck } from 'lucide-react'

import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DefenseGenerateButton } from '@/components/defense/DefenseGenerateButton'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Dossier de défense' }
export const dynamic = 'force-dynamic'

interface DossierRow {
  id: string
  reference: string
  missions: Array<{ id: string; type: string; status: string }>
}

interface DefenseDossierRow {
  id: string
  mission_id: string
  pdf_url: string | null
  pdf_sha256: string | null
  pdf_generated_at: string | null
  timestamp_status: 'none' | 'stub' | 'qualified'
  visit_started_at: string | null
  visit_ended_at: string | null
  visit_lat: number | null
  visit_lon: number | null
  methodological_choices: Array<{
    domain: string
    choice: string
    justification: string
  }> | null
  attached_document_urls: string[] | null
}

interface PhotoRow {
  id: string
  storage_path: string
  thumb_path: string | null
  taken_at: string | null
  caption: string | null
}

export default async function DossierDefensePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { orgId, supabase } = await getCurrentUser()

  // 1. Dossier + mission(s)
  const { data: dossierRaw } = await supabase
    .from('dossiers')
    .select('id, reference, missions(id, type, status)')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossierRaw) notFound()
  const dossier = dossierRaw as unknown as DossierRow

  // 2. Sélection mission DPE active (priorité DPE, fallback première)
  const mission =
    (dossier.missions ?? []).find((m) => m.type.toUpperCase() === 'DPE') ??
    dossier.missions?.[0] ??
    null

  if (!mission) {
    return (
      <div className="space-y-6 animate-fade-in">
        <BackLink dossierId={id} />
        <AppPageHeader title="Dossier" accent="de défense" />
        <Card variant="opaque" padding="default">
          <p className="text-sm text-ink-mute">Aucune mission n'est rattachée à ce dossier.</p>
        </Card>
      </div>
    )
  }

  // 3. Charge defense_dossier + photos
  const [defenseRes, photosRes] = await Promise.all([
    supabase
      // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
      .from('defense_dossiers' as any)
      .select('*')
      .eq('mission_id', mission.id)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('photos')
      .select('id, storage_path, thumb_path, taken_at, caption')
      .eq('dossier_id', id)
      .order('taken_at', { ascending: false })
      .limit(24),
  ])

  const defense = (defenseRes.data ?? null) as unknown as DefenseDossierRow | null
  const photos = (photosRes.data ?? []) as unknown as PhotoRow[]

  // Génère les signed URLs (bucket privé)
  const photoUrlMap = new Map<string, string>()
  if (photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from('mission-photos')
      .createSignedUrls(
        photos.map((p) => p.storage_path),
        3600,
      )
    if (signed) {
      photos.forEach((p, idx) => {
        const url = signed[idx]?.signedUrl
        if (url) photoUrlMap.set(p.id, url)
      })
    }
  }

  const visitDuration = computeDuration(defense?.visit_started_at, defense?.visit_ended_at)

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <BackLink dossierId={id} />

      <AppPageHeader
        eyebrow={`Dossier ${dossier.reference}`}
        title="Dossier"
        accent="de défense"
        description="Preuves contextuelles horodatées — protection juridique en cas de contestation client ou contrôle ADEME."
      />

      {/* Bloc actions */}
      <DefenseGenerateButton missionId={mission.id} existingPdfUrl={defense?.pdf_url ?? null} />

      {/* Grid 2 colonnes : géolocalisation + photos / méthode + intégrité */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card variant="opaque" padding="default" className="space-y-4">
          <div className="flex items-center gap-2.5">
            <MapPin className="size-5 text-ink" />
            <h3 className="text-[15px] font-semibold text-ink">Géolocalisation de la visite</h3>
          </div>
          {defense?.visit_started_at ? (
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">Début</dt>
                <dd className="font-mono text-ink">{formatDateTime(defense.visit_started_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">Fin</dt>
                <dd className="font-mono text-ink">{formatDateTime(defense.visit_ended_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">Durée</dt>
                <dd className="font-mono text-ink">{visitDuration}</dd>
              </div>
              {defense.visit_lat !== null && defense.visit_lon !== null ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-mute">Coordonnées</dt>
                  <dd className="font-mono text-ink text-[11px]">
                    {defense.visit_lat.toFixed(5)}, {defense.visit_lon.toFixed(5)}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-ink-mute">
              Aucune session de visite horodatée pour cette mission.
            </p>
          )}
        </Card>

        <Card variant="opaque" padding="default" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Camera className="size-5 text-ink" />
              <h3 className="text-[15px] font-semibold text-ink">Photos contextuelles</h3>
            </div>
            <Badge variant="muted">{photos.length}</Badge>
          </div>
          {photos.length === 0 ? (
            <p className="text-sm text-ink-mute">Aucune photo contextuelle attachée.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p) => {
                const url = photoUrlMap.get(p.id)
                if (!url) return null
                return (
                  <a
                    key={p.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square overflow-hidden rounded-md border border-rule bg-sage-alt"
                  >
                    {/* biome-ignore lint/performance/noImgElement: galerie defense — pas besoin d'optim Next */}
                    <img
                      src={url}
                      alt={p.caption ?? 'Photo contextuelle'}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </a>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Choix méthodologiques */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <FileCheck2 className="size-5 text-ink" />
          <h3 className="text-[15px] font-semibold text-ink">Choix méthodologiques</h3>
        </div>
        {defense?.methodological_choices && defense.methodological_choices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-rule text-left text-ink-mute">
                  <th className="font-mono font-medium text-[10px] uppercase tracking-wide pb-2 pr-3">
                    Domaine
                  </th>
                  <th className="font-mono font-medium text-[10px] uppercase tracking-wide pb-2 pr-3">
                    Choix
                  </th>
                  <th className="font-mono font-medium text-[10px] uppercase tracking-wide pb-2">
                    Justification
                  </th>
                </tr>
              </thead>
              <tbody>
                {defense.methodological_choices.map((row, idx) => (
                  <tr key={`${row.domain}-${idx}`} className="border-b border-rule/40 last:border-b-0">
                    <td className="py-2 pr-3 font-semibold text-ink">{row.domain}</td>
                    <td className="py-2 pr-3 text-ink">{row.choice}</td>
                    <td className="py-2 text-ink-mute">{row.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-mute">Aucun choix méthodologique consigné.</p>
        )}
      </Card>

      {/* Intégrité PDF */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-ink" />
          <h3 className="text-[15px] font-semibold text-ink">Intégrité du dossier</h3>
        </div>
        {defense ? (
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-mute">PDF généré le</dt>
              <dd className="font-mono text-ink">{formatDateTime(defense.pdf_generated_at)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-mute">Horodatage</dt>
              <dd>
                <TimestampBadge status={defense.timestamp_status} />
              </dd>
            </div>
            {defense.pdf_sha256 ? (
              <div className="space-y-1">
                <dt className="text-ink-mute flex items-center gap-1">
                  <Clock className="size-3.5" /> SHA-256
                </dt>
                <dd className="font-mono text-[11px] text-ink break-all rounded-md bg-sage-alt/60 border border-rule p-2">
                  {defense.pdf_sha256}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-ink-mute">
            Aucun dossier de défense n'a encore été généré pour cette mission.
          </p>
        )}
      </Card>
    </div>
  )
}

function BackLink({ dossierId }: { dossierId: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={`/dashboard/dossiers/${dossierId}`}>
        <ArrowLeft className="size-4" /> Retour au dossier
      </Link>
    </Button>
  )
}

function TimestampBadge({ status }: { status: 'none' | 'stub' | 'qualified' }) {
  if (status === 'qualified') return <Badge variant="green">Qualifié eIDAS</Badge>
  if (status === 'stub') return <Badge variant="yellow">OpenTimestamps (preuve)</Badge>
  return <Badge variant="muted">Non horodaté</Badge>
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function computeDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—'
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (ms < 0) return '—'
    const minutes = Math.round(ms / 60000)
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m.toString().padStart(2, '0')}`
  } catch {
    return '—'
  }
}
