/**
 * Parser incrémental "live" : appelle le parser custom existant
 * (`parseVoiceTranscript`) à chaque chunk reçu, déduplique les extractions
 * déjà connues, et expose une stream de "chips" (= cards d'info détectée).
 *
 * Stratégie : pas de delta-parsing fancy. On reparse l'intégralité du
 * transcript accumulé à chaque ingest (le parser custom est très rapide,
 * pure regex, ~µs par appel). On diff sur le state local pour ne retourner
 * que les NOUVEAUX chips à afficher en UI.
 *
 * Cf. `apps/web/src/lib/voice-parser.ts` pour la spec des extractions.
 */

import { type VoiceParsedData, parseVoiceTranscript } from '@/lib/voice-parser'

export type LiveChip =
  | { kind: 'surface'; value: number; raw: string }
  | { kind: 'year'; value: number; raw: string }
  | { kind: 'ceiling'; value: number; raw: string }
  | {
      kind: 'equipment'
      equipment: VoiceParsedData['equipment'][number]
      raw: string
    }
  | { kind: 'observation'; text: string }

/**
 * Clé de déduplication pour un équipement : on combine kind + brand + notes
 * (les notes contiennent par ex. "double vitrage" pour fenetre, "laine de verre" pour iso).
 */
function equipmentKey(eq: VoiceParsedData['equipment'][number]): string {
  return `${eq.kind}::${eq.brand ?? ''}::${eq.notes ?? ''}`
}

export class LiveParserSession {
  private chips: LiveChip[] = []
  private fullTranscript = ''
  private seenSurface: number | null = null
  private seenYear: number | null = null
  private seenCeiling: number | null = null
  private seenEquipment = new Set<string>()
  private seenObservations = new Set<string>()

  /**
   * Ingère un nouveau chunk de transcript (peut être tout le final accumulé
   * — la classe gère elle-même la déduplication).
   *
   * Retourne uniquement les chips NOUVEAUX (jamais vus précédemment).
   */
  ingest(fullFinalText: string): LiveChip[] {
    this.fullTranscript = fullFinalText
    const parsed = parseVoiceTranscript(this.fullTranscript)
    const newChips = this.diff(parsed)
    this.chips.push(...newChips)
    return newChips
  }

  /** Retourne l'état complet pour le dispatch final. */
  finalize(): {
    transcript: string
    chips: LiveChip[]
    parsed: VoiceParsedData
  } {
    const parsed = parseVoiceTranscript(this.fullTranscript)
    return {
      transcript: this.fullTranscript.trim(),
      chips: [...this.chips],
      parsed,
    }
  }

  /** Reset — utile quand on change de pièce active sans démonter le composant. */
  reset(): void {
    this.chips = []
    this.fullTranscript = ''
    this.seenSurface = null
    this.seenYear = null
    this.seenCeiling = null
    this.seenEquipment.clear()
    this.seenObservations.clear()
  }

  /**
   * Diff entre les extractions courantes et l'état "déjà vu".
   * Marque les nouveaux comme vus AVANT de retourner pour éviter doubles
   * insertions si appelé en série sur le même chunk.
   */
  private diff(parsed: VoiceParsedData): LiveChip[] {
    const out: LiveChip[] = []

    if (typeof parsed.surface_m2 === 'number' && parsed.surface_m2 !== this.seenSurface) {
      this.seenSurface = parsed.surface_m2
      out.push({
        kind: 'surface',
        value: parsed.surface_m2,
        raw: `${parsed.surface_m2} m²`,
      })
    }

    if (typeof parsed.year_built === 'number' && parsed.year_built !== this.seenYear) {
      this.seenYear = parsed.year_built
      out.push({
        kind: 'year',
        value: parsed.year_built,
        raw: `${parsed.year_built}`,
      })
    }

    if (
      typeof parsed.ceiling_height_m === 'number' &&
      parsed.ceiling_height_m !== this.seenCeiling
    ) {
      this.seenCeiling = parsed.ceiling_height_m
      out.push({
        kind: 'ceiling',
        value: parsed.ceiling_height_m,
        raw: `${parsed.ceiling_height_m} m`,
      })
    }

    for (const eq of parsed.equipment) {
      const key = equipmentKey(eq)
      if (this.seenEquipment.has(key)) continue
      this.seenEquipment.add(key)
      const label = eq.brand
        ? `${eq.kind} ${eq.brand}`
        : eq.notes
          ? `${eq.kind} ${eq.notes}`
          : eq.kind
      out.push({ kind: 'equipment', equipment: eq, raw: label })
    }

    for (const obs of parsed.observations) {
      const key = obs.toLowerCase().trim()
      if (this.seenObservations.has(key)) continue
      this.seenObservations.add(key)
      out.push({ kind: 'observation', text: obs })
    }

    return out
  }
}
