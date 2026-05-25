/**
 * KOVAS — Routeur de transcription audio (Lot B58, refonte acqui-target 2026-05).
 *
 * Source : `docs/refonte-2026-05/AI_ECONOMICS.md` (technique 6 — "Whisper hybride
 * local WASM + API").
 *
 * Objectif : décider à la volée quel moteur utiliser pour transcrire un audio
 * donné. Trois moteurs cibles :
 *   - `local_wasm`           — whisper.cpp WebAssembly côté navigateur (coût 0 EUR,
 *                              latence un peu plus élevée mais offline-friendly)
 *   - `api_whisper_mini`     — OpenAI `gpt-4o-mini-transcribe` ($0.003/min)
 *   - `api_whisper_standard` — OpenAI `whisper-1` plein ($0.006/min, plus précis
 *                              sur longs/bruyants)
 *
 * Économie attendue : si ~50% des audios courts (<3 min) passent en local,
 * on coupe ~25% du coût total de transcription du parc.
 *
 * ─── IMPORTANT — Statut implémentation ────────────────────────────────────────
 * Ce module est **pure-fn de décision uniquement**. Il N'EXÉCUTE PAS la
 * transcription. Pour réellement faire tourner whisper.cpp en navigateur, un
 * lot futur dédié devra :
 *   1. Ajouter une dépendance type `whisper.cpp-wasm` (ou équivalent),
 *      benchmarker la taille du modèle ggml (tiny/base/small) vs cible <30 Mo,
 *   2. Câbler le router dans `apps/web/src/app/api/transcribe/route.ts` côté
 *      serveur (choix mini vs standard selon `AudioMetadata`), et créer un
 *      hook client `useLocalWhisper()` pour les audios courts détectés.
 *   3. Implémenter un fallback gracieux : si `engine === 'local_wasm'` mais
 *      `localAvailable === false` (modèle non chargé, navigateur incompat),
 *      le caller DOIT rebasculer sur `api_whisper_mini`.
 *
 * Tant que ce câblage n'existe pas, `decideTranscriptionEngine` peut renvoyer
 * `local_wasm` mais le caller doit traiter ce résultat comme un "hint" et
 * fallback API.
 *
 * Authority : CLAUDE.md §3 feature #1 (saisie vocale terrain hybride FR).
 */

/**
 * Métadonnées d'un audio à transcrire.
 *
 * `noise_level` ∈ [0, 1] où 0 = silence parfait, 1 = bruit ambiant max (chantier,
 * vent, machine outils). Mesuré côté client via RMS du flux MediaRecorder ou
 * Web Audio AnalyserNode (à brancher dans un lot ultérieur). En l'absence de
 * mesure, le caller doit passer `0.5` (médiane neutre).
 */
export interface AudioMetadata {
  length_seconds: number
  noise_level: number
  sample_rate?: number
  channels?: number
}

/** Options de décision (DI pour les tests, isolation des effets). */
export interface DecideOptions {
  /**
   * Le moteur local WASM est-il disponible côté caller ?
   *
   * - `true` (défaut) : le caller a chargé whisper.cpp WASM, on peut router local.
   * - `false` : pas d'implém locale → on retombe systématiquement sur API.
   *
   * Le caller doit honnêtement remonter cette valeur (feature flag, capacité
   * navigateur, modèle ggml chargé en cache, etc.).
   */
  localAvailable?: boolean
}

export type TranscriptionEngine = 'local_wasm' | 'api_whisper_mini' | 'api_whisper_standard'

export interface TranscriptionDecision {
  engine: TranscriptionEngine
  reason: string
}

/* ─── Seuils décisionnels ──────────────────────────────────────────────────── */

/**
 * Au-delà, on considère l'audio "long" et on bascule sur Whisper standard
 * (meilleure gestion contexte long, prompt biasing plus stable).
 * Valeur tirée de l'observation que la majorité des notes vocales terrain
 * KOVAS font < 3 min ; au-delà de 10 min on est sur un rapport oral complet
 * où la qualité prime sur le coût.
 */
const LONG_AUDIO_THRESHOLD_SECONDS = 600

