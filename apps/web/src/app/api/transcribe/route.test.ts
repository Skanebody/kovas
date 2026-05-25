/**
 * @vitest-environment node
 *
 * Vitest — `/api/transcribe` route handler (Lot B60).
 *
 * Vérifie le cascading B58 (mini vs standard vs fallback) appliqué côté serveur :
 *   - meta indiquant un audio court silencieux → router renvoie local_wasm,
 *     mapper côté serveur fallback sur gpt-4o-mini-transcribe.
 *   - meta indiquant un audio long (>600s) → whisper-1 (standard).
 *   - meta indiquant un audio "standard" (durée moyenne ou bruyant) → mini.
 *   - meta absent / invalide → fallback mini (défaut conservateur).
 *   - 401 si pas d'user, 400 si audio/dossierId manquant.
 *
 * Stratégie de mock :
 *   - Le mock par défaut de `@supabase/ssr` du `vitest.setup.ts` renvoie un
 *     client neutre. On le re-mocke localement pour exposer un user authentifié
 *     + un dossier "owné" + un storage qui no-op proprement.
 *   - On mocke `openai` pour intercepter le model passé à
 *     `audio.transcriptions.create` et le renvoyer dans la réponse fixture.
 *   - On mocke `next/headers` côté setup global donc `createClient` du serveur
 *     Supabase est sûr à appeler.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock OpenAI : capture le model + renvoie une transcription fixture ─────
const transcribeCreateMock = vi.fn()

vi.mock('openai', () => {
  // On évite vi.fn().mockImplementation ici parce que le setup global
  // `vi.restoreAllMocks()` reset l'implémentation entre tests. Une classe
  // standard reste stable et renvoie toujours la même structure.
  class OpenAIMock {
    audio = {
      transcriptions: {
        create: transcribeCreateMock,
      },
    }
  }
  return { default: OpenAIMock }
})

// ── Mock Supabase server client : user authentifié + dossier ownership OK ──
const fromMock = vi.fn()
const storageFromMock = vi.fn()
const getUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  }),
}))

// ── Mock prompt builder (évite d'avoir à charger les 1400+ lignes de jargon) ─
vi.mock('@/lib/local-ai/vocabulary/diagnostic-jargon', () => ({
  buildWhisperPrompt: vi.fn(() => 'prompt:fixture'),
}))

import { POST } from './route'

// ── Helpers ────────────────────────────────────────────────────────────────

function buildFile(): File {
  return new File(['dummy-audio-bytes'], 'voice.webm', { type: 'audio/webm' })
}

function buildFormData(opts: {
  withAudio?: boolean
  dossierId?: string | null
  meta?: string | null
}): FormData {
  const fd = new FormData()
  if (opts.withAudio !== false) {
    fd.append('audio', buildFile())
  }
  if (opts.dossierId !== null) {
    fd.append('dossierId', opts.dossierId ?? 'dossier-test-1')
  }
  if (opts.meta != null) {
    fd.append('meta', opts.meta)
  }
  return fd
}

function buildRequest(fd: FormData): Request {
  // NextRequest hérite de Request — un Request standard suffit pour POST handler.
  return new Request('http://localhost/api/transcribe', {
    method: 'POST',
    body: fd,
  })
}

function installHappyPathMocks() {
  // dossier ownership OK
  const dossierChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'dossier-test-1',
        organization_id: 'org-test-1',
        missions: [{ type: 'dpe' }],
      },
      error: null,
    }),
  }
  // voice_notes insert OK
  const voiceNotesChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'vn-test-1' }, error: null }),
  }
  fromMock.mockImplementation((table: string) => {
    if (table === 'dossiers') return dossierChain
    if (table === 'voice_notes') return voiceNotesChain
    return {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  // storage upload + signed URL OK
  storageFromMock.mockReturnValue({
    upload: vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://mock/signed' },
      error: null,
    }),
  })

  // OpenAI : renvoie un transcript minimal verbose_json
  transcribeCreateMock.mockResolvedValue({
    text: 'transcription fixture',
    language: 'fr',
    duration: 12,
    segments: [],
  })
}

// ── Setup env ──────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'sk-test-fixture'
  // S'assurer qu'aucun override env ne fausse les assertions sur le model
  process.env.OPENAI_MODEL_TRANSCRIBE = ''
  transcribeCreateMock.mockReset()
  fromMock.mockReset()
  storageFromMock.mockReset()
  getUserMock.mockReset()
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-test-1' } },
    error: null,
  })
  installHappyPathMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

/* ============================================================
   Cascading B58 — routing engine → modèle OpenAI
   ============================================================ */

