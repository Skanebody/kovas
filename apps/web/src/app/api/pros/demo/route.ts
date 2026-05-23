import { sendEmail } from '@/lib/email/send'
import { NextResponse } from 'next/server'

interface DemoPayload {
  fullName?: string
  cabinet?: string
  city?: string
  email?: string
  phone?: string
  monthlyVolume?: string
  currentSoftware?: string
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
 * POST /api/pros/demo
 *
 * Demande de démo soumise depuis `/pros/demo`. Notifie l'admin
 * (`PROS_DEMO_ADMIN_EMAIL`) et envoie une confirmation au prospect.
 */
export async function POST(request: Request) {
  let payload: DemoPayload
  try {
    payload = (await request.json()) as DemoPayload
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 })
  }

  const fullName = payload.fullName?.trim() ?? ''
  const cabinet = payload.cabinet?.trim() ?? ''
  const city = payload.city?.trim() ?? ''
  const email = payload.email?.trim() ?? ''
  const phone = payload.phone?.trim() ?? ''
  const monthlyVolume = payload.monthlyVolume?.trim() ?? ''
  const currentSoftware = payload.currentSoftware?.trim() ?? ''

  if (!fullName || !cabinet || !city || !email || !phone) {
    return NextResponse.json(
      { error: 'Tous les champs nom, cabinet, ville, email et téléphone sont obligatoires.' },
      { status: 400 },
    )
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 })
  }

  const adminLines = [
    `Nom : ${fullName}`,
    `Cabinet : ${cabinet}`,
    `Ville : ${city}`,
    `Email : ${email}`,
    `Téléphone : ${phone}`,
    `Volume mensuel : ${monthlyVolume || 'non précisé'}`,
    `Logiciel actuel : ${currentSoftware || 'non précisé'}`,
  ]

  const adminResult = await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Nouvelle demande de démo KOVAS — ${fullName} (${cabinet})`,
    text: `Nouvelle demande de démo reçue depuis /pros/demo.\n\n${adminLines.join('\n')}`,
    html: `<h2>Nouvelle demande de démo KOVAS</h2><p>Reçue depuis <code>/pros/demo</code>.</p><ul>${adminLines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('')}</ul>`,
    category: 'transactional',
  })

  // Confirmation prospect — best-effort, on n'échoue pas la requête si elle rate.
  await sendEmail({
    to: email,
    subject: 'KOVAS — votre demande de démo est bien reçue',
    text: `Bonjour ${fullName},\n\nNous avons bien reçu votre demande de démo KOVAS pour ${cabinet} (${city}).\n\nUn membre de notre équipe vous recontactera sous 48h ouvrées pour planifier un créneau.\n\nÀ très bientôt,\nL'équipe KOVAS\ncontact@kovas.fr`,
    html: `<p>Bonjour ${escapeHtml(fullName)},</p><p>Nous avons bien reçu votre demande de démo KOVAS pour <strong>${escapeHtml(
      cabinet,
    )}</strong> (${escapeHtml(city)}).</p><p>Un membre de notre équipe vous recontactera sous 48h ouvrées pour planifier un créneau.</p><p>À très bientôt,<br/>L'équipe KOVAS<br/><a href="mailto:contact@kovas.fr">contact@kovas.fr</a></p>`,
    category: 'transactional',
  })

  if (!adminResult.success) {
    return NextResponse.json(
      { error: 'Notification interne en échec. Merci de réessayer dans quelques minutes.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}
