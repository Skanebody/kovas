import {
  type AudioMetadata,
  type TranscriptionEngine,
  decideTranscriptionEngine,
} from '@/lib/audio/transcription-router'
import { buildWhisperPrompt } from '@/lib/local-ai/vocabulary/diagnostic-jargon'
import { trackPerf } from '@/lib/observability/track-perf'
import { createClient } from '@/lib/supabase/server'
import {
  type AnnotatedSegment,
  annotateSegments,
  buildMarkedTranscript,
} from '@/lib/voice/segment-confidence'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

/**
 * Transcription audio via OpenAI Whisper — cascading B58 actif (Lot B60).
 *
 * Flux :
 *   1. Auth user + accès dossier (RLS).
 *   2. Parse multipart : `audio` (File) + `dossierId` (+ `meta` JSON optionnel).
 *   3. Décide le moteur via `decideTranscriptionEngine` (Lot B58, pure-fn) :
 *      - `local_wasm`           → fallback `gpt-4o-mini-transcribe` côté serveur.
 *        TODO (lot futur Whisper local) : le client devrait court-circuiter le
 *        serveur dès que whisper.cpp-wasm est chargé (cf. JSDoc B58 §IMPORTANT).
 *      - `api_whisper_mini`     → `gpt-4o-mini-transcribe` ($0.003/min).
 *      - `api_whisper_standard` → `whisper-1` ($0.006/min, long/bruyant).
 *   4. Appel OpenAI `audio.transcriptions.create` (verbose_json + segments).
 *   5. Annote chaque segment (confidence reliable/doubtful/inaudible) — MISSION-E.
 *   6. Upload du blob source dans `mission-audio-segments/` (signed URL 1h) pour
 *      le replay inline depuis le chat.
 *   7. Persiste dans `voice_notes` (MISSION-I) — sans cet INSERT les vocaux
 *      disparaissent au refresh.
 *
 * Économie immédiate : sur les audios courts/silencieux qui devraient être
 * `local_wasm` (~30% du volume), on fallback systématiquement sur le `mini` au
 * lieu du `standard` → -50% du coût transcription sur cette tranche.
 *
 * Compat clients : la signature JSON de la réponse est **préservée** (champs
 * existants intacts). On ajoute uniquement `engine` + `model_used` + `engineReason`
 * en bonus pour l'audit et le futur dashboard "Économies IA".
 *
 * Lot B93 (refonte acqui-target 2026-05) :
 *   - Lit l'optional header `X-Transcription-Engine` envoyé par le helper client
 *     `lib/audio/client-transcribe.ts` (valeur `local_wasm_attempted_failed`
 *     si le client a tenté WASM local et a échoué). Sert d'audit pour mesurer
 *     le ratio local vs API et prioriser le branchement réel de la lib WASM.
 *   - Calcule `suggested_engine` (ce qu'aurait décidé le router si `localAvailable=true`)
 *     en plus de `engine` (décision réelle avec localAvailable=false serveur-side).
 *     Permet de mesurer le "would-be local" sur les audios courts/silencieux.
 *   - Instrumente l'appel OpenAI via `trackPerf` avec opération
 *     `ai.whisper.engine.{api_whisper_mini,api_whisper_standard}` → counter
 *     PostHog/Supabase pour le dashboard "Économies IA".
 *
 * Authority : CLAUDE.md §3 feature #1 + MISSION-E niveau 3 + Lot B58/B60/B93.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const AUDIO_STORAGE_BUCKET = 'mission-audio-segments'
const SIGNED_URL_TTL_SECONDS = 3600 // 1h pour le replay segment

/**
 * Valeurs par défaut conservatrices quand le client n'envoie pas de `meta`.
 * `length_seconds=300` (5 min) force `api_whisper_mini` (sous le seuil long de
 * 600s) ; `noise_level=0.5` (médiane neutre) au-dessus du seuil local-eligible
 * de 0.4 — donc même si on activait le local, ce default ne basculerait pas
 * vers WASM. Combiné à `localAvailable=false` (forcé serveur-side), on est sûr
 * de tomber sur `api_whisper_mini`. C'est volontaire : coût-éco par défaut.
 */
const DEFAULT_META_FALLBACK: AudioMetadata = {
  length_seconds: 300,
  noise_level: 0.5,
}

/* ─── Mapping engine → identifiant modèle OpenAI ──────────────────────────── */

