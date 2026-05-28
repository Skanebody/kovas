/**
 * KOVAS — Hook `useVoiceCapture` pour le mode mission tchat.
 *
 * Regroupe TOUTE la logique de capture vocale terrain :
 *  - AudioRecorder (MediaRecorder + getUserMedia stream micro)
 *  - Web Speech API (transcript live FR via SpeechRecognitionController)
 *  - VU-mètre / meter stream partagé pour l'animation pendant l'enregistrement
 *  - Lifecycle `startListening` / `commitVoiceMessage` / `cancelVoiceMessage`
 *  - Cache `voiceBlobs` / `voiceLocalUrls` pour éviter le GC précoce de la
 *    blob entre la bulle optimiste et le retour Whisper / signed URL.
 *  - Transcription HTTP POST `/api/transcribe` avec AbortController 30s
 *  - Forward d'envoi vers Claude via le `sendMessageRef` fourni en prop
 *
 * NB importants conservés depuis l'audit grandeur nature (commits c1aebdd /
 * 07b6ea2 / 0d22898) :
 *  - `useLayoutEffect` pour synchroniser `sendMessageRef` est consommé côté
 *    composant principal (le hook se contente de READ la ref ; il ne sette
 *    pas la ref).
 *  - `audioRecorderRef.current = null` n'est exécuté qu'APRÈS `await stop()`
 *    pour éviter qu'un re-tap micro crée un 2e MediaRecorder simultané.
 *  - `releaseLocalBlob` revoke proprement les objectURL avant suppression.
 *
 * Authority : CLAUDE.md §3 features 1 + extrait de mission-tchat-interface.tsx.
 */

import type { RecordingMode } from '@/components/voice/RecordingOverlay'
import { AudioRecorder } from '@/lib/audio-record'
import {
  type SpeechRecognitionController,
  createSpeechRecognition,
} from '@/lib/voice/speech-recognition'
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

// -----------------------------------------------------------------------------
// Types partagés du mode mission tchat
// -----------------------------------------------------------------------------

/** Segment Whisper annoté retourné par /api/transcribe (anti-bruit MISSION-E). */
export interface ChatVoiceSegment {
  id: number
  text: string
  start: number
  end: number
  confidence: 'reliable' | 'doubtful' | 'inaudible'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  /** Si la réponse user a été transcrite via Web Speech API. */
  isVoice?: boolean
  /** ObjectURL local OU signed URL Supabase du blob audio (message vocal style WhatsApp). */
  audioUrl?: string
  /** Durée du blob audio en secondes (affiché dans le mini-player). */
  audioDuration?: number
  /** Photo URL temporaire (objectURL) si message est une photo. */
  photoUrl?: string
  /** UUID local Dexie (MISSION-B) — sert à mapper le status de sync. */
  photoLocalId?: string
  /** Pièce auto-associée à la photo (sidebar active au moment du tap). */
  photoRoomName?: string | null
  /** Indique si ce message assistant est encore en cours de streaming. */
  streaming?: boolean
  /** Vrai pendant l'upload + transcription Whisper d'un message vocal. */
  isTranscribing?: boolean
  /** Chemin Storage Supabase du blob audio (cleanup éventuel). */
  audioStoragePath?: string | null
  /** Segments Whisper annotés (rendu TranscriptSegments avec inaudible/douteux). */
  audioSegments?: ChatVoiceSegment[]
}

// -----------------------------------------------------------------------------
// Hook signature
// -----------------------------------------------------------------------------

/** Signature du callback `sendMessage` côté composant principal. */
export type SendMessageFn = (text: string, opts?: { suppressUserBubble?: boolean }) => Promise<void>

