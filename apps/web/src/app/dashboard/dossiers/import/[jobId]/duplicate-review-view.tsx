'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type {
  CommitResponse,
  DedupeEntityType,
  DedupeResolution,
  FieldChoiceMap,
} from '@/lib/import/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowRight, Check, Loader2, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { DuplicateMergeModal, type MergeFieldDefinition } from './duplicate-merge-modal'

// ============================================================================
// TYPES — sérialisables, alignés sur ce que la page parent passe en props
// ============================================================================

export interface MatchSidePayload {
  /** Snapshot des champs côté staging (à importer) — clé/valeur */
  fields: Record<string, string | null>
}

export interface DedupeMatchPayload {
  match_id: string
  entity_type: DedupeEntityType
  staging_entity_id: string
  existing_entity_id: string
  confidence_score: number
  match_reasons: string[]
  /** Résolution actuelle (peut être null si pas encore choisi par l'utilisateur) */
  resolution: DedupeResolution | null
  field_choices: FieldChoiceMap | null
  /** Snapshot du staging et de l'existant (uniquement les champs utiles à l'UI) */
  staging: MatchSidePayload
  existing: MatchSidePayload
  /** Libellé court calculé côté serveur (ex: "DUPONT Jean") pour titre carte */
  staging_label: string
  existing_label: string
}

export interface DuplicateReviewViewProps {
  job: {
    id: string
    source_filename: string
    detected_clients_count: number
    detected_properties_count: number
    detected_coproprietes_count: number
    detected_lots_count: number
    duplicates_clients_count: number
    duplicates_properties_count: number
    duplicates_coproprietes_count: number
  }
  matches: {
    client: DedupeMatchPayload[]
    property: DedupeMatchPayload[]
    copropriete: DedupeMatchPayload[]
  }
  /** Nombres de nouveaux (sans match) à importer tels quels */
  newEntitiesCount: {
    client: number
    property: number
    copropriete: number
    lot: number
  }
}

// ============================================================================
// Champs affichés par modal selon le type d'entité
// ============================================================================

const FIELD_LABELS_BY_TYPE: Record<DedupeEntityType, Array<{ key: string; label: string }>> = {
  client: [
    { key: 'display_name', label: 'Nom affiché' },
    { key: 'first_name', label: 'Prénom' },
    { key: 'last_name', label: 'Nom' },
    { key: 'company_name', label: 'Société' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'siret', label: 'SIRET' },
    { key: 'address', label: 'Adresse' },
    { key: 'postal_code', label: 'Code postal' },
    { key: 'city', label: 'Ville' },
    { key: 'notes', label: 'Notes' },
  ],
  property: [
    { key: 'address', label: 'Adresse' },
    { key: 'postal_code', label: 'Code postal' },
    { key: 'city', label: 'Ville' },
    { key: 'insee_code', label: 'Code INSEE' },
  ],
  copropriete: [
    { key: 'name', label: 'Nom de la copro' },
    { key: 'rnic_number', label: 'N° RNIC' },
    { key: 'address', label: 'Adresse' },
    { key: 'postal_code', label: 'Code postal' },
    { key: 'city', label: 'Ville' },
  ],
}

