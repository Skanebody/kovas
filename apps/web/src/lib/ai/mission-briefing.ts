/**
 * KOVAS — Wrapper TypeScript pour l'Edge Function `generate-mission-briefing`.
 *
 * Implémentation client-side (server-only) du use case Altman IA-first #11
 * du Strategic Playbook §16 : briefing personnalisé 30 min avant chaque
 * mission, généré par Claude Haiku 4.5.
 *
 * Usage type — server action / page server component :
 * ```
 * import { generateMissionBriefing } from '@/lib/ai/mission-briefing'
 * const briefing = await generateMissionBriefing({ missionId, accessToken })
 * if (briefing.ok) {
 *   return <MissionBriefingCard briefing={briefing.payload} />
 * }
 * ```
 *
 * Pour un appel depuis un Server Component, récupérer l'access_token via
 * `supabase.auth.getSession()` (cf. `lib/auth/current-user`).
 *
 * Authority : docs Strategic Playbook §16 (Altman) + Edge Function
 * `supabase/functions/generate-mission-briefing/index.ts`.
 */

const FUNCTION_URL_PATH = '/functions/v1/generate-mission-briefing'

export interface MissionBriefingPayload {
  /** Ex : "Mission Mme Martin · 14h · 12 rue de la République, Dieppe" */
  headline: string
  /** 2-3 phrases factuelles, ton sobre professionnel */
  context: string
  /** 1 à 3 risques à vérifier (impératif court) */
  risks: string[]
  /** 3 à 5 points concrets à ne pas oublier */
  checklist: string[]
  /** Estimation minutes (90 par défaut, ajusté par l'IA selon contexte) */
  duration_estimate_minutes: number
}

export interface MissionBriefingResult {
  mission_id: string
  briefing: MissionBriefingPayload
  tokens_used: { input: number; output: number }
  cost_eur: number
}

export type GenerateMissionBriefingResponse =
  | { ok: true; payload: MissionBriefingResult }
  | { ok: false; error: string; status: number }

export interface GenerateMissionBriefingInput {
  missionId: string
  /** access_token JWT user (RLS appliqué côté Supabase) */
  accessToken: string
  /** Override pour les tests / dev */
  baseUrl?: string
  /** Signal abort externe */
  signal?: AbortSignal
}

/**
 * Appelle l'Edge Function `generate-mission-briefing` et retourne un
 * résultat typé. Ne throw JAMAIS — toutes les erreurs sont traduites
 * en `{ ok: false, error, status }` pour faciliter l'usage côté UI.
 *
 * Server-only : nécessite `process.env.NEXT_PUBLIC_SUPABASE_URL` (ou le
 * baseUrl passé en argument pour les tests).
 */
export async function generateMissionBriefing(
  input: GenerateMissionBriefingInput,
): Promise<GenerateMissionBriefingResponse> {
  const baseUrl = input.baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) {
    return { ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL not set', status: 500 }
  }
  if (!input.missionId || !/^[0-9a-f-]{36}$/i.test(input.missionId)) {
    return { ok: false, error: 'missionId must be a valid uuid', status: 400 }
  }
  if (!input.accessToken) {
    return { ok: false, error: 'accessToken (user JWT) required', status: 401 }
  }

  const url = `${baseUrl.replace(/\/$/, '')}${FUNCTION_URL_PATH}`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({ mission_id: input.missionId }),
      // Briefing ~3-6 secondes côté Claude Haiku, on laisse de la marge.
      signal: input.signal,
      cache: 'no-store',
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: 'Invalid JSON response', status: res.status }
  }

  if (!res.ok) {
    const error =
      typeof json === 'object' && json && 'error' in json && typeof json.error === 'string'
        ? json.error
        : `HTTP ${res.status}`
    return { ok: false, error, status: res.status }
  }

  if (!isSuccessShape(json)) {
    return { ok: false, error: 'Unexpected response shape', status: res.status }
  }

  return {
    ok: true,
    payload: {
      mission_id: json.mission_id,
      briefing: json.briefing,
      tokens_used: json.tokens_used,
      cost_eur: json.cost_eur,
    },
  }
}

interface SuccessShape {
  ok: true
  mission_id: string
  briefing: MissionBriefingPayload
  tokens_used: { input: number; output: number }
  cost_eur: number
}

function isSuccessShape(x: unknown): x is SuccessShape {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  if (o.ok !== true) return false
  if (typeof o.mission_id !== 'string') return false
  if (typeof o.cost_eur !== 'number') return false
  if (typeof o.briefing !== 'object' || o.briefing === null) return false
  const b = o.briefing as Record<string, unknown>
  if (typeof b.headline !== 'string') return false
  if (typeof b.context !== 'string') return false
  if (!Array.isArray(b.risks) || !b.risks.every((r) => typeof r === 'string')) return false
  if (!Array.isArray(b.checklist) || !b.checklist.every((c) => typeof c === 'string')) return false
  if (typeof b.duration_estimate_minutes !== 'number') return false
  if (typeof o.tokens_used !== 'object' || o.tokens_used === null) return false
  const t = o.tokens_used as Record<string, unknown>
  if (typeof t.input !== 'number' || typeof t.output !== 'number') return false
  return true
}
