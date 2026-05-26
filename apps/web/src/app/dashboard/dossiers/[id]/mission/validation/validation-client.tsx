'use client'

/**
 * KOVAS — Composant client de la page Validation mission (MISSION-D).
 *
 * Layout split 3 colonnes desktop / scroll vertical mobile :
 *   - Gauche : sidebar pièces avec status validation
 *   - Centre : formulaire 3CL pré-rempli (édition inline, source + confidence)
 *   - Droite : checklist "Champs à risque" + CTA export Liciel
 */

import { VisionEquipmentSection } from '@/components/dashboard/widgets/VisionEquipmentSection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  exportToLicielAction,
  triggerProcessMissionPayloadAction,
  updateRoom3CLDataAction,
} from './actions'

interface Room3CLRow {
  id: string
  mission_session_id: string
  room_name: string
  room_type: string | null
  surface_sqm: number | null
  ceiling_height_m: number | null
  orientation: string | null
  data_3cl: Record<string, unknown>
  ai_confidence_score: number | null
  source: 'ai_extracted' | 'user_validated' | 'user_corrected'
  validated_by_user: boolean
  created_at: string
}

interface PhotoRow {
  id: string
  storage_path: string
  thumb_path: string | null
  room_id: string | null
  caption: string | null
  vision_analysis: Record<string, unknown> | null
  vision_confidence: number | null
}

interface ValidationClientProps {
  dossier: { id: string; reference: string }
  session: {
    id: string
    payload_processed: boolean
    sync_status: string
    sync_error: string | null
    sync_completed_at: string | null
    last_sync_attempt: string | null
  } | null
  rooms: Room3CLRow[]
  photos: PhotoRow[]
}

// ────────────────────────────────────────────────────────────
// Helpers UI
// ────────────────────────────────────────────────────────────

function confidenceBadge(confidence: number | null) {
  if (confidence == null) return <Badge variant="muted">Confiance N/A</Badge>
  if (confidence >= 0.9) return <Badge variant="green">{(confidence * 100).toFixed(0)}%</Badge>
  if (confidence >= 0.7) return <Badge variant="yellow">{(confidence * 100).toFixed(0)}%</Badge>
  return <Badge variant="red">{(confidence * 100).toFixed(0)}%</Badge>
}

function sourceLabel(source: Room3CLRow['source']): string {
  switch (source) {
    case 'ai_extracted':
      return 'IA'
    case 'user_validated':
      return 'Validé'
    case 'user_corrected':
      return 'Corrigé'
  }
}

function sourceVariant(source: Room3CLRow['source']): 'default' | 'green' | 'amber' {
  switch (source) {
    case 'ai_extracted':
      return 'default'
    case 'user_validated':
      return 'green'
    case 'user_corrected':
      return 'amber'
  }
}

function detectRoomWarnings(r: Room3CLRow): string[] {
  const w: string[] = []
  if (r.surface_sqm == null) w.push('Surface manquante')
  if (r.ceiling_height_m == null) w.push('Hauteur sous plafond manquante')
  if (r.orientation == null) w.push('Orientation manquante')
  const d3 = r.data_3cl ?? {}
  if (
    !Array.isArray((d3 as { windows?: unknown }).windows) ||
    ((d3 as { windows?: unknown[] }).windows?.length ?? 0) === 0
  ) {
    w.push('Aucune fenêtre saisie')
  }
  if (r.ai_confidence_score != null && r.ai_confidence_score < 0.7) {
    w.push(`Confiance IA faible (${(r.ai_confidence_score * 100).toFixed(0)}%)`)
  }
  return w
}

// ────────────────────────────────────────────────────────────
// Champ inline éditable
// ────────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onSave,
  source,
  confidence,
}: {
  label: string
  value: string | number | null
  onSave: (newValue: string) => Promise<void>
  source: 'ia' | 'voice' | 'photo' | 'user'
  confidence?: number | null
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [saving, setSaving] = useState(false)

  const sourceIconLabel =
    source === 'ia' ? 'IA' : source === 'voice' ? 'Voix' : source === 'photo' ? 'Photo' : 'Manuel'

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] uppercase">
            {sourceIconLabel}
          </Badge>
          {confidence != null && confidenceBadge(confidence)}
        </div>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            disabled={saving}
            className="h-8"
          />
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              await onSave(draft)
              setSaving(false)
              setEditing(false)
            }}
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : 'OK'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Annuler
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">
            {value == null || value === '' ? (
              <span className="italic text-muted-foreground">Non renseigné</span>
            ) : (
              String(value)
            )}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Composant principal
// ────────────────────────────────────────────────────────────

