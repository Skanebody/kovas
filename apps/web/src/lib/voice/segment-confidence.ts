/**
 * KOVAS — Mapping confiance Whisper verbose_json → catégorie UI.
 *
 * Whisper retourne par segment :
 *   - avg_logprob : log-probabilité moyenne (négatif, plus haut = mieux)
 *   - no_speech_prob : probabilité que ce segment soit du silence/bruit (0..1)
 *
 * Seuils calibrés empiriquement sur transcriptions FR diagnostiqueur terrain :
 *   - avg_logprob > -0.5            → reliable (haute confiance)
 *   - -0.8 < avg_logprob < -0.5     → doubtful (à vérifier)
 *   - avg_logprob < -0.8            → inaudible (rejeter / réécouter)
 *   - no_speech_prob > 0.6          → on jette le segment (silence/bruit)
 *
 * Authority : MISSION-E niveau 3 (Whisper confidence exposée).
 */

export type SegmentConfidence = 'reliable' | 'doubtful' | 'inaudible'

export interface RawWhisperSegment {
  id?: number
  start?: number
  end?: number
  text?: string
  avg_logprob?: number
  no_speech_prob?: number
}

export interface AnnotatedSegment {
  id: number
  text: string
  start: number
  end: number
  avgLogprob: number
  noSpeechProb: number
  confidence: SegmentConfidence
}

const RELIABLE_THRESHOLD = -0.5
const DOUBTFUL_THRESHOLD = -0.8
const NO_SPEECH_REJECT_THRESHOLD = 0.6

/** Classifie un segment Whisper en catégorie de confiance. */
export function classifySegment(avgLogprob: number, noSpeechProb: number): SegmentConfidence {
  if (noSpeechProb > NO_SPEECH_REJECT_THRESHOLD) return 'inaudible'
  if (avgLogprob >= RELIABLE_THRESHOLD) return 'reliable'
  if (avgLogprob >= DOUBTFUL_THRESHOLD) return 'doubtful'
  return 'inaudible'
}

/**
 * Normalise les segments verbose_json Whisper en AnnotatedSegment[].
 * Tolère les segments mal formés (valeurs manquantes traitées comme "doubtful").
 */
export function annotateSegments(raw: unknown): AnnotatedSegment[] {
  if (!Array.isArray(raw)) return []
  const out: AnnotatedSegment[] = []
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as RawWhisperSegment | null
    if (!s || typeof s !== 'object') continue
    const text = typeof s.text === 'string' ? s.text.trim() : ''
    if (text.length === 0) continue
    const avgLogprob = typeof s.avg_logprob === 'number' ? s.avg_logprob : -0.6
    const noSpeechProb = typeof s.no_speech_prob === 'number' ? s.no_speech_prob : 0
    // On filtre déjà les segments massivement "no speech" (gain bande passante)
    if (noSpeechProb > 0.9) continue
    out.push({
      id: typeof s.id === 'number' ? s.id : i,
      text,
      start: typeof s.start === 'number' ? s.start : 0,
      end: typeof s.end === 'number' ? s.end : 0,
      avgLogprob,
      noSpeechProb,
      confidence: classifySegment(avgLogprob, noSpeechProb),
    })
  }
  return out
}

/**
 * Construit le `fullText` en remplaçant les segments inaudibles par un marker.
 * Format : "Texte fiable. [inaudible — réécoutez] *texte douteux*."
 *
 * Utilisé côté serveur pour la persistence + pour passer à Claude (niveau 4).
 */
export function buildMarkedTranscript(segments: AnnotatedSegment[]): string {
  return segments
    .map((s) => {
      if (s.confidence === 'inaudible') return '[inaudible — réécoutez]'
      if (s.confidence === 'doubtful') return `*${s.text}*`
      return s.text
    })
    .join(' ')
    .trim()
}
