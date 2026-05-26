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

interface LitigationRow {
  id: string
  organization_id: string
  dossier_id: string | null
  mission_id: string | null
  litigation_type: string
  client_complaint: string
  status: 'opened' | 'in_progress' | 'resolved' | 'closed' | 'court'
  draft_response_md: string | null
  cited_references: string[] | null
  draft_generated_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_META: Record<
  LitigationRow['status'],
  { label: string; variant: 'blue' | 'yellow' | 'green' | 'red' | 'muted' }
> = {
  opened: { label: 'Ouvert', variant: 'blue' },
  in_progress: { label: 'En cours', variant: 'yellow' },
  resolved: { label: 'Résolu', variant: 'green' },
  closed: { label: 'Clos', variant: 'muted' },
  court: { label: 'Tribunal', variant: 'red' },
}

const TYPE_LABEL: Record<string, string> = {
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

  const { data: litigationRaw } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
    .from('litigation_workflows' as any)
    .select('*')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const litigation = (litigationRaw ?? null) as LitigationRow | null

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
            <Badge variant={STATUS_META[litigation.status].variant}>
              {STATUS_META[litigation.status].label}
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
                <dd className="text-[#0F1419]">
                  {TYPE_LABEL[litigation.litigation_type] ?? litigation.litigation_type}
                </dd>
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
                {litigation.client_complaint}
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