/**
 * Au-dessous, on considère l'audio "court" (<3 min) — éligible local si
 * le bruit ambiant est raisonnable.
 */
const SHORT_AUDIO_THRESHOLD_SECONDS = 180

/**
 * Bruit max toléré pour passer en local. Au-delà, on garde l'API qui a un
 * modèle plus robuste (gpt-4o-mini-transcribe finetune anti-bruit).
 * Valeur empirique ; à recalibrer après benchmarks réels lot futur.
 */
const NOISE_THRESHOLD_FOR_LOCAL = 0.4

/* ─── Tarifs (USD/min) — alignés sur ai-cost-calculator AI_PRICING_DEFAULTS ── */

const PRICE_USD_PER_MIN_MINI = 0.003
const PRICE_USD_PER_MIN_STANDARD = 0.006

/**
 * Taux USD → EUR utilisé pour les estimations. Aligné sur le défaut de
 * `ai-cost-calculator` (variable env `USD_TO_EUR_RATE`, défaut 0.92).
 * On laisse le caller surcharger via paramètre si besoin (test ou config).
 */
const DEFAULT_USD_TO_EUR_RATE = 0.92

/* ─── decideTranscriptionEngine ────────────────────────────────────────────── */

/**
 * Décide pure-fn quel moteur de transcription utiliser.
 *
 * Règles (par priorité décroissante) :
 *   1. Si `localAvailable === false` → `api_whisper_mini` (fallback systématique).
 *   2. Si `length_seconds > 600` (>10 min, "long") → `api_whisper_standard`.
 *   3. Si `length_seconds < 180` && `noise_level < 0.4` → `local_wasm`.
 *   4. Sinon → `api_whisper_mini` (cas par défaut éco, 50% moins cher que standard).
 *
 * Sécurité : si `length_seconds <= 0` (audio vide / corrompu), on renvoie
 * `api_whisper_mini` avec une `reason` explicite — le caller décidera de
 * skipper ou de tenter quand même.
 */
export function decideTranscriptionEngine(
  meta: AudioMetadata,
  opts: DecideOptions = {},
): TranscriptionDecision {
  const localAvailable = opts.localAvailable ?? true

  // Garde-fou : audio invalide → on évite local (modèle WASM peut crasher
  // sur durée nulle) et on tente l'API qui a son propre fallback.
  if (!Number.isFinite(meta.length_seconds) || meta.length_seconds <= 0) {
    return {
      engine: 'api_whisper_mini',
      reason: 'invalid_length_fallback_mini',
    }
  }

  if (!localAvailable) {
    // Pas de local disponible : on prend mini par défaut sauf si audio long.
    if (meta.length_seconds > LONG_AUDIO_THRESHOLD_SECONDS) {
      return {
        engine: 'api_whisper_standard',
        reason: 'long_audio_no_local',
      }
    }
    return {
      engine: 'api_whisper_mini',
      reason: 'local_unavailable_fallback_mini',
    }
  }

  if (meta.length_seconds > LONG_AUDIO_THRESHOLD_SECONDS) {
    return {
      engine: 'api_whisper_standard',
      reason: 'long_audio_above_600s',
    }
  }

  if (
    meta.length_seconds < SHORT_AUDIO_THRESHOLD_SECONDS &&
    meta.noise_level < NOISE_THRESHOLD_FOR_LOCAL
  ) {
    return {
      engine: 'local_wasm',
      reason: 'short_quiet_audio_local_eligible',
    }
  }

  return {
    engine: 'api_whisper_mini',
    reason: 'default_mini_economical',
  }
}

/* ─── estimateTranscriptionCostEur ─────────────────────────────────────────── */

/**
 * Estime le coût EUR d'une transcription pour un moteur donné.
 *
 * Pure-fn — pas d'I/O, taux USD→EUR injectable pour les tests.
 *
 * Convention : on arrondit à 5 décimales EUR (cohérent avec le route handler
 * `/api/transcribe` actuel). Pour le storage centimes EUR voir
 * `ai-cost-calculator.ts`.
 */
