/**
 * Vitest — `client-transcribe` (Lot B93, refonte acqui-target 2026-05).
 *
 * Couvre le helper de routage côté navigateur :
 *   - Audio court+silencieux + localWhisper.isReady → transcrit localement.
 *   - Audio court+silencieux + localWhisper.isReady mais transcribe() throw
 *     → fallback API avec header `X-Transcription-Engine: local_wasm_attempted_failed`.
 *   - Audio long → API direct (pas de tentative locale).
 *   - Audio bruyant → API direct.
 *   - Pas de localWhisper passé → API direct.
 *   - API renvoie 500 → throw une erreur explicite (caller affiche toast).
 *
 * Stratégie : on stub `fetch` global pour intercepter les appels API et
 * vérifier les headers + body. Le hook local est injecté via option (DI).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ClientTranscribeOptions, transcribeAudioClient } from './client-transcribe'

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function buildBlob(): Blob {
  return new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/webm' })
}

function mockFetchOk(body: Record<string, unknown> = {}): ReturnType<typeof vi.fn> {
  const json = vi.fn().mockResolvedValue({
    transcript: 'API transcript fixture',
    markedText: 'API marked',
    engine: 'api_whisper_mini',
    model_used: 'gpt-4o-mini-transcribe',
    costEur: 0.001,
    audioSignedUrl: 'https://mock/signed',
    audioStoragePath: 'org/dossier/file.webm',
    voiceNoteId: 'vn-1',
    ...body,
  })
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json,
  })
}

function mockFetchError(): ReturnType<typeof vi.fn> {
  const json = vi.fn().mockResolvedValue({ error: 'OpenAI down', name: 'NetworkError' })
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json,
  })
}

function buildOptions(overrides: Partial<ClientTranscribeOptions> = {}): ClientTranscribeOptions {
  return {
    dossierId: 'dossier-1',
    meta: { length_seconds: 60, noise_level: 0.1 },
    ...overrides,
  }
}

beforeEach(() => {
  // Reset le fetch global avant chaque test pour éviter les leaks
  // (jsdom expose fetch natif depuis Node 18).
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* ============================================================
   Routing — local d'abord, API fallback
   ============================================================ */

describe('transcribeAudioClient — routing par engine', () => {
  it('court + silencieux + localWhisper ready → transcription locale (pas de fetch)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const localTranscribe = vi.fn().mockResolvedValue({
      text: 'local transcript',
      confidence: 0.92,
      engine: 'local_wasm',
      durationMs: 320,
    })

    const result = await transcribeAudioClient(buildBlob(), {
      ...buildOptions(),
      localWhisper: {
        isReady: true,
        isSupported: true,
        transcribe: localTranscribe,
      },
    })

    expect(result.engine).toBe('local_wasm')
    expect(result.transcript).toBe('local transcript')
    expect(result.costEur).toBe(0)
    expect(localTranscribe).toHaveBeenCalledOnce()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('local échoue → fallback API avec header X-Transcription-Engine: local_wasm_attempted_failed', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)

    const localTranscribe = vi.fn().mockRejectedValue(new Error('WHISPER_LOCAL_NOT_AVAILABLE'))

    const result = await transcribeAudioClient(buildBlob(), {
      ...buildOptions(),
      localWhisper: {
        isReady: true,
        isSupported: true,
        transcribe: localTranscribe,
      },
    })

    expect(result.engine).toBe('api_whisper_mini')
    expect(fetchSpy).toHaveBeenCalledOnce()
    const call = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = call.headers as Record<string, string>
    expect(headers['X-Transcription-Engine']).toBe('local_wasm_attempted_failed')
  })

  it('audio long → API direct (pas de tentative locale)', async () => {
    const fetchSpy = mockFetchOk({
      engine: 'api_whisper_standard',
      model_used: 'whisper-1',
    })
    vi.stubGlobal('fetch', fetchSpy)

    const localTranscribe = vi.fn()

    await transcribeAudioClient(buildBlob(), {
      ...buildOptions({ meta: { length_seconds: 900, noise_level: 0.2 } }),
      localWhisper: {
        isReady: true,
        isSupported: true,
        transcribe: localTranscribe,
      },
    })

    expect(localTranscribe).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledOnce()
    // Pas de header local_wasm_attempted_failed sur ce path (router n'a pas
    // suggéré local au départ).
    const call = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = (call.headers as Record<string, string>) ?? {}
    expect(headers['X-Transcription-Engine']).toBeUndefined()
  })

  it('audio bruyant court → API direct (pas éligible local)', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)

    const localTranscribe = vi.fn()

    await transcribeAudioClient(buildBlob(), {
      ...buildOptions({ meta: { length_seconds: 60, noise_level: 0.8 } }),
      localWhisper: {
        isReady: true,
        isSupported: true,
        transcribe: localTranscribe,
      },
    })

    expect(localTranscribe).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('pas de localWhisper passé → API direct, pas de tentative locale', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await transcribeAudioClient(buildBlob(), buildOptions())

    expect(result.engine).toBe('api_whisper_mini')
    expect(fetchSpy).toHaveBeenCalledOnce()
    // Sans hook local et avec localAvailable=false, le router décide direct
    // mini — donc pas de header local_wasm_attempted_failed.
    const call = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = (call.headers as Record<string, string>) ?? {}
    expect(headers['X-Transcription-Engine']).toBeUndefined()
  })

  it('localWhisper.isReady=false → API direct (pas de tentative locale)', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)

    const localTranscribe = vi.fn()

    await transcribeAudioClient(buildBlob(), {
      ...buildOptions(),
      localWhisper: {
        isReady: false,
        isSupported: true,
        transcribe: localTranscribe,
      },
    })

    expect(localTranscribe).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})