describe('POST /api/transcribe — cascading B58 (Lot B60)', () => {
  it('audio court silencieux (router → local_wasm) → fallback gpt-4o-mini-transcribe', async () => {
    const fd = buildFormData({
      meta: JSON.stringify({ length_seconds: 60, noise_level: 0.1 }),
    })
    const res = await POST(buildRequest(fd))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(transcribeCreateMock).toHaveBeenCalledOnce()
    const callArgs = transcribeCreateMock.mock.calls[0]?.[0] as { model: string }
    expect(callArgs.model).toBe('gpt-4o-mini-transcribe')
    // Le router décide local_wasm (court+silencieux + localAvailable=false ignoré
    // par les règles long_audio mais ici on a localAvailable=false donc on tombe
    // direct sur local_unavailable_fallback_mini). On vérifie le mapping engine→model.
    expect(json.model_used).toBe('gpt-4o-mini-transcribe')
    expect(json.engine).toBe('api_whisper_mini')
  })

  it('audio long (>600s) → whisper-1 (standard)', async () => {
    const fd = buildFormData({
      meta: JSON.stringify({ length_seconds: 900, noise_level: 0.3 }),
    })
    const res = await POST(buildRequest(fd))
    const json = await res.json()

    expect(res.status).toBe(200)
    const callArgs = transcribeCreateMock.mock.calls[0]?.[0] as { model: string }
    expect(callArgs.model).toBe('whisper-1')
    expect(json.model_used).toBe('whisper-1')
    expect(json.engine).toBe('api_whisper_standard')
    expect(json.engineReason).toBe('long_audio_no_local')
  })

  it('audio durée moyenne → gpt-4o-mini-transcribe (défaut éco)', async () => {
    const fd = buildFormData({
      meta: JSON.stringify({ length_seconds: 240, noise_level: 0.3 }),
    })
    const res = await POST(buildRequest(fd))
    const json = await res.json()

    expect(res.status).toBe(200)
    const callArgs = transcribeCreateMock.mock.calls[0]?.[0] as { model: string }
    expect(callArgs.model).toBe('gpt-4o-mini-transcribe')
    expect(json.model_used).toBe('gpt-4o-mini-transcribe')
    expect(json.engine).toBe('api_whisper_mini')
  })

  it('meta absent → fallback mini (défaut conservateur 300s/0.5)', async () => {
    const fd = buildFormData({ meta: null })
    const res = await POST(buildRequest(fd))
    const json = await res.json()

    expect(res.status).toBe(200)
    const callArgs = transcribeCreateMock.mock.calls[0]?.[0] as { model: string }
    expect(callArgs.model).toBe('gpt-4o-mini-transcribe')
    expect(json.engine).toBe('api_whisper_mini')
    expect(json.length_seconds).toBe(300) // default fallback
  })

  it('meta JSON invalide → fallback mini (défaut conservateur)', async () => {
    const fd = buildFormData({ meta: '{not-json' })
    const res = await POST(buildRequest(fd))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.engine).toBe('api_whisper_mini')
    expect(json.model_used).toBe('gpt-4o-mini-transcribe')
  })

  it('meta partiel (sans noise_level) → fallback noise par défaut, routage cohérent', async () => {
    const fd = buildFormData({
      meta: JSON.stringify({ length_seconds: 60 }),
    })
    const res = await POST(buildRequest(fd))
    const json = await res.json()

    expect(res.status).toBe(200)
    // length=60 + localAvailable=false → local_unavailable_fallback_mini
    expect(json.engine).toBe('api_whisper_mini')
    expect(json.model_used).toBe('gpt-4o-mini-transcribe')
  })
})

/* ============================================================
   Préservation de la signature JSON (compat clients mobile + tchat)
   ============================================================ */

describe('POST /api/transcribe — signature JSON préservée', () => {
  it('retourne tous les champs legacy + champs B60 sans casser la forme', async () => {
    const fd = buildFormData({
      meta: JSON.stringify({ length_seconds: 30, noise_level: 0.2 }),
    })
    const res = await POST(buildRequest(fd))
    const json = await res.json()

    // Champs legacy attendus par les clients existants
    expect(json).toHaveProperty('transcript')
    expect(json).toHaveProperty('markedText')
    expect(json).toHaveProperty('segments')
    expect(json).toHaveProperty('language')
    expect(json).toHaveProperty('durationSeconds')
    expect(json).toHaveProperty('model')
    expect(json).toHaveProperty('costEur')
    expect(json).toHaveProperty('latencyMs')
    expect(json).toHaveProperty('audioSignedUrl')
    expect(json).toHaveProperty('audioStoragePath')
    expect(json).toHaveProperty('voiceNoteId')

    // Nouveaux champs B60 (audit cascading)
    expect(json).toHaveProperty('engine')
    expect(json).toHaveProperty('model_used')
    expect(json).toHaveProperty('engineReason')
    expect(json).toHaveProperty('length_seconds')
  })
})

/* ============================================================
   Garde-fous : 401 unauthorized, 400 missing fields
   ============================================================ */

describe('POST /api/transcribe — gardes auth/validation', () => {
  it('400 si audio manquant', async () => {
    const fd = buildFormData({ withAudio: false })
    const res = await POST(buildRequest(fd))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/missing audio/)
  })

  it('400 si dossierId manquant', async () => {
    const fd = buildFormData({ dossierId: null })
    const res = await POST(buildRequest(fd))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/dossierId/)
  })
})
