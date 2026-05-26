'use client'

/**
 * KOVAS — Hook React `useLocalWhisper()` (Lot B99, refonte acqui-target 2026-05).
 *
 * Source : `docs/refonte-2026-05/AI_ECONOMICS.md` (technique 6 — "Whisper hybride
 * local WASM + API") + JSDoc B58 `transcription-router.ts` §IMPORTANT.
 *
 * Objectif : exécuter Whisper côté navigateur via `@xenova/transformers` v2 LTS
 * (pipeline `automatic-speech-recognition` + modèle `Xenova/whisper-tiny`,
 * ~75 Mo quantisé). Coût marginal 0 EUR par transcription. Gain attendu :
 * -15% du coût transcription total une fois branché (cf. AI_ECONOMICS §3).
 *
 * ─── État B99 — Branchement effectif ────────────────────────────────────────
 * Le scaffold B93 (throw `WHISPER_LOCAL_NOT_AVAILABLE`) est remplacé par le
 * vrai pipeline. Le modèle est lazy-loaded via dynamic import au mount, donc
 * la lib WASM (`@xenova/transformers`) ne pollue PAS le main bundle JS
 * initial (le code-split Next.js auto-chunke).
 *
 * Cache : `@xenova/transformers` utilise nativement IndexedDB (`browserCache`)
 * pour stocker le modèle après le premier download — les usages suivants
 * n'ont plus de download (cache hit ~instantané).
 *
 * Fallback : si la lib n'est pas installée (`pnpm add` jamais lancé) ou si
 * le dynamic import échoue (CSP, network, browser trop vieux), le hook
 * stocke l'erreur dans `error` et `client-transcribe.ts` retombe
 * silencieusement sur `/api/transcribe` avec le header
 * `X-Transcription-Engine: local_wasm_attempted_failed`.
 *
 * Authority : CLAUDE.md §3 feature #1 (saisie vocale terrain hybride FR).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/* ─── Types publics ─────────────────────────────────────────────────────── */

/**
 * Résultat d'une transcription locale WASM.
 *
 * `engine` est toujours `local_wasm` ici — fixe par construction. Le helper
 * `client-transcribe.ts` est responsable de normaliser ce shape avec celui
 * retourné par `/api/transcribe` pour que les consommateurs UI traitent les
 * deux sources de manière transparente.
 */
export interface LocalWhisperResult {
  text: string
  confidence: number
  engine: 'local_wasm'
  /** Durée de l'inference côté navigateur (ms) — utile pour observabilité. */
  durationMs: number
}

export interface UseLocalWhisperReturn {
  /** Modèle chargé et prêt à transcrire. Devient `true` après lazy-load OK. */
  isReady: boolean
  /**
   * Capacité matérielle du navigateur à exécuter WASM SIMD (prérequis pour
   * @xenova/transformers performant). Devient `false` sur navigateurs trop
   * vieux (Safari < 16.4, etc.) — dans ce cas, on ne tente même pas le download
   * du modèle (économie de bande passante).
   */
  isSupported: boolean
  /** Erreur de chargement éventuelle (model fetch failed, WASM crash, etc.). */
  error: Error | null
  /**
   * Lance la transcription locale. Throw `WHISPER_LOCAL_NOT_AVAILABLE` si le
   * modèle n'est pas encore chargé, ou `WHISPER_LOCAL_NOT_SUPPORTED` si WASM
   * indisponible. Le caller (helper) est responsable du fallback API.
   */
  transcribe: (audioBlob: Blob) => Promise<LocalWhisperResult>
}

/* ─── Constantes internes ──────────────────────────────────────────────── */

/**
 * Nom du modèle Hugging Face. Whisper-tiny multilingue (~75 Mo quantisé int8),
 * gère le FR avec qualité acceptable pour audios courts (< 180s) — cf. critère
 * d'éligibilité du router B58. Pour la qualité supérieure, le router bascule
 * sur l'API serveur (`whisper-1` ou `gpt-4o-mini-transcribe`).
 */
