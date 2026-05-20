/**
 * KOVAS — POST /api/utilities/generate-client-template
 *
 * Génère un message email/SMS pré-écrit avec substitution {{var}}.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type Channel,
  type ClientTemplateInput,
  type EmailTemplateKey,
  type GeneratedTemplate,
  type SmsTemplateKey,
  type TemplateVars,
  generateTemplate,
} from '@/lib/utilities/client-template-generator'
import { trackUtilityUsage } from '@/lib/utilities/usage-tracker'

export const runtime = 'nodejs'

interface ErrorBody {
  error: string
}

const EMAIL_KEYS: readonly EmailTemplateKey[] = [
  'demande_documents',
  'confirmation_rdv',
  'rappel_rdv',
  'rapport_envoye',
  'relance_paiement',
]
const SMS_KEYS: readonly SmsTemplateKey[] = ['rappel_rdv', 'confirmation_rdv', 'rapport_envoye']

function parseVars(raw: unknown): Partial<TemplateVars> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: Partial<TemplateVars> = {}
  const keys: (keyof TemplateVars)[] = [
    'clientName',
    'diagnosticianName',
    'diagnosticianPhone',
    'diagnosticianEmail',
    'appointmentDate',
    'appointmentTime',
    'appointmentAddress',
    'reportLink',
    'invoiceAmount',
    'invoiceDueDate',
  ]
  for (const k of keys) {
    if (typeof r[k] === 'string') {
      out[k] = r[k] as string
    }
  }
  return out
}

function parseInput(body: unknown): ClientTemplateInput | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object'
  const b = body as Record<string, unknown>

  const channel = b.channel
  if (channel !== 'email' && channel !== 'sms') return "channel must be 'email' or 'sms'"

  const templateKey = b.templateKey
  if (typeof templateKey !== 'string') return 'templateKey required'

  if (channel === 'email' && !EMAIL_KEYS.includes(templateKey as EmailTemplateKey)) {
    return `email templateKey must be one of ${EMAIL_KEYS.join('|')}`
  }
  if (channel === 'sms' && !SMS_KEYS.includes(templateKey as SmsTemplateKey)) {
    return `sms templateKey must be one of ${SMS_KEYS.join('|')}`
  }

  let requestedDocuments: string[] | undefined
  if (Array.isArray(b.requestedDocuments)) {
    if (!b.requestedDocuments.every((d) => typeof d === 'string')) {
      return 'requestedDocuments must be string[]'
    }
    requestedDocuments = b.requestedDocuments as string[]
  }

  return {
    channel: channel as Channel,
    templateKey: templateKey as EmailTemplateKey | SmsTemplateKey,
    vars: parseVars(b.vars),
    requestedDocuments,
  }
}

export async function POST(request: Request): Promise<NextResponse<GeneratedTemplate | ErrorBody>> {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const parsed = parseInput(bodyJson)
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 })
  }

  let result: GeneratedTemplate
  try {
    result = generateTemplate(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'template generation failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  trackUtilityUsage({
    supabase: user.supabase,
    userId: user.user.id,
    organizationId: user.orgId,
    utility: 'client_template_generator',
    context: { channel: parsed.channel, templateKey: parsed.templateKey },
  })

  return NextResponse.json(result)
}
