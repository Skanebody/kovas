/**
 * KOVAS — Page Litige d'un dossier.
 *
 * Workflow de mise en cause client :
 *   - Si pas de `litigation_workflows` lié → formulaire d'ouverture
 *   - Sinon → détails + réponse IA + statut + actions
 *
 * Server component. Charge dossier + missions + litigation (s'il existe).
 */

import { ArrowLeft, BookOpen, FileText, Scale, User } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppPageHeader } from '@/components/app-page-header'
import { LitigationActions } from '@/components/litigation/LitigationActions'
import { LitigationCreateForm } from '@/components/litigation/LitigationCreateForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Litige' }
export const dynamic = 'force-dynamic'

interface DossierRow {
  id: string
  reference: string
  missions: Array<{ id: string; type: string }>
}

/**
 * Reflète les colonnes réelles de `litigation_workflows` (migration
 * 20260525121000). La plainte du client est stockée dans `notes` (+ copie
 * dans `metadata.client_complaint`), le type UI d'origine dans
 * `metadata.ui_litigation_type`. Les champs « brouillon IA »
 * (draft_response_md / cited_references / draft_generated_at) ne sont PAS
 * des colonnes : ils sont optionnels et lus défensivement (cf. note report).
 */
interface LitigationRow {
  id: string
  organization_id: string
  mission_id: string | null
  litigation_kind: string
  status: string
  notes: string | null
  metadata: Record<string, unknown> | null
  draft_response_md?: string | null
  cited_references?: string[] | null
  draft_generated_at?: string | null
  created_at: string
  updated_at: string
}

const STATUS_META: Record<
  string,
  { label: string; variant: 'blue' | 'yellow' | 'green' | 'red' | 'muted' }
> = {
  opened: { label: 'Ouvert', variant: 'blue' },
  in_progress: { label: 'En cours', variant: 'yellow' },
  awaiting_third_party: { label: 'En attente d’un tiers', variant: 'yellow' },
  escalated: { label: 'Escaladé', variant: 'red' },
  resolved: { label: 'Résolu', variant: 'green' },
  closed: { label: 'Clos', variant: 'muted' },
  dropped: { label: 'Abandonné', variant: 'muted' },
}

const FALLBACK_STATUS_META = { label: 'Ouvert', variant: 'blue' as const }

/** Libellés de la taxonomie UI (metadata.ui_litigation_type). */
const UI_TYPE_LABEL: Record<string, string> = {
  dpe_contestation: 'Contestation étiquette DPE',
  erreur_surface_carrez: 'Erreur surface Carrez/Boutin',
  oubli_diagnostic: 'Oubli de diagnostic',
  amiante_non_detecte: 'Amiante non détecté',
  plomb_non_detecte: 'Plomb non détecté',
  gaz_securite: 'Anomalie gaz / sécurité',
  electricite_securite: 'Anomalie électricité / sécurité',
  demande_remboursement: 'Demande de remboursement',
  autre: 'Autre',
}

/** Libellés de la taxonomie DB `litigation_kind`. */
const KIND_LABEL: Record<string, string> = {
  claim_client: 'Réclamation client',
  mediation: 'Médiation',
  rcp_insurer: 'Assurance RC Pro',
  judicial: 'Judiciaire',
  administrative: 'Administratif',
  other: 'Autre',
}

/** Résout le libellé du type de litige : type UI d'origine sinon kind DB. */
function litigationTypeLabel(row: LitigationRow): string {
  const uiType =
    row.metadata && typeof row.metadata.ui_litigation_type === 'string'
      ? (row.metadata.ui_litigation_type as string)
      : null
  if (uiType && UI_TYPE_LABEL[uiType]) return UI_TYPE_LABEL[uiType]
  return KIND_LABEL[row.litigation_kind] ?? row.litigation_kind
}

/** Plainte du client : `notes` en priorité, sinon `metadata.client_complaint`. */
function clientComplaint(row: LitigationRow): string {
  if (row.notes && row.notes.trim().length > 0) return row.notes
  if (row.metadata && typeof row.metadata.client_complaint === 'string') {
    return row.metadata.client_complaint as string
  }
  return '—'
}