const MODEL_NAME = 'Xenova/whisper-tiny'

/**
 * Sample rate attendu par Whisper. Le modèle est entrainé sur 16kHz mono PCM
 * — il faut resampler tous les audios (browsers enregistrent souvent en
 * 44.1kHz ou 48kHz via MediaRecorder). On utilise OfflineAudioContext pour
 * le resampling natif et performant.
 */
const WHISPER_SAMPLE_RATE = 16_000

/**
 * Confidence par défaut. Whisper-tiny ne retourne pas de probabilité log par
 * token au format @xenova/transformers v2 — on fixe une valeur raisonnable
 * pour les consommateurs UI. La qualité du local est mesurée empiriquement
 * par le delta d'édition utilisateur (tracking PostHog).
 */
const DEFAULT_LOCAL_CONFIDENCE = 0.85

/* ─── Helpers internes ──────────────────────────────────────────────────── */

/**
 * Détecte le support WebAssembly + SIMD.
 *
 * - `WebAssembly` global présent (~tous les navigateurs depuis 2018).
 * - WASM SIMD valide (instruction `v128.const` minimale) → requis pour
 *   `@xenova/transformers` (onnxruntime-web utilise SIMD pour les ops vectorisées).
 *   Sans SIMD on tomberait sur un mode scalar 5-10× plus lent : on préfère router API.
 *
 * Exporté pour les tests + pour le helper `client-transcribe.ts` qui veut
 * tester côté caller sans monter le hook.
 */
export function detectWasmSupport(): boolean {
  if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') {
    return false
  }
  try {
    // Header `\0asm\1\0\0\0` + minimal SIMD function : 1 import-empty,
    // 1 function w/ v128.const i32x4 0 0 0 0, drop. Ce bytecode est le
    // canonical SIMD-feature-detect snippet (cf. webassembly.org/roadmap).
    const simdBytes = new Uint8Array([
      0x00,
      0x61,
      0x73,
      0x6d,
      0x01,
      0x00,
      0x00,
      0x00, // magic + version
      0x01,
      0x05,
      0x01,
      0x60,
      0x00,
      0x01,
      0x7b, // type section : () -> v128
      0x03,
      0x02,
      0x01,
      0x00, // function section
      0x0a,
      0x0a,
      0x01,
      0x08,
      0x00,
      0xfd,
      0x0c, // code : v128.const 0×16
      0x00,
      0x00,
      0x00,
      0x00,
      0x0b,
    ])
    return WebAssembly.validate(simdBytes)
  } catch {
    return false
  }
}

/**
 * Type opaque du pipeline `@xenova/transformers`. La lib n'exporte pas de type
 * strict pour le pipeline ASR — on utilise `unknown` côté API publique et
 * on isole les casts à un seul endroit (la fonction `transcribe` ci-dessous).
 */
type WhisperPipeline = (
  audio: Float32Array,
  options: {
    language?: string
    task?: 'transcribe' | 'translate'
    return_timestamps?: boolean
    chunk_length_s?: number
    stride_length_s?: number
  },
) => Promise<{ text?: string } | { text?: string }[]>

/**
 * Charge dynamiquement le pipeline Whisper depuis `@xenova/transformers`.
 *
 * - Dynamic import : la lib (~3-5 Mo gzippé) reste HORS du main bundle JS
 *   initial. Code-splitting Next.js auto-chunke.
 * - Si la dep n'est pas installée (`pnpm add @xenova/transformers` jamais
 *   lancé), l'import throw → caller catch et fallback API.
 * - `quantized: true` : modèle int8 ~75 Mo (vs ~150 Mo float32). Qualité OK
 *   pour FR sur audios courts/silencieux (cf. critères router B58).
 * - Cache IndexedDB automatique : `@xenova/transformers` détecte le browser
 *   et utilise `caches` + IndexedDB pour stocker le modèle après le 1er
 *   download. Cache hit sur les usages suivants (~instantané).
 *
 * Exporté pour permettre aux tests de mocker le chargement model.
 */