/**
 * Le router B58 renvoie des engines abstraits ; cette fonction les mappe vers
 * les identifiants concrets attendus par le SDK OpenAI installé.
 *
 * `local_wasm` n'est pas un modèle OpenAI : si on reçoit cet engine côté
 * serveur, c'est que le client n'a pas pu/voulu faire le WASM lui-même → on
 * tombe sur `gpt-4o-mini-transcribe` (le plus économique, 50% moins cher que
 * `whisper-1`). Override possible via `OPENAI_MODEL_TRANSCRIBE` pour les
 * environnements de pre-prod qui veulent tester whisper-1 sur tout.
 */
function mapEngineToOpenAiModel(engine: TranscriptionEngine): string {
  const override = process.env.OPENAI_MODEL_TRANSCRIBE
  if (override) return override

  switch (engine) {
    case 'api_whisper_standard':
      return 'whisper-1'
    case 'api_whisper_mini':
      return 'gpt-4o-mini-transcribe'
    case 'local_wasm':
      // Fallback serveur : on traite local_wasm comme un "hint" non honorable
      // ici (pas de WASM côté serveur Node.js sur Vercel — c'est un sujet
      // navigateur). Le mini est le défaut éco le moins risqué.
      return 'gpt-4o-mini-transcribe'
  }
}

/**
 * Parse le champ `meta` (JSON stringifié dans le multipart) en `AudioMetadata`.
 * Robuste aux meta partielles : si `length_seconds` ou `noise_level` manquent /
 * sont invalides, on retombe sur `DEFAULT_META_FALLBACK` (cf. JSDoc ci-dessus).
 */
