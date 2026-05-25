import { sendEmail } from '@/lib/email/send'
import { NextResponse } from 'next/server'

interface WaitlistPayload {
  fullName?: string
  email?: string
  useCase?: string
}

const ADMIN_EMAIL = process.env.PROS_DEMO_ADMIN_EMAIL ?? 'contact@kovas.fr'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * POST /api/api-publique-waitlist
 *
 * Inscription à la liste d'attente API publique. Notifie l'admin.
 */
export async function POST(request: Request) {
  let payload: WaitlistPayload
  try {
    payload = (await request.json()) as WaitlistPayload
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 })
  }

  const fullName = payload.fullName?.trim() ?? ''
  const email = payload.email?.trim() ?? ''
  const useCase = payload.useCase?.trim() ?? ''

  if (!fullName || !email) {
    return NextResponse.json({ error: 'Nom et email sont obligatoires.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 })
  }

  const adminLines = [
    `Nom : ${fullName}`,
    `Email : ${email}`,
    `Usage prévu : ${useCase || 'non précisé'}`,
  ]

  const adminResult = await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Nouvelle inscription API waitlist KOVAS — ${fullName}`,
    text: `Inscription à la liste d'attente API publique.\n\n${adminLines.join('\n')}`,
    html: `<h2>Nouvelle inscription liste d'attente API</h2><ul>${adminLines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('')}</ul>`,
    category: 'transactional',
  })

  await sendEmail({
    to: email,
    subject: "KOVAS — vous êtes sur la liste d'attente API",
    text: `Bonjour ${fullName},\n\nVous êtes officiellement inscrit sur la liste d'attente de l'API publique KOVAS.\n\nNous vous tiendrons informé(e) dès l'ouverture des accès anticipés, prévue en Phase 2 (M10+).\n\nÀ très bientôt,\nL'équipe KOVAS`,
    html: `<p>Bonjour ${escapeHtml(fullName)},</p><p>Vous êtes officiellement inscrit sur la liste d'attente de l'API publique KOVAS.</p><p>Nous vous tiendrons informé(e) dès l'ouverture des accès anticipés, prévue en Phase 2 (M10+).</p><p>À très bientôt,<br/>L'équipe KOVAS</p>`,
    category: 'transactional',
  })

  if (!adminResult.success) {
    return NextResponse.json(
      { error: 'Notification interne en échec. Merci de réessayer plus tard.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}