export async function loadWhisperModel(): Promise<WhisperPipeline> {
  // Dynamic import : isolé dans une variable typée `unknown` pour éviter
  // que TypeScript ne s'attende à des types stricts (@xenova/transformers
  // n'expose pas de typings exhaustifs pour le pipeline ASR).
  const transformers = (await import('@xenova/transformers')) as unknown as {
    pipeline: (
      task: string,
      model: string,
      options?: { quantized?: boolean },
    ) => Promise<WhisperPipeline>
    env?: { allowLocalModels?: boolean; useBrowserCache?: boolean }
  }

  // Config env : pas de modèles locaux (CDN HF Hub uniquement) + cache
  // navigateur activé (IndexedDB). Les flags par défaut depuis v2.6 sont
  // déjà OK mais on les force pour être explicite et défensif.
  if (transformers.env) {
    transformers.env.allowLocalModels = false
    transformers.env.useBrowserCache = true
  }

  const asr = await transformers.pipeline('automatic-speech-recognition', MODEL_NAME, {
    quantized: true,
  })

  return asr
}

/**
 * Décode un Blob audio en Float32Array mono 16kHz, format attendu par Whisper.
 *
 * Étapes :
 *   1. Lecture du Blob en ArrayBuffer.
 *   2. Décodage via AudioContext (gère webm/opus, mp4/aac, wav, ogg…).
 *   3. Resampling vers 16kHz via OfflineAudioContext (natif, performant).
 *   4. Downmix stéréo → mono (moyenne des canaux).
 *
 * Exporté pour les tests + pour les composants qui veulent pré-décoder en
 * background (Web Worker dédié, par exemple).
 */
