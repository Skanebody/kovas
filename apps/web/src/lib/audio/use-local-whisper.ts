'use client'

/**
 * KOVAS — Hook React `useLocalWhisper()` (Lot B93, refonte acqui-target 2026-05).
 *
 * Source : `docs/refonte-2026-05/AI_ECONOMICS.md` (technique 6 — "Whisper hybride
 * local WASM + API") + JSDoc B58 `transcription-router.ts` §IMPORTANT.
 *
 * Objectif : exposer à un composant React l'accès à un moteur Whisper local
 * (whisper.cpp compilé en WebAssembly ou `@xenova/transformers` ONNX Web) qui
 * tourne ON-DEVICE pour les audios courts/silencieux (cf. router B58 décision
 * `local_wasm`). Coût marginal 0 EUR par transcription. Gain attendu : -15%
 * du coût transcription total une fois branché (cf. AI_ECONOMICS §3).
 *
 * ─── État actuel — Scaffold uniquement ─────────────────────────────────────
 * Aucune lib WASM Whisper n'est installée dans le monorepo au moment de ce
 * lot. Le hook expose une API React PROPRE (`isReady`, `transcribe`, `error`,
 * `isSupported`) qui permet à `client-transcribe.ts` de router intelligemment
 * sans crasher, mais `transcribe()` throw immédiatement `WHISPER_LOCAL_NOT_AVAILABLE`.
 *
 * Le helper `client-transcribe.ts` traite ce throw comme un fallback gracieux
 * vers `/api/transcribe` avec le header `X-Transcription-Engine:
 * local_wasm_attempted_failed` — l'observabilité serveur compte les retombées
 * pour pouvoir prioriser le branchement réel.
 *
 * Pour brancher pour de vrai :
 *   1. `pnpm add @xenova/transformers@^3` (ou `whisper.cpp-wasm`, à benchmarker)
 *   2. Remplacer le body de `loadWhisperModel()` ci-dessous par le `pipeline()`
 *      de `@xenova/transformers` ('automatic-speech-recognition', 'Xenova/whisper-tiny')
 *   3. Implémenter `runWhisperOnAudio()` (resample 16kHz, mono PCM, callback).
 *   4. Activer le cache IndexedDB via la convention Hugging Face Hub
 *      (`@xenova/transformers` le fait nativement via `transformers.env.cacheDir`).
 *   5. Mettre à jour les tests de fallback (`use-local-whisper.test.ts`).
 *
 * TODO B93+1 : installer `@xenova/transformers` v3.x et brancher pour de vrai.
 * Authority : CLAUDE.md §3 feature #1 (saisie vocale terrain hybride FR).
 */

import { useEffect, useState } from 'react'

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
   * whisper.cpp-wasm rapide). Devient `false` sur navigateurs trop vieux
   * (Safari < 16.4, etc.) — dans ce cas, on ne tente même pas le download
   * du modèle (économie de bande passante).
   */
  isSupported: boolean
  /** Erreur de chargement éventuelle (model fetch failed, WASM crash, etc.). */
  error: Error | null
  /**
   * Lance la transcription locale. Throw si la lib n'est pas dispo (scaffold)
   * ou si une erreur survient pendant l'inference. Le caller (helper) est
   * responsable du fallback API.
   */
  transcribe: (audioBlob: Blob) => Promise<LocalWhisperResult>
}

/* ─── Helpers internes ──────────────────────────────────────────────────── */

/**
 * Détecte le support WebAssembly + SIMD.
 *
 * - `WebAssembly` global présent (~tous les navigateurs depuis 2018).
 * - WASM SIMD valide (instruction `v128.const` minimale) → requis pour
 *   whisper.cpp et @xenova/transformers performants. Si pas SIMD on pourrait
 *   tomber sur un mode "scalar" 5-10× plus lent : on préfère router API.
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
 * Charge dynamiquement la lib WASM Whisper.
 *
 * Scaffold-only — throw explicite tant que la dep n'est pas installée. Voir
 * le JSDoc d'en-tête pour la procédure de branchement réelle.
 *
 * Exporté pour permettre aux tests de mocker le chargement model.
 */
export async function loadWhisperModel(): Promise<{
  transcribe: (audio: Blob) => Promise<{ text: string; confidence: number }>
}> {
  // TODO B93+1 : remplacer par le pipeline @xenova/transformers réel
  //
  //   const { pipeline, env } = await import('@xenova/transformers')
  //   env.allowLocalModels = false
  //   env.useBrowserCache = true  // IndexedDB automatic
  //   const asr = await pipeline(
  //     'automatic-speech-recognition',
  //     'Xenova/whisper-tiny',
  //     { quantized: true }, // ~40 Mo model, OK mobile
  //   )
  //   return {
  //     transcribe: async (audio) => {
  //       const arrayBuffer = await audio.arrayBuffer()
  //       const result = await asr(arrayBuffer, { language: 'french', task: 'transcribe' })
  //       return { text: result.text, confidence: result.confidence ?? 0.8 }
  //     },
  //   }
  //
  throw new Error('WHISPER_LOCAL_NOT_AVAILABLE')
}

/* ─── Hook public ───────────────────────────────────────────────────────── */

/**
 * Hook React pour la transcription locale Whisper WASM.
 *
 * Comportement :
 *   1. Au mount, détecte le support WASM SIMD (synchrone, pas d'I/O).
 *   2. Si supporté, tente de lazy-load la lib WASM (dynamic import, hors
 *      bundle principal). Scaffold-only aujourd'hui → throw fallback API.
 *   3. Expose `transcribe(audioBlob)` qui lance l'inference on-device.
 *
 * Le caller (helper `client-transcribe.ts`) DOIT vérifier `isReady` ET
 * `isSupported` avant d'appeler `transcribe`. En cas de throw, il bascule
 * automatiquement sur `/api/transcribe` avec le header signalant le fail.
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
  const [model, setModel] = useState<{
    transcribe: (audio: Blob) => Promise<{ text: string; confidence: number }>
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    const wasmOk = detectWasmSupport()
    setIsSupported(wasmOk)

    if (!wasmOk) {
      // Pas la peine de tenter le download — le caller fera API direct.
      return () => {
        cancelled = true
      }
    }

    // Lazy import : ne JAMAIS importer la lib WASM au top-level — elle
    // explose le bundle principal de plusieurs Mo. Le `loadWhisperModel`
    // utilise `await import(...)` côté implémentation réelle.
    void (async () => {
      try {
        const loaded = await loadWhisperModel()
        if (!cancelled) {
          setModel(loaded)
          setIsReady(true)
        }
      } catch (err) {
        if (!cancelled) {
          // Pas un crash : le scaffold throw `WHISPER_LOCAL_NOT_AVAILABLE`.
          // On stocke l'erreur pour debug mais on laisse le caller fallback.
          setError(err instanceof Error ? err : new Error('whisper_load_failed'))
          setIsReady(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    isReady,
    isSupported,
    error,
    transcribe: async (audioBlob: Blob): Promise<LocalWhisperResult> => {
      if (!isSupported) {
        throw new Error('WHISPER_LOCAL_NOT_SUPPORTED')
      }
      if (!isReady || !model) {
        throw new Error('WHISPER_LOCAL_NOT_AVAILABLE')
      }

      const t0 = Date.now()
      const raw = await model.transcribe(audioBlob)
      const durationMs = Date.now() - t0

      return {
        text: raw.text,
        confidence: raw.confidence,
        engine: 'local_wasm',
        durationMs,
      }
    },
  }
}
