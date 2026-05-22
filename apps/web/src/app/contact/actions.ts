'use server'

/**
 * KOVAS — Server Action /contact (Lot #147 SITE-ANNEXES)
 *
 * Insertion d'une demande de contact dans `contact_inquiries`, avec
 * validation Zod par typologie (particulier / diagnostiqueur / journaliste
 * / partenariat), rate-limit IP 3/h, email auto-reply Resend.
 *
 * Sécurité :
 *  - honeypot silencieux (retour ok sans insert)
 *  - rate-limit IP via la même infra anti-spam que quote_requests
 *  - service role pour bypass RLS (table service role only)
 *
 * Email :
 *  - notification interne à contact@kovas.fr (catégorie 'transactional')
 *  - auto-reply au demandeur (catégorie 'transactional')
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { z } from 'zod'

import {
  checkRateLimit,
  emailKey,
  ipKey,
  recordRateLimitHit,
} from '@/lib/anti-spam/rate-limits'
import { sendEmail } from '@/lib/email/send'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'

const baseContactSchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(20).max(2000),
  honeypot: z.string().optional(),
  consent_rgpd: z.literal(true),
})

const particulierSchema = baseContactSchema.extend({
  inquiry_type: z.literal('particulier'),
  city: z.string().trim().max(120).optional(),
  project_type: z.enum(['vente', 'location', 'renovation', 'achat', 'curiosite']).optional(),
})

const diagnostiqueurSchema = baseContactSchema.extend({
  inquiry_type: z.literal('diagnostiqueur'),
  monthly_volume: z.coerce.number().int().min(0).max(2000).optional(),
  current_software: z.string().trim().max(120).optional(),
})

const journalisteSchema = baseContactSchema.extend({
  inquiry_type: z.literal('journaliste'),
  media: z.string().trim().min(2).max(120),
  deadline: z.string().trim().max(120).optional(),
})

const partenariatSchema = baseContactSchema.extend({
  inquiry_type: z.literal('partenariat'),
  company: z.string().trim().min(2).max(160),
  partnership_type: z
    .enum(['notaires', 'agences-immobilieres', 'banques-courtiers', 'fournisseurs-energie', 'autre'])
    .optional(),
})

export const contactInquirySchema = z.discriminatedUnion('inquiry_type', [
  particulierSchema,
  diagnostiqueurSchema,
  journalisteSchema,
  partenariatSchema,
])

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>

export interface ContactInquiryResult {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

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

/**
 * Construit le contexte JSONB selon la typologie de demande.
 */
function buildContext(data: ContactInquiryInput): Record<string, unknown> {
  switch (data.inquiry_type) {
    case 'particulier':
      return {
        city: data.city ?? null,
        project_type: data.project_type ?? null,
      }
    case 'diagnostiqueur':
      return {
        monthly_volume: data.monthly_volume ?? null,
        current_software: data.current_software ?? null,
      }
    case 'journaliste':
      return {
        media: data.media,
        deadline: data.deadline ?? null,
      }
    case 'partenariat':
      return {
        partnership_type: data.partnership_type ?? null,
      }
  }
}

/**
 * Server Action publique : insère la demande + envoie notifications.
 */
export async function submitContactInquiry(
  raw: ContactInquiryInput,
): Promise<ContactInquiryResult> {
  // 1. Validation
  const parsed = contactInquirySchema.safeParse(raw)
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

  // 2. Honeypot — succès silencieux
  if ((data.honeypot ?? '').length > 0) {
    return { ok: true, message: 'Votre message a bien été reçu.' }
  }

  // 3. Admin client (service role)
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 4. Rate-limit IP (3/h) + email (5/7j)
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
  const emailVerdict = await checkRateLimit(admin, emailKey(data.email), 24 * 7, 5)
  if (!emailVerdict.allowed) {
    return {
      ok: false,
      error: 'Limite hebdomadaire atteinte pour cet email.',
    }
  }

  // 5. Insert
  // biome-ignore lint/suspicious/noExplicitAny: table publique non typée encore
  const { error: insertError } = await (admin as any)
    .from('contact_inquiries')
    .insert({
      inquiry_type: data.inquiry_type,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone ?? null,
      company: data.inquiry_type === 'partenariat' ? data.company : null,
      context: buildContext(data),
      message: data.message,
      source_ip: clientIp,
      user_agent: userAgent,
      honeypot_value: data.honeypot ?? null,
    })

  if (insertError) {
    console.error('[contact:insert] error', insertError)
    return {
      ok: false,
      error: "Impossible d'enregistrer votre demande. Réessayez dans un instant.",
    }
  }

  // 6. Enregistre les hits anti-spam
  const hitKeys = [emailKey(data.email)]
  if (clientIp) hitKeys.push(ipKey(clientIp))
  try {
    await recordRateLimitHit(admin, hitKeys)
  } catch (err) {
    // Non bloquant : log et continue
    console.warn('[contact:rate-limit-hit] failed', err)
  }

  // 7. Notification interne
  const internalSubject = `[Contact ${data.inquiry_type}] ${data.first_name} ${data.last_name}`
  const internalText = [
    `Type : ${data.inquiry_type}`,
    `Nom : ${data.first_name} ${data.last_name}`,
    `Email : ${data.email}`,
    data.phone ? `Téléphone : ${data.phone}` : null,
    '',
    'Contexte :',
    JSON.stringify(buildContext(data), null, 2),
    '',
    'Message :',
    data.message,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    await sendEmail({
      to: COMPANY_IDENTITY.emails.contactGeneral,
      subject: internalSubject,
      text: internalText,
      category: 'transactional',
      replyTo: data.email,
    })
  } catch (err) {
    console.warn('[contact:notify-internal] failed', err)
  }

  // 8. Auto-reply au demandeur
  const autoReplySubject = "Nous avons bien reçu votre message — KOVAS"
  const autoReplyText = [
    `Bonjour ${data.first_name},`,
    '',
    "Nous avons bien reçu votre message et reviendrons vers vous sous vingt-quatre heures ouvrées.",
    '',
    "Si votre demande est urgente, vous pouvez nous écrire directement à contact@kovas.fr.",
    '',
    'Cordialement,',
    "L'équipe KOVAS",
    '',
    '—',
    `SASU ${COMPANY_IDENTITY.legalName} — SIREN ${COMPANY_IDENTITY.sirenFormatted}`,
    `${COMPANY_IDENTITY.address.line1}, ${COMPANY_IDENTITY.address.postalCode} ${COMPANY_IDENTITY.address.city}`,
  ].join('\n')

  try {
    await sendEmail({
      to: data.email,
      subject: autoReplySubject,
      text: autoReplyText,
      category: 'transactional',
    })
  } catch (err) {
    console.warn('[contact:auto-reply] failed', err)
  }

  return {
    ok: true,
    message: 'Votre message a bien été reçu. Nous vous répondons sous 24h ouvrées.',
  }
}