const ENTITY_TAB_LABEL: Record<DedupeEntityType, string> = {
  client: 'Clients',
  property: 'Biens',
  copropriete: 'Copropriétés',
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

interface UiMatchState extends DedupeMatchPayload {
  /** État local optimiste : tant que la requête API n'a pas répondu, on
   *  affiche déjà le nouveau choix mais on peut rollback en cas d'erreur. */
  pending: boolean
  error: string | null
}

interface ToastState {
  kind: 'success' | 'error' | 'info'
  message: string
}

/**
 * Vue de validation finale des doublons (étape 5 du wizard import Liciel).
 *
 * Affiche :
 *  - 3 cards récapitulatives (clients/biens/copros)
 *  - Tabs pour basculer entre les 3 types
 *  - Liste des matches avec actions « Fusionner / Garder séparés / Ignorer »
 *  - Récap des nouveaux à importer tels quels (collapsibles)
 *  - Bouton final « Importer » → POST /commit → redirige sur summary
 */
export function DuplicateReviewView({ job, matches, newEntitiesCount }: DuplicateReviewViewProps) {
  const router = useRouter()
  const [tab, setTab] = useState<DedupeEntityType>('client')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  // État local par entité (résolutions optimistes)
  const initialState = useMemo<Record<DedupeEntityType, UiMatchState[]>>(
    () => ({
      client: matches.client.map((m) => ({ ...m, pending: false, error: null })),
      property: matches.property.map((m) => ({ ...m, pending: false, error: null })),
      copropriete: matches.copropriete.map((m) => ({ ...m, pending: false, error: null })),
    }),
    [matches],
  )
  const [state, setState] = useState<Record<DedupeEntityType, UiMatchState[]>>(initialState)

  // Modal merge
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<UiMatchState | null>(null)

  function showToast(t: ToastState) {
    setToast(t)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Total non résolu (pour activer le bouton final) ───────────────
  const unresolvedCount = useMemo(() => {
    let n = 0
    for (const t of ['client', 'property', 'copropriete'] as const) {
      for (const m of state[t]) {
        if (m.resolution === null) n++
      }
    }
    return n
  }, [state])

  // Compteurs par tab (badge)
  function unresolvedFor(t: DedupeEntityType): number {
    return state[t].filter((m) => m.resolution === null).length
  }

  // ── API : POST resolution ────────────────────────────────────────
  async function postResolution(
    match: UiMatchState,
    resolution: DedupeResolution,
    fieldChoices?: FieldChoiceMap,
  ): Promise<boolean> {
    setState((prev) => updateOne(prev, match, { pending: true, error: null }))
    try {
      const res = await fetch(`/api/import/dedupe/${job.id}/resolution`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          match_id: match.match_id,
          resolution,
          field_choices: fieldChoices ?? null,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setState((prev) =>
        updateOne(prev, match, {
          resolution,
          field_choices: fieldChoices ?? null,
          pending: false,
          error: null,
        }),
      )
      showToast({ kind: 'success', message: 'Résolution enregistrée.' })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setState((prev) => updateOne(prev, match, { pending: false, error: message }))
      showToast({ kind: 'error', message: `Échec : ${message}` })
      return false
    }
  }

  function openMergeFor(match: UiMatchState) {
    setMergeTarget(match)
    setMergeOpen(true)
  }

  async function handleMergeSubmit(choices: FieldChoiceMap) {
    if (!mergeTarget) return
    await postResolution(mergeTarget, 'merge', choices)
  }

  // ── Commit final ─────────────────────────────────────────────────
  async function handleCommit() {
    if (committing) return
    if (unresolvedCount > 0) {
      setCommitError(`Il reste ${unresolvedCount} doublon(s) à résoudre.`)
      return
    }
    setCommitting(true)
    setCommitError(null)
    try {
      const res = await fetch(`/api/import/commit/${job.id}`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const result = (await res.json()) as CommitResponse
      // Encode le résultat dans la query pour l'afficher dans le summary
      const params = new URLSearchParams({
        ic: String(result.imported.clients),
        ip: String(result.imported.properties),
        ico: String(result.imported.coproprietes),
        il: String(result.imported.lots),
        mc: String(result.merged.clients),
        mp: String(result.merged.properties),
        mco: String(result.merged.coproprietes),
      })
      router.push(`/dashboard/dossiers/import/${job.id}?${params.toString()}`)
      router.refresh()
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Erreur inconnue')
      setCommitting(false)
    }
  }

  // ── Champs pour la modal merge (alimentée par mergeTarget) ────────
  const mergeFields: MergeFieldDefinition[] = useMemo(() => {
    if (!mergeTarget) return []
    const defs = FIELD_LABELS_BY_TYPE[mergeTarget.entity_type]
    return defs.map((d) => ({
      key: d.key,
      label: d.label,
      existing: mergeTarget.existing.fields[d.key] ?? null,
      newValue: mergeTarget.staging.fields[d.key] ?? null,
    }))
  }, [mergeTarget])

  // ── Total importable (info bouton final) ─────────────────────────
  const totalImportable =
    newEntitiesCount.client +
    newEntitiesCount.property +
    newEntitiesCount.copropriete +
    state.client.filter((m) => m.resolution === 'keep_separate').length +
    state.property.filter((m) => m.resolution === 'keep_separate').length +
    state.copropriete.filter((m) => m.resolution === 'keep_separate').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Stats récap ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Clients"
          value={job.detected_clients_count}
          subValue={`dont ${job.duplicates_clients_count} doublon${job.duplicates_clients_count > 1 ? 's' : ''}`}
        />
        <StatCard
          label="Biens"
          value={job.detected_properties_count}
          subValue={`dont ${job.duplicates_properties_count} doublon${job.duplicates_properties_count > 1 ? 's' : ''}`}
        />
        <StatCard
          label="Copropriétés"
          value={job.detected_coproprietes_count}
          subValue={`dont ${job.duplicates_coproprietes_count} doublon${job.duplicates_coproprietes_count > 1 ? 's' : ''}`}
        />
      </div>

      {/* ── Section doublons ──────────────────────────────────────── */}
      <Card variant="opaque" padding="default">
        <CardContent className="pt-2 space-y-5">
          <header className="space-y-1.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Doublons détectés
            </p>
            <h2 className="font-serif italic font-normal text-xl md:text-2xl text-ink leading-tight">
              {unresolvedCount === 0
                ? 'Tous les doublons sont résolus.'
                : `${unresolvedCount} doublon${unresolvedCount > 1 ? 's' : ''} à valider.`}
            </h2>
          </header>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-rule">
            {(['client', 'property', 'copropriete'] as const).map((t) => {
              const total = state[t].length
              const unres = unresolvedFor(t)
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'relative px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
                    '-mb-[1px] border-b-2',
                    tab === t
                      ? 'border-[#0F1419] text-ink'
                      : 'border-transparent text-ink-mute hover:text-ink',
                  )}
                >
                  {ENTITY_TAB_LABEL[t]} ({total})
                  {unres > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-mist text-[#7C3F0A] text-[9px] font-semibold w-4 h-4">
                      {unres}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Liste des matches du tab courant */}
          <ol className="space-y-3">
            {state[tab].length === 0 ? (
              <li className="text-sm text-ink-mute italic">
                Aucun doublon de ce type — toutes les nouvelles entrées seront importées telles
                quelles.
              </li>
            ) : (
              state[tab].map((m) => (
                <MatchCard
                  key={m.match_id}
                  match={m}
                  entityType={tab}
                  onMerge={() => openMergeFor(m)}
                  onKeepSeparate={() => postResolution(m, 'keep_separate')}
                  onSkip={() => postResolution(m, 'skip')}
                />
              ))
            )}
          </ol>
        </CardContent>
      </Card>

      {/* ── Section nouveaux ──────────────────────────────────────── */}
      {(newEntitiesCount.client > 0 ||
        newEntitiesCount.property > 0 ||
        newEntitiesCount.copropriete > 0 ||
        newEntitiesCount.lot > 0) && (
        <Card variant="opaque" padding="default">
          <CardContent className="pt-2 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Nouveaux éléments à importer tels quels
            </p>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              {newEntitiesCount.client > 0 && (
                <li className="flex items-center gap-2">
                  <Users className="size-3.5 text-ink-mute" aria-hidden />
                  <span className="tabular-nums font-medium text-ink">
                    {newEntitiesCount.client}
                  </span>{' '}
                  nouveau{newEntitiesCount.client > 1 ? 'x' : ''} client
                  {newEntitiesCount.client > 1 ? 's' : ''}
                </li>
              )}
              {newEntitiesCount.property > 0 && (
                <li>
                  <span className="tabular-nums font-medium text-ink">
                    {newEntitiesCount.property}
                  </span>{' '}
                  nouveau{newEntitiesCount.property > 1 ? 'x' : ''} bien
                  {newEntitiesCount.property > 1 ? 's' : ''}
                </li>
              )}
              {newEntitiesCount.copropriete > 0 && (
                <li>
                  <span className="tabular-nums font-medium text-ink">
                    {newEntitiesCount.copropriete}
                  </span>{' '}
                  nouvelle{newEntitiesCount.copropriete > 1 ? 's' : ''} copropriété
                  {newEntitiesCount.copropriete > 1 ? 's' : ''}
                </li>
              )}
              {newEntitiesCount.lot > 0 && (
                <li>
                  <span className="tabular-nums font-medium text-ink">{newEntitiesCount.lot}</span>{' '}
                  lot{newEntitiesCount.lot > 1 ? 's' : ''} de copro
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Footer commit ─────────────────────────────────────────── */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Button variant="ghost" onClick={() => router.push('/dashboard/dossiers/import')}>
          Annuler
        </Button>
        <div className="flex items-center gap-3 flex-wrap">
          {unresolvedCount > 0 && (
            <Badge variant="orange" className="text-[10px]">
              <AlertTriangle className="size-3 mr-1" /> {unresolvedCount} à résoudre
            </Badge>
          )}
          <Button
            variant="accent"
            size="lg"
            disabled={committing || unresolvedCount > 0}
            onClick={handleCommit}
          >
            {committing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Import en cours…
              </>
            ) : (
              <>
                Importer{' '}
                {totalImportable > 0 && <span className="tabular-nums">{totalImportable}</span>}{' '}
                élément{totalImportable > 1 ? 's' : ''}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {commitError && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden />
          <p>{commitError}</p>
        </div>
      )}

      {/* ── Toast minimal ─────────────────────────────────────────── */}
      {toast && (
        <output
          aria-live="polite"
          className={cn(
            'fixed bottom-4 right-4 z-50 rounded-pill px-4 py-2 text-xs font-medium shadow-md',
            toast.kind === 'success' && 'bg-accent-green text-paper',
            toast.kind === 'error' && 'bg-danger text-paper',
            toast.kind === 'info' && 'bg-[#0F1419] text-paper',
          )}
        >
          {toast.message}
        </output>
      )}

      {/* ── Modal merge ───────────────────────────────────────────── */}
      {mergeTarget && (
        <DuplicateMergeModal
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          title={`Fusionner ${mergeTarget.staging_label} ↔ ${mergeTarget.existing_label}`}
          fields={mergeFields}
          initialChoices={mergeTarget.field_choices ?? undefined}
          onSubmit={handleMergeSubmit}
        />
      )}
    </div>
  )
}

// ============================================================================
// Helpers : update d'un match dans l'état
// ============================================================================
function updateOne(
  prev: Record<DedupeEntityType, UiMatchState[]>,
  target: { match_id: string; entity_type: DedupeEntityType },
  patch: Partial<UiMatchState>,
): Record<DedupeEntityType, UiMatchState[]> {
  return {
    ...prev,
    [target.entity_type]: prev[target.entity_type].map((m) =>
      m.match_id === target.match_id ? { ...m, ...patch } : m,
    ),
  }
}

// ============================================================================
// Sous-composants UI
// ============================================================================

function StatCard({
  label,
  value,
  subValue,
}: {
  label: string
  value: number
  subValue: string
}) {
  return (
    <Card variant="opaque" padding="sm">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">{label}</p>
        <p className="font-serif italic font-normal text-3xl text-ink leading-none tabular-nums">
          {value}
        </p>
        <p className="text-[11px] text-ink-mute">{subValue}</p>
      </div>
    </Card>
  )
}

function MatchCard({
  match,
  entityType,
  onMerge,
  onKeepSeparate,
  onSkip,
}: {
  match: UiMatchState
  entityType: DedupeEntityType
  onMerge: () => void
  onKeepSeparate: () => void
  onSkip: () => void
}) {
  const fieldDefs = FIELD_LABELS_BY_TYPE[entityType]
  // Champs à afficher en preview : les 3 premiers où au moins l'un des 2 a une valeur
  const previewFields = fieldDefs
    .filter((f) => match.existing.fields[f.key] || match.staging.fields[f.key])
    .slice(0, 3)
  const confidencePercent = Math.round(match.confidence_score * 100)
  const isResolved = match.resolution !== null

  return (
    <li
      className={cn(
        'rounded-xl border bg-paper p-4 space-y-3',
        isResolved
          ? match.resolution === 'skip'
            ? 'border-rule/60 opacity-60'
            : 'border-accent-green/40 bg-accent-green/5'
          : 'border-rule',
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="size-4 text-orange-600 shrink-0" aria-hidden />
          <p className="text-sm font-medium text-ink truncate">
            {match.existing_label} ↔ {match.staging_label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isResolved && <ResolutionBadge resolution={match.resolution} />}
          <Badge variant="muted" className="font-mono text-[10px] tabular-nums">
            Confiance {confidencePercent}%
          </Badge>
        </div>
      </div>

      {/* Preview des 3 champs principaux */}
      <div className="grid grid-cols-[5rem_1fr_1fr] gap-x-3 gap-y-1 text-[11px]">
        {previewFields.map((f) => (
          <FieldRow
            key={f.key}
            label={f.label}
            existing={match.existing.fields[f.key]}
            newValue={match.staging.fields[f.key]}
          />
        ))}
      </div>

      {/* Raisons */}
      {match.match_reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {match.match_reasons.slice(0, 5).map((r) => (
            <span
              key={r}
              className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sage-alt/60 text-ink-mute"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Erreur API */}
      {match.error && (
        <p className="text-[11px] text-danger flex items-center gap-1">
          <X className="size-3" /> {match.error}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          variant={match.resolution === 'merge' ? 'accent' : 'outline'}
          size="sm"
          onClick={onMerge}
          disabled={match.pending}
        >
          {match.resolution === 'merge' ? (
            <>
              <Check className="size-3" /> Fusion validée — Modifier
            </>
          ) : (
            <>Fusionner…</>
          )}
        </Button>
        <Button
          variant={match.resolution === 'keep_separate' ? 'default' : 'outline'}
          size="sm"
          onClick={onKeepSeparate}
          disabled={match.pending}
        >
          {match.resolution === 'keep_separate' && <Check className="size-3" />}
          Garder séparés
        </Button>
        <Button
          variant={match.resolution === 'skip' ? 'default' : 'ghost'}
          size="sm"
          onClick={onSkip}
          disabled={match.pending}
        >
          {match.resolution === 'skip' && <Check className="size-3" />}
          Ignorer
        </Button>
        {match.pending && <Loader2 className="size-3.5 animate-spin text-ink-mute" />}
      </div>
    </li>
  )
}

function FieldRow({
  label,
  existing,
  newValue,
}: {
  label: string
  existing: string | null | undefined
  newValue: string | null | undefined
}) {
  return (
    <>
      <span className="text-ink-mute font-mono uppercase tracking-wider text-[9px] pt-0.5">
        {label}
      </span>
      <span className="font-mono text-ink truncate">
        {existing ?? <span className="italic text-ink-mute/60">—</span>}
      </span>
      <span className="font-mono text-ink truncate">
        {newValue ?? <span className="italic text-ink-mute/60">—</span>}
      </span>
    </>
  )
}

function ResolutionBadge({ resolution }: { resolution: DedupeResolution | null }) {
  if (resolution === null) return null
  const map: Record<
    DedupeResolution,
    { label: string; variant: 'green' | 'blue' | 'muted' | 'orange' }
  > = {
    merge: { label: 'Fusionner', variant: 'green' },
    keep_separate: { label: 'Séparés', variant: 'blue' },
    replace: { label: 'Remplacer', variant: 'orange' },
    skip: { label: 'Ignoré', variant: 'muted' },
  }
  const v = map[resolution]
  return (
    <Badge variant={v.variant} className="text-[10px]">
      <Check className="size-3 mr-1" /> {v.label}
    </Badge>
  )
}