/* ============================================================
   Multipart body — champs envoyés au serveur
   ============================================================ */

describe('transcribeAudioClient — body API multipart', () => {
  it('envoie audio + dossierId + meta JSON dans FormData', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)

    await transcribeAudioClient(
      buildBlob(),
      buildOptions({ meta: { length_seconds: 120, noise_level: 0.3 } }),
    )

    expect(fetchSpy).toHaveBeenCalledOnce()
    const call = fetchSpy.mock.calls[0]
    const url = call[0] as string
    const init = call[1] as RequestInit
    expect(url).toBe('/api/transcribe')
    expect(init.method).toBe('POST')

    const form = init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('dossierId')).toBe('dossier-1')
    expect(form.get('meta')).toBe('{"length_seconds":120,"noise_level":0.3}')
    expect(form.get('audio')).toBeInstanceOf(File)
  })

  it('inclut sessionId si fourni', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)

    await transcribeAudioClient(buildBlob(), buildOptions({ sessionId: 'session-abc' }))

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const form = init.body as FormData
    expect(form.get('sessionId')).toBe('session-abc')
  })
})

/* ============================================================
   Erreurs — API down, local crash inattendu
   ============================================================ */

describe('transcribeAudioClient — gestion erreurs', () => {
  it('API renvoie 500 → throw erreur explicite avec message serveur', async () => {
    const fetchSpy = mockFetchError()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(transcribeAudioClient(buildBlob(), buildOptions())).rejects.toThrow(
      /transcribe_api_failed/,
    )
  })

  it('local crash inattendu (non-scaffold) → log warning + fallback API OK', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // suppress console output in test
    })

    const localTranscribe = vi.fn().mockRejectedValue(new Error('unexpected_wasm_crash'))

    const result = await transcribeAudioClient(buildBlob(), {
      ...buildOptions(),
      localWhisper: {
        isReady: true,
        isSupported: true,
        transcribe: localTranscribe,
      },
    })

    expect(result.engine).toBe('api_whisper_mini')
    expect(warnSpy).toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('local throw WHISPER_LOCAL_NOT_AVAILABLE (scaffold) → fallback silencieux sans warning', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // suppress console output in test
    })

    const localTranscribe = vi.fn().mockRejectedValue(new Error('WHISPER_LOCAL_NOT_AVAILABLE'))

    await transcribeAudioClient(buildBlob(), {
      ...buildOptions(),
      localWhisper: {
        isReady: true,
        isSupported: true,
        transcribe: localTranscribe,
      },
    })

    expect(warnSpy).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})