function parseAudioMeta(rawMeta: unknown): AudioMetadata {
  if (typeof rawMeta !== 'string' || rawMeta.length === 0) {
    return DEFAULT_META_FALLBACK
  }

  try {
    const parsed = JSON.parse(rawMeta) as Partial<AudioMetadata>
    const len = Number(parsed.length_seconds)
    const noise = Number(parsed.noise_level)

    const safeLen = Number.isFinite(len) && len > 0 ? len : DEFAULT_META_FALLBACK.length_seconds
    const safeNoise =
      Number.isFinite(noise) && noise >= 0 && noise <= 1 ? noise : DEFAULT_META_FALLBACK.noise_level

    return {
      length_seconds: safeLen,
      noise_level: safeNoise,
      sample_rate:
        typeof parsed.sample_rate === 'number' && parsed.sample_rate > 0
          ? parsed.sample_rate
          : undefined,
      channels:
        typeof parsed.channels === 'number' && parsed.channels > 0 ? parsed.channels : undefined,
    }
  } catch {
    return DEFAULT_META_FALLBACK
  }
}

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // API key check
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured', stub: true },
      { status: 503 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('audio') as File | null
  // Accept dossierId (new) or missionId (legacy) — we treat both as dossierId.
  const dossierId = (formData.get('dossierId') ?? formData.get('missionId')) as string | null
  // sessionId optionnel — permet de scoper le replay segment par session mission.
  const sessionId = (formData.get('sessionId') ?? null) as string | null
  // clientLocalId optionnel (BUG 2) — UUID local Dexie de la note vocale offline.
  // Quand fourni, l'INSERT voice_notes devient un UPSERT idempotent : un rejeu de
  // sync (réponse perdue après transcription réussie) retombe sur la même ligne.
  const rawClientLocalId = formData.get('clientLocalId')
  const clientLocalId =
    typeof rawClientLocalId === 'string' && rawClientLocalId.length > 0 ? rawClientLocalId : null
  // meta JSON optionnel (Lot B60) : { length_seconds, noise_level, sample_rate?, channels? }
  const rawMeta = formData.get('meta')

  if (!file || !dossierId) {
    return NextResponse.json({ error: 'missing audio or dossierId' }, { status: 400 })
  }

  // Verify dossier belongs to user's org + fetch the included mission types
  // pour booster Whisper avec le vocab pertinent (DPE + Amiante + ...).
  const { data: dossier, error: dossierError } = await supabase
    .from('dossiers')
    .select('id, organization_id, missions(type)')
    .eq('id', dossierId)
    .single()
  if (dossierError || !dossier) {
    return NextResponse.json({ error: 'dossier not found' }, { status: 404 })
  }

  const orgId = dossier.organization_id as string
  const missionTypes = ((dossier.missions ?? []) as { type: string }[]).map((m) => m.type)

  // ── Cascading B58 : décide quel moteur utiliser ──────────────────────────
  // localAvailable=false : on est côté serveur Node.js, pas de WASM ici. Si
  // le router renvoie local_wasm, on tombera proprement sur mini via le mapper.
  const audioMeta = parseAudioMeta(rawMeta)
  const decision = decideTranscriptionEngine(audioMeta, { localAvailable: false })
  const model = mapEngineToOpenAiModel(decision.engine)

  // ── Lot B93 : audit ratio local_wasm vs API ─────────────────────────────
  // Le client (helper `lib/audio/client-transcribe.ts`) peut envoyer ce header
  // pour signaler qu'il a tenté la transcription locale WASM et que ça a
  // échoué (lib pas chargée, hardware incompat, inference crash). Sans le
  // header, on suppose que le client n'a juste pas tenté local (audio long,
  // bruyant, browser ne supporte pas WASM SIMD).
  //
  // On calcule en parallèle `suggestedEngine` : ce qu'aurait décidé le router
  // si le client avait du WASM dispo. Permet de mesurer le "would-be local"
  // (potentiel d'économie une fois la lib WASM réellement branchée).
  const engineHint = request.headers.get('X-Transcription-Engine')
  const localAttemptedFailed = engineHint === 'local_wasm_attempted_failed'
  const suggestedDecision = decideTranscriptionEngine(audioMeta, { localAvailable: true })
  const suggestedEngine = suggestedDecision.engine

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const prompt = buildWhisperPrompt(missionTypes)

  try {
    const t0 = Date.now()
    // verbose_json + segment granularity → on récupère avg_logprob + no_speech_prob
    // par segment pour exposer la confiance au client (MISSION-E niveau 3).
    //
    // Lot B93 : on wrappe l'appel dans `trackPerf` pour incrémenter un counter
    // par engine (`ai.whisper.engine.{api_mini,api_standard}`). Best-effort —
    // si l'insert perf_metrics échoue, on continue (trackPerf swallow l'erreur).
    const result = await trackPerf(
      {
        operation: `ai.whisper.engine.${decision.engine}`,
        organizationId: orgId,
        metadata: {
          model,
          engine: decision.engine,
          engine_reason: decision.reason,
          length_seconds: audioMeta.length_seconds,
          noise_level: audioMeta.noise_level,
          // Trace les retombées local→API pour mesurer le potentiel d'économie
          // (cf. doc AI_ECONOMICS § "Whisper hybride local WASM + API").
          local_wasm_attempted_failed: localAttemptedFailed,
          suggested_engine: suggestedEngine,
        },
      },
      () =>
        openai.audio.transcriptions.create({
          file,
          model,
          language: 'fr',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
          prompt,
        }),
    )
    const latencyMs = Date.now() - t0

    // Tarif modèle-dépendant : standard ($0.006/min) vs mini ($0.003/min).
    const pricePerMinUsd = model === 'whisper-1' ? 0.006 : 0.003
    const duration = (result as { duration?: number }).duration ?? 0
    const costEur = Math.round((duration / 60) * pricePerMinUsd * 0.93 * 100000) / 100000 // approx EUR

    // Annote les segments verbose_json
    const rawSegments = (result as { segments?: unknown }).segments
    const segments: AnnotatedSegment[] = annotateSegments(rawSegments)
    const markedText = segments.length > 0 ? buildMarkedTranscript(segments) : result.text

    // Upload du blob source pour permettre le replay inline (audio signé 1h)
    // Le segment_id est l'index → on upload UN seul fichier (l'audio complet)
    // et on stocke aussi les timestamps start/end pour seek côté <audio>.
    let audioSignedUrl: string | null = null
    let audioStoragePath: string | null = null
    try {
      const ext = file.type.includes('mp4') ? 'mp4' : 'webm'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
      const scopeFolder = sessionId ?? dossierId
      audioStoragePath = `${orgId}/${scopeFolder}/${fileName}`
      const arrayBuffer = await file.arrayBuffer()
      const uploadRes = await supabase.storage
        .from(AUDIO_STORAGE_BUCKET)
        .upload(audioStoragePath, new Blob([arrayBuffer], { type: file.type }), {
          contentType: file.type || 'audio/webm',
          upsert: false,
          cacheControl: '3600',
        })
      if (uploadRes.error) {
        // Bucket peut ne pas exister (création lazy en V1) — on n'échoue pas
        // la transcription pour autant, juste pas de replay disponible.
        console.warn('[transcribe] audio upload failed', uploadRes.error.message)
        audioStoragePath = null
      } else {
        const { data: signed } = await supabase.storage
          .from(AUDIO_STORAGE_BUCKET)
          .createSignedUrl(audioStoragePath, SIGNED_URL_TTL_SECONDS)
        audioSignedUrl = signed?.signedUrl ?? null
      }
    } catch (storageErr) {
      console.warn('[transcribe] storage step failed', storageErr)
    }

    // ── PERSISTENCE voice_notes (MISSION-I) ────────────────────────────
    // Sans cet INSERT, les vocaux disparaissent à chaque refresh et l'analyse
    // finale ne trouve rien à analyser. Critique pour le mode Capture.
    let voiceNoteId: string | null = null
    if (audioStoragePath) {
      const segmentsPayload = segments.map((s) => ({
        id: s.id,
        text: s.text,
        start: s.start,
        end: s.end,
        avgLogprob: s.avgLogprob,
        noSpeechProb: s.noSpeechProb,
        confidence: s.confidence,
      }))
      // BUG 2 : client_local_id ajouté par migration 20260528120000 (pas dans
      // les types générés) → cast `as never`. Avec clef → upsert idempotent ;
      // sans clef (mode online classique) → insert direct (legacy préservé).
      const voiceInsertPayload = {
        dossier_id: dossierId,
        organization_id: orgId,
        recorded_by: user.id,
        storage_path: audioStoragePath,
        duration_seconds: Math.round(duration),
        language: (result as { language?: string }).language ?? 'fr',
        provider: 'openai',
        transcript_raw: result.text,
        transcript_structured: { segments: segmentsPayload, markedText },
        ai_cost_eur: costEur,
        status: 'transcribed',
        transcribed_at: new Date().toISOString(),
        file_size_bytes: file.size,
        // CHECK constraint : ne tolère que pending|processing|transcribed|failed|skipped
        transcription_status: 'transcribed',
        transcription_model: model,
        transcription_cost_usd: costEur,
        client_local_id: clientLocalId,
      }
      const voiceQuery = clientLocalId
        ? supabase.from('voice_notes').upsert(voiceInsertPayload as never, {
            onConflict: 'dossier_id,client_local_id',
            ignoreDuplicates: false,
          })
        : supabase.from('voice_notes').insert(voiceInsertPayload as never)
      const { data: vn, error: vnErr } = await voiceQuery.select('id').single()
      if (vnErr) {
        console.warn('[transcribe] voice_notes insert failed (non blocking)', vnErr.message)
      } else if (vn && typeof (vn as { id?: unknown }).id === 'string') {
        voiceNoteId = (vn as { id: string }).id
      }
    }

    return NextResponse.json({
      transcript: result.text,
      // markedText : transcription avec [inaudible] sur les segments rejetés
      // et *italique* sur les douteux — utilisable pour Claude / persistence.
      markedText,
      // Segments annotés pour rendu UI bulle USER (italique + replay inline)
      segments: segments.map((s) => ({
        id: s.id,
        text: s.text,
        start: s.start,
        end: s.end,
        avgLogprob: s.avgLogprob,
        noSpeechProb: s.noSpeechProb,
        confidence: s.confidence,
      })),
      language: (result as { language?: string }).language ?? 'fr',
      durationSeconds: Math.round(duration),
      model,
      costEur,
      latencyMs,
      // URL signée 1h pour réécouter l'audio source (permettre le replay segment)
      audioSignedUrl,
      audioStoragePath,
      // ID de la voice_note persistée (null si l'INSERT a échoué ou pas d'audio)
      voiceNoteId,
      // ── Lot B60 : audit cascading B58 ─────────────────────────────────
      // engine = décision abstraite du router (local_wasm | api_whisper_mini | api_whisper_standard)
      // model_used = identifiant concret passé à OpenAI (whisper-1 | gpt-4o-mini-transcribe)
      // engineReason = motif lisible (long_audio_*, default_mini_economical, etc.)
      // length_seconds = durée utilisée par le router (pour audit/dashboard)
      engine: decision.engine,
      model_used: model,
      engineReason: decision.reason,
      length_seconds: audioMeta.length_seconds,
      // ── Lot B93 : audit ratio local_wasm vs API ─────────────────────
      // suggested_engine = ce qu'aurait décidé le router si le client avait
      // eu WASM dispo (utile pour mesurer le "would-be local"). Si égal à
      // `engine`, pas de différence. Si `local_wasm` mais engine = `api_whisper_mini`,
      // c'est exactement la tranche où l'on pourrait économiser.
      suggested_engine: suggestedEngine,
      // local_wasm_attempted_failed = true si le client a tenté local et
      // signalé un échec via le header X-Transcription-Engine.
      local_wasm_attempted_failed: localAttemptedFailed,
    })
  } catch (err) {
    // Log explicite côté serveur (visible dans le terminal `pnpm dev`)
    console.error('[transcribe] route threw exception', {
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : 'Unknown',
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined,
    })
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'transcription failed',
        // Détails additionnels en dev pour débugger côté browser
        ...(process.env.NODE_ENV !== 'production' && err instanceof Error
          ? { name: err.name, stack: err.stack?.split('\n').slice(0, 3) }
          : {}),
      },
      { status: 500 },
    )
  }
}