export default async function DossierLitigationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { orgId, supabase } = await getCurrentUser()

  const { data: dossierRaw } = await supabase
    .from('dossiers')
    .select('id, reference, missions(id, type)')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossierRaw) notFound()
  const dossier = dossierRaw as unknown as DossierRow
  const primaryMission = dossier.missions?.[0] ?? null

  // Le litige est rattaché à la mission (litigation_workflows.mission_id) :
  // c'est la clé fiable partagée entre la création et l'affichage. Sans
  // mission rattachée, aucun litige n'a pu être ouvert → on montre le form.
  let litigation: LitigationRow | null = null
  if (primaryMission) {
    const { data: litigationRaw } = await supabase
      .from('litigation_workflows')
      .select(
        'id, organization_id, mission_id, litigation_kind, status, notes, metadata, created_at, updated_at',
      )
      .eq('mission_id', primaryMission.id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    litigation = (litigationRaw as unknown as LitigationRow | null) ?? null
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/dossiers/${id}`}>
          <ArrowLeft className="size-4" /> Retour au dossier
        </Link>
      </Button>

      <AppPageHeader
        eyebrow={`Dossier ${dossier.reference}`}
        title="Mise"
        accent="en cause"
        description="Suivi du litige + projet de réponse argumentée."
        action={
          litigation ? (
            <Badge variant={(STATUS_META[litigation.status] ?? FALLBACK_STATUS_META).variant}>
              {(STATUS_META[litigation.status] ?? FALLBACK_STATUS_META).label}
            </Badge>
          ) : null
        }
      />

      {!litigation ? (
        <LitigationCreateForm dossierId={id} missionId={primaryMission?.id ?? null} />
      ) : (
        <div className="space-y-6">
          {/* Détails */}
          <Card variant="opaque" padding="default" className="space-y-4">
            <div className="flex items-center gap-2.5">
              <User className="size-5 text-[#0F1419]" />
              <h3 className="text-[15px] font-semibold text-[#0F1419]">Détails du litige</h3>
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-wide text-[#0F1419]/72">
                  Type
                </dt>
                <dd className="text-[#0F1419]">{litigationTypeLabel(litigation)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-wide text-[#0F1419]/72">
                  Ouvert le
                </dt>
                <dd className="font-mono text-[#0F1419]">{formatDate(litigation.created_at)}</dd>
              </div>
            </dl>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-[#0F1419]/72 mb-2">
                Plainte du client
              </p>
              <div className="rounded-md border border-[#0F1419]/[0.08] bg-sage-alt/60 p-4 text-[13px] text-[#0F1419] whitespace-pre-wrap leading-relaxed">
                {clientComplaint(litigation)}
              </div>
            </div>
          </Card>

          {/* Actions */}
          <LitigationActions
            litigationId={litigation.id}
            status={litigation.status}
            hasDraft={Boolean(litigation.draft_response_md)}
          />

          {/* Réponse IA */}
          <Card variant="opaque" padding="default" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Scale className="size-5 text-[#0F1419]" />
                <h3 className="text-[15px] font-semibold text-[#0F1419]">Projet de réponse</h3>
              </div>
              {litigation.draft_generated_at ? (
                <span className="text-[11px] font-mono text-[#0F1419]/72">
                  Généré le {formatDate(litigation.draft_generated_at)}
                </span>
              ) : null}
            </div>
            {litigation.draft_response_md ? (
              <div className="rounded-md border border-[#0F1419]/[0.08] bg-paper p-4 text-[13px] text-[#0F1419] whitespace-pre-wrap leading-relaxed font-sans">
                {litigation.draft_response_md}
              </div>
            ) : (
              <p className="text-sm text-[#0F1419]/72">
                Aucun brouillon généré. Cliquez sur « Générer la réponse IA » ci-dessus pour
                produire un projet argumenté avec références juridiques.
              </p>
            )}
          </Card>

          {/* Références citées */}
          {litigation.cited_references && litigation.cited_references.length > 0 ? (
            <Card variant="opaque" padding="default" className="space-y-3">
              <div className="flex items-center gap-2.5">
                <BookOpen className="size-5 text-[#0F1419]" />
                <h3 className="text-[15px] font-semibold text-[#0F1419]">Références citées</h3>
              </div>
              <ul className="flex flex-wrap gap-2">
                {litigation.cited_references.map((ref, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: liste statique servie par l'IA, ordre stable
                  <li key={`${ref}-${idx}`}>
                    <Badge variant="outline">{ref}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Note V2 : éditeur markdown + export Word */}
          <Card variant="opaque" padding="default" className="flex items-start gap-3">
            <FileText className="size-5 text-[#0F1419]/72 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-[#0F1419]">Édition manuelle</p>
              <p className="text-[11px] text-[#0F1419]/72">
                Éditeur markdown enrichi + export courrier avocat — prévu V2.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}
