// ============================================
// KOVAS — Edge Function : verification-send-alert-emails
//
// Consomme verification_alerts_queue WHERE status='pending', envoie un email
// Resend par alerte selon alert_type, marque status='sent' + email_sent_at.
//
// Alertes diagnostiqueur (envoyées au diag) :
//   - cofrac_expiry_60        info     "Votre certification COFRAC expire dans 60 jours"
//   - cofrac_expiry_30        warning  "Votre certification COFRAC expire dans 30 jours"
//   - cofrac_expiry_7         critical "URGENT : votre certification COFRAC expire dans 7 jours"
//   - cofrac_suspended        critical "URGENT : votre certification COFRAC a été suspendue"
//   - cofrac_radiated         critical "URGENT : votre certification COFRAC a été radiée"
//   - rcpro_expiry_60/30/7    "Votre RC Pro expire dans X jours"
//   - rcpro_expired           critical "URGENT : votre RC Pro est expirée"
//   - sirene_radiated         critical "URGENT : votre entreprise a été radiée"
//   - sirene_liquidation      critical "URGENT : votre entreprise est en liquidation"
//
// Alertes équipe admin (envoyées à contact@kovas.fr) :
//   - signalement_threshold   critical "3+ signalements sur le diagnostiqueur X"
//   - manual_audit_required   critical "Audit manuel requis pour le diagnostiqueur X"
//
// Trigger : pg_cron toutes les heures (cf. 20260524250000_verification_continuous_crons.sql)
//
// Variables env :
//   - SUPABASE_URL                 (auto)
//   - SUPABASE_SERVICE_ROLE_KEY    (auto)
//   - RESEND_API_KEY               (requis)
//   - RESEND_FROM                  (default 'KOVAS <contact@kovas.fr>')
//   - ADMIN_ALERT_EMAIL            (default 'contact@kovas.fr')
//   - CRON_SECRET                  (optionnel)
// ============================================

/// <reference lib="deno.ns" />

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BATCH_SIZE = 100

type Severity = 'info' | 'warning' | 'critical'

type AlertType =
  | 'cofrac_expiry_60'
  | 'cofrac_expiry_30'
  | 'cofrac_expiry_7'
  | 'cofrac_suspended'
  | 'cofrac_radiated'
  | 'rcpro_expiry_60'
  | 'rcpro_expiry_30'
  | 'rcpro_expiry_7'
  | 'rcpro_expired'
  | 'sirene_radiated'
  | 'sirene_liquidation'
  | 'signalement_threshold'
  | 'manual_audit_required'

interface AlertRow {
  id: string
  diagnostician_id: string
  alert_type: AlertType
  severity: Severity
  created_at: string
}

interface DiagnosticianInfo {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  city: string | null
  email: string | null
  cofrac_valid_until: string | null
  rcpro_valid_until: string | null
}

interface EmailContent {
  to: string
  subject: string
  text: string
  html: string
  tag: 'verification_diag' | 'verification_admin'
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fullNameOf(diag: DiagnosticianInfo): string {
  if (diag.full_name?.trim()) return diag.full_name.trim()
  const parts = [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim()
  return parts || 'Diagnostiqueur'
}

function buildEmail(
  alert: AlertRow,
  diag: DiagnosticianInfo,
  adminEmail: string,
): EmailContent | null {
  const name = fullNameOf(diag)
  const greeting = `Bonjour ${name},`
  const sig = `\n\nCordialement,\nL'équipe KOVAS\nNexus 1993 SASU · contact@kovas.fr`

  // Helpers ville pour les emails admin
  const cityLabel = diag.city ? ` (${diag.city})` : ''

  switch (alert.alert_type) {
    case 'cofrac_expiry_60':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'Votre certification COFRAC expire dans 60 jours',
        text: `${greeting}\n\nVotre certification COFRAC arrive à expiration le ${diag.cofrac_valid_until ?? 'date à confirmer'} (dans 60 jours).\n\nPour conserver votre statut "Vérifié KOVAS" et rester visible dans l'annuaire public, pensez à initier le renouvellement avec votre organisme certificateur dès maintenant.${sig}`,
        html: `<p>${greeting}</p><p>Votre certification COFRAC arrive à expiration le <strong>${diag.cofrac_valid_until ?? 'date à confirmer'}</strong> (dans 60 jours).</p><p>Pour conserver votre statut "Vérifié KOVAS" et rester visible dans l'annuaire public, pensez à initier le renouvellement avec votre organisme certificateur dès maintenant.</p><p>Cordialement,<br/>L'équipe KOVAS</p>`,
      }

    case 'cofrac_expiry_30':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'Votre certification COFRAC expire dans 30 jours',
        text: `${greeting}\n\nVotre certification COFRAC expire dans 30 jours (${diag.cofrac_valid_until ?? 'date à confirmer'}).\n\nSans renouvellement avant cette date, votre fiche sera automatiquement retirée de l'annuaire public KOVAS.\n\nMerci de transmettre votre nouveau certificat dès qu'il sera disponible depuis votre tableau de bord.${sig}`,
        html: `<p>${greeting}</p><p>Votre certification COFRAC expire dans <strong>30 jours</strong> (${diag.cofrac_valid_until ?? 'date à confirmer'}).</p><p>Sans renouvellement avant cette date, votre fiche sera automatiquement retirée de l'annuaire public KOVAS.</p><p>Merci de transmettre votre nouveau certificat dès qu'il sera disponible depuis votre tableau de bord.</p>`,
      }

    case 'cofrac_expiry_7':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'URGENT : votre certification COFRAC expire dans 7 jours',
        text: `${greeting}\n\nVotre certification COFRAC expire dans 7 jours (${diag.cofrac_valid_until ?? 'date à confirmer'}). Au-delà, votre profil sera automatiquement masqué de l'annuaire public.\n\nMerci de transmettre votre nouveau certificat sans attendre via votre tableau de bord.${sig}`,
        html: `<p>${greeting}</p><p><strong>Votre certification COFRAC expire dans 7 jours</strong> (${diag.cofrac_valid_until ?? 'date à confirmer'}). Au-delà, votre profil sera automatiquement masqué de l'annuaire public.</p><p>Merci de transmettre votre nouveau certificat sans attendre via votre tableau de bord.</p>`,
      }

