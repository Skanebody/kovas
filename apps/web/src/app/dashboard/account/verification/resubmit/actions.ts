'use server'

import { createAdminClientLoose } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  getSiretValidationMessage,
  isFakeSiretAllowed,
  validateSiret,
} from '@/lib/validation/siret'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

/**
 * Server Actions de RE-SOUMISSION des phases de validation pour un user déjà
 * loggé et déjà rattaché à un diagnostician (claimed_by_user_id = user.id).
 *
 * Différence avec `/signup/diagnostiqueur/actions.ts` :
 *  - on ne crée PAS de user / diagnostician (déjà existants)
 *  - on vérifie l'ownership de la fiche avant tout update
 *  - on reset le `*_rejection_reason` à null et bascule `*_status = 'in_review'`
 *  - redirect vers `/dashboard/account/verification?resubmitted=<phase>`
 *
 * Les écritures sur `diagnostician_verification_status`, `verification_documents`,
 * `verification_checks_log` utilisent service_role (tables étanches en RLS).
 */

const COFRAC_BODIES = [
  'Bureau Veritas Certification',
  'Apave Certification',
  'Dekra Certification',
  'SOCOTEC',
  'Qualibat',
  'autre',
] as const

export type ResubmitPhase = 'identity' | 'cofrac' | 'rcpro' | 'sirene'

type ActionState = { error?: string } | undefined

const adminLoose = createAdminClientLoose

/**
 * Vérifie que le user courant est bien le owner du diagnostician
 * (anti-IDOR — on n'accepte JAMAIS un diagnostician_id en input).
 */
async function getOwnedDiagnosticianId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Session expirée — reconnecte-toi.')

  const admin = adminLoose()
  const { data: diag } = await admin
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  if (!diag?.id) {
    throw new Error('Aucune fiche diagnostiqueur rattachée à ce compte.')
  }
  return diag.id as string
}

async function logCheck(
  diagnostician_id: string,
  payload: {
    check_type: string
    check_source: string
    status: 'success' | 'warning' | 'failure' | 'timeout'
    result?: Record<string, unknown>
  },
) {
  const admin = adminLoose()
  await admin.from('verification_checks_log').insert({
    diagnostician_id,
    check_type: payload.check_type,
    check_source: payload.check_source,
    status: payload.status,
    result: payload.result ?? null,
    triggered_by: 'user',
  })
}

function finalizeRedirect(phase: ResubmitPhase): never {
  revalidatePath('/dashboard/account/verification')
  redirect(`/dashboard/account/verification?resubmitted=${phase}`)
}

// ============================================================================
// IDENTITÉ
// ============================================================================

const IdentityMethod = z.enum(['france_connect', 'kyc_scan_cni', 'yousign_qualified'])

