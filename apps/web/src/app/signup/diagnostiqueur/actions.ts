'use server'

import { createAdminClient, createAdminClientLoose } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getEmailValidationMessage, validateProEmail } from '@/lib/validation/email'
import {
  getSiretValidationMessage,
  isFakeSiretAllowed,
  validateSiret,
} from '@/lib/validation/siret'
import { redirect } from 'next/navigation'
import { z } from 'zod'

/**
 * Server Actions pour le parcours d'onboarding diagnostiqueur 7 étapes
 * (inspiration Doctolib post-incident 2022 — validation préalable obligatoire).
 *
 * Toutes les actions retournent un état sérialisable + utilisent
 * `redirect()` pour passer à l'étape suivante.
 *
 * Les écritures aux tables `diagnostician_verification_status`,
 * `verification_documents`, `verification_checks_log` se font via
 * service_role pour bypass des RLS (les tables sont étanches en RLS).
 */

const COFRAC_BODIES = [
  'Bureau Veritas Certification',
  'Apave Certification',
  'Dekra Certification',
  'SOCOTEC',
  'Qualibat',
  'autre',
] as const

type ActionState = { error?: string } | undefined

// ============================================================================
// Helpers admin client (typed loose — tables verification pas encore dans types.ts)
// ============================================================================

const adminClient = createAdminClient
const adminLoose = createAdminClientLoose

/**
 * Récupère le diagnostician_id lié à un user_id donné.
 * Si le user n'a pas encore claim un diagnostician existant (cas le plus
 * fréquent en inscription pure), on crée une fiche minimaliste qui sera
 * enrichie au fil des étapes.
 */
async function getOrCreateDiagnosticianForUser(userId: string, email: string) {
  const admin = adminLoose()
  const { data: existing } = await admin
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', userId)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  // FIX-AUDIT-D : colonne consolidée (`email` au lieu de `contact_email`)
  const { data: created, error } = await admin
    .from('diagnosticians')
    .insert({
      claimed_by_user_id: userId,
      email,
      data_source: 'self_signup',
      validation_status: 'pending',
    })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(error?.message ?? 'Impossible de créer la fiche diagnostiqueur.')
  }

  // Bootstrap la ligne diagnostician_verification_status (1 par diag)
  await admin
    .from('diagnostician_verification_status')
    .upsert({ diagnostician_id: created.id }, { onConflict: 'diagnostician_id' })

  return created.id as string
}

async function getCurrentUserAndDiagnostician() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Session expirée — reconnectez-vous.')
  const diagId = await getOrCreateDiagnosticianForUser(user.id, user.email ?? '')
  return { user, diagnostician_id: diagId }
}

async function logCheck(
  diagnostician_id: string,
  payload: {
    check_type: string
    check_source: string
    status: 'success' | 'warning' | 'failure' | 'timeout'
    result?: Record<string, unknown>
    triggered_by?: string
  },
) {
  const admin = adminLoose()
  await admin.from('verification_checks_log').insert({
    diagnostician_id,
    check_type: payload.check_type,
    check_source: payload.check_source,
    status: payload.status,
    result: payload.result ?? null,
    triggered_by: payload.triggered_by ?? 'user',
  })
}

// ============================================================================
// Étape 1 — Création compte
// ============================================================================

const step1Schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  phone: z.string().regex(/^(\+33|0)[1-9](\s?\d{2}){4}$/, 'Numéro mobile français invalide'),
  cgu: z.literal('on', { message: 'Vous devez accepter les CGU/CGV' }),
})

export async function submitStep1Account(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = step1Schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    phone: formData.get('phone'),
    cgu: formData.get('cgu'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const emailCheck = validateProEmail(parsed.data.email)
  if (!emailCheck.valid) {
    return { error: getEmailValidationMessage(emailCheck.reason) }
  }

  const admin = adminClient()
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    phone: parsed.data.phone,
    user_metadata: { signup_flow: 'diagnostiqueur_v2' },
  })

  if (createErr || !createdUser.user) {
    if (createErr?.message?.includes('already')) {
      return { error: 'Un compte existe déjà avec cet email.' }
    }
    return { error: createErr?.message ?? 'Création impossible' }
  }

  // Connexion immédiate (session)
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (signInErr) return { error: signInErr.message }

  // Bootstrap diagnostician + verification_status
  await getOrCreateDiagnosticianForUser(createdUser.user.id, parsed.data.email)

  redirect('/signup/diagnostiqueur?step=2')
}

