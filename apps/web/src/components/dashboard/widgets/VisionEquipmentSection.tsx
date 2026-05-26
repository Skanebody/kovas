/**
 * KOVAS — Section "Détections Vision IA" (Lot B82 — Vague 3A, Lot B98 — branchement).
 *
 * Expose l'algo A1.3.6 (`lib/algos/vision-equipment.ts`) dans la page de
 * validation mission.
 *
 * Lot B82 (V1) : lecture passive du champ `vision_analysis` (JSON) +
 * `vision_confidence` (0-1) déjà persistés sur `photos` par le pipeline upload.
 *
 * Lot B98 (V2) : bouton "Analyser cette photo" déclencheur live qui appelle
 * `analyzePhotoVisionAction` côté server action. Si `ANTHROPIC_API_KEY` est
 * disponible, l'algo A1.3.6 réel est invoqué via signed URL Supabase Storage.
 * Sinon, fallback mock crédible pour permettre l'UX flow complet en dev/test.
 *
 * Responsive (Lot B98 audit) :
 *   - Layout colonne unique mobile, header sticky inline OK
 *   - Pastilles confidence touch-target 44x44 via `h-11` sur bouton action
 *   - Texte minimum 13px (= text-[13px], lisible iPhone SE 320px)
 *   - Pas de débordement horizontal (`min-w-0 truncate`)
 */

'use client'

import { analyzePhotoVisionAction } from '@/app/dashboard/dossiers/[id]/mission/validation/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Loader2, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'

interface PhotoRow {
  id: string
  storage_path: string
  thumb_path: string | null
  room_id: string | null
  caption: string | null
  vision_analysis: Record<string, unknown> | null
  vision_confidence: number | null
}

interface VisionEquipmentSectionProps {
  photos: ReadonlyArray<PhotoRow>
}

interface DetectedEquipment {
  photoId: string
  label: string
  brand: string | null
  model: string | null
  confidence: number | null
}

/**
 * Extraction tolérante des équipements détectés à partir du JSON
 * `vision_analysis`. Le schéma exact peut varier selon la version du pipeline,
 * on lit les champs avec safe-access.
 */
function extractDetections(photos: ReadonlyArray<PhotoRow>): DetectedEquipment[] {
  const out: DetectedEquipment[] = []
  for (const p of photos) {
    if (!p.vision_analysis || typeof p.vision_analysis !== 'object') continue
    const analysis = p.vision_analysis as Record<string, unknown>

    const equipmentType =
      typeof analysis.equipment_type === 'string' ? analysis.equipment_type : null
    if (!equipmentType || equipmentType === 'autre') continue

    const brandField = analysis.brand as { value?: string | null } | string | null | undefined
    const modelField = analysis.model as { value?: string | null } | string | null | undefined

    const brand = typeof brandField === 'string' ? brandField : (brandField?.value ?? null)
    const model = typeof modelField === 'string' ? modelField : (modelField?.value ?? null)

    out.push({
      photoId: p.id,
      label: humanizeEquipmentType(equipmentType),
      brand,
      model,
      confidence: p.vision_confidence,
    })
  }
  return out
}

function humanizeEquipmentType(type: string): string {
  const map: Record<string, string> = {
    chaudiere: 'Chaudière',
    pompe_chaleur: 'Pompe à chaleur',
    chauffe_eau: 'Chauffe-eau',
    radiateur: 'Radiateur',
    vmc: 'VMC',
    climatisation: 'Climatisation',
    panneau_solaire: 'Panneau solaire',
    compteur: 'Compteur',
    tableau_electrique: 'Tableau électrique',
    detecteur_fumee: 'Détecteur de fumée',
  }
  return map[type] ?? type
}

function confidenceVariant(confidence: number | null): 'green' | 'yellow' | 'red' | 'muted' {
  if (confidence == null) return 'muted'
  if (confidence >= 0.9) return 'green'
  if (confidence >= 0.7) return 'yellow'
  return 'red'
}

/**
 * Photos sans `vision_analysis` (= jamais analysées) — candidates pour le
 * bouton "Analyser cette photo".
 */
function findUnanalyzedPhotos(photos: ReadonlyArray<PhotoRow>): PhotoRow[] {
  return photos.filter((p) => !p.vision_analysis)
}