export async function decodeAudioToMono16khz(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()

  // Browser support : Safari préfixait webkitAudioContext jusqu'en iOS 14.
  // On garde le fallback pour les navigateurs iPad 14-15 que KOVAS peut
  // cibler (parc diagnostiqueurs FR pas toujours à jour).
  const AudioCtx =
    (typeof window !== 'undefined' &&
      ((window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
    undefined

  if (!AudioCtx) {
    throw new Error('WHISPER_LOCAL_NO_AUDIO_CONTEXT')
  }

  // 1er decodage : on garde le sample rate natif du blob pour préserver
  // la qualité. Le resampling vient ensuite via OfflineAudioContext.
  const decodeCtx = new AudioCtx()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    // Free decoded buffer ASAP, on aura un nouveau context pour le resampling.
    void decodeCtx.close().catch(() => {
      /* ignore close errors */
    })
  }

  const targetSampleRate = WHISPER_SAMPLE_RATE
  const targetDuration = audioBuffer.duration

  // OfflineAudioContext fait le resampling natif via SRC haute qualité.
  // Pas besoin de DSP manuel ni de lib externe (gain bundle ~150kB).
  const offline = new OfflineAudioContext({
    numberOfChannels: 1, // forces le downmix mono (browser averages channels)
    length: Math.ceil(targetDuration * targetSampleRate),
    sampleRate: targetSampleRate,
  })

  const source = offline.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offline.destination)
  source.start(0)

  const resampled = await offline.startRendering()
  // OfflineAudioContext + numberOfChannels:1 → getChannelData(0) est déjà mono.
  return resampled.getChannelData(0)
}

/* ─── Hook public ───────────────────────────────────────────────────────── */

/**
 * Hook React pour la transcription locale Whisper WASM.
 *
 * Comportement :
 *   1. Au mount, détecte le support WASM SIMD (synchrone, pas d'I/O).
 *   2. Si supporté, lazy-load le pipeline `@xenova/transformers` via dynamic
 *      import + télécharge `Xenova/whisper-tiny` (~75 Mo, mis en cache
 *      IndexedDB pour les sessions suivantes).
 *   3. Expose `transcribe(audioBlob)` qui décode le blob en Float32Array
 *      16kHz mono et lance l'inference on-device.
 *
 * Le caller (helper `client-transcribe.ts`) DOIT vérifier `isReady` ET
 * `isSupported` avant d'appeler `transcribe`. En cas de throw, il bascule
 * automatiquement sur `/api/transcribe` avec le header signalant le fail.
 *
 * Cleanup : si le composant unmount AVANT la fin du download/init, le hook
 * annule proprement le state update via un ref `cancelled` pour éviter le
 * warning React "Can't perform state update on unmounted component".
 *
 * @example
 * ```tsx
 * const { isReady, transcribe } = useLocalWhisper()
 * if (isReady) {
 *   try {
 *     const { text } = await transcribe(blob)
 *   } catch (err) {
 *     // fallback API silencieux côté caller
 *   }
 * }
 * ```
 */
export function useLocalWhisper(): UseLocalWhisperReturn {
  const [isReady, setIsReady] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  /**
   * Ref (pas state) pour le pipeline : éviter une re-render à chaque update
   * et permettre l'accès synchrone depuis `transcribe()` sans stale closure.
   */
  const pipelineRef = useRef<WhisperPipeline | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    const wasmOk = detectWasmSupport()
    setIsSupported(wasmOk)

    if (!wasmOk) {
      // Pas la peine de tenter le download — le caller fera API direct.
      return () => {
        cancelledRef.current = true
      }
    }

    // Lazy import : ne JAMAIS importer la lib WASM au top-level — elle
    // explose le bundle principal de plusieurs Mo.
    void (async () => {
      try {
        const loaded = await loadWhisperModel()
        if (!cancelledRef.current) {
          pipelineRef.current = loaded
          setIsReady(true)
        }
      } catch (err) {
        if (!cancelledRef.current) {
          // Stockage erreur pour debug + caller fallback API.
          setError(err instanceof Error ? err : new Error('whisper_load_failed'))
          setIsReady(false)
        }
      }
    })()

    return () => {
      cancelledRef.current = true
      pipelineRef.current = null
    }
  }, [])

  const transcribe = useCallback(
    async (audioBlob: Blob): Promise<LocalWhisperResult> => {
      if (!isSupported) {
        throw new Error('WHISPER_LOCAL_NOT_SUPPORTED')
      }
      const pipe = pipelineRef.current
      if (!pipe) {
        throw new Error('WHISPER_LOCAL_NOT_AVAILABLE')
      }

      const t0 =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()

      // Décodage Blob → Float32Array 16kHz mono (requis par Whisper).
      const audioData = await decodeAudioToMono16khz(audioBlob)

      // Inference on-device. Paramètres :
      //   - language: 'french' → biais sur les tokens FR (sinon Whisper essaye
      //     d'auto-détecter, ce qui rate parfois sur audios courts).
      //   - task: 'transcribe' (pas 'translate' qui force EN).
      //   - chunk_length_s: 30 → découpage interne pour audios > 30s (Whisper
      //     n'accepte que des fenêtres 30s natives).
      //   - return_timestamps: false → on n'utilise pas les segments côté UI
      //     V1, et ça simplifie le shape de sortie.
      const raw = await pipe(audioData, {
        language: 'french',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      })

      // Le pipeline ASR peut retourner un objet OU un array de chunks selon
      // la version de @xenova/transformers et la durée de l'audio. On
      // normalise les deux formats.
      const text = Array.isArray(raw)
        ? raw
            .map((c) => c.text ?? '')
            .join(' ')
            .trim()
        : (raw.text ?? '').trim()

      const durationMs =
        (typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()) - t0

      return {
        text,
        confidence: DEFAULT_LOCAL_CONFIDENCE,
        engine: 'local_wasm',
        durationMs,
      }
    },
    [isSupported],
  )

  return {
    isReady,
    isSupported,
    error,
    transcribe,
  }
}
