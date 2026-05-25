'use server'

/**
 * KOVAS — Server Actions admin /press (Game Changer 5 acqui-target).
 *
 * Trois actions :
 *   1. triggerPressReleaseDraft — appelle l'Edge Function `send-monthly-press-release`
 *      pour générer un brouillon (le mois écoulé par défaut).
 *   2. approvePressRelease — passe status='draft' → 'approved' (Benjamin a relu).
 *   3. dispatchPressRelease — diffuse le communiqué aux journalistes opt-in.
 *      Envoie via Resend, crée 1 row press_release_sends par destinataire,
 *      passe status='sent' + sent_at.
 *
 * Sécurité :
 *   - verifyAdminAccess (admin + 2FA + secret OK) requis.
 *   - Idempotence : refuse de redispatcher un release status='sent' sauf force=true.
 *   - Pas de batch parallèle massif : envoi séquentiel pour respecter rate-limit Resend
 *     (gratuit = 10 req/s, pro = 100 req/s).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { sendEmail } from '@/lib/email/send'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<string> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
  return access.user.id
}

export async function triggerPressReleaseDraft(options?: {
  force?: boolean
  observatoireReportId?: string
}): Promise<{ ok: boolean; error?: string; details?: unknown }> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-monthly-press-release`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      force: options?.force ?? false,
      observatoire_report_id: options?.observatoireReportId,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    return { ok: false, error: `Edge Function échec : ${errText.slice(0, 300)}` }
  }

  const json = await response.json()
  revalidatePath('/admin/press')
  return { ok: true, details: json }
}

export async function approvePressRelease(
  releaseId: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireAdmin()
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: press_releases pas dans Database.types
  const { error } = await (supabase as any)
    .from('press_releases')
    .update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', releaseId)
    .eq('status', 'draft')

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/press')
  return { ok: true }
}

export async function archivePressRelease(
  releaseId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { error } = await (supabase as any)
    .from('press_releases')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', releaseId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/press')
  return { ok: true }
}

interface ContactRow {
  id: string
  email: string
  full_name: string
  beats: string[] | null
}

interface PressReleaseRow {
  id: string
  slug: string
  title: string
  subtitle: string | null
  dateline: string | null
  body_markdown: string
  status: 'draft' | 'pending_review' | 'approved' | 'sent' | 'archived'
  category: string
}

function buildPressReleaseEmail(
  release: PressReleaseRow,
  contact: ContactRow,
): { subject: string; html: string; text: string } {
  const subject = `[Communiqué KOVAS] ${release.title}`

  const firstName = contact.full_name.split(' ')[0] ?? ''
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,'

  const bodyParagraphs = release.body_markdown
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px 0;">${p.trim()}</p>`)
    .join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0F1419;line-height:1.65;max-width:680px;margin:0 auto;padding:32px;">
  <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5B7088;margin:0 0 8px 0;">Communiqué de presse</p>
  ${release.dateline ? `<p style="font-size:13px;color:#5B7088;margin:0 0 24px 0;">${release.dateline}</p>` : ''}
  <h1 style="font-size:24px;font-weight:700;margin:0 0 12px 0;letter-spacing:-0.3px;">${release.title}</h1>
  ${release.subtitle ? `<p style="font-size:16px;color:#1F2E4D;margin:0 0 28px 0;font-style:italic;">${release.subtitle}</p>` : ''}
  <hr style="border:none;border-top:1px solid #E7E2D2;margin:0 0 24px 0;" />
  <p style="margin:0 0 24px 0;">${greeting}</p>
  ${bodyParagraphs}
  <hr style="border:none;border-top:1px solid #E7E2D2;margin:32px 0 24px 0;" />
  <p style="font-size:13px;color:#5B7088;margin:0;">
    <strong>Contact presse</strong><br/>
    Benjamin Bel — fondateur de KOVAS<br/>
    <a href="mailto:contact@kovas.fr" style="color:#0F1E3D;">contact@kovas.fr</a><br/>
    <a href="https://kovas.fr/presse" style="color:#0F1E3D;">kovas.fr/presse</a>
  </p>
  <p style="font-size:11px;color:#7E8AA4;margin:24px 0 0 0;">
    Vous recevez ce communiqué parce que vous êtes inscrit·e à la liste presse de KOVAS.
    Pour vous désabonner, répondez « STOP » à cet email.
  </p>
</body>
</html>`

  const text = `${release.dateline ?? ''}

${release.title}
${release.subtitle ? `\n${release.subtitle}\n` : ''}

${greeting}

${release.body_markdown}

—
Contact presse : Benjamin Bel — contact@kovas.fr — https://kovas.fr/presse

Pour vous désabonner, répondez « STOP » à cet email.`

  return { subject, html, text }
}

export async function dispatchPressRelease(
  releaseId: string,
  options?: { beatsFilter?: string[]; force?: boolean },
): Promise<{
  ok: boolean
  error?: string
  sent?: number
  failed?: number
  contacts_count?: number
}> {
  await requireAdmin()
  const supabase = createAdminClient()

  // 1. Charge le release
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: releaseRaw, error: releaseErr } = await (supabase as any)
    .from('press_releases')
    .select('id, slug, title, subtitle, dateline, body_markdown, status, category')
    .eq('id', releaseId)
    .maybeSingle()

  if (releaseErr || !releaseRaw) {
    return { ok: false, error: 'Communiqué introuvable' }
  }
  const release = releaseRaw as PressReleaseRow

  if (release.status === 'sent' && !options?.force) {
    return { ok: false, error: 'Communiqué déjà diffusé (utilisez force=true pour rediffuser)' }
  }
  if (release.status !== 'approved' && release.status !== 'sent') {
    return {
      ok: false,
      error: `Diffusion impossible depuis status=${release.status}. Approuvez d'abord.`,
    }
  }

  // 2. Charge les contacts opt-in
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  let query = (supabase as any)
    .from('press_contacts')
    .select('id, email, full_name, beats')
    .eq('opt_in', true)
    .is('unsubscribed_at', null)

  if (options?.beatsFilter && options.beatsFilter.length > 0) {
    query = query.overlaps('beats', options.beatsFilter)
  }

  const { data: contactsRaw, error: contactsErr } = await query
  if (contactsErr) {
    return { ok: false, error: `Contacts presse : ${contactsErr.message}` }
  }
  const contacts = (contactsRaw ?? []) as ContactRow[]

  if (contacts.length === 0) {
    return { ok: false, error: 'Aucun contact presse opt-in', contacts_count: 0 }
  }

  // 3. Envoi séquentiel (rate-limit Resend friendly)
  let sent = 0
  let failed = 0

  for (const contact of contacts) {
    const { subject, html, text } = buildPressReleaseEmail(release, contact)
    const result = await sendEmail({
      to: contact.email,
      subject,
      html,
      text,
      category: 'product',
      tags: [
        { name: 'press_release_id', value: release.id },
        { name: 'press_release_slug', value: release.slug },
      ],
    })

    // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
    await (supabase as any).from('press_release_sends').upsert(
      {
        press_release_id: release.id,
        press_contact_id: contact.id,
        resend_message_id: result.id ?? null,
        sent_at: new Date().toISOString(),
        bounced_at: result.success ? null : new Date().toISOString(),
        bounce_reason: result.success ? null : (result.error?.slice(0, 500) ?? null),
      },
      { onConflict: 'press_release_id,press_contact_id' },
    )

    if (result.success) {
      sent += 1
      // Update contact tracking — incrément SQL via RPC évité ici pour rester
      // simple; on lit puis on écrit (acceptable car envoi séquentiel mono-cron).
      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      const { data: current } = await (supabase as any)
        .from('press_contacts')
        .select('emails_sent')
        .eq('id', contact.id)
        .maybeSingle()
      const currentCount = ((current as { emails_sent?: number } | null)?.emails_sent ?? 0) | 0
      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      await (supabase as any)
        .from('press_contacts')
        .update({
          emails_sent: currentCount + 1,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', contact.id)
    } else {
      failed += 1
    }

    // 100ms throttle pour rester sous 10 req/s (plafond Resend free)
    await new Promise((r) => setTimeout(r, 100))
  }

  // 4. Met à jour le release
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  await (supabase as any)
    .from('press_releases')
    .update({
      status: 'sent',
      contacts_at_send: contacts.length,
      emails_sent: sent,
      emails_failed: failed,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', release.id)

  revalidatePath('/admin/press')
  revalidatePath('/presse')

  return {
    ok: true,
    sent,
    failed,
    contacts_count: contacts.length,
  }
}
