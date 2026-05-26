/**
 * KOVAS — Section "Détections Vision IA" (Lot B82 — Vague 3A).
 *
 * Expose l'algo A1.3.6 (`lib/algos/vision-equipment.ts`) dans la page de
 * validation mission. Affiche un résumé des équipements reconnus par
 * l'analyse Vision sur les photos déjà uploadées du dossier.
 *
 * Lecture des résultats : on consomme directement le champ `vision_analysis`
 * (JSON) + `vision_confidence` (0-1) déjà persistés sur `photos` par le
 * pipeline upload. Pas de re-trigger ici — la section est un shell de lecture
 * sobre.
 *
 * TODO B82+ : si besoin, ajouter un bouton "Analyser cette photo" qui
 * déclenche `analyzeEquipmentPhoto` côté server action. Pour l'instant la
 * priorité est l'exposition visible de ce qui existe déjà côté pipeline.
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'

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

export function VisionEquipmentSection({ photos }: VisionEquipmentSectionProps) {
  const detections = extractDetections(photos)

  return (
    <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-[#0F1419]/72" aria-hidden />
          <h2 className="text-sm font-semibold text-[#0F1419]">Détections Vision IA</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">A1.3.6</p>
      </header>

      {detections.length === 0 ? (
        <p className="text-[13px] text-[#0F1419]/72 leading-relaxed">
          Prends une photo de plaque signalétique (chaudière, VMC, compteur) — KOVAS la lit
          automatiquement et pré-remplit la fiche équipement.
        </p>
      ) : (
        <ul className="space-y-2">
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
              <Badge variant={confidenceVariant(d.confidence)}>
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
    </section>
  )
}
