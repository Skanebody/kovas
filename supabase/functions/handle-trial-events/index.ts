// Supabase Edge Function — handle-trial-events
//
// Webhook Stripe alternatif (Deno runtime) qui écoute les événements liés à
// l'essai 30j + débit auto + résiliation. Cf. CLAUDE.md §6 (refonte 2026-05-22).
//
// IMPORTANT : par défaut, la consommation primaire des webhooks Stripe se fait
// via la route Next.js `apps/web/src/app/api/billing/webhook/route.ts` (gère
// déjà TOUS les events trial_will_end, subscription.updated, payment_failed,
// subscription.deleted). Cette Edge Function existe en filet de sécurité :
// elle peut être branchée comme webhook secondaire dans Stripe Dashboard pour
// découpler les notifications email du runtime Vercel (utile si throttling).
//
// Events écoutés :
//  - customer.subscription.trial_will_end  → email J-3 rappel
//  - customer.subscription.updated         → email facture à conversion
//  - invoice.payment_failed                → email mise à jour CB
//  - customer.subscription.deleted         → email confirmation résiliation
//
// Secrets requis :
//  - STRIPE_WEBHOOK_SECRET (signature event)
//  - RESEND_API_KEY (emails) — primary, conforme CLAUDE.md §8
//  - BREVO_API_KEY (fallback) — si RESEND indisponible
//  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (lookup destinataire)
//
// Déploiement :
//   supabase functions deploy handle-trial-events
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... RESEND_API_KEY=re_...

// @ts-nocheck — Deno runtime (npm: + esm.sh), pas de tsconfig Node ici
import Stripe from 'npm:stripe@^17.0.0'
import { createClient } from 'jsr:@supabase/supabase-js@^2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2026-04-22.dahlia',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? ''
const FROM = Deno.env.get('RESEND_FROM') ?? 'KOVAS <hello@kovas.fr>'
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'

interface OrgContact {
  email: string
  firstName: string
}

async function resolveOrgContact(orgId: string): Promise<OrgContact | null> {
  const { data: member } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle()

  if (!member?.user_id) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', member.user_id)
    .maybeSingle()

  if (!profile?.email) return null
  const firstName = (profile.full_name ?? '').split(' ')[0] || 'bonjour'
  return { email: profile.email, firstName }
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  // Préférence Resend, fallback Brevo si seule clé Brevo dispo.
  if (RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    })
    return
  }
  if (BREVO_API_KEY) {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'KOVAS', email: 'hello@kovas.fr' },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    })
    return
  }
  console.log('[handle-trial-events] stub email', { to, subject })
}

function formatDateFR(seconds: number | null | undefined): string {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })
}

function eurosFromCents(cents: number | null | undefined): string {
  if (!cents) return '0,00'
  return (cents / 100).toFixed(2).replace('.', ',')
}

async function handleTrialWillEnd(sub: Stripe.Subscription): Promise<void> {
  const orgId = sub.metadata?.organization_id
  if (!orgId) return
  const contact = await resolveOrgContact(orgId)
  if (!contact) return

  const item = sub.items.data[0]
  const text = `Bonjour ${contact.firstName},

Votre essai gratuit KOVAS se termine dans 3 jours.

À partir du ${formatDateFR(sub.trial_end)}, votre carte bancaire sera prélevée de ${eurosFromCents(item?.price?.unit_amount)} € HT par mois.

Aucune action n'est nécessaire pour continuer : votre abonnement se prolonge automatiquement.

Si vous souhaitez modifier votre formule, votre moyen de paiement ou résilier, vous pouvez le faire à tout moment depuis votre espace :
${APP_URL}/app/account

Je reste disponible pour toute question.

Cordialement,
Benjamin Bel
Fondateur KOVAS
benjamin@kovas.fr`

  await sendEmail(contact.email, 'Votre essai KOVAS se termine dans 3 jours', text)
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const orgId = sub.metadata?.organization_id
  if (!orgId) return
  // On agit uniquement à la transition trialing → active.
  const { data: prev } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('organization_id', orgId)
    .maybeSingle()

  await supabase
    .from('subscriptions')
    .update({
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      trial_started_at: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    })
    .eq('organization_id', orgId)

  if (prev?.status === 'trialing' && sub.status === 'active') {
    const contact = await resolveOrgContact(orgId)
    if (!contact) return
    const item = sub.items.data[0]
    const text = `Bonjour ${contact.firstName},

Votre abonnement KOVAS est désormais actif. Merci de votre confiance.

Détail du prélèvement : ${eurosFromCents(item?.price?.unit_amount)} € HT, prochain prélèvement le ${formatDateFR(item?.current_period_end)}.

Votre facture détaillée est disponible dans votre espace :
${APP_URL}/app/account

Cordialement,
Benjamin Bel
Fondateur KOVAS
benjamin@kovas.fr`
    await sendEmail(contact.email, 'Confirmation de votre abonnement KOVAS', text)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customer =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customer) return
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('organization_id')
    .eq('stripe_customer_id', customer)
    .maybeSingle()
  if (!sub?.organization_id) return
  const contact = await resolveOrgContact(sub.organization_id)
  if (!contact) return

  const attemptText =
    (invoice.attempt_count ?? 1) > 1
      ? `Stripe va retenter automatiquement le prélèvement dans les prochains jours.`
      : `Stripe va retenter automatiquement le prélèvement à J+1, J+3 puis J+7.`

  const text = `Bonjour ${contact.firstName},

Le prélèvement de ${eurosFromCents(invoice.amount_due)} € sur votre abonnement KOVAS n'a pas pu être effectué.

${attemptText}

Pour mettre à jour votre carte bancaire et éviter toute interruption de service, rendez-vous sur votre portail de gestion :
${APP_URL}/app/account

En cas de difficulté, répondez simplement à cet email — je vous accompagne personnellement.

Cordialement,
Benjamin Bel
Fondateur KOVAS
benjamin@kovas.fr`

  await sendEmail(contact.email, 'Action requise — paiement KOVAS non abouti', text)
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const orgId = sub.metadata?.organization_id
  if (!orgId) return
  await supabase
    .from('subscriptions')
    .update({ status: sub.status })
    .eq('organization_id', orgId)

  const contact = await resolveOrgContact(orgId)
  if (!contact) return
  const text = `Bonjour ${contact.firstName},

Votre abonnement KOVAS a bien été résilié. Plus aucun prélèvement ne sera effectué.

Vos données restent accessibles en lecture seule pendant 3 mois, puis seront définitivement supprimées conformément au RGPD. Pour exporter vos dossiers ou réactiver votre compte avant cette échéance :
${APP_URL}/app/account

Merci de la confiance que vous nous avez accordée.

Cordialement,
Benjamin Bel
Fondateur KOVAS`

  await sendEmail(contact.email, 'Résiliation de votre abonnement KOVAS', text)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const sig = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!sig || !webhookSecret) {
    return new Response('Missing signature or secret', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err) {
    return new Response(`Invalid signature: ${(err as Error).message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      default:
        // ignored
        break
    }
  } catch (err) {
    console.error('[handle-trial-events] handler failed', err)
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
