/**
 * Helper enregistrement audio via MediaRecorder.
 * Format préféré : audio/webm;codecs=opus (bon ratio qualité/taille pour la voix).
 * Fallback Safari iOS : audio/mp4.
 *
 * MISSION-E niveau 1 : les constraints micro sont centralisées dans
 * `lib/voice/recording-constraints.ts` (echoCancellation + noiseSuppression +
 * autoGainControl + sampleRate 16k + mono) avec fallback gracieux Safari iOS.
 */

import { getOptimalMicrophoneStream } from './voice/recording-constraints'

export interface AudioRecording {
  blob: Blob
  mimeType: string
  durationSeconds: number
}

const PREFERRED_MIMETYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const m of PREFERRED_MIMETYPES) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

export class AudioRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startTime = 0
  public mimeType = ''

  /**
   * Retourne le MediaStream actif (pour brancher un AnalyserNode / VU-mètre).
   * Null si l'enregistrement n'est pas démarré.
   */
  getStream(): MediaStream | null {
    return this.stream
  }

  async start(): Promise<void> {
    this.stream = await getOptimalMicrophoneStream()
    this.mimeType = pickMimeType()
    this.recorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    )
    this.chunks = []
    this.startTime = Date.now()

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    // Pas de timeslice : MediaRecorder.start() sans argument → un seul chunk
    // produit au stop, blob garanti valide (sinon les fragments WebM/MP4
    // intermédiaires ne forment pas un fichier complet — bug Safari + bug Chrome
    // avec certains codecs opus → <audio> renvoie NotSupportedError).
    this.recorder.start()
  }

  async stop(): Promise<AudioRecording> {
    const recorder = this.recorder
    if (!recorder) throw new Error('Recorder not started')

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        try {
          // Précision : durée mesurée avant cleanup pour précision max
          const durationSeconds = (Date.now() - this.startTime) / 1000
          const finalMime = this.mimeType || recorder.mimeType || 'audio/webm'
          const blob = new Blob(this.chunks, { type: finalMime })
          this.cleanup()
          // Garde-fou : blob vide = recording cassé (stop() trop rapide,
          // pas de permission micro, etc.) → reject explicite plutôt que
          // de retourner un blob illisible qui crashera <audio>.
          if (blob.size === 0) {
            reject(new Error('Empty audio blob — recording too short or no data captured'))
            return
          }
          resolve({ blob, mimeType: finalMime, durationSeconds })
        } catch (err) {
          reject(err)
        }
      }
      // requestData() force MediaRecorder à flush le buffer dans
      // ondataavailable AVANT que onstop ne tire. Sinon sur certains browsers
      // (Safari notamment), la dernière trame audio peut être perdue.
      try {
        if (recorder.state === 'recording') recorder.requestData()
      } catch {
        // requestData peut throw sur certains polyfills — non bloquant
      }
      recorder.stop()
    })
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop()
    }
    this.cleanup()
  }

  private cleanup(): void {
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop()
      this.stream = null
    }
    this.recorder = null
    this.chunks = []
  }
}