    case 'cofrac_suspended':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'URGENT : votre certification COFRAC a été suspendue',
        text: `${greeting}\n\nVotre certification COFRAC vient d'être marquée comme suspendue par l'organisme certificateur. Par conséquent, votre profil public KOVAS a été désactivé.\n\nMerci de prendre contact avec votre organisme certificateur et de nous transmettre la situation régularisée dès que possible.${sig}`,
        html: `<p>${greeting}</p><p><strong>Votre certification COFRAC vient d'être marquée comme suspendue</strong> par l'organisme certificateur. Par conséquent, votre profil public KOVAS a été désactivé.</p><p>Merci de prendre contact avec votre organisme certificateur et de nous transmettre la situation régularisée dès que possible.</p>`,
      }

    case 'cofrac_radiated':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'URGENT : votre certification COFRAC a été radiée',
        text: `${greeting}\n\nVotre certification COFRAC apparaît désormais en statut radié. Votre profil public KOVAS a été désactivé en conséquence.\n\nSi vous estimez qu'il s'agit d'une erreur, contactez l'organisme certificateur ainsi que notre équipe à contact@kovas.fr pour étudier votre situation.${sig}`,
        html: `<p>${greeting}</p><p><strong>Votre certification COFRAC apparaît désormais en statut radié.</strong> Votre profil public KOVAS a été désactivé en conséquence.</p><p>Si vous estimez qu'il s'agit d'une erreur, contactez l'organisme certificateur ainsi que notre équipe à <a href="mailto:contact@kovas.fr">contact@kovas.fr</a> pour étudier votre situation.</p>`,
      }

    case 'rcpro_expiry_60':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'Votre RC Pro expire dans 60 jours',
        text: `${greeting}\n\nVotre attestation RC Pro arrive à expiration le ${diag.rcpro_valid_until ?? 'date à confirmer'} (dans 60 jours).\n\nPour rester en règle vis-à-vis de la réglementation diagnostic et conserver votre visibilité publique, pensez à demander à votre assureur l'attestation pour la période suivante.${sig}`,
        html: `<p>${greeting}</p><p>Votre attestation RC Pro arrive à expiration le <strong>${diag.rcpro_valid_until ?? 'date à confirmer'}</strong> (dans 60 jours).</p><p>Pour rester en règle vis-à-vis de la réglementation diagnostic et conserver votre visibilité publique, pensez à demander à votre assureur l'attestation pour la période suivante.</p>`,
      }

    case 'rcpro_expiry_30':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'Votre RC Pro expire dans 30 jours',
        text: `${greeting}\n\nVotre attestation RC Pro expire dans 30 jours (${diag.rcpro_valid_until ?? 'date à confirmer'}). Merci de nous transmettre la nouvelle attestation avant cette date depuis votre tableau de bord.${sig}`,
        html: `<p>${greeting}</p><p>Votre attestation RC Pro expire dans <strong>30 jours</strong> (${diag.rcpro_valid_until ?? 'date à confirmer'}). Merci de nous transmettre la nouvelle attestation avant cette date depuis votre tableau de bord.</p>`,
      }

    case 'rcpro_expiry_7':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'URGENT : votre RC Pro expire dans 7 jours',
        text: `${greeting}\n\nVotre RC Pro expire dans 7 jours (${diag.rcpro_valid_until ?? 'date à confirmer'}). Au-delà, votre profil sera automatiquement masqué de l'annuaire public KOVAS.\n\nMerci de transmettre la nouvelle attestation sans attendre.${sig}`,
        html: `<p>${greeting}</p><p><strong>Votre RC Pro expire dans 7 jours</strong> (${diag.rcpro_valid_until ?? 'date à confirmer'}). Au-delà, votre profil sera automatiquement masqué de l'annuaire public KOVAS.</p><p>Merci de transmettre la nouvelle attestation sans attendre.</p>`,
      }

    case 'rcpro_expired':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'URGENT : votre RC Pro est expirée',
        text: `${greeting}\n\nVotre RC Pro est expirée depuis le ${diag.rcpro_valid_until ?? 'date à confirmer'}. Votre profil public a été masqué et votre statut Vérifié KOVAS suspendu.\n\nMerci de transmettre la nouvelle attestation depuis votre tableau de bord pour réactiver votre fiche.${sig}`,
        html: `<p>${greeting}</p><p><strong>Votre RC Pro est expirée depuis le ${diag.rcpro_valid_until ?? 'date à confirmer'}.</strong> Votre profil public a été masqué et votre statut Vérifié KOVAS suspendu.</p><p>Merci de transmettre la nouvelle attestation depuis votre tableau de bord pour réactiver votre fiche.</p>`,
      }

    case 'sirene_radiated':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'URGENT : votre entreprise apparaît comme radiée au répertoire SIRENE',
        text: `${greeting}\n\nVotre entreprise apparaît désormais comme radiée dans le répertoire SIRENE de l'INSEE. Votre profil public KOVAS a été masqué en conséquence.\n\nSi vous avez créé une nouvelle structure, transmettez son extrait KBis depuis votre tableau de bord. Sinon, contactez-nous à contact@kovas.fr.${sig}`,
        html: `<p>${greeting}</p><p><strong>Votre entreprise apparaît désormais comme radiée dans le répertoire SIRENE de l'INSEE.</strong> Votre profil public KOVAS a été masqué en conséquence.</p><p>Si vous avez créé une nouvelle structure, transmettez son extrait KBis depuis votre tableau de bord. Sinon, contactez-nous à <a href="mailto:contact@kovas.fr">contact@kovas.fr</a>.</p>`,
      }

    case 'sirene_liquidation':
      if (!diag.email) return null
      return {
        to: diag.email,
        tag: 'verification_diag',
        subject: 'URGENT : votre entreprise apparaît en procédure de liquidation',
        text: `${greeting}\n\nVotre entreprise apparaît en procédure de liquidation au répertoire SIRENE. Votre profil public a été masqué.\n\nSi cette information est erronée, merci de nous contacter à contact@kovas.fr.${sig}`,
        html: `<p>${greeting}</p><p><strong>Votre entreprise apparaît en procédure de liquidation au répertoire SIRENE.</strong> Votre profil public a été masqué.</p><p>Si cette information est erronée, merci de nous contacter à <a href="mailto:contact@kovas.fr">contact@kovas.fr</a>.</p>`,
      }

    case 'signalement_threshold':
      return {
        to: adminEmail,
        tag: 'verification_admin',
        subject: `[KOVAS Admin] 3+ signalements : ${name}${cityLabel} — audit manuel requis`,
        text: `Le diagnostiqueur ${name}${cityLabel} (id: ${diag.id}) a accumulé au moins 3 signalements particuliers sur les 6 derniers mois.\n\nUn audit manuel est requis depuis la console admin :\nhttps://kovas.fr/admin/signalements\n\n— KOVAS Verification Pipeline`,
        html: `<p>Le diagnostiqueur <strong>${name}${cityLabel}</strong> (id: <code>${diag.id}</code>) a accumulé au moins 3 signalements particuliers sur les 6 derniers mois.</p><p>Un audit manuel est requis depuis la console admin :<br/><a href="https://kovas.fr/admin/signalements">https://kovas.fr/admin/signalements</a></p><p>— KOVAS Verification Pipeline</p>`,
      }

    case 'manual_audit_required':
      return {
        to: adminEmail,
        tag: 'verification_admin',
        subject: `[KOVAS Admin] Audit manuel requis : ${name}${cityLabel}`,
        text: `Audit manuel demandé pour le diagnostiqueur ${name}${cityLabel} (id: ${diag.id}).\n\nFile de modération :\nhttps://kovas.fr/admin/verifications/queue\n\n— KOVAS Verification Pipeline`,
        html: `<p>Audit manuel demandé pour le diagnostiqueur <strong>${name}${cityLabel}</strong> (id: <code>${diag.id}</code>).</p><p>File de modération :<br/><a href="https://kovas.fr/admin/verifications/queue">https://kovas.fr/admin/verifications/queue</a></p><p>— KOVAS Verification Pipeline</p>`,
      }

    default:
      return null
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'
  const adminEmail = Deno.env.get('ADMIN_ALERT_EMAIL') ?? 'contact@kovas.fr'
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'missing_supabase_env' }, 500)
  }

  // Auth : Bearer service_role OU x-cron-secret
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  const authorized =
    authHeader === `Bearer ${serviceRole}` ||
    (cronSecret !== undefined && cronHeader === cronSecret)
  if (!authorized) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Fetch les alertes pending (max BATCH_SIZE)
  const { data: alertsRaw, error: alertsErr } = await supabase
    .from('verification_alerts_queue')
    .select('id, diagnostician_id, alert_type, severity, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (alertsErr) {
    return jsonResponse({ error: 'db_error', detail: alertsErr.message }, 500)
  }

  const alerts = (alertsRaw ?? []) as AlertRow[]
  if (alerts.length === 0) {
    return jsonResponse({ ok: true, processed: 0, sent: 0, skipped: 0 })
  }

  // Charge les diagnosticians associés (1 seul round-trip)
  const diagIds = Array.from(new Set(alerts.map((a) => a.diagnostician_id)))
  const { data: diagsRaw } = await supabase
    .from('diagnosticians')
    .select('id, full_name, first_name, last_name, city, email')
    .in('id', diagIds)
  const { data: dvsRaw } = await supabase
    .from('diagnostician_verification_status')
    .select('diagnostician_id, cofrac_valid_until, rcpro_valid_until')
    .in('diagnostician_id', diagIds)

  const diagsMap = new Map<string, DiagnosticianInfo>()
  for (const d of diagsRaw ?? []) {
    diagsMap.set(d.id as string, {
      id: d.id as string,
      full_name: (d.full_name as string | null) ?? null,
      first_name: (d.first_name as string | null) ?? null,
      last_name: (d.last_name as string | null) ?? null,
      city: (d.city as string | null) ?? null,
      email: (d.email as string | null) ?? null,
      cofrac_valid_until: null,
      rcpro_valid_until: null,
    })
  }
  for (const v of dvsRaw ?? []) {
    const id = v.diagnostician_id as string
    const cur = diagsMap.get(id)
    if (cur) {
      cur.cofrac_valid_until = (v.cofrac_valid_until as string | null) ?? null
      cur.rcpro_valid_until = (v.rcpro_valid_until as string | null) ?? null
    }
  }

  let sent = 0
  let skipped = 0
  const errors: Array<{ alertId: string; reason: string }> = []

  for (const alert of alerts) {
    const diag = diagsMap.get(alert.diagnostician_id)
    if (!diag) {
      skipped++
      errors.push({ alertId: alert.id, reason: 'diagnostician_not_found' })
      // Marque dismissed pour ne pas réessayer indéfiniment
      await supabase
        .from('verification_alerts_queue')
        .update({ status: 'dismissed' })
        .eq('id', alert.id)
      continue
    }

    const email = buildEmail(alert, diag, adminEmail)
    if (!email) {
      skipped++
      errors.push({ alertId: alert.id, reason: 'no_email_template_or_no_recipient' })
      await supabase
        .from('verification_alerts_queue')
        .update({ status: 'dismissed' })
        .eq('id', alert.id)
      continue
    }

    if (!resendApiKey) {
      // Pas d'API key — on log mais on ne plante pas (graceful)
      skipped++
      errors.push({ alertId: alert.id, reason: 'resend_api_key_missing' })
      continue
    }

    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
          tags: [
            { name: 'category', value: 'verification_alert' },
            { name: 'alert_type', value: alert.alert_type },
            { name: 'severity', value: alert.severity },
            { name: 'audience', value: email.tag },
          ],
        }),
      })

      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        errors.push({ alertId: alert.id, reason: `resend_${resp.status}: ${t.slice(0, 200)}` })
        skipped++
        continue
      }

      await supabase
        .from('verification_alerts_queue')
        .update({ status: 'sent', email_sent_at: new Date().toISOString() })
        .eq('id', alert.id)

      sent++
    } catch (e) {
      errors.push({ alertId: alert.id, reason: `exception: ${String(e).slice(0, 200)}` })
      skipped++
    }
  }

  return jsonResponse({
    ok: true,
    processed: alerts.length,
    sent,
    skipped,
    errors: errors.length ? errors : undefined,
  })
})
