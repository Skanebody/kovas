'use client'

import { Loader2, Mic, MicOff, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { AudioRecorder } from '@/lib/audio-record'
import { createClient } from '@/lib/supabase/client'
import { parseVoiceTranscript, VOICE_PARSER_THRESHOLD } from '@/lib/voice-parser'
import { createVoiceNoteAction } from './actions'

interface VoiceRecorderProps {
  missionId: string
  orgId: string
  rooms: { id: string; name: string }[]
}

type Status = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'parsing' | 'error'

export function VoiceRecorder({ missionId, orgId, rooms }: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const recorderRef = useRef<AudioRecorder | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      recorderRef.current?.cancel()
    }
  }, [])

  async function start() {
    setError(null)
    try {
      const rec = new AudioRecorder()
      await rec.start()
      recorderRef.current = rec
      setStatus('recording')
      setDuration(0)
      tickRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer le micro')
      setStatus('error')
    }
  }

  async function stop() {
    if (!recorderRef.current) return
    try {
      const rec = await recorderRef.current.stop()
      recorderRef.current = null
      if (tickRef.current) clearInterval(tickRef.current)
      setStatus('uploading')

      // Upload audio to Storage
      const supabase = createClient()
      const ext = rec.mimeType.includes('mp4') ? 'mp4' : 'webm'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const storagePath = `${orgId}/${missionId}/${filename}`

      const { error: uploadErr } = await supabase.storage
        .from('voice-notes')
        .upload(storagePath, rec.blob, {
          contentType: rec.mimeType,
          cacheControl: '3600',
          upsert: false,
        })
      if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`)

      // Send to /api/transcribe
      setStatus('transcribing')
      const fd = new FormData()
      fd.append('audio', rec.blob, filename)
      fd.append('missionId', missionId)

      const resp = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await resp.json()

      // Stub mode (no API key) — save audio + minimal note
      if (resp.status === 503 && data.stub) {
        await createVoiceNoteAction({
          missionId,
          roomId: selectedRoom,
          storagePath,
          durationSeconds: rec.durationSeconds,
          transcriptRaw: '[Transcription désactivée : OPENAI_API_KEY manquante]',
          transcriptStructured: null,
          provider: 'stub',
          parserUsed: 'none',
          aiCostEur: 0,
          aiConfidence: 0,
        })
        setStatus('idle')
        return
      }

      if (!resp.ok) throw new Error(data.error ?? 'Erreur transcription')

      // Parse transcript localement
      setStatus('parsing')
      const parsed = parseVoiceTranscript(data.transcript ?? '')
      const usedClaude = parsed.confidence < VOICE_PARSER_THRESHOLD
      // V1 : on note la confiance, fallback Claude implémenté en J6

      await createVoiceNoteAction({
        missionId,
        roomId: selectedRoom,
        storagePath,
        durationSeconds: data.durationSeconds ?? rec.durationSeconds,
        transcriptRaw: data.transcript,
        transcriptStructured: parsed,
        provider: 'openai',
        parserUsed: usedClaude ? 'custom_js_then_claude_pending' : 'custom_js',
        aiCostEur: data.costEur,
        aiConfidence: parsed.confidence,
      })

      setStatus('idle')
      setDuration(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setStatus('error')
    }
  }

  function cancel() {
    recorderRef.current?.cancel()
    recorderRef.current = null
    if (tickRef.current) clearInterval(tickRef.current)
    setStatus('idle')
    setDuration(0)
  }

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-40">
          <Select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            disabled={status !== 'idle' && status !== 'error'}
          >
            <option value="">— Note libre (sans pièce) —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>

        {status === 'idle' || status === 'error' ? (
          <Button type="button" onClick={start}>
            <Mic className="size-4" /> Enregistrer
          </Button>
        ) : status === 'recording' ? (
          <>
            <span className="text-sm font-mono tabular-nums">{fmt(duration)}</span>
            <Button type="button" variant="outline" onClick={stop}>
              <Square className="size-4 fill-current" /> Stop
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={cancel} aria-label="Annuler">
              <MicOff className="size-4" />
            </Button>
          </>
        ) : (
          <Button type="button" disabled>
            <Loader2 className="size-4 animate-spin" />
            {status === 'uploading' && 'Upload…'}
            {status === 'transcribing' && 'Transcription…'}
            {status === 'parsing' && 'Analyse…'}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-accent-red" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-subtle-foreground">
        Décrivez la pièce à voix haute. KOVAS transcrit + structure automatiquement.
      </p>
    </div>
  )
}
