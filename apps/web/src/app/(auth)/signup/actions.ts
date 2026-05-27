'use server'

import { verifyDiagnosticActivityCached } from '@/lib/data-gouv/recherche-entreprises'
import { joinFullName } from '@/lib/name-utils'
import { isValidReferralCodeFormat } from '@/lib/referral/code-generator'
import { applyReferralOnSignup } from '@/lib/referral/referral-engine'
import { createClient } from '@/lib/supabase/server'
import { getEmailValidationMessage, validateProEmail } from '@/lib/validation/email'
import { isFakeSiretAllowed } from '@/lib/validation/siret'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const REFERRAL_COOKIE = 'kovas_ref_code'

const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  firstName: z.string().trim().min(1, 'Prénom requis').max(60),
  lastName: z.string().trim().min(1, 'Nom requis').max(60),
  siret: z.string().min(1, 'SIRET requis'),
})

export type SignupState =
  | { error?: string; fieldErrors?: Partial<Record<keyof z.infer<typeof signupSchema>, string>> }
  | undefined

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    siret: formData.get('siret'),
  })

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])),
    }
  }

  // Protection 1 — Email pro obligatoire
  const emailCheck = validateProEmail(parsed.data.email)
  if (!emailCheck.valid) {
    return {
      fieldErrors: { email: getEmailValidationMessage(emailCheck.reason) },
    }
  }

  // Protection 2 — Vérification SIRET réelle au registre SIRENE
  // (remplace l'ancien check Luhn purement mathématique). On appelle
  // l'API Recherche d'Entreprises (api.gouv.fr, open data, sans clé)
  // pour confirmer que l'établissement existe vraiment et qu'il est actif.
  const cleanedSiret = parsed.data.siret.replace(/\s/g, '')

  // Format basique 14 chiffres — première barrière sans appel réseau
  if (!/^\d{14}$/.test(cleanedSiret)) {
    return { fieldErrors: { siret: 'Le SIRET doit contenir exactement 14 chiffres.' } }
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Bypass DEV (NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1) : on saute
  // l'appel API mais on continue le signup (utile tests E2E).
  let sireneVerification: Awaited<ReturnType<typeof verifyDiagnosticActivityCached>> | null = null
  if (!isFakeSiretAllowed()) {
    sireneVerification = await verifyDiagnosticActivityCached(admin, cleanedSiret)

    // Erreur réseau / rate-limit / parse → on bloque le signup avec un message
    // explicite. L'utilisateur peut retenter (le cache ne stockera rien).
    if (sireneVerification.error === 'network' || sireneVerification.error === 'rate_limit') {
      return {
        error:
          'Vérification SIRET temporairement indisponible. Merci de réessayer dans quelques minutes.',
      }
    }

    if (sireneVerification.error === 'not_found' || !sireneVerification.found) {
      return {
        fieldErrors: {
          siret:
            'Votre SIRET ne correspond pas à un établissement enregistré au registre SIRENE. Vérifiez le numéro saisi ou contactez contact@kovas.fr.',
        },
      }
    }

    if (!sireneVerification.isActive) {
      return {
        fieldErrors: {
          siret:
            'Votre SIRET ne correspond pas à un établissement actif au registre SIRENE. Vérifiez le numéro saisi ou contactez contact@kovas.fr.',
        },
      }
    }
    // Si NAF mismatch : on laisse passer mais on flagge pour revue admin.
    // Cas typique : nouveau cabinet pas encore catégorisé, ou multi-activités.
  }

  // Protection 3 — 1 SIRET = 1 essai à vie
  const { data: existingTrial } = await admin
    .from('cabinet_trials')
    .select('id, converted_to_paid, blocked_reason')
    .eq('siret', cleanedSiret)
    .maybeSingle()

  if (existingTrial) {
    if (existingTrial.blocked_reason) {
      return {
        error:
          'Ton cabinet a été suspendu suite à des comportements suspects. Contacte contact@kovas.fr.',
      }
    }
    if (existingTrial.converted_to_paid) {
      return {
        error: 'Un compte payant existe déjà pour ce SIRET. Connecte-toi.',
      }
    }
    return {
      error:
        "Ton cabinet a déjà bénéficié d'un essai KOVAS. Choisis un abonnement à partir de 29€/mois.",
    }
  }

  // Recompose `full_name` pour compat schema legacy (cf. profiles trigger)
  const fullName = joinFullName(parsed.data.firstName, parsed.data.lastName)

  // Création user (auto-confirm en V1 dev — cf. CLAUDE.md §6)
  const { data: createdUser, error: adminError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
    },
  })

  if (adminError || !createdUser?.user) {
    if (adminError?.message?.includes('already')) {
      return { fieldErrors: { email: 'Un compte existe déjà avec cet email.' } }
    }
    return { error: adminError?.message ?? 'Création du compte impossible.' }
  }

  // Récupère l'organization auto-créée par le trigger handle_new_user()
  const { data: profile } = await admin
    .from('profiles')
    .select('default_org_id')
    .eq('id', createdUser.user.id)
    .single()

  // Enregistre le trial dans cabinet_trials avec les méta-données SIRENE
  const signupAnomaly =
    sireneVerification?.found && !sireneVerification.isDiagnosticNAF ? 'naf_mismatch' : null

  const trialPayload: Record<string, unknown> = {
    siret: cleanedSiret,
    email: parsed.data.email,
    user_id: createdUser.user.id,
    organization_id: profile?.default_org_id ?? null,
  }
  if (sireneVerification?.found) {
    trialPayload.sirene_verified_naf = sireneVerification.nafCode
    trialPayload.sirene_verified_at = new Date().toISOString()
    trialPayload.sirene_company_name = sireneVerification.companyName
  }
  if (signupAnomaly) {
    trialPayload.signup_anomaly = signupAnomaly
  }

  const { error: trialError } = await admin
    .from('cabinet_trials')
    // biome-ignore lint/suspicious/noExplicitAny: colonnes ajoutées par migration 20260620300000, types pas régénérés
    .insert(trialPayload as any)

  if (trialError && !trialError.message.includes('duplicate')) {
    // Non bloquant en V1 — log et continue
    console.error('cabinet_trials insert failed:', trialError)
  }

  // Programme parrainage : si un code est porté par le cookie ou le formulaire,
  // on enregistre la referral (non bloquant si le code est invalide).
  const formRef = (formData.get('ref') ?? '').toString().trim()
  const cookieStore = await cookies()
  const cookieRef = cookieStore.get(REFERRAL_COOKIE)?.value ?? ''
  const refCandidate = isValidReferralCodeFormat(formRef)
    ? formRef
    : isValidReferralCodeFormat(cookieRef)
      ? cookieRef
      : null

  if (refCandidate) {
    try {
      await applyReferralOnSignup({
        supabase: admin,
        newUserId: createdUser.user.id,
        referralCode: refCandidate,
      })
    } catch (refErr) {
      // Non bloquant — on ne casse pas le signup si la table n'existe pas encore
      console.warn('referral apply failed:', refErr)
    }
    cookieStore.delete(REFERRAL_COOKIE)
  }

  // Connexion immédiate
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signInError) {
    return { error: signInError.message }
  }

  redirect('/dashboard/onboarding')
}
