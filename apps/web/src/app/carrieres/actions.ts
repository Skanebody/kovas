'use server'

/**
 * KOVAS — Server Action /carrieres (Lot #147 SITE-ANNEXES)
 *
 * Candidature spontanée : insert dans `spontaneous_applications` + email
 * notification interne. Pas de demandeur authentifié — service role only.
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

import {
  checkRateLimit,
  emailKey,
  ipKey,
  recordRateLimitHit,
} from '@/lib/anti-spam/rate-limits'
import { sendEmail } from '@/lib/email/send'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import {
  spontaneousApplicationSchema,
  type SpontaneousApplicationInput,
  type SpontaneousApplicationResult,
} from './schemas'

async function getClientIp(): Promise<string | null> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip')?.trim() ?? null
}

async function getUserAgent(): Promise<string | null> {
  const h = await headers()
  return h.get('user-agent')?.slice(0, 500) ?? null
}

export async function submitSpontaneousApplication(
  raw: SpontaneousApplicationInput,
): Promise<SpontaneousApplicationResult> {
  const parsed = spontaneousApplicationSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.')
      if (!fieldErrors[path]) fieldErrors[path] = issue.message
    }
    return {
      ok: false,
      error: 'Vérifiez les champs en erreur.',
      fieldErrors,
    }
  }
  const data = parsed.data

  if ((data.honeypot ?? '').length > 0) {
    return { ok: true, message: 'Votre candidature a bien été reçue.' }
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const clientIp = await getClientIp()
  const userAgent = await getUserAgent()

  if (clientIp) {
    const ipVerdict = await checkRateLimit(admin, ipKey(clientIp), 1, 3)
    if (!ipVerdict.allowed) {
      return {
        ok: false,
        error: 'Trop de demandes depuis votre connexion. Réessayez dans une heure.',
      }
    }
  }
  const emailVerdict = await checkRateLimit(admin, emailKey(data.email), 24 * 7, 3)
  if (!emailVerdict.allowed) {
    return {
      ok: false,
      error: 'Une candidature récente a déjà été enregistrée avec cet email.',
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: table non typée
  const { error: insertError } = await (admin as any)
    .from('spontaneous_applications')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      linkedin_url: data.linkedin_url ?? null,
      target_role: data.target_role,
      message: data.message,
      source_ip: clientIp,
      user_agent: userAgent,
      honeypot_value: data.honeypot ?? null,
    })

  if (insertError) {
    console.error('[carrieres:insert] error', insertError)
    return {
      ok: false,
      error: "Impossible d'enregistrer votre candidature. Réessayez dans un instant.",
    }
  }

  try {
    await recordRateLimitHit(admin, [
      emailKey(data.email),
      ...(clientIp ? [ipKey(clientIp)] : []),
    ])
  } catch (err) {
    console.warn('[carrieres:rate-limit-hit] failed', err)
  }

  // Notification interne
  try {
    await sendEmail({
      to: COMPANY_IDENTITY.emails.contactGeneral,
      subject: `[Candidature spontanée] ${data.first_name} ${data.last_name} — ${data.target_role}`,
      text: [
        `Nom : ${data.first_name} ${data.last_name}`,
        `Email : ${data.email}`,
        data.linkedin_url ? `LinkedIn : ${data.linkedin_url}` : null,
        `Rôle visé : ${data.target_role}`,
        '',
        'Message :',
        data.message,
      ]
        .filter(Boolean)
        .join('\n'),
      category: 'transactional',
      replyTo: data.email,
    })
  } catch (err) {
    console.warn('[carrieres:notify-internal] failed', err)
  }

  // Auto-reply
  try {
    await sendEmail({
      to: data.email,
      subject: 'Votre candidature spontanée a bien été reçue — KOVAS',
      text: [
        `Bonjour ${data.first_name},`,
        '',
        "Nous avons bien reçu votre candidature spontanée et la conservons en réserve. Aucune offre n'est ouverte actuellement, mais nous reviendrons vers vous dès qu'un poste correspondant à votre profil sera créé.",
        '',
        "Si votre situation évolue, n'hésitez pas à actualiser votre LinkedIn ou à nous écrire à contact@kovas.fr.",
        '',
        'Cordialement,',
        "L'équipe KOVAS",
      ].join('\n'),
      category: 'transactional',
    })
  } catch (err) {
    console.warn('[carrieres:auto-reply] failed', err)
  }

  return {
    ok: true,
    message:
      'Votre candidature a bien été enregistrée. Nous la conservons en réserve et reviendrons vers vous si un poste correspondant s’ouvre.',
  }
}
