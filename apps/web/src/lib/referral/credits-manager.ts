import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gestionnaire de crédits applicatifs KOVAS.
 *
 * Les crédits proviennent du programme de parrainage (50€ / filleul payant).
 * Ils sont déduits automatiquement des factures Stripe avant prélèvement
 * (côté webhook `invoice.finalized` ou en amont via Stripe credit balance).
 *
 * Toutes les valeurs monétaires sont en centimes d'euros (int).
 */

export interface UserCreditsState {
  balanceEurCents: number
  totalEarnedEurCents: number
  totalSpentEurCents: number
  lastUpdatedAt: string | null
}

export async function getUserCredits(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserCreditsState> {
  const { data } = await supabase
    .from('user_credits')
    .select('balance_eur_cents, total_earned_eur_cents, total_spent_eur_cents, last_updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return {
      balanceEurCents: 0,
      totalEarnedEurCents: 0,
      totalSpentEurCents: 0,
      lastUpdatedAt: null,
    }
  }

  const row = data as {
    balance_eur_cents: number
    total_earned_eur_cents: number
    total_spent_eur_cents: number
    last_updated_at: string | null
  }

  return {
    balanceEurCents: row.balance_eur_cents,
    totalEarnedEurCents: row.total_earned_eur_cents,
    totalSpentEurCents: row.total_spent_eur_cents,
    lastUpdatedAt: row.last_updated_at,
  }
}

export interface ApplyCreditsResult {
  /** Centimes effectivement déduits (≤ invoiceAmount, ≤ balance) */
  deductedEurCents: number
  /** Nouveau solde après déduction */
  newBalanceEurCents: number
}

/**
 * Applique le solde de crédits disponibles à une facture donnée.
 *
 * Règle métier : la déduction est plafonnée par
 *   min(solde courant, montant de la facture).
 *
 * Idempotence : à appeler une seule fois par invoiceId. Le caller est responsable
 * de tracer l'invoiceId pour éviter les doubles déductions.
 *
 * Server-only (modifie `user_credits` + `credit_transactions`).
 */
export async function applyCreditsToInvoice(params: {
  supabase: SupabaseClient
  userId: string
  invoiceAmountCents: number
  invoiceId: string
  description?: string
}): Promise<ApplyCreditsResult> {
  const { supabase, userId, invoiceAmountCents, invoiceId, description } = params

  if (invoiceAmountCents <= 0) {
    return { deductedEurCents: 0, newBalanceEurCents: 0 }
  }

  const current = await getUserCredits(supabase, userId)

  if (current.balanceEurCents <= 0) {
    return { deductedEurCents: 0, newBalanceEurCents: 0 }
  }

  const deducted = Math.min(current.balanceEurCents, invoiceAmountCents)
  const newBalance = current.balanceEurCents - deducted
  const nowIso = new Date().toISOString()

  await supabase
    .from('user_credits')
    .upsert(
      {
        user_id: userId,
        balance_eur_cents: newBalance,
        total_earned_eur_cents: current.totalEarnedEurCents,
        total_spent_eur_cents: current.totalSpentEurCents + deducted,
        last_updated_at: nowIso,
      },
      { onConflict: 'user_id' },
    )

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'invoice_deduction',
    amount_eur_cents: -deducted, // négatif = sortie
    description: description ?? `Déduction crédits sur facture ${invoiceId}`,
    reference_id: invoiceId,
  })

  return { deductedEurCents: deducted, newBalanceEurCents: newBalance }
}

/**
 * Formate un solde de centimes en chaîne lisible "12,50 €".
 * Locale FR avec espace insécable avant le symbole.
 */
export function formatCredits(eurCents: number): string {
  const eur = eurCents / 100
  return `${eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}
