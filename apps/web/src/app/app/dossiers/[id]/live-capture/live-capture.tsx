'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import type { VoiceParsedData } from '@/lib/voice-parser'
import {
  type DispatchConflict,
  type DispatchContext,
  type DispatchPlan,
  planDispatch,
} from '@/lib/voice/dispatch-target'
import { type LiveChip, LiveParserSession } from '@/lib/voice/live-parser'
import {
  type SpeechRecognitionController,
  createSpeechRecognition,
  isWebSpeechSupported,
} from '@/lib/voice/speech-recognition'
import { AlertTriangle, Check, Mic, MicOff, PenLine, Send, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyVoiceDispatchAction } from '../voice-dispatch-action'

interface LiveCaptureProps {
  dossierId: string
  property: {
    surface_total: number | null
    year_built: number | null
    floor_number: number | null
    building_letter: string | null
    apartment_detail: string | null
    lot_number: string | null
  } | null
  rooms: { id: string; name: string }[]
  missions: { id: string; type: string; reference: string }[]
}

type Mode = 'voice' | 'text'
type Status = 'idle' | 'recording' | 'stopped' | 'dispatching' | 'done'

interface ChipState {
  chip: LiveChip
  /** Index unique pour le toggle UI */
  id: string
  /** Inclus dans le dispatch ? (toggle utilisateur) */
  enabled: boolean
}

/**
 * Hook debounce maison ~5 lignes (pas de lodash dans le projet).
 */
function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fn(...args), delay)
    },
    [fn, delay],
  )
}

function formatChipLabel(chip: LiveChip): string {
  switch (chip.kind) {
    case 'surface':
      return `Surface ${chip.value} m²`
    case 'year':
      return `Année ${chip.value}`
    case 'ceiling':
      return `Hauteur ${chip.value} m`
    case 'equipment': {
      const parts: string[] = [chip.equipment.kind.replace(/_/g, ' ')]
      if (chip.equipment.brand) parts.push(chip.equipment.brand)
      if (chip.equipment.notes) parts.push(chip.equipment.notes)
      return parts.join(' · ')
    }
    case 'observation':
      return chip.text.length > 60 ? `${chip.text.slice(0, 57)}…` : chip.text
  }
}