export interface UseVoiceCaptureProps {
  dossierId: string
  /** Organisation id (réservé, utile pour télémétrie future). Non lu en V1. */
  orgId: string
  /** Pièce active dans la sidebar (réservé, utile pour télémétrie future). */
  roomId?: string | null
  sessionId: string
  /** Forward-ref vers `sendMessage` du composant — appelé après transcription. */
  sendMessageRef: RefObject<SendMessageFn | null>
  /** Setter messages — utilisé pour la bulle optimiste + swap post-Whisper. */
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  /** Reporter d'erreur — affiché dans la zone messages. */
  setErrorMsg: (s: string | null) => void
  /** Setter input textarea — vidé à start/commit/cancel + alimenté par le transcript live. */
  setInput: Dispatch<SetStateAction<string>>
  /**
   * Lecture courante du textarea — utilisée en fallback si la ref transcript
   * Web Speech est vide au moment du commit (cas où l'utilisateur a tapé
   * manuellement pendant un record sans transcript live). Doit être une
   * fonction stable (lit via closure / useRef côté composant).
   */
  getInput: () => string
}

export interface UseVoiceCaptureReturn {
  /** Vrai pendant tout l'enregistrement (entre startListening et commit/cancel). */
  isListening: boolean
  /** Mode courant du bouton vocal (idle | tap-toggle | press-hold | press-hold-cancel). */
  voiceMode: RecordingMode
  /** Setter du mode (piloté par VoiceMessageButton `onModeChange`). */
  setVoiceMode: Dispatch<SetStateAction<RecordingMode>>
  /** Timestamp ms du démarrage record (passé à RecordingOverlay pour le timer). */
  voiceStartedAt: number
  /**
   * Stream micro partagé (MediaStream brut) — passé à RecordingOverlay qui
   * calcule lui-même le niveau via Web Audio API. Le briefing évoquait
   * `voiceLevel: number` ; on expose `meterStream` car le RecordingOverlay
   * existant attend bien un MediaStream et calcule le VU-mètre en interne.
   */
  meterStream: MediaStream | null
  /** Démarre dictée + record (MediaRecorder + Web Speech API parallèle). */
  startListening: () => void
  /** Commit : stop, upload Whisper, met à jour la bulle, envoie à Claude. */
  commitVoiceMessage: () => Promise<void>
  /** Cancel : drop tout l'enregistrement et le transcript. */
  cancelVoiceMessage: () => void
  /** Getter (lecture seule) du cache blobs — exposé pour interop éventuelle. */
  getVoiceBlobs: () => Map<string, Blob>
  /** Revoke l'objectURL local + drop la blob d'un messageId donné. */
  releaseLocalBlob: (messageId: string) => void
}

// -----------------------------------------------------------------------------
// useVoiceCapture
// -----------------------------------------------------------------------------

