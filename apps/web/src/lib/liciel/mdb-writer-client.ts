/**
 * KOVAS — Client TypeScript du microservice mdb-writer.
 *
 * Pont entre Next.js (Vercel EU) et le microservice Java Spring Boot (Railway)
 * qui convertit le JSON pivot Liciel V4 en .mdb Jet 4.0.
 *
 * Authority :
 *   - Schema pivot : ./zip-v4-schema.ts (source de vérité)
 *   - Microservice : services/mdb-writer/ (Java + Jackcess + Spring Boot 3)
 *
 * Sécurité : appelé UNIQUEMENT depuis des routes API server-side. Jamais exposé
 * au client browser — les variables MDB_WRITER_* ne sont PAS NEXT_PUBLIC_.
 */

import { type LicielMissionV4, LicielMissionV4Schema } from './zip-v4-schema'

/* ────────────────────────────────────────────────────────────────────────── */
/* Configuration                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MdbWriterConfig {
  /** Base URL du microservice (sans slash final). Defaults to MDB_WRITER_URL env. */
  readonly url: string
  /** Clé API partagée (header X-API-Key). Defaults to MDB_WRITER_API_KEY env. */
  readonly apiKey: string
  /** Timeout request en ms. Defaults to 30s (Railway cold start friendly). */
  readonly timeoutMs?: number
}

export function getDefaultConfig(): MdbWriterConfig {
  const url = process.env.MDB_WRITER_URL
  const apiKey = process.env.MDB_WRITER_API_KEY
  if (!url || !apiKey) {
    throw new MdbWriterConfigError(
      'MDB_WRITER_URL et MDB_WRITER_API_KEY doivent être définis (server-only env vars).',
    )
  }
  return {
    url: url.replace(/\/+$/, ''),
    apiKey,
    timeoutMs: 30_000,
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Errors                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export class MdbWriterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyPreview?: string,
  ) {
    super(message)
    this.name = 'MdbWriterError'
  }
}

export class MdbWriterConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MdbWriterConfigError'
  }
}

export class MdbWriterValidationError extends Error {
  constructor(
    message: string,
    readonly issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }>,
  ) {
    super(message)
    this.name = 'MdbWriterValidationError'
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Client                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ConvertOptions {
  /** Override config (utile pour tests + multi-tenant). */
  readonly config?: MdbWriterConfig
  /** Injectable fetch pour les tests. Defaults to globalThis.fetch. */
  readonly fetchImpl?: typeof fetch
  /** AbortSignal externe (priorité sur timeoutMs). */
  readonly signal?: AbortSignal
}

/**
 * Convertit un pivot Liciel V4 en bytes .mdb via le microservice Java.
 *
 * 1. Valide le pivot avec Zod (échec rapide côté Next.js avant tout I/O)
 * 2. POST /convert avec X-API-Key + JSON body
 * 3. Retourne ArrayBuffer prêt à être embarqué dans le ZIP final ou streamé
 *
 * @throws {MdbWriterValidationError} si le pivot ne passe pas Zod
 * @throws {MdbWriterConfigError}     si env vars absentes
 * @throws {MdbWriterError}           si le microservice retourne une erreur HTTP
 */
export async function convertToMdb(
  pivot: LicielMissionV4,
  opts: ConvertOptions = {},
): Promise<ArrayBuffer> {
  // 1. Validation Zod fail-fast (évite un round-trip si invalide)
  const parsed = LicielMissionV4Schema.safeParse(pivot)
  if (!parsed.success) {
    throw new MdbWriterValidationError(
      `Pivot invalide (${parsed.error.issues.length} issue(s))`,
      parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    )
  }

  const config = opts.config ?? getDefaultConfig()
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch

  if (typeof fetchImpl !== 'function') {
    throw new MdbWriterConfigError('fetch is unavailable in this runtime')
  }

  // 2. Timeout + abort
  const abortCtrl = new AbortController()
  const timeoutMs = config.timeoutMs ?? 30_000
  const timeoutId = setTimeout(() => abortCtrl.abort(), timeoutMs)

  const onExternalAbort = () => abortCtrl.abort()
  if (opts.signal) {
    if (opts.signal.aborted) abortCtrl.abort()
    else opts.signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const response = await fetchImpl(`${config.url}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-msaccess',
        'X-API-Key': config.apiKey,
      },
      body: JSON.stringify(parsed.data),
      signal: abortCtrl.signal,
    })

    if (!response.ok) {
      const preview = await safeText(response, 500)
      throw new MdbWriterError(
        `MDB writer returned ${response.status} ${response.statusText}`,
        response.status,
        preview,
      )
    }

    return await response.arrayBuffer()
  } finally {
    clearTimeout(timeoutId)
    if (opts.signal) opts.signal.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * Health-check léger du microservice (Spring Boot Actuator `/health`).
 * Utile pour la page status KOVAS + smoke tests CI.
 */
export async function pingMdbWriter(
  opts: { readonly config?: MdbWriterConfig; readonly fetchImpl?: typeof fetch } = {},
): Promise<{ ok: boolean; status: number }> {
  const config = opts.config ?? getDefaultConfig()
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  try {
    const response = await fetchImpl(`${config.url}/health`, { method: 'GET' })
    return { ok: response.ok, status: response.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Internals                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

async function safeText(response: Response, maxLen: number): Promise<string | undefined> {
  try {
    const text = await response.text()
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
  } catch {
    return undefined
  }
}