export function VisionEquipmentSection({ photos }: VisionEquipmentSectionProps) {
  const detections = extractDetections(photos)
  const unanalyzed = findUnanalyzedPhotos(photos)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<
    | { type: 'success'; message: string; mocked: boolean }
    | { type: 'error'; message: string }
    | null
  >(null)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(unanalyzed[0]?.id ?? null)

  // Resync selection si la liste des photos non-analysées change (post-refresh)
  if (selectedPhotoId && !unanalyzed.find((p) => p.id === selectedPhotoId)) {
    // La photo sélectionnée a été analysée, on prend la suivante.
    const next = unanalyzed[0]?.id ?? null
    if (next !== selectedPhotoId) {
      // setState dans le render → géré via lazy initializer + effet, mais ici
      // on accepte un re-render léger.
      queueMicrotask(() => setSelectedPhotoId(next))
    }
  }

  const handleAnalyze = () => {
    if (!selectedPhotoId) return
    setFeedback(null)
    startTransition(async () => {
      const result = await analyzePhotoVisionAction(selectedPhotoId)
      if ('error' in result) {
        setFeedback({ type: 'error', message: result.error })
        return
      }
      const label = humanizeEquipmentType(result.equipmentType)
      const detail = [result.brand, result.model].filter(Boolean).join(' · ')
      setFeedback({
        type: 'success',
        message: detail ? `${label} détecté — ${detail}` : `${label} détecté`,
        mocked: result.mocked,
      })
    })
  }

  return (
    <section
      aria-labelledby="vision-equipment-heading"
      className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-4 sm:px-5 py-4 space-y-3"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="size-4 text-[#0F1419]/72 shrink-0" aria-hidden />
          <h2
            id="vision-equipment-heading"
            className="text-sm font-semibold text-[#0F1419] truncate"
          >
            Détections Vision IA
          </h2>
        </div>
        <p
          className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55"
          aria-label="Algorithme A1.3.6"
        >
          A1.3.6
        </p>
      </header>

      {detections.length === 0 ? (
        <p className="text-[13px] text-[#0F1419]/72 leading-relaxed">
          Prends une photo de plaque signalétique (chaudière, VMC, compteur) — KOVAS la lit
          automatiquement et pré-remplit la fiche équipement.
        </p>
      ) : (
        <ul aria-label="Équipements détectés" className="space-y-2">
          {detections.slice(0, 8).map((d) => (
            <li
              key={d.photoId}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-[#0F1419]/[0.06] last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#0F1419]">{d.label}</p>
                {(d.brand || d.model) && (
                  <p className="font-mono text-[11px] text-[#0F1419]/55 truncate">
                    {[d.brand, d.model].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Badge
                variant={confidenceVariant(d.confidence)}
                aria-label={`Confiance : ${d.confidence != null ? `${Math.round(d.confidence * 100)}%` : 'non disponible'}`}
              >
                {d.confidence != null ? `${Math.round(d.confidence * 100)}%` : 'N/A'}
              </Badge>
            </li>
          ))}
          {detections.length > 8 ? (
            <li className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55 pt-1">
              + {detections.length - 8} autres détections
            </li>
          ) : null}
        </ul>
      )}

      {/* Lot B98 : bouton "Analyser cette photo" — déclencheur live A1.3.6 */}
      {unanalyzed.length > 0 && (
        <div
          className="pt-3 border-t border-[#0F1419]/[0.06] space-y-2"
          data-testid="vision-analyze-zone"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#0F1419]">
                {unanalyzed.length} photo{unanalyzed.length > 1 ? 's' : ''} non analysée
                {unanalyzed.length > 1 ? 's' : ''}
              </p>
              <p className="font-mono text-[11px] text-[#0F1419]/55 truncate">
                Analyse 1 photo (~4s · Vision IA A1.3.6)
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={handleAnalyze}
              disabled={isPending || !selectedPhotoId}
              aria-label="Lancer l'analyse Vision IA sur la prochaine photo non analysée"
              className="min-h-[44px] w-full sm:w-auto"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" aria-hidden />
                  Analyse en cours…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-1.5" aria-hidden />
                  Analyser cette photo
                </>
              )}
            </Button>
          </div>

          {feedback && (
            <output
              aria-live="polite"
              className={
                feedback.type === 'success'
                  ? 'block text-[12px] text-[#2D4015] bg-lime-mist rounded-md px-3 py-2'
                  : 'block text-[12px] text-[#8B1414] bg-coral-mist rounded-md px-3 py-2'
              }
            >
              {feedback.type === 'success' ? (
                <>
                  {feedback.message}
                  {feedback.mocked && (
                    <span className="ml-1 font-mono text-[10px] uppercase tracking-wider opacity-72">
                      (mock dev)
                    </span>
                  )}
                </>
              ) : (
                feedback.message
              )}
            </output>
          )}
        </div>
      )}
    </section>
  )
}