export function useVoiceCapture(props: UseVoiceCaptureProps): UseVoiceCaptureReturn {
  const { dossierId, sessionId, sendMessageRef, setMessages, setErrorMsg, setInput, getInput } =
    props

  // MISSION-E niveau 2 : stream parallèle pour le VU-mètre (anti-bruit)
  // pendant la dictée Web Speech API (qui ne nous donne pas accès au stream micro).
  // FIX-WA (composer WhatsApp) : ce même stream est partagé avec un AudioRecorder
  // qui capture le blob audio pour produire une bulle "message vocal" style WhatsApp.
  const meterStreamRef = useRef<MediaStream | null>(null)
  const [meterStream, setMeterStream] = useState<MediaStream | null>(null)
  // Audio recorder parallèle (MediaRecorder) — capture le blob pour la bulle audio.
  // La transcription reste pilotée par Web Speech API (live) ; le blob sert UNIQUEMENT
  // à l'affichage de la bulle vocal-style WhatsApp.
  const audioRecorderRef = useRef<AudioRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionController | null>(null)
  // Mode courant du bouton vocal (piloté par VoiceMessageButton + RecordingOverlay)
  const [voiceMode, setVoiceMode] = useState<RecordingMode>('idle')
  // Timestamp ms du démarrage enregistrement (passé au RecordingOverlay pour le timer)
  const [voiceStartedAt, setVoiceStartedAt] = useState<number>(0)
  // Buffer du transcript final accumulé pendant le record (Web Speech onResult)
  // Utilisé au commit pour créer le ChatMessage avec content = transcript.
  const voiceTranscriptRef = useRef<string>('')
  // Map messageId → Blob audio des messages vocaux envoyés. Évite le GC précoce
  // de la blob locale entre la création optimiste de la bulle et le retour
  // Whisper. Libéré dès qu'une signed URL Supabase remplace l'objectURL local.
  const voiceBlobsRef = useRef<Map<string, Blob>>(new Map())
  // Map messageId → objectURL local (pour revokeObjectURL au moment du swap).
  const voiceLocalUrlsRef = useRef<Map<string, string>>(new Map())
  // True tant que le composant est monté — testé avant tout setState async
  // (post-Whisper, post-getUserMedia) pour éviter les "state update on unmounted
  // component" + leaks quand le diagnostiqueur quitte la mission en plein vol.
  const mountedRef = useRef<boolean>(true)
  // AbortController du POST /api/transcribe en cours — abort au unmount/cancel
  // pour ne pas laisser le fetch Whisper tourner après départ de la page.
  const whisperAbortRef = useRef<AbortController | null>(null)

  const [isListening, setIsListening] = useState<boolean>(false)

  // ----- Speech Recognition + AudioRecorder + VU-mètre anti-bruit -----
  // FIX-WA : le micro stream est ouvert UNE SEULE FOIS via l'AudioRecorder, et
  // partagé avec le VU-mètre. Le transcript live arrive par Web Speech API en
  // parallèle. Au commit on dispose de blob+transcript pour la bulle vocale.
  const stopMeterStream = useCallback((): void => {
    if (meterStreamRef.current) {
      for (const t of meterStreamRef.current.getTracks()) t.stop()
      meterStreamRef.current = null
    }
    setMeterStream(null)
  }, [])

  /**
   * Démarre dictée vocale : MediaRecorder (pour blob audio) + Web Speech API (pour transcript live).
   * Le stream micro est ouvert via AudioRecorder.start() puis exposé au VU-mètre.
   */
  const startListening = useCallback(() => {
    // GARDE ANTI-RÉENTRÉE (fix bug terrain "le 2e tap relance un nouvel audio") :
    // si un AudioRecorder est déjà actif, on NE relance PAS. Sans cette garde,
    // un 2e tap mal détecté créerait un 2e MediaRecorder + getUserMedia simultané
    // = double enregistrement (et le 1er est orphelin, micro jamais relâché).
    if (audioRecorderRef.current) return

    if (recognitionRef.current) recognitionRef.current.abort()
    voiceTranscriptRef.current = ''
    setInput('')

    // OPTIMISTIC STATE (fix racine du bug toggle) : on bascule en listening
    // IMMÉDIATEMENT, de façon synchrone, AVANT la résolution async de
    // getUserMedia. Auparavant `setIsListening(true)` était dans le `.then()`,
    // donc au pointerup du 1er tap le bouton lisait encore isRecording=false
    // (périmé) → handlePointerUp faisait un return anticipé → ne passait jamais
    // en tap-toggle → le tap suivant relançait un nouvel enregistrement.
    // En settant l'état tout de suite, le re-render arrive avant le pointerup.
    setIsListening(true)
    setVoiceStartedAt(Date.now())

    const ctrl = createSpeechRecognition({
      lang: 'fr-FR',
      continuous: true, // on garde ouvert tant que le user maintient le doigt OU re-tap
      interimResults: true,
      onResult: ({ interim, final }) => {
        voiceTranscriptRef.current = final.length > 0 ? final : interim
        setInput(voiceTranscriptRef.current)
      },
      onError: (err) => {
        // Erreurs FATALES (cleanup complet) :
        //  - not-allowed       : permission micro refusée
        //  - audio-capture     : micro indisponible/réquisitionné (appel entrant,
        //    autre app a pris le micro) → le MediaRecorder est probablement mort
        //    aussi ; sans cleanup, isListening resterait bloqué à true et l'overlay
        //    figé (bug terrain P0-3).
        //  - service-not-allowed : service de reconnaissance bloqué
        if (err === 'not-allowed' || err === 'audio-capture' || err === 'service-not-allowed') {
          setErrorMsg(
            err === 'audio-capture'
              ? 'Le micro est devenu indisponible (appel en cours ?). Enregistrement interrompu.'
              : "Autorisez l'accès au micro dans les réglages du navigateur pour la dictée.",
          )
          setIsListening(false)
          setVoiceStartedAt(0)
          stopMeterStream()
          if (audioRecorderRef.current) {
            audioRecorderRef.current.cancel()
            audioRecorderRef.current = null
          }
          setVoiceMode('idle')
        }
        // Pour les autres erreurs (no-speech, network), on laisse le record continuer
        // (le blob + Whisper serveur prennent le relais).
      },
      onEnd: () => {
        // Web Speech se ferme tout seul après silence — on NE coupe PAS le record.
        // Le user contrôle l'arrêt via le bouton (tap-toggle OU release press-hold).
      },
    })

    // Démarre l'AudioRecorder D'ABORD (lui ouvre le getUserMedia) puis le speech.
    // NB : le blob audio + Whisper serveur suffisent à transcrire même si Web
    // Speech n'est pas supporté (Safari/iOS) — on ne bloque donc PAS le record
    // sur ctrl.isSupported, on dégrade juste le transcript live.
    const recorder = new AudioRecorder()
    audioRecorderRef.current = recorder
    void recorder
      .start()
      .then(() => {
        // Composant démonté pendant getUserMedia (départ mission) → on coupe
        // immédiatement le micro qui vient de s'ouvrir (sinon micro zombie).
        if (!mountedRef.current) {
          recorder.cancel()
          audioRecorderRef.current = null
          return
        }
        const stream = recorder.getStream()
        if (stream) {
          meterStreamRef.current = stream
          setMeterStream(stream)
        }
        // Démarre Web Speech API (si supporté) après l'ouverture du micro pour
        // éviter le double-prompt permission. Sinon : blob seul + Whisper.
        if (ctrl.isSupported) {
          try {
            ctrl.start()
            recognitionRef.current = ctrl
          } catch {
            /* InvalidState — on continue avec juste le blob (sans live transcript) */
          }
        }
        // setIsListening / setVoiceStartedAt déjà faits de façon optimistic.
      })
      .catch(() => {
        setErrorMsg("Impossible d'accéder au micro. Vérifiez les autorisations du navigateur.")
        audioRecorderRef.current = null
        // Rollback de l'optimistic state puisque le micro n'a pas pu démarrer.
        setIsListening(false)
        setVoiceStartedAt(0)
        setVoiceMode('idle')
      })
  }, [stopMeterStream, setInput, setErrorMsg])

  /**
   * Revoke l'objectURL local + drop la blob du cache pour un messageId donné.
   * Exposé publiquement : utilisé après swap vers une signed URL Supabase.
   */
  const releaseLocalBlob = useCallback((messageId: string): void => {
    const url = voiceLocalUrlsRef.current.get(messageId)
    if (url) {
      URL.revokeObjectURL(url)
      voiceLocalUrlsRef.current.delete(messageId)
    }
    voiceBlobsRef.current.delete(messageId)
  }, [])

  /**
   * COMMIT : l'utilisateur a relâché (press-hold) OU tap sur stop (tap-toggle).
   *
   * Flow :
   *  1. Crée immédiatement une bulle USER optimiste avec objectURL local +
   *     `isTranscribing=true` (placeholder "Transcription en cours…").
   *  2. La blob est conservée dans `voiceBlobsRef` pour empêcher le GC pendant
   *     l'upload (sinon l'objectURL devient injouable au re-render).
   *  3. En arrière-plan, POST /api/transcribe (upload Storage + Whisper verbose_json) :
   *      - Succès : la bulle est mise à jour avec la signed URL persistante +
   *        markedText + segments, puis envoyée à l'IA Claude.
   *      - Échec/offline : on garde la blob locale + fallback Web Speech.
   *  4. Cas edge : audio < 1s → skip Whisper (cost gating), juste la bulle audio.
   */
  const commitVoiceMessage = useCallback(async (): Promise<void> => {
    if (recognitionRef.current) recognitionRef.current.stop()

    // ATTENTION (cf. audit P0-6) : on NE doit PAS null la ref avant l'await stop()
    // sinon un re-tap micro pendant le settle peut créer un 2e recorder + getUserMedia
    // simultané (Chrome reject) + corruption blob. On nullifie SEULEMENT après stop().
    const recorder = audioRecorderRef.current
    const webSpeechTranscript = (voiceTranscriptRef.current || getInput()).trim()
    voiceTranscriptRef.current = ''

    setIsListening(false)
    setVoiceMode('idle')
    setInput('')
    stopMeterStream()

    if (!recorder) {
      // Pas de recorder actif → fallback : envoie juste le texte transcrit
      if (webSpeechTranscript) void sendMessageRef.current?.(webSpeechTranscript)
      return
    }

    let rec: { blob: Blob; durationSeconds: number }
    try {
      rec = await recorder.stop()
    } catch {
      audioRecorderRef.current = null
      // Recording cassé — on garde quand même le transcript text Web Speech si dispo
      if (webSpeechTranscript) void sendMessageRef.current?.(webSpeechTranscript)
      return
    }
    // Maintenant que stop() a résolu, on libère le slot pour autoriser un nouveau record
    audioRecorderRef.current = null

    // ── 1) Bulle USER optimiste avec objectURL local + spinner ─────────────
    const messageId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const localUrl = URL.createObjectURL(rec.blob)
    voiceBlobsRef.current.set(messageId, rec.blob)
    voiceLocalUrlsRef.current.set(messageId, localUrl)

    // Cas edge : audio très court (< 1s) → on n'appelle pas Whisper (coût inutile,
    // résultat peu fiable). On affiche juste la bulle audio sans texte transcrit.
    const isTooShort = rec.durationSeconds < 1
    const optimisticContent = isTooShort ? '(message vocal court)' : 'Transcription en cours…'

    const optimisticMsg: ChatMessage = {
      id: messageId,
      role: 'user',
      content: optimisticContent,
      createdAt: Date.now(),
      isVoice: true,
      audioUrl: localUrl,
      audioDuration: rec.durationSeconds,
      isTranscribing: !isTooShort,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    if (isTooShort) {
      // Pas d'appel Whisper, mais on tente quand même d'envoyer le Web Speech
      // transcript à Claude si dispo (UX continuity).
      if (webSpeechTranscript) {
        void sendMessageRef.current?.(webSpeechTranscript, { suppressUserBubble: true })
      }
      return
    }

    // ── 2) Upload + Whisper en arrière-plan ────────────────────────────────
    const controller = new AbortController()
    whisperAbortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000)

    try {
      const form = new FormData()
      const file = new File([rec.blob], 'voice.webm', {
        type: rec.blob.type || 'audio/webm',
      })
      form.append('audio', file)
      form.append('dossierId', dossierId)
      form.append('sessionId', sessionId)

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)
      whisperAbortRef.current = null
      // Composant démonté entre-temps (départ mission) → on stoppe sans setState.
      if (!mountedRef.current) return

      if (!res.ok) {
        // Lit le body même en erreur pour récupérer le vrai message serveur
        let serverMsg = `HTTP ${res.status}`
        try {
          const errBody = (await res.json()) as { error?: string; name?: string }
          if (errBody.error) serverMsg = `${errBody.name ?? 'Error'}: ${errBody.error}`
          console.error('[mission-tchat] transcribe HTTP error', res.status, errBody)
        } catch {
          /* response non-JSON */
        }
        throw new Error(`transcribe ${serverMsg}`)
      }

      const data = (await res.json()) as {
        transcript?: string
        markedText?: string
        segments?: ChatVoiceSegment[]
        audioSignedUrl?: string | null
        audioStoragePath?: string | null
      }

      const finalTranscript = (data.markedText || data.transcript || '').trim()
      const finalSignedUrl = data.audioSignedUrl ?? null

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          return {
            ...m,
            content: finalTranscript || '(message vocal sans transcription)',
            audioUrl: finalSignedUrl ?? m.audioUrl,
            audioStoragePath: data.audioStoragePath ?? null,
            audioSegments: data.segments ?? undefined,
            isTranscribing: false,
          }
        }),
      )

      // Si on a swap vers une signed URL, libère la blob locale (sinon on la
      // garde — la signed URL n'a pas été obtenue, le local reste la seule source).
      if (finalSignedUrl) releaseLocalBlob(messageId)

      // Envoie à Claude le transcript brut (Whisper plus fiable que Web Speech)
      const rawTranscript = (data.transcript || '').trim() || webSpeechTranscript
      if (rawTranscript) {
        void sendMessageRef.current?.(rawTranscript, { suppressUserBubble: true })
      }
    } catch (err) {
      window.clearTimeout(timeoutId)
      // Offline / timeout / 5xx → fallback Web Speech, on conserve la blob locale
      // pour permettre la réécoute in-session (objectURL toujours valide tant que
      // la blob est référencée dans voiceBlobsRef).
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      const fallbackText = webSpeechTranscript
        ? webSpeechTranscript
        : '(transcription indisponible — hors connexion)'
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          return {
            ...m,
            content: fallbackText,
            isTranscribing: false,
          }
        }),
      )
      if (webSpeechTranscript) {
        void sendMessageRef.current?.(webSpeechTranscript, { suppressUserBubble: true })
      }
      // Log léger (ne pas spam Sentry pour les offline classiques)
      if (!isAbort && process.env.NODE_ENV !== 'production') {
        console.warn('[mission-tchat] transcribe failed', err)
      }
    }
  }, [
    stopMeterStream,
    dossierId,
    sessionId,
    getInput,
    setInput,
    setMessages,
    sendMessageRef,
    releaseLocalBlob,
  ])

  /**
   * CANCEL : l'utilisateur a dragé au-delà du seuil cancel OU pointerCancel.
   * Drop l'audio + transcript, retourne en idle.
   */
  const cancelVoiceMessage = useCallback((): void => {
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancel()
      audioRecorderRef.current = null
    }
    // Abort un éventuel POST Whisper en cours (cancel pendant la transcription).
    if (whisperAbortRef.current) {
      whisperAbortRef.current.abort()
      whisperAbortRef.current = null
    }
    voiceTranscriptRef.current = ''
    setIsListening(false)
    setVoiceStartedAt(0)
    setVoiceMode('idle')
    setInput('')
    stopMeterStream()
  }, [stopMeterStream, setInput])

  // Cleanup au unmount : coupe TOUT (micro, Web Speech, fetch Whisper, VU-mètre)
  // pour éviter un micro zombie (voyant rouge + batterie) ou un setState
  // post-unmount quand le diagnostiqueur quitte la mission en plein enregistrement
  // ou pendant la transcription (audit P0-1 + P0-5).
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cancel()
        audioRecorderRef.current = null
      }
      if (whisperAbortRef.current) {
        whisperAbortRef.current.abort()
        whisperAbortRef.current = null
      }
      stopMeterStream()
    }
  }, [stopMeterStream])

  // Cleanup : libère tous les objectURL locaux des messages vocaux au démontage
  // (sinon memory leak Browser sur les blobs Audio retenues).
  useEffect(() => {
    const localUrls = voiceLocalUrlsRef.current
    const blobs = voiceBlobsRef.current
    return () => {
      for (const url of localUrls.values()) {
        URL.revokeObjectURL(url)
      }
      localUrls.clear()
      blobs.clear()
    }
  }, [])

  // Getter du cache (signature publique demandée par le briefing)
  const getVoiceBlobs = useCallback((): Map<string, Blob> => voiceBlobsRef.current, [])

  return {
    isListening,
    voiceMode,
    setVoiceMode,
    voiceStartedAt,
    meterStream,
    startListening,
    commitVoiceMessage,
    cancelVoiceMessage,
    getVoiceBlobs,
    releaseLocalBlob,
  }
}