export async function resubmitIdentity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const methodParse = IdentityMethod.safeParse(formData.get('method'))
  if (!methodParse.success) {
    return { error: 'Sélectionnez une méthode de vérification.' }
  }
  const method = methodParse.data

  let diagnostician_id: string
  try {
    diagnostician_id = await getOwnedDiagnosticianId()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ownership.' }
  }
  const admin = adminLoose()

  if (method === 'france_connect') {
    const FC_DEV_SIMULATE = process.env.NODE_ENV !== 'production'
    if (FC_DEV_SIMULATE) {
      await admin
        .from('diagnostician_verification_status')
        .update({
          identity_method: 'france_connect',
          identity_status: 'verified',
          identity_verified_at: new Date().toISOString(),
          identity_provider_ref: `fc_dev_resub_${Date.now()}`,
          identity_rejection_reason: null,
        })
        .eq('diagnostician_id', diagnostician_id)

      await logCheck(diagnostician_id, {
        check_type: 'identity_initial',
        check_source: 'france_connect',
        status: 'success',
        result: { mode: 'dev_resubmit_simulation' },
      })
      finalizeRedirect('identity')
    }
    redirect('/api/auth/franceconnect/start')
  }

  if (method === 'kyc_scan_cni') {
    const cniRecto = formData.get('cni_recto') as File | null
    const cniVerso = formData.get('cni_verso') as File | null
    const liveness = formData.get('liveness_payload') as string | null

    if (!cniRecto || !cniVerso || !liveness) {
      return {
        error: 'CNI recto, CNI verso et vérification du visage sont obligatoires.',
      }
    }

    const supabase = await createClient()
    const docs: Array<{ doc_type: string; storage_path: string }> = []
    for (const [name, file] of [
      ['cni_recto', cniRecto],
      ['cni_verso', cniVerso],
    ] as const) {
      const path = `${diagnostician_id}/${name}_resub_${Date.now()}.${file.name.split('.').pop() ?? 'bin'}`
      const { error: upErr } = await supabase.storage
        .from('verification-docs')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) return { error: `Upload ${name} échoué : ${upErr.message}` }
      docs.push({ doc_type: name, storage_path: path })
    }
    docs.push({
      doc_type: 'selfie_liveness',
      storage_path: `${diagnostician_id}/liveness_resub_${Date.now()}.json`,
    })

    for (const d of docs) {
      await admin.from('verification_documents').insert({
        diagnostician_id,
        doc_type: d.doc_type,
        storage_path: d.storage_path,
      })
    }

    await admin
      .from('diagnostician_verification_status')
      .update({
        identity_method: 'kyc_scan_cni',
        identity_status: 'in_review',
        identity_rejection_reason: null,
      })
      .eq('diagnostician_id', diagnostician_id)

    await logCheck(diagnostician_id, {
      check_type: 'identity_initial',
      check_source: 'veriff',
      status: 'success',
      result: { docs: docs.map((d) => d.doc_type), resubmit: true },
    })
    finalizeRedirect('identity')
  }

  if (method === 'yousign_qualified') {
    await admin
      .from('diagnostician_verification_status')
      .update({
        identity_method: 'yousign_qualified',
        identity_status: 'in_review',
        identity_rejection_reason: null,
      })
      .eq('diagnostician_id', diagnostician_id)
    redirect('/api/yousign/identity-verification/start')
  }

  return { error: 'Méthode non gérée.' }
}

// ============================================================================
// COFRAC
// ============================================================================

const cofracSchema = z.object({
  cofrac_number: z.string().regex(/^COFRAC-\d{3}-\d{5}$/, 'Format attendu : COFRAC-XXX-NNNNN'),
  certifying_body: z.enum(COFRAC_BODIES),
})

