import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidReferralCodeFormat, normalizeReferralCode } from './code-generator'

/**
 * Moteur de parrainage — logique métier des transitions de statut.
 *
 * Workflow :
 *   1. signup avec ?ref=XXX → applyReferralOnSignup → status='subscribed'
 *   2. 1re facture payée (webhook Stripe) → onFirstInvoicePaid →
 *      status='paid_invoice_1' puis automatique 'rewarded' avec crédit 50€
 *      au parrain (sous quota annuel : max 12 récompenses/an/parrain).
 *
 * Anti-abus :
 *   - 1 filleul par compte (contrainte UNIQUE referrals.referred_id)
 *   - referrer_id != referred_id (CHECK constraint)
 *   - Max 12 récompenses payées / 12 mois glissants / parrain
 *     (au-delà : status reste 'paid_invoice_1', filleul bénéficie mais
 *      pas de bonus monétaire pour le parrain)
 */

export const REFERRAL_REWARD_EUR_CENTS = 5000 // 50€
export const REFERRAL_MAX_REWARDED_PER_YEAR = 12

export interface ApplyReferralResult {
  ok: boolean
  message: string
}

/**
 * Applique un code de parrainage au moment du signup.
 *
 * @returns ok=false si code invalide / inexistant / parrain == filleul / déjà parrainé.
 *          Non bloquant pour le signup côté appelant.
 */
export async function applyReferralOnSignup(params: {
  supabase: SupabaseClient
  newUserId: string
  referralCode: string
}): Promise<ApplyReferralResult> {
  const { supabase, newUserId, referralCode } = params

  if (!isValidReferralCodeFormat(referralCode)) {
    return { ok: false, message: 'Code de parrainage invalide.' }
  }

  const normalized = normalizeReferralCode(referralCode)

  // Lookup du code
  const { data: codeRow } = await supabase
    .from('referral_codes')
    .select('user_id, active')
    .eq('code', normalized)
    .maybeSingle()

  if (!codeRow || !(codeRow as { active: boolean }).active) {
    return { ok: false, message: 'Code de parrainage inconnu ou désactivé.' }
  }

  const referrerId = (codeRow as { user_id: string }).user_id

  if (referrerId === newUserId) {
    return { ok: false, message: 'Vous ne pouvez pas vous parrainer vous-même.' }
  }

  // Vérifie qu'il n'y a pas déjà une referral pour ce filleul (anti-rejouage)
  const { data: existing } = await supabase
    .from('referrals')
    .select('id, status')
    .eq('referred_id', newUserId)
    .maybeSingle()

  if (existing) {
    return { ok: false, message: 'Vous avez déjà été parrainé.' }
  }

  const { error } = await supabase.from('referrals').insert({
    referrer_id: referrerId,
    referred_id: newUserId,
    referral_code: normalized,
    status: 'subscribed',
    signed_up_at: new Date().toISOString(),
  })

  if (error) {
    return { ok: false, message: `Enregistrement parrainage impossible : ${error.message}` }
  }

  return { ok: true, message: 'Parrainage enregistré. Vous bénéficierez de 1 mois offert.' }
}

/**
 * Déclenché par le webhook Stripe `invoice.payment_succeeded` :
 * si le user payant correspond à un filleul en status='subscribed',
 *   → progression vers 'paid_invoice_1' puis 'rewarded' (crédit parrain).
 *
 * Idempotent — peut être appelé plusieurs fois sans double-récompense.
 */
export async function onFirstInvoicePaid(params: {
  supabase: SupabaseClient
  paidUserId: string
}): Promise<void> {
  const { supabase, paidUserId } = params

  const { data: referral } = await supabase
    .from('referrals')
    .select('id, referrer_id, status, reward_eur_cents')
    .eq('referred_id', paidUserId)
    .maybeSingle()

  if (!referral) return

  const r = referral as {
    id: string
    referrer_id: string
    status: string
    reward_eur_cents: number | null
  }

  if (r.status === 'rewarded' || r.status === 'paid_invoice_1') {
    // Déjà traité — idempotent
    return
  }

  if (r.status !== 'subscribed') {
    // pending / cancelled → on ignore
    return
  }

  const nowIso = new Date().toISOString()

  // Étape 1 : marquer "paid_invoice_1"
  await supabase
    .from('referrals')
    .update({
      status: 'paid_invoice_1',
      first_invoice_paid_at: nowIso,
    })
    .eq('id', r.id)

  // Étape 2 : vérifier le quota annuel parrain
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const { count: rewardedLastYear } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', r.referrer_id)
    .eq('status', 'rewarded')
    .gte('rewarded_at', oneYearAgo)

  if ((rewardedLastYear ?? 0) >= REFERRAL_MAX_REWARDED_PER_YEAR) {
    // Plafond atteint — pas de récompense supplémentaire, mais le filleul
    // a bénéficié de son mois offert via Stripe.
    return
  }

  // Étape 3 : créditer le parrain
  await supabase
    .from('referrals')
    .update({
      status: 'rewarded',
      rewarded_at: nowIso,
      reward_eur_cents: REFERRAL_REWARD_EUR_CENTS,
    })
    .eq('id', r.id)

  // Insert credit transaction (audit trail)
  await supabase.from('credit_transactions').insert({
    user_id: r.referrer_id,
    type: 'referral_reward',
    amount_eur_cents: REFERRAL_REWARD_EUR_CENTS,
    description: 'Récompense parrainage — 1re facture payée par votre filleul',
    reference_id: r.id,
  })

  // Update agrégat user_credits (upsert)
  const { data: currentCredits } = await supabase
    .from('user_credits')
    .select('balance_eur_cents, total_earned_eur_cents, total_spent_eur_cents')
    .eq('user_id', r.referrer_id)
    .maybeSingle()

  const cc = (currentCredits ?? null) as {
    balance_eur_cents: number
    total_earned_eur_cents: number
    total_spent_eur_cents: number
  } | null

  await supabase
    .from('user_credits')
    .upsert(
      {
        user_id: r.referrer_id,
        balance_eur_cents: (cc?.balance_eur_cents ?? 0) + REFERRAL_REWARD_EUR_CENTS,
        total_earned_eur_cents: (cc?.total_earned_eur_cents ?? 0) + REFERRAL_REWARD_EUR_CENTS,
        total_spent_eur_cents: cc?.total_spent_eur_cents ?? 0,
        last_updated_at: nowIso,
      },
      { onConflict: 'user_id' },
    )
}

