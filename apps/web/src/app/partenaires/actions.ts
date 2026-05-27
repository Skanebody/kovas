'use server'

/**
 * KOVAS — Server Action /partenaires (Lot #147 SITE-ANNEXES)
 *
 * Demande de partenariat : insert dans `partner_inquiries` + notification
 * interne + auto-reply. Service role only.
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { headers } from 'next/headers'

import { checkRateLimit, emailKey, ipKey, recordRateLimitHit } from '@/lib/anti-spam/rate-limits'
import { sendEmail } from '@/lib/email/send'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import {
  type PartnerInquiryInput,
  type PartnerInquiryResult,
  partnerInquirySchema,
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

function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, 'FR')
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

export async function submitPartnerInquiry(
  raw: PartnerInquiryInput,
): Promise<PartnerInquiryResult> {
  const parsed = partnerInquirySchema.safeParse(raw)
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
    return { ok: true, message: 'Votre demande a bien été reçue.' }
  }

  const phoneE164 = normalizePhone(data.phone)
  if (!phoneE164) {
    return {
      ok: false,
      error: 'Numéro de téléphone invalide.',
      fieldErrors: { phone: 'Format de téléphone invalide.' },
    }
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
        error: 'Trop de demandes depuis ta connexion. Réessaie dans une heure.',
      }
    }
  }
  const emailVerdict = await checkRateLimit(admin, emailKey(data.email), 24 * 7, 3)
  if (!emailVerdict.allowed) {
    return {
      ok: false,
      error: 'Une demande récente a déjà été enregistrée avec cet email.',
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: table non typée
  const { error: insertError } = await (admin as any).from('partner_inquiries').insert({
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    phone: phoneE164,
    company_name: data.company_name,
    company_role: data.company_role,
    partnership_type: data.partnership_type,
    message: data.message,
    source_ip: clientIp,
    user_agent: userAgent,
    honeypot_value: data.honeypot ?? null,
  })

  if (insertError) {
    console.error('[partenaires:insert] error', insertError)
    return {
      ok: false,
      error: "Impossible d'enregistrer ta demande. Réessaie dans un instant.",
    }
  }

  try {
    await recordRateLimitHit(admin, [emailKey(data.email), ...(clientIp ? [ipKey(clientIp)] : [])])
  } catch (err) {
    console.warn('[partenaires:rate-limit-hit] failed', err)
  }

  try {
    await sendEmail({
      to: COMPANY_IDENTITY.emails.contactGeneral,
      subject: `[Partenariat ${data.partnership_type}] ${data.company_name}`,
      text: [
        `Type partenariat : ${data.partnership_type}`,
        `Société : ${data.company_name}`,
        `Contact : ${data.first_name} ${data.last_name} (${data.company_role})`,
        `Email : ${data.email}`,
        `Téléphone : ${phoneE164}`,
        '',
        'Message :',
        data.message,
      ].join('\n'),
      category: 'transactional',
      replyTo: data.email,
    })
  } catch (err) {
    console.warn('[partenaires:notify-internal] failed', err)
  }

  try {
    await sendEmail({
      to: data.email,
      subject: 'Votre demande de partenariat a bien été reçue — KOVAS',
      text: [
        `Bonjour ${data.first_name},`,
        '',
        'Nous avons bien reçu votre demande de partenariat et reviendrons vers vous sous quarante-huit heures ouvrées pour échanger.',
        '',
        "Pour préparer notre échange, n'hésitez pas à nous transmettre tout document utile (présentation, plaquette, fiche société) à contact@kovas.fr.",
        '',
        'Cordialement,',
        "L'équipe KOVAS",
        '',
        '—',
        `SASU ${COMPANY_IDENTITY.legalName} — SIREN ${COMPANY_IDENTITY.sirenFormatted}`,
      ].join('\n'),
      category: 'transactional',
    })
  } catch (err) {
    console.warn('[partenaires:auto-reply] failed', err)
  }

  return {
    ok: true,
    message:
      'Ta demande a bien été enregistrée. Nous revenons vers toi sous 48h ouvrées pour échanger.',
  }
}