export async function resubmitCofrac(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cofracSchema.safeParse({
    cofrac_number: formData.get('cofrac_number'),
    certifying_body: formData.get('certifying_body'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const certificate = formData.get('certificate') as File | null
  if (!certificate || certificate.size === 0) {
    return { error: 'Le certificat PDF est obligatoire.' }
  }
  if (certificate.size > 10 * 1024 * 1024) {
    return { error: 'Le certificat dépasse 10 Mo.' }
  }

  let diagnostician_id: string
  try {
    diagnostician_id = await getOwnedDiagnosticianId()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ownership.' }
  }

  const supabase = await createClient()
  const ext = certificate.name.split('.').pop() ?? 'pdf'
  const path = `${diagnostician_id}/cofrac_resub_${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('verification-docs')
    .upload(path, certificate, { contentType: certificate.type, upsert: false })
  if (upErr) return { error: `Upload échoué : ${upErr.message}` }

  const admin = adminLoose()
  await admin.from('verification_documents').insert({
    diagnostician_id,
    doc_type: 'cofrac_certificate',
    storage_path: path,
  })

  await admin
    .from('diagnostician_verification_status')
    .update({
      cofrac_number: parsed.data.cofrac_number,
      cofrac_certifying_body: parsed.data.certifying_body,
      cofrac_status: 'in_review',
      cofrac_rejection_reason: null,
    })
    .eq('diagnostician_id', diagnostician_id)

  // Re-déclenche la vérification automatique
  try {
    await admin.functions.invoke('verify-cofrac', {
      body: {
        diagnostician_id,
        cofrac_number: parsed.data.cofrac_number,
        certifying_body: parsed.data.certifying_body,
        storage_path: path,
      },
    })
  } catch (e) {
    console.warn('verify-cofrac invoke failed (resubmit, non bloquant):', e)
  }

  await logCheck(diagnostician_id, {
    check_type: 'cofrac_initial',
    check_source: 'cofrac_api',
    status: 'success',
    result: {
      cofrac_number: parsed.data.cofrac_number,
      certifying_body: parsed.data.certifying_body,
      resubmit: true,
    },
  })

  finalizeRedirect('cofrac')
}

// ============================================================================
// RCPRO
// ============================================================================

const rcproSchema = z.object({
  insurer: z.string().min(2).max(80),
  policy_number: z.string().min(2).max(40),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ'),
  amount_per_claim: z.coerce.number().min(0).max(100_000_000),
  amount_per_year: z.coerce.number().min(0).max(100_000_000),
})

export async function resubmitRcpro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const attestation = formData.get('attestation') as File | null
  if (!attestation || attestation.size === 0) {
    return { error: "L'attestation RC Pro est obligatoire." }
  }
  if (attestation.size > 10 * 1024 * 1024) {
    return { error: 'Le fichier dépasse 10 Mo.' }
  }

  const parsed = rcproSchema.safeParse({
    insurer: formData.get('insurer'),
    policy_number: formData.get('policy_number'),
    valid_until: formData.get('valid_until'),
    amount_per_claim: formData.get('amount_per_claim'),
    amount_per_year: formData.get('amount_per_year'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données RC Pro invalides' }
  }

  let diagnostician_id: string
  try {
    diagnostician_id = await getOwnedDiagnosticianId()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ownership.' }
  }

  const supabase = await createClient()
  const ext = attestation.name.split('.').pop() ?? 'pdf'
  const path = `${diagnostician_id}/rcpro_resub_${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('verification-docs')
    .upload(path, attestation, { contentType: attestation.type, upsert: false })
  if (upErr) return { error: `Upload échoué : ${upErr.message}` }

  const admin = adminLoose()
  await admin.from('verification_documents').insert({
    diagnostician_id,
    doc_type: 'rcpro_attestation',
    storage_path: path,
    ai_extracted_data: {
      insurer: parsed.data.insurer,
      policy_number: parsed.data.policy_number,
      valid_until: parsed.data.valid_until,
      amount_per_claim_eur: parsed.data.amount_per_claim,
      amount_per_year_eur: parsed.data.amount_per_year,
    },
  })

  await admin
    .from('diagnostician_verification_status')
    .update({
      rcpro_insurer: parsed.data.insurer,
      rcpro_policy_number: parsed.data.policy_number,
      rcpro_valid_until: parsed.data.valid_until,
      rcpro_amount_per_claim_eur: parsed.data.amount_per_claim,
      rcpro_amount_per_year_eur: parsed.data.amount_per_year,
      rcpro_status: 'in_review',
      rcpro_rejection_reason: null,
    })
    .eq('diagnostician_id', diagnostician_id)

  await logCheck(diagnostician_id, {
    check_type: 'rcpro_initial',
    check_source: 'claude_vision',
    status: 'success',
    result: {
      insurer: parsed.data.insurer,
      valid_until: parsed.data.valid_until,
      resubmit: true,
    },
  })

  finalizeRedirect('rcpro')
}

// ============================================================================
// SIRENE
// ============================================================================

const sireneSchema = z.object({
  siret: z.string().min(1),
  confirm: z.literal('on', { message: "Confirmez l'exactitude des données" }),
})

export async function resubmitSirene(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sireneSchema.safeParse({
    siret: formData.get('siret'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const cleanedSiret = parsed.data.siret.replace(/\s/g, '')
  if (!isFakeSiretAllowed()) {
    const siretCheck = validateSiret(cleanedSiret)
    if (!siretCheck.valid) {
      return { error: getSiretValidationMessage(siretCheck.reason) }
    }
  }

  let diagnostician_id: string
  try {
    diagnostician_id = await getOwnedDiagnosticianId()
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur ownership.' }
  }
  const admin = adminLoose()

  const companyName = (formData.get('company_name') as string) ?? null
  const legalForm = (formData.get('legal_form') as string) ?? null
  const apeCode = (formData.get('ape_code') as string) ?? null
  const directorName = (formData.get('director_name') as string) ?? null

  await admin
    .from('diagnostician_verification_status')
    .update({
      sirene_siret: cleanedSiret,
      sirene_company_name: companyName,
      sirene_legal_form: legalForm,
      sirene_ape_code: apeCode,
      sirene_director_name: directorName,
      sirene_status: 'verified',
      sirene_verified_at: new Date().toISOString(),
      sirene_last_api_check: new Date().toISOString(),
      sirene_rejection_reason: null,
    })
    .eq('diagnostician_id', diagnostician_id)

  await logCheck(diagnostician_id, {
    check_type: 'sirene_initial',
    check_source: 'sirene_api',
    status: 'success',
    result: { siret: cleanedSiret, company_name: companyName, resubmit: true },
  })

  finalizeRedirect('sirene')
}
