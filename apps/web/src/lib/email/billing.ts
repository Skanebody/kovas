/**
 * Emails transactionnels billing — essai 30j + débit auto + résiliation.
 *
 * Ton SOBRE PROFESSIONNEL : vouvoiement, signature humaine Benjamin Bel, pas d'emoji.
 * Cf. CLAUDE.md §6 + §21bis (avatar diagnostiqueur 43 ans ex-cadre reconverti).
 *
 * Tous les helpers reçoivent un `admin` Supabase service role pour résoudre l'email
 * destinataire à partir de l'`organization_id`. Pas d'effet de bord si user introuvable.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { sendEmail } from './send'

type Admin = SupabaseClient<Database>

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'

interface OrgContact {
  email: string
  firstName: string
}

async function resolveOrgContact(admin: Admin, orgId: string): Promise<OrgContact | null> {
  // L'owner de l'org est dans memberships avec role='owner' et status='active'.
  const { data: member } = await admin
    .from('memberships')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle()

  if (!member?.user_id) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', member.user_id)
    .maybeSingle()

  if (!profile?.email) return null

  const firstName = (profile.full_name ?? '').split(' ')[0] || 'bonjour'
  return { email: profile.email, firstName }
}

function eurosFromCents(cents: number | null | undefined): string {
  if (!cents) return '0,00'
  return (cents / 100).toFixed(2).replace('.', ',')
}

function formatDateFR(iso: string | number | null | undefined): string {
  if (!iso) return ''
  const date = typeof iso === 'number' ? new Date(iso * 1000) : new Date(iso)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

/* --------------------------------------------------------------------------
 * 1. Rappel J+27 (3 jours avant fin essai) — trial_will_end Stripe webhook
 * ----------------------------------------------------------------------- */
export async function sendTrialEndingReminder(opts: {
  admin: Admin
  orgId: string
  subscription: Stripe.Subscription
}): Promise<void> {
  const contact = await resolveOrgContact(opts.admin, opts.orgId)
  if (!contact) return

  const item = opts.subscription.items.data[0]
  const priceCents = item?.price?.unit_amount ?? 0
  const trialEnd = formatDateFR(opts.subscription.trial_end)

  const text = `Bonjour ${contact.firstName},

Votre essai gratuit KOVAS se termine dans 3 jours.

À partir du ${trialEnd}, votre carte bancaire sera prélevée de ${eurosFromCents(priceCents)} € HT par mois.

Aucune action n'est nécessaire pour continuer : votre abonnement se prolonge automatiquement.

Si vous souhaitez modifier votre formule, votre moyen de paiement ou résilier, vous pouvez le faire à tout moment depuis votre espace :
${APP_URL}/app/account

Je reste disponible pour toute question.

Cordialement,
Benjamin Bel
Fondateur KOVAS
contact@kovas.fr`

  await sendEmail({
    to: contact.email,
    subject: `Votre essai KOVAS se termine dans 3 jours`,
    text,
    category: 'transactional',
  })
}

/* --------------------------------------------------------------------------
 * 2. Conversion essai → payant (1er débit réussi)
 * ----------------------------------------------------------------------- */
export async function sendTrialConvertedReceipt(opts: {
  admin: Admin
  orgId: string
  subscription: Stripe.Subscription
}): Promise<void> {
  const contact = await resolveOrgContact(opts.admin, opts.orgId)
  if (!contact) return

  const item = opts.subscription.items.data[0]
  const priceCents = item?.price?.unit_amount ?? 0
  const periodEnd = formatDateFR(item?.current_period_end)

  const text = `Bonjour ${contact.firstName},

Votre abonnement KOVAS est désormais actif. Merci de votre confiance.

Détail du prélèvement : ${eurosFromCents(priceCents)} € HT, prochain prélèvement le ${periodEnd}.

Votre facture détaillée est disponible dans votre espace, rubrique Mon compte > Abonnement :
${APP_URL}/app/account

Vous pouvez à tout moment changer de formule ou résilier sans engagement depuis le portail Stripe.

Cordialement,
Benjamin Bel
Fondateur KOVAS
contact@kovas.fr`

  await sendEmail({
    to: contact.email,
    subject: `Confirmation de votre abonnement KOVAS`,
    text,
    category: 'transactional',
  })
}

/* --------------------------------------------------------------------------
 * 3. Échec de paiement — invoice.payment_failed
 * ----------------------------------------------------------------------- */
export async function sendPaymentFailedNotice(opts: {
  admin: Admin
  orgId: string
  invoice: Stripe.Invoice
}): Promise<void> {
  const contact = await resolveOrgContact(opts.admin, opts.orgId)
  if (!contact) return

  const amountCents = opts.invoice.amount_due ?? 0
  const attemptText =
    (opts.invoice.attempt_count ?? 1) > 1
      ? `Stripe va retenter automatiquement le prélèvement dans les prochains jours.`
      : `Stripe va retenter automatiquement le prélèvement à J+1, J+3 puis J+7.`

  const text = `Bonjour ${contact.firstName},

Le prélèvement de ${eurosFromCents(amountCents)} € sur votre abonnement KOVAS n'a pas pu être effectué.

${attemptText}

Pour mettre à jour votre carte bancaire et éviter toute interruption de service, rendez-vous sur votre portail de gestion :
${APP_URL}/app/account

En cas de difficulté, répondez simplement à cet email — je vous accompagne personnellement.

Cordialement,
Benjamin Bel
Fondateur KOVAS
contact@kovas.fr`

  await sendEmail({
    to: contact.email,
    subject: `Action requise — paiement KOVAS non abouti`,
    text,
    category: 'alert',
  })
}

/* --------------------------------------------------------------------------
 * 4. Résiliation confirmée — customer.subscription.deleted
 * ----------------------------------------------------------------------- */
export async function sendSubscriptionCanceledNotice(opts: {
  admin: Admin
  orgId: string
}): Promise<void> {
  const contact = await resolveOrgContact(opts.admin, opts.orgId)
  if (!contact) return

  const text = `Bonjour ${contact.firstName},

Votre abonnement KOVAS a bien été résilié. Plus aucun prélèvement ne sera effectué.

Vos données restent accessibles en lecture seule pendant 3 mois, puis seront définitivement supprimées conformément au RGPD. Pour exporter vos dossiers ou réactiver votre compte avant cette échéance :
${APP_URL}/app/account

Merci de la confiance que vous nous avez accordée. Vos retours sont les bienvenus à contact@kovas.fr.

Cordialement,
Benjamin Bel
Fondateur KOVAS`

  await sendEmail({
    to: contact.email,
    subject: `Résiliation de votre abonnement KOVAS`,
    text,
    category: 'transactional',
  })
}
