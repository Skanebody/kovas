/**
 * POST /api/admin/tests/[test]
 *
 * Tests système (smoke tests) instrumentés.
 *
 * Tests supportés (V1) :
 *   - resend           : envoie un email test via Resend (body.email requis)
 *   - stripe-webhook   : log uniquement V1 (V2 : appel /api/webhooks/stripe en local)
 *   - vision-ai        : log uniquement V1 (V2 : route Vision Haiku)
 *   - whisper          : log uniquement V1 (V2 : transcription stub)
 *   - ban-search       : pingue l'API BAN avec une query
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { sendEmail } from '@/lib/email/send'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ test: string }>
}

const SUPPORTED_TESTS = new Set(['resend', 'stripe-webhook', 'vision-ai', 'whisper', 'ban-search'])

interface TestResult {
  ok: boolean
  detail: string
}

export async function POST(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  // Narrowing local pour la closure (access.user nullé après checks).
  const adminUser = access.user
  const { test } = await params
  if (!SUPPORTED_TESTS.has(test)) {
    return NextResponse.json({ error: `Test ${test} inconnu` }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await request.json().catch(() => ({}))) as Record<string, unknown>) ?? {}
  } catch {
    body = {}
  }

  const start = Date.now()
  let result: TestResult = { ok: false, detail: 'not implemented' }

  await withAuditWrapper(
    {
      adminUserId: adminUser.id,
      actionType: `test_${test.replace(/-/g, '_')}`,
      targetType: 'test',
      targetId: test,
      targetLabel: test,
      payload: body,
    },
    async () => {
      switch (test) {
        case 'resend': {
          const email =
            typeof body.email === 'string' && body.email.trim() !== ''
              ? body.email.trim()
              : adminUser.email
          const r = await sendEmail({
            to: email,
            subject: 'KOVAS Admin · Test envoi Resend',
            text: `Test envoyé depuis /admin/actions à ${new Date().toISOString()}`,
            category: 'transactional',
          })
          result = {
            ok: r.success,
            detail: r.success
              ? `Envoi OK${r.stub ? ' (stub, pas de Resend key)' : ''} → ${email}`
              : `Échec : ${r.error ?? 'unknown'}`,
          }
          break
        }
        case 'stripe-webhook': {
          result = {
            ok: true,
            detail: 'V1 log only — V2 : POST /api/webhooks/stripe avec event factice',
          }
          break
        }
        case 'vision-ai': {
          result = { ok: true, detail: 'V1 log only — V2 : route Vision Haiku upload photo test' }
          break
        }
        case 'whisper': {
          result = { ok: true, detail: 'V1 log only — V2 : transcription stub 5s audio' }
          break
        }
        case 'ban-search': {
          const q = typeof body.q === 'string' && body.q.trim() !== '' ? body.q.trim() : 'Paris'
          try {
            const res = await fetch(
              `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`,
            )
            if (!res.ok) {
              result = { ok: false, detail: `BAN HTTP ${res.status}` }
            } else {
              const json = (await res.json()) as {
                features?: Array<{ properties?: { label?: string } }>
              }
              const label = json.features?.[0]?.properties?.label ?? '(aucun résultat)'
              result = { ok: true, detail: `BAN OK → ${label}` }
            }
          } catch (err) {
            result = {
              ok: false,
              detail: `BAN error: ${err instanceof Error ? err.message : 'unknown'}`,
            }
          }
          break
        }
      }
    },
  )

  return NextResponse.json({
    ok: result.ok,
    test,
    duration_ms: Date.now() - start,
    detail: result.detail,
  })
}