export function ValidationClient({
  dossier,
  session,
  rooms: initialRooms,
  photos,
}: ValidationClientProps) {
  const [rooms, setRooms] = useState<Room3CLRow[]>(initialRooms)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRooms[0]?.id ?? null)
  const [syncing, startSync] = useTransition()
  const [exporting, startExport] = useTransition()
  const [exportResult, setExportResult] = useState<
    { ok: true; storagePath: string; warnings: string[] } | { error: string } | null
  >(null)

  const selected = rooms.find((r) => r.id === selectedRoomId) ?? null
  const photosForRoom = photos.filter(
    (p) => p.room_id === selected?.id || (!selected && !p.room_id),
  )

  const handleTriggerSync = () => {
    if (!session) return
    startSync(async () => {
      const res = await triggerProcessMissionPayloadAction(session.id)
      if ('error' in res) {
        // Toast utilisateur (cf. audit P1-9 mode mission). Avant : console.error
        // muet → l'utilisateur cliquait 5x sans feedback puis spammait l'API.
        toast.error('Synchronisation impossible', {
          description: res.error,
        })
      } else {
        toast.success('Synchronisation lancée — vous serez notifié à la fin.')
      }
    })
  }

  const handleSaveField = async (rowId: string, key: string, newValue: string) => {
    // Inférer type via valeur initiale
    const room = rooms.find((r) => r.id === rowId)
    if (!room) return
    let coerced: unknown = newValue
    if (key === 'surface_sqm' || key === 'ceiling_height_m') {
      const n = Number.parseFloat(newValue)
      coerced = Number.isNaN(n) ? null : n
    }
    if (newValue === '') coerced = null

    const patch = { [key]: coerced }
    const res = await updateRoom3CLDataAction(rowId, patch)
    if ('ok' in res) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                data_3cl: { ...r.data_3cl, ...patch },
                source: 'user_corrected',
                validated_by_user: true,
              }
            : r,
        ),
      )
    } else {
      // Toast d'erreur (cf. audit P1-8). Avant : aucun feedback, le champ revenait
      // silencieusement à sa valeur initiale, l'utilisateur croyait avoir sauvegardé.
      toast.error('Modification non sauvegardée', {
        description: res.error,
      })
    }
  }

  const handleExport = () => {
    if (!session) return
    startExport(async () => {
      const res = await exportToLicielAction(session.id)
      setExportResult(res)
    })
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/dossiers/${dossier.id}`}>
              <ArrowLeft className="size-4" /> Retour au dossier
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-bold">Validation mission</h1>
          <p className="text-sm text-muted-foreground">
            Dossier {dossier.reference} — {rooms.length} pièce(s) structurée(s) par IA
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session && !session.payload_processed && (
            <Button onClick={handleTriggerSync} disabled={syncing} variant="outline">
              {syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {session.sync_status === 'failed'
                ? 'Réessayer la synchronisation'
                : 'Lancer la synchronisation'}
            </Button>
          )}
          <Button
            onClick={handleExport}
            disabled={exporting || rooms.length === 0}
            className="bg-[#D4F542] text-[#0F1419] hover:bg-[#C5E933]"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Exporter vers Liciel
          </Button>
        </div>
      </div>

      {/* Banner statut sync */}
      {session && (
        <Card className="p-3 text-sm">
          {session.sync_status === 'processing' || session.sync_status === 'queued' ? (
            <div className="flex items-center gap-2 text-blue-700">
              <Loader2 className="size-4 animate-spin" />
              Synchronisation en cours… La structuration IA prend en général 30 à 60 secondes.
            </div>
          ) : session.sync_status === 'failed' ? (
            <div className="flex items-start gap-2 text-red-700">
              <AlertTriangle className="size-4 mt-0.5" />
              <div>
                Échec de synchronisation. Tu peux relancer le pipeline.
                {session.sync_error && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {session.sync_error.slice(0, 200)}
                  </div>
                )}
              </div>
            </div>
          ) : session.payload_processed ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="size-4" />
              Mission synchronisée et structurée par IA. Validez les champs ci-dessous avant export.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="size-4" />
              Mission en attente de synchronisation.
            </div>
          )}
        </Card>
      )}

      {/* Résultat export */}
      {exportResult && (
        <Card className="p-3 text-sm">
          {'ok' in exportResult ? (
            <div className="flex items-start gap-2 text-green-700">
              <CheckCircle2 className="size-4 mt-0.5" />
              <div>
                Export Liciel généré ({exportResult.storagePath.split('/').pop()}).
                {exportResult.warnings.length > 0 && (
                  <div className="mt-1 text-xs text-amber-700">
                    {exportResult.warnings.length} avertissement(s) :{' '}
                    {exportResult.warnings.join(' · ')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-4" />
              {exportResult.error}
            </div>
          )}
        </Card>
      )}

      {/* Détections Vision IA (A1.3.6) — Lot B82 */}
      <VisionEquipmentSection photos={photos} />

      {/* Layout 3 colonnes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_280px]">
        {/* ─── Gauche : liste des pièces ─── */}
        <Card className="p-3">
          <h2 className="mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Pièces ({rooms.length})
          </h2>
          {rooms.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              Aucune pièce structurée. Lancez la synchronisation.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rooms.map((r) => {
                const warnings = detectRoomWarnings(r)
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRoomId(r.id)}
                      className={cn(
                        'w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors',
                        selectedRoomId === r.id
                          ? 'border-foreground bg-foreground/5'
                          : 'border-border hover:bg-accent/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.room_name}</span>
                        <Badge variant={sourceVariant(r.source)} className="text-[10px]">
                          {sourceLabel(r.source)}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1 text-xs text-muted-foreground">
                        <span>{r.room_type ?? 'type ?'}</span>
                        {warnings.length > 0 ? (
                          <span className="flex items-center gap-1 text-amber-700">
                            <AlertTriangle className="size-3" />
                            {warnings.length}
                          </span>
                        ) : (
                          <CheckCircle2 className="size-3 text-green-700" />
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* ─── Centre : champs 3CL de la pièce sélectionnée ─── */}
        <Card className="p-4 space-y-4">
          {selected ? (
            <>
              <div>
                <h2 className="text-lg font-bold">{selected.room_name}</h2>
                <p className="text-xs text-muted-foreground">
                  Type : {selected.room_type ?? 'non défini'} · Source :{' '}
                  {sourceLabel(selected.source)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <EditableField
                  label="Surface (m²)"
                  value={selected.surface_sqm}
                  source={selected.source === 'ai_extracted' ? 'ia' : 'user'}
                  confidence={selected.ai_confidence_score}
                  onSave={(v) => handleSaveField(selected.id, 'surface_sqm', v)}
                />
                <EditableField
                  label="Hauteur sous plafond (m)"
                  value={selected.ceiling_height_m}
                  source={selected.source === 'ai_extracted' ? 'ia' : 'user'}
                  confidence={selected.ai_confidence_score}
                  onSave={(v) => handleSaveField(selected.id, 'ceiling_height_m', v)}
                />
                <EditableField
                  label="Orientation"
                  value={selected.orientation}
                  source={selected.source === 'ai_extracted' ? 'ia' : 'user'}
                  confidence={selected.ai_confidence_score}
                  onSave={(v) => handleSaveField(selected.id, 'orientation', v)}
                />
                <EditableField
                  label="Type"
                  value={selected.room_type}
                  source={selected.source === 'ai_extracted' ? 'ia' : 'user'}
                  confidence={selected.ai_confidence_score}
                  onSave={(v) => handleSaveField(selected.id, 'room_type', v)}
                />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Données 3CL détaillées (JSON IA)
                </h3>
                <pre className="rounded-lg border border-border bg-background/50 p-3 text-xs overflow-auto max-h-[280px]">
                  {JSON.stringify(selected.data_3cl, null, 2)}
                </pre>
              </div>

              {photosForRoom.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Photos liées ({photosForRoom.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                    {photosForRoom.map((p) => (
                      <div
                        key={p.id}
                        className="aspect-square rounded-md border border-border bg-muted/30 p-1 text-[10px]"
                      >
                        <div className="truncate">{p.storage_path.split('/').pop()}</div>
                        {p.vision_confidence != null && (
                          <div className="mt-1">{confidenceBadge(p.vision_confidence)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Sélectionnez une pièce à gauche pour voir ses champs 3CL.
            </p>
          )}
        </Card>

        {/* ─── Droite : champs à risque ─── */}
        <Card className="p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="size-3" />
            Champs à risque
          </h2>

          {rooms.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Aucune pièce à analyser.</p>
          ) : (
            <ul className="space-y-2">
              {rooms
                .flatMap((r) =>
                  detectRoomWarnings(r).map((w) => ({
                    room: r.room_name,
                    warning: w,
                    roomId: r.id,
                  })),
                )
                .slice(0, 12)
                .map((item) => (
                  <li key={`${item.roomId}-${item.warning}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedRoomId(item.roomId)}
                      className="w-full text-left rounded-md border border-amber-200 bg-amber-50/50 p-2 text-xs hover:bg-amber-50"
                    >
                      <div className="font-medium">{item.room}</div>
                      <div className="text-amber-700">{item.warning}</div>
                    </button>
                  </li>
                ))}
              {rooms.flatMap((r) => detectRoomWarnings(r)).length === 0 && (
                <li className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="size-4" />
                  Aucun champ à risque détecté.
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
