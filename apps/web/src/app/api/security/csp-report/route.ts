import { publicLimiter } from '@/lib/rate-limit'
/**
 * Endpoint POST de réception des violations CSP.
 * ─────────────────────────────────────────────────────────────
 * Le navigateur POST automatiquement un rapport JSON quand une directive
 * Content-Security-Policy est violée (cf. report-uri + report-to dans
 * next.config.ts > CONTENT_SECURITY_POLICY).
 *
 * Comportement :
 *   - Rate-limit 50 reports/min/IP via publicLimiter Upstash (sinon noop).
 *   - Log structuré dans Sentry via captureMessage(level='warning') avec
 *     context `csp_violation` et le body stringifié.
 *   - Toujours retourne 204 No Content (anti-debug bot : pas d'écho).
 *
 * Sécurité :
 *   - N'expose AUCUN détail au caller (status code uniforme, pas de body).
 *   - Si le body est mal formé, on log "malformed report" en Sentry mais
 *     on retourne 204 quand même.
 */
import * as Sentry from '@sentry/nextjs'
import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Extrait une IP utilisable pour la clé rate-limit. Vercel injecte
 * x-forwarded-for ; on prend la première (client réelle).
 */
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ─── Rate-limit basique 50 req/min/IP (Upstash publicLimiter ou noop)
  if (publicLimiter) {
    try {
      const ip = getClientIp(req)
      const { success } = await publicLimiter.limit(`csp-report:${ip}`)
      if (!success) {
        // Silencieux côté caller, on n'apprend rien à un bot.
        return new NextResponse(null, { status: 204 })
      }
    } catch {
      // Upstash indisponible : on poursuit (fail-open sur CSP report,
      // ce n'est pas un endpoint critique).
    }
  }

  // ─── Lecture du body : navigateurs envoient application/csp-report
  // ou application/reports+json selon report-uri vs report-to.
  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    Sentry.captureMessage('csp_violation: malformed report body', {
      level: 'warning',
      tags: { source: 'csp-report' },
    })
    return new NextResponse(null, { status: 204 })
  }

  // ─── Log structuré dans Sentry. On stringify pour éviter d'envoyer
  // des objets profonds qui dépasseraient les limites Sentry.
  try {
    const payload = JSON.stringify(body).slice(0, 8192) // cap 8KB anti-flood
    Sentry.captureMessage('csp_violation', {
      level: 'warning',
      tags: { source: 'csp-report' },
      extra: { report: payload },
    })
  } catch {
    // En dernier recours, on ignore. Pas de leak côté caller.
  }

  return new NextResponse(null, { status: 204 })
}