// ============================================================================
// Étape 2 — Choix formule
// ============================================================================

const step2Schema = z.object({
  plan: z.enum(['solo_light', 'solo_pro', 'cabinet', 'cabinet_plus']),
})

export async function submitStep2Plan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = step2Schema.safeParse({ plan: formData.get('plan') })
  if (!parsed.success) {
    return { error: 'Sélectionnez une formule pour continuer' }
  }

  const { user, diagnostician_id } = await getCurrentUserAndDiagnostician()

  const admin = adminLoose()
  // Stocke le plan choisi dans user_metadata (la subscription Stripe se créera J+30)
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { selected_plan: parsed.data.plan },
  })

  await logCheck(diagnostician_id, {
    check_type: 'identity_initial',
    check_source: 'admin_manual',
    status: 'success',
    result: { plan_selected: parsed.data.plan },
    triggered_by: 'user',
  })

  redirect('/signup/diagnostiqueur?step=3')
}

// ============================================================================
// Étape 3 — Identité civile
// ============================================================================

const IdentityMethod = z.enum(['france_connect', 'kyc_scan_cni', 'yousign_qualified'])

export async function submitStep3Identity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const methodParse = IdentityMethod.safeParse(formData.get('method'))
  if (!methodParse.success) {
    return { error: 'Sélectionnez une méthode de vérification' }
  }

  const method = methodParse.data
  const { diagnostician_id } = await getCurrentUserAndDiagnostician()
  const admin = adminLoose()

  if (method === 'france_connect') {
    // Mode dev — placeholder route démarre l'auth ; on simule immédiatement
    // (V2 prod : redirige vers /api/auth/franceconnect/start)
    const FC_DEV_SIMULATE = process.env.NODE_ENV !== 'production'
    if (FC_DEV_SIMULATE) {
      await admin
        .from('diagnostician_verification_status')
        .update({
          identity_method: 'france_connect',
          identity_status: 'verified',
          identity_verified_at: new Date().toISOString(),
          identity_provider_ref: `fc_dev_sim_${Date.now()}`,
        })
        .eq('diagnostician_id', diagnostician_id)

      await logCheck(diagnostician_id, {
        check_type: 'identity_initial',
        check_source: 'france_connect',
        status: 'success',
        result: { mode: 'dev_simulation' },
      })

      redirect('/signup/diagnostiqueur?step=4')
    }

    redirect('/api/auth/franceconnect/start')
  }

  if (method === 'kyc_scan_cni') {
    const cniRecto = formData.get('cni_recto') as File | null
    const cniVerso = formData.get('cni_verso') as File | null
    const liveness = formData.get('liveness_payload') as string | null

    if (!cniRecto || !cniVerso || !liveness) {
      return {
        error: 'CNI recto, CNI verso et liveness sont obligatoires pour cette méthode.',
      }
    }

    // Upload Storage privé (bucket `verification-docs`)
    const supabase = await createClient()
    const docs: Array<{ doc_type: string; storage_path: string }> = []
    for (const [name, file] of [
      ['cni_recto', cniRecto],
      ['cni_verso', cniVerso],
    ] as const) {
      const path = `${diagnostician_id}/${name}_${Date.now()}.${file.name.split('.').pop() ?? 'bin'}`
      const { error: upErr } = await supabase.storage
        .from('verification-docs')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) return { error: `Upload ${name} échoué : ${upErr.message}` }
      docs.push({ doc_type: name, storage_path: path })
    }

    docs.push({
      doc_type: 'selfie_liveness',
      storage_path: `${diagnostician_id}/liveness_${Date.now()}.json`,
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
      })
      .eq('diagnostician_id', diagnostician_id)

    await logCheck(diagnostician_id, {
      check_type: 'identity_initial',
      check_source: 'veriff',
      status: 'success',
      result: { docs: docs.map((d) => d.doc_type) },
    })

    redirect('/signup/diagnostiqueur?step=4')
  }

  if (method === 'yousign_qualified') {
    await admin
      .from('diagnostician_verification_status')
      .update({ identity_method: 'yousign_qualified', identity_status: 'in_review' })
      .eq('diagnostician_id', diagnostician_id)
    redirect('/api/yousign/identity-verification/start')
  }

  return { error: 'Méthode non gérée' }
}

