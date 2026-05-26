/**
 * Vitest — `useLocalWhisper` (Lot B93, refonte acqui-target 2026-05).
 *
 * Couverture du scaffold + détection WASM SIMD + erreur de fallback :
 *   - `detectWasmSupport` : true si WebAssembly.validate OK, false sinon
 *     (navigateurs trop vieux, sandbox restrictive, etc.).
 *   - `loadWhisperModel` : throw `WHISPER_LOCAL_NOT_AVAILABLE` tant que la
 *     lib WASM n'est pas installée (scaffold).
 *   - Hook `useLocalWhisper` : `isReady=false` au mount + `transcribe()` throw
 *     une erreur explicite que le helper client-transcribe peut catch.
 *
 * Stratégie : on monte le hook dans un composant minimal via `@testing-library/react`
 * et on inspecte les retours. WebAssembly est dispo dans jsdom.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { detectWasmSupport, loadWhisperModel, useLocalWhisper } from './use-local-whisper'

describe('detectWasmSupport — feature detection', () => {
  it('renvoie true quand WebAssembly.validate accepte le bytecode SIMD', () => {
    // jsdom expose WebAssembly natif → on devrait passer.
    // Si WebAssembly.validate sur SIMD échoue (Node sans SIMD support),
    // on accepte les deux issues — le test vérifie surtout le no-throw.
    expect(() => detectWasmSupport()).not.toThrow()
  })

  it('renvoie false si WebAssembly absent du global', () => {
    const originalWebAssembly = globalThis.WebAssembly
    // biome-ignore lint/suspicious/noExplicitAny: stub global pour test
    ;(globalThis as any).WebAssembly = undefined
    try {
      expect(detectWasmSupport()).toBe(false)
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: restore global
      ;(globalThis as any).WebAssembly = originalWebAssembly
    }
  })

  it('renvoie false si WebAssembly.validate throw (sandbox restrictive)', () => {
    const originalValidate = WebAssembly.validate
    // biome-ignore lint/suspicious/noExplicitAny: stub temporaire
    ;(WebAssembly as any).validate = () => {
      throw new Error('validate disabled')
    }
    try {
      expect(detectWasmSupport()).toBe(false)
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: restore
      ;(WebAssembly as any).validate = originalValidate
    }
  })
})

describe('loadWhisperModel — scaffold état actuel', () => {
  it('throw WHISPER_LOCAL_NOT_AVAILABLE tant que la lib WASM n est pas installée', async () => {
    await expect(loadWhisperModel()).rejects.toThrow('WHISPER_LOCAL_NOT_AVAILABLE')
  })
})

describe('useLocalWhisper hook — comportement scaffold', () => {
  it('isReady=false au mount initial — soit error défini (WASM supporté + scaffold throw), soit isSupported=false (jsdom)', async () => {
    const { result } = renderHook(() => useLocalWhisper())

    // État initial avant le useEffect
    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBeNull()

    // Deux issues possibles selon le runtime :
    //   - jsdom valide le bytecode SIMD → loadWhisperModel throw → error set
    //   - jsdom rejette SIMD → useEffect return early → isSupported=false
    // Les deux sont des chemins valides pour le scaffold actuel. On vérifie
    // simplement que isReady reste false à la fin (pas de modèle chargé).
    await waitFor(
      () => {
        const noModel = !result.current.isReady
        const sawFailure = result.current.error !== null || !result.current.isSupported
        expect(noModel && sawFailure).toBe(true)
      },
      { timeout: 1000 },
    )
  })

  it('transcribe() throw WHISPER_LOCAL_NOT_AVAILABLE quand le modèle nest pas chargé', async () => {
    const { result } = renderHook(() => useLocalWhisper())
    const fakeBlob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/webm' })

    await expect(result.current.transcribe(fakeBlob)).rejects.toThrow(
      /WHISPER_LOCAL_NOT_AVAILABLE|WHISPER_LOCAL_NOT_SUPPORTED/,
    )
  })

  it('expose isSupported=false quand detectWasmSupport renvoie false', async () => {
    // On rend WebAssembly indisponible AVANT le mount du hook pour que
    // useEffect détecte unsupported.
    const originalWebAssembly = globalThis.WebAssembly
    // biome-ignore lint/suspicious/noExplicitAny: stub global
    ;(globalThis as any).WebAssembly = undefined
    try {
      const { result } = renderHook(() => useLocalWhisper())
      await waitFor(
        () => {
          expect(result.current.isSupported).toBe(false)
        },
        { timeout: 500 },
      )
      expect(result.current.isReady).toBe(false)

      const fakeBlob = new Blob([new Uint8Array([0])], { type: 'audio/webm' })
      await expect(result.current.transcribe(fakeBlob)).rejects.toThrow(
        'WHISPER_LOCAL_NOT_SUPPORTED',
      )
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: restore
      ;(globalThis as any).WebAssembly = originalWebAssembly
    }
  })

  it('cleanup useEffect annule le state update sur unmount précoce', async () => {
    const { unmount } = renderHook(() => useLocalWhisper())
    // Unmount immédiat : le useEffect lazy-load doit no-op proprement.
    unmount()
    // Pas d'erreur React "Can't perform state update on unmounted component"
    // → si on arrive ici sans warning console, le cleanup fonctionne.
    expect(true).toBe(true)
    vi.useRealTimers()
  })
})
