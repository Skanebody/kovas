/**
 * Helper enregistrement audio via MediaRecorder.
 * Format préféré : audio/webm;codecs=opus (bon ratio qualité/taille pour la voix).
 * Fallback Safari iOS : audio/mp4.
 */

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

  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('MediaDevices API non supportée (HTTPS requis)')
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000, // optimal pour Whisper
      },
    })
    this.mimeType = pickMimeType()
    this.recorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined)
    this.chunks = []
    this.startTime = Date.now()

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.start(500) // collect chunks every 500ms
  }

  async stop(): Promise<AudioRecording> {
    if (!this.recorder) throw new Error('Recorder not started')

    return new Promise((resolve, reject) => {
      this.recorder!.onstop = () => {
        try {
          const finalMime = this.mimeType || this.recorder!.mimeType || 'audio/webm'
          const blob = new Blob(this.chunks, { type: finalMime })
          const durationSeconds = Math.round((Date.now() - this.startTime) / 1000)
          this.cleanup()
          resolve({ blob, mimeType: finalMime, durationSeconds })
        } catch (err) {
          reject(err)
        }
      }
      this.recorder!.stop()
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
