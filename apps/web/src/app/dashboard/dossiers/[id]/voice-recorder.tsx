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
  dossierId: string
  orgId: string
  rooms: { id: string; name: string }[]
}

type Status = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'parsing' | 'error'

export function VoiceRecorder({ dossierId, orgId, rooms }: VoiceRecorderProps) {
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
      const storagePath = `${orgId}/${dossierId}/${filename}`

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
      fd.append('dossierId', dossierId)

      const resp = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await resp.json()

      // Stub mode (no API key) — save audio + minimal note
      if (resp.status === 503 && data.stub) {
        await createVoiceNoteAction({
          dossierId,
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
      let parsed = parseVoiceTranscript(data.transcript ?? '')
      let parserUsed = 'custom_js'
      let claudeCostEur = 0

      // Fallback Claude si confiance insuffisante (J6 hybride)
      if (parsed.confidence < VOICE_PARSER_THRESHOLD && (data.transcript ?? '').length > 20) {
        try {
          const claudeResp = await fetch('/api/structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: data.transcript, dossierId }),
          })
          if (claudeResp.ok) {
            const claudeData = await claudeResp.json()
            parsed = claudeData.structured
            parserUsed = 'custom_js_then_claude_haiku'
            claudeCostEur = claudeData.costEur ?? 0
          }
        } catch {
          // Fallback silencieux : on garde le parsing custom même si Claude échoue
        }
      }

      await createVoiceNoteAction({
        dossierId,
        roomId: selectedRoom,
        storagePath,
        durationSeconds: data.durationSeconds ?? rec.durationSeconds,
        transcriptRaw: data.transcript,
        transcriptStructured: parsed,
        provider: 'openai',
        parserUsed,
        aiCostEur: (data.costEur ?? 0) + claudeCostEur,
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

      <p className="text-xs text-ink-faint">
        Décrivez la pièce à voix haute. KOVAS transcrit + structure automatiquement.
      </p>
    </div>
  )
}
