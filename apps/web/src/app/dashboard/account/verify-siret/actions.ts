'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyDiagnosticActivityCached } from '@/lib/data-gouv/recherche-entreprises'
import { checkRateLimit } from '@/lib/rate-limit'
import { isFakeSiretAllowed } from '@/lib/validation/siret'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const schema = z.object({ siret: z.string().min(1, 'SIRET requis') })

export type VerifySiretState = { error?: string; fieldErrors?: { siret?: string } } | undefined

/**
 * Validation + enregistrement du SIRET APRÈS paiement (funnel sans friction).
 *
 * Reprend la logique anti-abus historiquement faite au signup :
 *   1. Vérification SIRENE réelle (API Recherche d'Entreprises, open data).
 *   2. Unicité « 1 SIRET = 1 cabinet » (table cabinet_trials).
 *   3. Écriture `organizations.siret` + enregistrement `cabinet_trials`.
 *
 * Le `siret-guard` (lib/billing/siret-guard.ts) déverrouille l'app dès que
 * `organizations.siret` est renseigné.
 */
export async function verifyAndSaveSiretAction(
  _prev: VerifySiretState,
  formData: FormData,
): Promise<VerifySiretState> {
  const { user, orgId, profile } = await getCurrentUser()
  if (!orgId) return { error: 'Organisation introuvable. Reconnecte-toi.' }

  const parsed = schema.safeParse({ siret: formData.get('siret') })
  if (!parsed.success) {
    return { fieldErrors: { siret: parsed.error.issues[0]?.message ?? 'SIRET requis' } }
  }

  // Rate-limit (tier `signup` permissif, scopé à l'utilisateur).
  const rl = await checkRateLimit('signup', `verify-siret:${user.id}`)
  if (!rl.success) {
    return { error: 'Trop de tentatives. Réessaie dans quelques minutes.' }
  }

  const cleanedSiret = parsed.data.siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(cleanedSiret)) {
    return { fieldErrors: { siret: 'Le SIRET doit contenir exactement 14 chiffres.' } }
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Vérification SIRENE réelle (sauf bypass DEV/E2E).
  let sirene: Awaited<ReturnType<typeof verifyDiagnosticActivityCached>> | null = null
  if (!isFakeSiretAllowed()) {
    sirene = await verifyDiagnosticActivityCached(admin, cleanedSiret)
    if (sirene.error === 'network' || sirene.error === 'rate_limit') {
      return {
        error:
          'Vérification SIRET temporairement indisponible. Merci de réessayer dans quelques minutes.',
      }
    }
    if (sirene.error === 'not_found' || !sirene.found) {
      return {
        fieldErrors: {
          siret:
            'Ce SIRET ne correspond pas à un établissement enregistré au registre SIRENE. Vérifie le numéro ou contacte contact@kovas.fr.',
        },
      }
    }
    if (!sirene.isActive) {
      return {
        fieldErrors: {
          siret:
            'Ce SIRET ne correspond pas à un établissement actif au registre SIRENE. Vérifie le numéro saisi.',
        },
      }
    }
  }

  // 2. Unicité — 1 SIRET = 1 cabinet. S'il est déjà rattaché à une AUTRE org → bloque.
  const { data: existingTrial } = await admin
    .from('cabinet_trials')
    .select('id, organization_id, converted_to_paid, blocked_reason')
    .eq('siret', cleanedSiret)
    .maybeSingle()

  if (existingTrial?.organization_id && existingTrial.organization_id !== orgId) {
    return {
      fieldErrors: {
        siret:
          'Ce SIRET est déjà rattaché à un autre compte KOVAS. Contacte contact@kovas.fr si c’est une erreur.',
      },
    }
  }

  // 3. Écrit le SIRET sur l'organisation (déverrouille l'app via siret-guard).
  const { error: orgErr } = await admin
    .from('organizations')
    .update({ siret: cleanedSiret })
    .eq('id', orgId)

  if (orgErr) {
    if (orgErr.message.includes('duplicate') || orgErr.code === '23505') {
      return { fieldErrors: { siret: 'Ce SIRET est déjà utilisé par un autre cabinet.' } }
    }
    return { error: 'Enregistrement du SIRET impossible. Réessaie dans un instant.' }
  }

  // 4. Enregistre cabinet_trials (anti-abus 1 essai / SIRET) si pas déjà présent.
  if (!existingTrial) {
    const trialPayload: Record<string, unknown> = {
      siret: cleanedSiret,
      email: profile.email,
      user_id: user.id,
      organization_id: orgId,
    }
    if (sirene?.found) {
      trialPayload.sirene_verified_naf = sirene.nafCode
      trialPayload.sirene_verified_at = new Date().toISOString()
      trialPayload.sirene_company_name = sirene.companyName
      if (!sirene.isDiagnosticNAF) trialPayload.signup_anomaly = 'naf_mismatch'
    }
    const { error: trialErr } = await admin
      .from('cabinet_trials')
      // biome-ignore lint/suspicious/noExplicitAny: colonnes ajoutées par migration 20260620300000, types pas régénérés
      .insert(trialPayload as any)
    if (trialErr && !trialErr.message.includes('duplicate')) {
      console.error('cabinet_trials insert failed:', trialErr)
    }
  }

  redirect('/dashboard/dashboard')
}