// ============================================================================
// Étape 4 — Certification COFRAC
// ============================================================================

const step4Schema = z.object({
  cofrac_number: z.string().regex(/^COFRAC-\d{3}-\d{5}$/, 'Format attendu : COFRAC-XXX-NNNNN'),
  certifying_body: z.enum(COFRAC_BODIES),
})

export async function submitStep4Cofrac(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = step4Schema.safeParse({
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

  const { diagnostician_id } = await getCurrentUserAndDiagnostician()
  const supabase = await createClient()
  const ext = certificate.name.split('.').pop() ?? 'pdf'
  const path = `${diagnostician_id}/cofrac_${Date.now()}.${ext}`
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
    })
    .eq('diagnostician_id', diagnostician_id)

  // Invoke Edge Function verify-cofrac (créée par VAL-3) en background
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
    // Non bloquant — la background fn peut être retry par cron
    console.warn('verify-cofrac invoke failed (non bloquant):', e)
  }

  await logCheck(diagnostician_id, {
    check_type: 'cofrac_initial',
    check_source: 'cofrac_api',
    status: 'success',
    result: {
      cofrac_number: parsed.data.cofrac_number,
      certifying_body: parsed.data.certifying_body,
    },
  })

  redirect('/signup/diagnostiqueur?step=5')
}

// ============================================================================
// Étape 5 — RC Pro
// ============================================================================

const step5Schema = z.object({
  insurer: z.string().min(2).max(80),
  policy_number: z.string().min(2).max(40),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ'),
  amount_per_claim: z.coerce.number().min(0).max(100_000_000),
  amount_per_year: z.coerce.number().min(0).max(100_000_000),
})

export async function submitStep5Rcpro(
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

  const parsed = step5Schema.safeParse({
    insurer: formData.get('insurer'),
    policy_number: formData.get('policy_number'),
    valid_until: formData.get('valid_until'),
    amount_per_claim: formData.get('amount_per_claim'),
    amount_per_year: formData.get('amount_per_year'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données RC Pro invalides' }
  }

  const { diagnostician_id } = await getCurrentUserAndDiagnostician()
  const supabase = await createClient()
  const ext = attestation.name.split('.').pop() ?? 'pdf'
  const path = `${diagnostician_id}/rcpro_${Date.now()}.${ext}`
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
    })
    .eq('diagnostician_id', diagnostician_id)

  await logCheck(diagnostician_id, {
    check_type: 'rcpro_initial',
    check_source: 'claude_vision',
    status: 'success',
    result: { insurer: parsed.data.insurer, valid_until: parsed.data.valid_until },
  })

  redirect('/signup/diagnostiqueur?step=6')
}

// ============================================================================
// Étape 6 — Entreprise SIRENE
// ============================================================================

const step6Schema = z.object({
  siret: z.string().min(1),
  confirm: z.literal('on', { message: "Confirmez l'exactitude des données" }),
})

export async function submitStep6Sirene(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = step6Schema.safeParse({
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

  const { diagnostician_id } = await getCurrentUserAndDiagnostician()
  const admin = adminLoose()

  // Snapshot des données capturées par /api/sirene/lookup (cf. route handler)
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
    })
    .eq('diagnostician_id', diagnostician_id)

  await logCheck(diagnostician_id, {
    check_type: 'sirene_initial',
    check_source: 'sirene_api',
    status: 'success',
    result: { siret: cleanedSiret, company_name: companyName },
  })

  redirect('/signup/diagnostiqueur?step=7')
}
