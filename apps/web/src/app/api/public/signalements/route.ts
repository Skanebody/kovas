import { createAdminClient } from '@/lib/admin/supabase-admin'
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * POST /api/public/signalements
 *
 * Endpoint public (anonyme OK) pour signaler un diagnostiqueur.
 *
 * Body JSON :
 *   {
 *     diagnosticianId: string  (uuid)
 *     reason: 'faux_diagnostiqueur'|'rapport_frauduleux'|'dpe_aberrant'|'disparu_apres_paiement'|'identite_usurpee'|'non_certifie'|'autre'
 *     description?: string
 *     reporterEmail?: string  (optionnel — meilleur suivi si fourni)
 *     proofUrls?: string[]
 *   }
 *
 * Rate-limit applicatif : 1 signalement / IP / diagId / 24h (vérif SQL).
 *
 * Le trigger SQL `trg_signalement_threshold` se charge du seuil 3+ / 6 mois.
 */

const ALLOWED_REASONS = new Set([
  'faux_diagnostiqueur',
  'rapport_frauduleux',
  'dpe_aberrant',
  'disparu_apres_paiement',
  'identite_usurpee',
  'non_certifie',
  'autre',
])

interface SignalementInput {
  diagnosticianId: string
  reason: string
  description?: string
  reporterEmail?: string
  proofUrls?: string[]
}

function extractClientIp(req: Request): string {
  // Vercel + Cloudflare standard
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip') ?? '0.0.0.0'
}

function hashIpDaily(ip: string): string {
  // Hash IP + jour courant — anonyme mais permet rate-limit 24h / diag.
  const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const salt = process.env.IP_HASH_SALT ?? 'kovas-signalement-salt'
  return createHash('sha256').update(`${ip}:${day}:${salt}`).digest('hex')
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: SignalementInput
  try {
    body = (await req.json()) as SignalementInput
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Validation
  if (typeof body.diagnosticianId !== 'string' || body.diagnosticianId.length < 8) {
    return NextResponse.json({ error: 'diagnosticianId requis' }, { status: 400 })
  }
  if (typeof body.reason !== 'string' || !ALLOWED_REASONS.has(body.reason)) {
    return NextResponse.json({ error: 'reason invalide' }, { status: 400 })
  }
  const description =
    typeof body.description === 'string' && body.description.length > 0
      ? body.description.slice(0, 2000)
      : null
  const reporterEmail =
    typeof body.reporterEmail === 'string' && body.reporterEmail.length > 3
      ? body.reporterEmail.slice(0, 200)
      : null
  const proofUrls = Array.isArray(body.proofUrls)
    ? body.proofUrls.filter((u) => typeof u === 'string').slice(0, 5)
    : []

  const ip = extractClientIp(req)
  const reporterIpHash = hashIpDaily(ip)

  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour tables VAL-1
  const supabase = createAdminClient() as any

  // Rate-limit : 1 signalement / IP / diag / 24h (via SELECT idempotent)
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('diagnostician_signalements')
    .select('id', { count: 'exact', head: true })
    .eq('diagnostician_id', body.diagnosticianId)
    .eq('reporter_ip_hash', reporterIpHash)
    .gte('created_at', since24h)

  if ((recentCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message:
          "Vous avez déjà signalé ce diagnostiqueur dans les dernières 24 heures. Notre équipe vous recontactera si nécessaire.",
      },
      { status: 429 },
    )
  }

  // Insert
  const { data, error } = await supabase
    .from('diagnostician_signalements')
    .insert({
      diagnostician_id: body.diagnosticianId,
      reporter_email: reporterEmail,
      reporter_ip_hash: reporterIpHash,
      reason: body.reason,
      description,
      proof_urls: proofUrls,
      status: 'new',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[signalements] insert error', error.message)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: (data as { id?: string } | null)?.id })
}