export function estimateTranscriptionCostEur(
  meta: AudioMetadata,
  engine: TranscriptionEngine,
  usdToEurRate: number = DEFAULT_USD_TO_EUR_RATE,
): number {
  if (!Number.isFinite(meta.length_seconds) || meta.length_seconds <= 0) {
    return 0
  }

  if (engine === 'local_wasm') {
    return 0
  }

  const minutes = meta.length_seconds / 60
  const pricePerMinUsd =
    engine === 'api_whisper_standard' ? PRICE_USD_PER_MIN_STANDARD : PRICE_USD_PER_MIN_MINI

  const costUsd = minutes * pricePerMinUsd
  const costEur = costUsd * usdToEurRate

  return Math.round(costEur * 100000) / 100000
}

/* ─── estimateTranscriptionSavings ─────────────────────────────────────────── */

export interface SavingsInput {
  /** Total minutes audio à transcrire sur la période considérée. */
  totalMinutes: number
  /** Part des minutes routées en local_wasm (0-1). */
  localShareRatio: number
  /**
   * Part des minutes routées en mini (0-1).
   * Reste = standard. `localShareRatio + miniShareRatio` doit être ≤ 1
   * (sinon clampé pour garantir un standardShare ≥ 0).
   */
  miniShareRatio: number
}

export interface SavingsProjection {
  /** Coût EUR effectif avec le mix donné. */
  effectiveCostEur: number
  /** Coût EUR baseline (100% Whisper standard). */
  baselineCostEur: number
  /** Économie EUR (baseline - effective). Toujours ≥ 0. */
  savingsEur: number
  /** Économie en % (savingsEur / baselineCostEur). 0 si baseline = 0. */
  savingsPercent: number
}

/**
 * Projette l'économie de coût pour un mix local/mini/standard donné par rapport
 * au baseline 100% Whisper standard (le plus cher).
 *
 * Utile pour le dashboard "Économies IA" et les rapports mensuels.
 *
 * Clamp safety :
 *   - ratios < 0 → 0
 *   - ratios > 1 → 1
 *   - si local + mini > 1, on conserve local et on clampe mini à `1 - local`
 *     (le standard share devient 0, on n'inverse pas la logique métier).
 *   - totalMinutes < 0 → 0 (pas de coût négatif).
 */
export function estimateTranscriptionSavings(
  input: SavingsInput,
  usdToEurRate: number = DEFAULT_USD_TO_EUR_RATE,
): SavingsProjection {
  const totalMinutes = Math.max(0, input.totalMinutes)
  const local = Math.min(1, Math.max(0, input.localShareRatio))
  const miniRaw = Math.min(1, Math.max(0, input.miniShareRatio))
  const mini = Math.min(miniRaw, 1 - local)
  const standard = Math.max(0, 1 - local - mini)

  const baselineCostUsd = totalMinutes * PRICE_USD_PER_MIN_STANDARD
  const effectiveCostUsd =
    totalMinutes *
    (local * 0 + mini * PRICE_USD_PER_MIN_MINI + standard * PRICE_USD_PER_MIN_STANDARD)

  const baselineCostEur = round5(baselineCostUsd * usdToEurRate)
  const effectiveCostEur = round5(effectiveCostUsd * usdToEurRate)
  const savingsEur = Math.max(0, round5(baselineCostEur - effectiveCostEur))
  const savingsPercent =
    baselineCostEur > 0 ? Math.round((savingsEur / baselineCostEur) * 10000) / 100 : 0

  return {
    effectiveCostEur,
    baselineCostEur,
    savingsEur,
    savingsPercent,
  }
}

function round5(n: number): number {
  return Math.round(n * 100000) / 100000
}

/* ─── __testing : exposition seuils pour tests / dashboard ─────────────────── */

export const __testing = {
  LONG_AUDIO_THRESHOLD_SECONDS,
  SHORT_AUDIO_THRESHOLD_SECONDS,
  NOISE_THRESHOLD_FOR_LOCAL,
  PRICE_USD_PER_MIN_MINI,
  PRICE_USD_PER_MIN_STANDARD,
  DEFAULT_USD_TO_EUR_RATE,
}