function formatDuration(s: number): string {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(1, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

export function LiveCapture({ dossierId, property, rooms, missions }: LiveCaptureProps) {
  const [mode, setMode] = useState<Mode>('voice')
  const [status, setStatus] = useState<Status>('idle')
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const [textareaValue, setTextareaValue] = useState('')
  const [chips, setChips] = useState<ChipState[]>([])
  const [conflicts, setConflicts] = useState<DispatchConflict[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string>('')
  const [activeMissionId, setActiveMissionId] = useState<string>('')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const supported = useMemo(() => isWebSpeechSupported(), [])
  const sessionRef = useRef<LiveParserSession>(new LiveParserSession())
  const controllerRef = useRef<SpeechRecognitionController | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null)
  const chipIdRef = useRef(0)

  // Cleanup à l'unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  // Auto-scroll du transcript live
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight
    }
  }, [])

  const addChipsFromParse = useCallback((newChips: LiveChip[]) => {
    if (newChips.length === 0) return
    setChips((prev) => [
      ...prev,
      ...newChips.map((chip) => {
        chipIdRef.current += 1
        return { chip, id: `chip-${chipIdRef.current}`, enabled: true }
      }),
    ])
  }, [])

  // ============ Mode VOIX (Web Speech API) ============
  const startVoice = useCallback(() => {
    setError(null)
    setInterim('')
    setFinalText('')
    setChips([])
    setConflicts([])
    setDuration(0)
    sessionRef.current.reset()

    const controller = createSpeechRecognition({
      lang: 'fr-FR',
      continuous: true,
      interimResults: true,
      onResult: ({ interim: interimText, final }) => {
        setInterim(interimText)
        setFinalText(final)
        const newChips = sessionRef.current.ingest(final)
        addChipsFromParse(newChips)
      },
      onError: (err) => {
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setError('Microphone non autorisé. Vérifiez les permissions du navigateur.')
        } else if (err === 'network') {
          setError('Erreur réseau (la reconnaissance vocale Chrome utilise un cloud).')
        } else {
          setError(`Erreur reconnaissance : ${err}`)
        }
        setStatus('stopped')
      },
      onEnd: () => {
        // Geré par les transitions explicites (stop user)
      },
    })

    controllerRef.current = controller
    if (!controller.isSupported) {
      setError('Web Speech API non supportée — utilisez le mode texte ou la note vocale différée.')
      return
    }

    controller.start()
    setStatus('recording')
    tickRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
  }, [addChipsFromParse])

  const stopVoice = useCallback(() => {
    controllerRef.current?.stop()
    controllerRef.current = null
    if (tickRef.current) clearInterval(tickRef.current)
    setStatus('stopped')
  }, [])

  const abortVoice = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    if (tickRef.current) clearInterval(tickRef.current)
    sessionRef.current.reset()
    setStatus('idle')
    setInterim('')
    setFinalText('')
    setChips([])
    setConflicts([])
    setDuration(0)
  }, [])

  // ============ Mode TEXTE (textarea + debounce parser) ============
  const parseText = useCallback(
    (value: string) => {
      sessionRef.current.reset()
      const newChips = sessionRef.current.ingest(value)
      setChips([])
      chipIdRef.current = 0
      addChipsFromParse(newChips)
      setFinalText(value)
    },
    [addChipsFromParse],
  )

  const debouncedParseText = useDebouncedCallback(parseText, 500)

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setTextareaValue(value)
    debouncedParseText(value)
    if (status === 'idle' && value.length > 0) setStatus('stopped')
  }

  // ============ Toggle inclusion d'un chip ============
  function toggleChip(id: string) {
    setChips((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)))
  }

  // ============ Calcul du plan (mémoïsé) ============
  const enabledChips = chips.filter((c) => c.enabled)

  const computedPlan = useMemo<DispatchPlan>(() => {
    if (enabledChips.length === 0) return { actions: [], conflicts: [] }

    // Reconstruit un VoiceParsedData partiel à partir des chips activés
    const filtered: VoiceParsedData = {
      equipment: [],
      observations: [],
      raw_keywords: [],
      confidence: 0,
    }
    for (const { chip } of enabledChips) {
      switch (chip.kind) {
        case 'surface':
          filtered.surface_m2 = chip.value
          break
        case 'year':
          filtered.year_built = chip.value
          break
        case 'ceiling':
          filtered.ceiling_height_m = chip.value
          break
        case 'equipment':
          filtered.equipment.push(chip.equipment)
          break
        case 'observation':
          filtered.observations.push(chip.text)
          break
      }
    }

    const context: DispatchContext = {
      property: property ?? {
        surface_total: null,
        year_built: null,
        floor_number: null,
        building_letter: null,
        apartment_detail: null,
        lot_number: null,
      },
      activeRoomId: activeRoomId || null,
      activeMissionId: activeMissionId || null,
    }

    return planDispatch(filtered, context)
    // conflicts est dérivé séparément (state local pour conserver les resolutions)
  }, [enabledChips, property, activeRoomId, activeMissionId])

  // Sync conflicts state à chaque recalcul du plan
  useEffect(() => {
    setConflicts((prev) => {
      // Conserve les résolutions déjà choisies pour les conflits qui existent encore
      const byField = new Map(prev.map((c) => [c.field, c.resolution]))
      return computedPlan.conflicts.map((c) => ({
        ...c,
        resolution: byField.get(c.field) ?? null,
      }))
    })
  }, [computedPlan])

  function resolveConflict(field: string, resolution: 'keep' | 'overwrite') {
    setConflicts((prev) => prev.map((c) => (c.field === field ? { ...c, resolution } : c)))
  }

  const totalToApply =
    computedPlan.actions.length + conflicts.filter((c) => c.resolution === 'overwrite').length

  // ============ Apply / dispatch ============
  async function handleApply() {
    if (totalToApply === 0) {
      toast.error('Aucune information à appliquer — sélectionnez au moins un élément détecté.')
      return
    }
    setStatus('dispatching')
    try {
      const res = await applyVoiceDispatchAction(dossierId, {
        actions: computedPlan.actions,
        conflicts,
      })
      if (res.error) {
        toast.error(`Erreur : ${res.error}`)
        setStatus('stopped')
        return
      }
      toast.success(
        `${res.applied} ${res.applied === 1 ? 'information appliquée' : 'informations appliquées'}.`,
      )
      // Reset complet
      abortVoice()
      setTextareaValue('')
      setStatus('done')
      setTimeout(() => setStatus('idle'), 800)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors du dispatch')
      setStatus('stopped')
    }
  }

  // ============ Render ============
  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Saisie terrain · LIVE
        </p>
        <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-ink leading-tight">
          Captez la voix, on remplit les cases.
        </h2>
      </header>

      {/* Toggle mode + select pièce + select mission */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 md:gap-3">
        <div className="col-span-2 md:col-span-1 flex items-center gap-1 rounded-pill border border-rule bg-paper/85 p-1">
          <button
            type="button"
            onClick={() => setMode('voice')}
            className={cn(
              'flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-all',
              mode === 'voice'
                ? 'bg-chartreuse text-ink shadow-sm'
                : 'text-ink-mute hover:text-ink',
            )}
            disabled={status === 'recording'}
          >
            <Mic className="size-3.5" /> Voix
          </button>
          <button
            type="button"
            onClick={() => {
              if (status === 'recording') abortVoice()
              setMode('text')
            }}
            className={cn(
              'flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-all',
              mode === 'text' ? 'bg-chartreuse text-ink shadow-sm' : 'text-ink-mute hover:text-ink',
            )}
          >
            <PenLine className="size-3.5" /> Texte
          </button>
        </div>

        <Select
          value={activeRoomId}
          onChange={(e) => setActiveRoomId(e.target.value)}
          className="text-[12px]"
        >
          <option value="">— Aucune pièce ciblée —</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>

        <Select
          value={activeMissionId}
          onChange={(e) => setActiveMissionId(e.target.value)}
          className="text-[12px]"
        >
          <option value="">— Aucun diag ciblé —</option>
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.reference} · {m.type}
            </option>
          ))}
        </Select>
      </div>

      {/* Banner support */}
      {mode === 'voice' && !supported && (
        <div className="rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 text-[12px] text-ink-soft">
          Saisie vocale différée — votre navigateur ne supporte pas la transcription live. Utilisez
          le mode <strong>Texte</strong> ou la note vocale (record-then-upload) ci-dessous.
        </div>
      )}

      {/* Zone enregistrement / texte */}
      {mode === 'voice' ? (
        <div className="space-y-3">
          {/* Contrôles enregistrement */}
          <div className="flex items-center gap-3">
            {status === 'recording' ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-pill bg-accent-red/10 px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.1em] text-accent-red">
                  <span className="size-2 rounded-full bg-accent-red animate-pulse" />
                  REC {formatDuration(duration)}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={stopVoice}>
                  <MicOff className="size-3.5" /> Stop
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={abortVoice}
                  aria-label="Annuler"
                >
                  <X className="size-3.5" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="accent"
                onClick={startVoice}
                disabled={!supported || status === 'dispatching'}
              >
                <Mic className="size-4" />
                {status === 'idle' ? 'Démarrer la saisie vocale' : 'Reprendre'}
              </Button>
            )}
          </div>

          {/* Transcript live */}
          <div
            ref={transcriptScrollRef}
            className={cn(
              'min-h-[120px] max-h-[220px] overflow-y-auto rounded-lg border border-rule bg-paper/60 p-3 text-[14px] leading-relaxed',
              status === 'recording' && 'border-accent-red/40',
            )}
          >
            {finalText && <span className="text-ink whitespace-pre-wrap">{finalText} </span>}
            {interim && <span className="text-ink-mute italic whitespace-pre-wrap">{interim}</span>}
            {!finalText && !interim && (
              <p className="text-ink-faint italic">
                Parlez à voix haute : « Salon de 28 m², double vitrage PVC, chaudière Saunier Duval
                2019… »
              </p>
            )}
          </div>
        </div>
      ) : (
        <Textarea
          value={textareaValue}
          onChange={handleTextChange}
          rows={5}
          placeholder="Tapez ou collez votre description… Ex : Maison de 95 m² construite en 1985, PAC Daikin, double vitrage PVC, VMC simple flux."
          className="text-[14px]"
        />
      )}

      {/* Chips détectés */}
      {chips.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5">
            <Check className="size-3.5" /> Captées par l'IA · {enabledChips.length}/{chips.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {chips.map(({ chip, id, enabled }) => {
              const isConflict = conflicts.some(
                (c) =>
                  (chip.kind === 'surface' && c.field === 'property.surface_total') ||
                  (chip.kind === 'year' && c.field === 'property.year_built'),
              )
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleChip(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-all animate-in fade-in slide-in-from-bottom-2 duration-300',
                    enabled
                      ? isConflict
                        ? 'border-amber/60 bg-amber/10 text-ink'
                        : 'border-chartreuse-deep/60 bg-chartreuse/30 text-ink'
                      : 'border-rule bg-paper/60 text-ink-mute opacity-60',
                  )}
                >
                  {isConflict && <AlertTriangle className="size-3.5 text-amber" />}
                  {!isConflict && enabled && <Check className="size-3.5" />}
                  {formatChipLabel(chip)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Conflits — résolution inline */}
      {conflicts.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-amber flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" /> Conflits ({conflicts.length})
          </p>
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div
                key={c.field}
                className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-[12px] space-y-2"
              >
                <p className="text-ink-soft">
                  <strong className="font-medium text-ink">{c.field}</strong> : existant{' '}
                  <span className="font-mono">{c.existing}</span> ≠ détecté{' '}
                  <span className="font-mono text-amber">{c.suggested}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={c.resolution === 'keep' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => resolveConflict(c.field, 'keep')}
                  >
                    Garder {c.existing}
                  </Button>
                  <Button
                    type="button"
                    variant={c.resolution === 'overwrite' ? 'accent' : 'outline'}
                    size="sm"
                    onClick={() => resolveConflict(c.field, 'overwrite')}
                  >
                    Écraser → {c.suggested}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <p className="text-sm text-accent-red" role="alert">
          {error}
        </p>
      )}

      {/* CTA Stop & apply */}
      {(status === 'recording' || status === 'stopped' || chips.length > 0) && (
        <Button
          type="button"
          variant="accent"
          size="lg"
          onClick={async () => {
            if (status === 'recording') stopVoice()
            await handleApply()
          }}
          disabled={status === 'dispatching' || totalToApply === 0}
          className="w-full md:w-auto"
        >
          <Send className="size-4" />
          {status === 'dispatching'
            ? 'Application en cours…'
            : totalToApply === 0
              ? 'Aucune info à appliquer'
              : `Stop et appliquer ${totalToApply} ${totalToApply === 1 ? 'info' : 'infos'}`}
        </Button>
      )}
    </Card>
  )
}