/**
 * Agrégats d'un parrain pour son dashboard.
 */
export interface ReferralStats {
  code: string | null
  active: boolean
  totalReferred: number
  totalSubscribed: number
  totalPaid: number
  totalRewarded: number
  totalEarnedEurCents: number
}

export async function getReferralStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReferralStats> {
  const { data } = await supabase
    .from('referral_stats_per_user')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return {
      code: null,
      active: false,
      totalReferred: 0,
      totalSubscribed: 0,
      totalPaid: 0,
      totalRewarded: 0,
      totalEarnedEurCents: 0,
    }
  }

  const row = data as {
    code: string
    active: boolean
    total_referred: number | null
    total_subscribed: number | null
    total_paid: number | null
    total_rewarded: number | null
    total_earned_eur_cents: number | null
  }

  return {
    code: row.code,
    active: row.active,
    totalReferred: row.total_referred ?? 0,
    totalSubscribed: row.total_subscribed ?? 0,
    totalPaid: row.total_paid ?? 0,
    totalRewarded: row.total_rewarded ?? 0,
    totalEarnedEurCents: row.total_earned_eur_cents ?? 0,
  }
}

/**
 * Liste détaillée des filleuls d'un parrain (limité aux 50 derniers).
 * Nom masqué partiellement pour respect RGPD côté UI.
 */
export interface ReferredEntry {
  id: string
  referredUserId: string
  status: 'pending' | 'subscribed' | 'paid_invoice_1' | 'rewarded' | 'cancelled'
  signedUpAt: string | null
  firstInvoicePaidAt: string | null
  rewardedAt: string | null
  rewardEurCents: number | null
  maskedName: string
}

export async function listMyReferrals(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReferredEntry[]> {
  const { data } = await supabase
    .from('referrals')
    .select(
      'id, referred_id, status, signed_up_at, first_invoice_paid_at, rewarded_at, reward_eur_cents',
    )
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!data || data.length === 0) return []

  // Jointure manuelle sur profiles pour récupérer le nom (masqué)
  const referredIds = (data as { referred_id: string }[]).map((d) => d.referred_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', referredIds)

  const profilesById = new Map<string, { full_name: string | null; email: string }>()
  for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string }[]) {
    profilesById.set(p.id, { full_name: p.full_name, email: p.email })
  }

  return (
    data as {
      id: string
      referred_id: string
      status: ReferredEntry['status']
      signed_up_at: string | null
      first_invoice_paid_at: string | null
      rewarded_at: string | null
      reward_eur_cents: number | null
    }[]
  ).map((d) => {
    const prof = profilesById.get(d.referred_id)
    return {
      id: d.id,
      referredUserId: d.referred_id,
      status: d.status,
      signedUpAt: d.signed_up_at,
      firstInvoicePaidAt: d.first_invoice_paid_at,
      rewardedAt: d.rewarded_at,
      rewardEurCents: d.reward_eur_cents,
      maskedName: maskName(prof?.full_name ?? prof?.email ?? '?'),
    }
  })
}

/**
 * Masque un nom complet pour affichage public/audit :
 *   "Pierre Martin" → "P. M****"
 *   "pierre.martin@cabinet.fr" → "p.m****@****"
 */
export function maskName(name: string): string {
  if (!name || name.length === 0) return '?'
  if (name.includes('@')) {
    const [local, domain] = name.split('@')
    return `${local.slice(0, 3)}${'*'.repeat(Math.max(0, local.length - 3))}@${'*'.repeat(Math.max(1, domain.length))}`
  }
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return `${parts[0].charAt(0).toUpperCase()}${'*'.repeat(Math.max(1, parts[0].length - 1))}`
  }
  const first = parts[0].charAt(0).toUpperCase()
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  const lastRest = '*'.repeat(Math.max(3, parts[parts.length - 1].length - 1))
  return `${first}. ${lastInitial}${lastRest}`
}
