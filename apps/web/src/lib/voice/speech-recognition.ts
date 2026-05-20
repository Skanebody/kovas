/**
 * Wrapper TypeScript pour la Web Speech API.
 *
 * Stratégie KOVAS V1 :
 * - Détection runtime de `window.SpeechRecognition || window.webkitSpeechRecognition`
 * - Si non supporté → `isSupported = false`, consumer bascule sur fallback Whisper
 *   (cf. `voice-recorder.tsx` qui fait record-then-upload-then-transcribe)
 * - Auto-restart si `continuous && onend` se déclenche par silence Chrome (~30s)
 *
 * Types Web Speech API déclarés en `declare global` car @types/dom-speech-recognition
 * n'est pas installé et `lib.dom.iterable.d.ts` ne couvre pas SpeechRecognition.
 */

// ============================================================================
// Types Web Speech API (declare global)
// ============================================================================

interface KovasSpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { readonly transcript: string; readonly confidence: number }
  item(index: number): { readonly transcript: string; readonly confidence: number }
}

interface KovasSpeechRecognitionResultList {
  readonly length: number
  [index: number]: KovasSpeechRecognitionResult
  item(index: number): KovasSpeechRecognitionResult
}

interface KovasSpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: KovasSpeechRecognitionResultList
}

interface KovasSpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface KovasSpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((this: KovasSpeechRecognitionInstance, ev: KovasSpeechRecognitionEvent) => void) | null
  onerror:
    | ((this: KovasSpeechRecognitionInstance, ev: KovasSpeechRecognitionErrorEvent) => void)
    | null
  onend: ((this: KovasSpeechRecognitionInstance, ev: Event) => void) | null
  onstart: ((this: KovasSpeechRecognitionInstance, ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface KovasSpeechRecognitionConstructor {
  new (): KovasSpeechRecognitionInstance
  prototype: KovasSpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: KovasSpeechRecognitionConstructor
    webkitSpeechRecognition?: KovasSpeechRecognitionConstructor
  }
}

// ============================================================================
// API publique
// ============================================================================

export interface SpeechRecognitionEvent {
  /** Texte non-définitif (peut changer ; à afficher en gris italique) */
  interim: string
  /** Texte accumulé définitif depuis le start() */
  final: string
}

export interface SpeechRecognitionController {
  start(): void
  stop(): void
  abort(): void
  readonly isSupported: boolean
}

export interface CreateSpeechRecognitionOptions {
  lang?: 'fr-FR' | 'en-US'
  onResult: (e: SpeechRecognitionEvent) => void
  onError?: (err: string) => void
  onEnd?: () => void
  /** Default true : reconnaissance continue (longues sessions terrain) */
  continuous?: boolean
  /** Default true : émission des résultats interim (UX live) */
  interimResults?: boolean
}

function getCtor(): KovasSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * Crée un controller pour la Web Speech API.
 *
 * Particularité Chrome : en mode `continuous`, l'API se coupe d'elle-même après
 * ~30s de silence (variable selon Chrome version). On gère un auto-restart
 * transparent : tant que l'utilisateur n'a pas appelé `stop()` ou `abort()`,
 * on relance `start()` automatiquement sur `onend`.
 *
 * Particularité Safari iOS : support partiel — `continuous` est ignoré, chaque
 * session se termine après une phrase. L'auto-restart compense partiellement.
 *
 * Particularité Firefox : aucun support. `isSupported` sera `false`.
 */
export function createSpeechRecognition(
  opts: CreateSpeechRecognitionOptions,
): SpeechRecognitionController {
  const Ctor: KovasSpeechRecognitionConstructor | null = getCtor()
  if (!Ctor) {
    return {
      start: () => {},
      stop: () => {},
      abort: () => {},
      isSupported: false,
    }
  }
  // Narrow non-null pour les closures async (build() est appelé sur start()).
  const SafeCtor: KovasSpeechRecognitionConstructor = Ctor

  const lang = opts.lang ?? 'fr-FR'
  const continuous = opts.continuous ?? true
  const interimResults = opts.interimResults ?? true

  let recognition: KovasSpeechRecognitionInstance | null = null
  let finalTranscript = ''
  // userStopped : vrai uniquement après un stop() ou abort() explicite.
  // Distingue un arrêt volontaire d'un arrêt provoqué par silence → restart auto.
  let userStopped = false
  let isRunning = false

  function build(): KovasSpeechRecognitionInstance {
    const r = new SafeCtor()
    r.lang = lang
    r.continuous = continuous
    r.interimResults = interimResults
    r.maxAlternatives = 1

    r.onstart = () => {
      isRunning = true
    }

    r.onresult = (ev) => {
      let interim = ''
      // ev.resultIndex pointe sur le premier résultat nouveau depuis le précédent
      // event. On accumule final côté state, interim est éphémère par event.
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (!res) continue
        const alt = res[0]
        if (!alt) continue
        if (res.isFinal) {
          finalTranscript += alt.transcript
        } else {
          interim += alt.transcript
        }
      }
      opts.onResult({ interim: interim.trim(), final: finalTranscript.trim() })
    }

    r.onerror = (ev) => {
      // 'no-speech', 'aborted', 'network', 'not-allowed', 'service-not-allowed', 'audio-capture'
      // Pour 'no-speech' on laisse passer : onend va se déclencher et le restart auto prendra le relais.
      // Pour 'not-allowed' on remonte au consumer.
      if (ev.error === 'aborted' || ev.error === 'no-speech') return
      opts.onError?.(ev.error)
    }

    r.onend = () => {
      isRunning = false
      // Auto-restart si l'utilisateur n'a pas explicitement stoppé ET qu'on est en mode continuous.
      // Le restart est wrappé dans un try/catch — certains navigateurs (Safari) refusent
      // un start() trop rapide après onend, on ignore silencieusement (le onEnd handler
      // ci-dessous sera appelé au prochain cycle si besoin).
      if (!userStopped && continuous) {
        try {
          // Léger délai pour éviter "InvalidStateError" sur certains user-agents.
          setTimeout(() => {
            if (userStopped) return
            try {
              recognition?.start()
            } catch {
              // Ignoré : Safari peut refuser le restart, on appelle onEnd
              opts.onEnd?.()
            }
          }, 100)
        } catch {
          opts.onEnd?.()
        }
        return
      }
      opts.onEnd?.()
    }

    return r
  }

  return {
    start() {
      if (isRunning) return
      userStopped = false
      finalTranscript = ''
      recognition = build()
      try {
        recognition.start()
      } catch (err) {
        // Typiquement "InvalidStateError" si déjà en cours
        opts.onError?.(err instanceof Error ? err.message : 'start_failed')
      }
    },
    stop() {
      userStopped = true
      try {
        recognition?.stop()
      } catch {
        // déjà arrêté
      }
    },
    abort() {
      userStopped = true
      try {
        recognition?.abort()
      } catch {
        // déjà arrêté
      }
    },
    get isSupported() {
      return true
    },
  }
}

/**
 * Helper synchrone — utilisable côté composant pour décider du fallback Whisper
 * sans avoir à construire un controller.
 */
export function isWebSpeechSupported(): boolean {
  return getCtor() !== null
}
