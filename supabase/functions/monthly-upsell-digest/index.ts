// Edge Function: monthly-upsell-digest
// Cron: 0 7 1 * * UTC (1er du mois 8h CET)
//
// Pour chaque user avec subscription active :
//   1. Récupère stats du mois précédent (missions, factures, leads)
//   2. Top 1-2 suggestions pending non encore shown_email
//   3. Envoie email "Votre activité du mois" via Resend
//   4. Marque shown_email_at sur les suggestions envoyées
//
// Anti-spam : 1 email max par mois (du fait du cron 1× / mois)
// Respect opt-in : ne pas envoyer si user_preferences.monthly_report_email_enabled === false

// @ts-nocheck — Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SuggestionRow {
  id: string
  suggestion_type: 'addon' | 'pack' | 'tier_upgrade'
  suggested_target: string
  reason_label: string
  reason_benefit: string
  estimated_value_eur: number | null
  priority: number
}

// Catalog inline (mirror simplifié de apps/web/src/lib/upsell/upsell-content.ts)
const PRICE_LABELS: Record<string, string> = {
  facturx_ppf: '22€/mo HT',
  pennylane_sync: '15€/mo HT',
  signatures_eidas: '18€/mo HT',
  bilingual_reports: '19€/mo HT',
  sms_reminders: '12€/mo HT',
  community_pro: '9€/mo HT',
  analytics_advanced: '24€/mo HT',
  regulatory_watch: '12€/mo HT',
  cockpit_ademe_m2: '15€/mo HT',
  pack_growth: '29€/mo HT',
  pack_cabinet: '49€/mo HT',
  pack_international: '25€/mo HT',
  essential: '19€/mo HT',
  decouverte: '29€/mo HT',
  pro: '39€/mo HT',
  all_inclusive: '99€/mo HT',
  cabinet: '149€/mo HT',
}

const TITLES: Record<string, string> = {
  facturx_ppf: 'Facturation Factur-X PPF',
  pennylane_sync: 'Synchronisation Pennylane',
  signatures_eidas: 'Signatures électroniques eIDAS',
  bilingual_reports: 'Rapports bilingues FR/EN',
  sms_reminders: 'SMS rappel client J-1',
  community_pro: 'Communauté Pro',
  analytics_advanced: 'Analytics avancés cabinet',
  regulatory_watch: 'Veille IA hebdomadaire',
  cockpit_ademe_m2: 'Cockpit ADEME Mode 2',
  pack_growth: 'Pack Croissance',
  pack_cabinet: 'Pack Cabinet',
  pack_international: 'Pack International',
  essential: 'Forfait Essential',
  decouverte: 'Forfait Découverte',
  pro: 'Forfait Pro',
  all_inclusive: 'Forfait All Inclusive',
  cabinet: 'Forfait Cabinet',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderEmailHtml(args: {
  recipientFirstName: string
  monthLabel: string
  missionsCount: number
  invoicesCount: number
  leadsCount: number
  hoursSavedEstimate: number
  suggestions: SuggestionRow[]
  baseUrl: string
}): string {
  const {
    recipientFirstName,
    monthLabel,
    missionsCount,
    invoicesCount,
    leadsCount,
    hoursSavedEstimate,
    suggestions,
    baseUrl,
  } = args
  const suggestionsHtml = suggestions
    .map((s) => {
      const title = TITLES[s.suggested_target] ?? s.suggested_target
      const price = PRICE_LABELS[s.suggested_target] ?? ''
      const ctaUrl =
        s.suggestion_type === 'tier_upgrade'
          ? `${baseUrl}/pricing/checkout?plan=${encodeURIComponent(s.suggested_target)}&utm_source=monthly_digest`
          : `${baseUrl}/app/account?module=${encodeURIComponent(s.suggested_target)}&utm_source=monthly_digest`
      return `
      <tr><td style="padding:24px 0;border-top:1px solid #E5DECB;">
        <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 6px 0;">
          ${escapeHtml(s.reason_label)}
        </p>
        <h3 style="font-family:'Manrope',sans-serif;font-size:18px;font-weight:700;color:#0F1E3D;margin:0 0 8px 0;line-height:1.3;">
          ${escapeHtml(title)}
        </h3>
        <p style="font-family:'Manrope',sans-serif;font-size:14px;color:#4A5878;line-height:1.5;margin:0 0 14px 0;">
          ${escapeHtml(s.reason_benefit)}
        </p>
        <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#7E8AA4;margin:0 0 14px 0;">
          ${escapeHtml(price)} · 14 jours gratuits
        </p>
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#D4F542;color:#0F1419;font-family:'Manrope',sans-serif;font-weight:600;font-size:13px;padding:10px 22px;border-radius:999px;text-decoration:none;">
          Démarrer mon essai 14j
        </a>
      </td></tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:'Manrope',Arial,sans-serif;color:#0F1E3D;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8F5EE;padding:32px 0;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#FDFBF6;border-radius:24px;padding:32px;">
<tr><td>
<p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 6px 0;">KOVAS 360 · Rapport mensuel</p>
<h1 style="font-family:'Instrument Serif',serif;font-style:italic;font-size:32px;color:#0F1E3D;margin:0 0 6px 0;line-height:1.15;">${escapeHtml(monthLabel)}</h1>
<p style="font-family:'Manrope',sans-serif;font-size:14px;color:#4A5878;line-height:1.5;margin:0 0 28px 0;">Bonjour ${escapeHtml(recipientFirstName)}, voici un aperçu de votre activité du mois.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top:1px solid #E5DECB;">
<tr>
<td style="padding:20px 0;border-bottom:1px solid #E5DECB;"><p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Missions</p><p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${missionsCount}</p></td>
<td style="padding:20px 0;border-bottom:1px solid #E5DECB;"><p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Factures</p><p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${invoicesCount}</p></td>
</tr>
<tr>
<td style="padding:20px 0;border-bottom:1px solid #E5DECB;"><p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Demandes</p><p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${leadsCount}</p></td>
<td style="padding:20px 0;border-bottom:1px solid #E5DECB;"><p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Heures économisées</p><p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${hoursSavedEstimate}h</p></td>
</tr>
</table>
${suggestions.length > 0 ? `<div style="margin-top:24px;"><p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Suggestions personnalisées</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${suggestionsHtml}</table></div>` : ''}
<p style="font-family:'Manrope',sans-serif;font-size:14px;color:#0F1E3D;margin:32px 0 4px 0;">Benjamin</p>
<p style="font-family:'Manrope',sans-serif;font-size:12px;color:#4A5878;margin:0;">Fondateur · KOVAS 360</p>
<p style="font-family:'Manrope',sans-serif;font-size:11px;color:#7E8AA4;margin:24px 0 0 0;line-height:1.5;">Pour gérer vos préférences de notification, rendez-vous dans <a href="${escapeHtml(baseUrl)}/app/account" style="color:#7E8AA4;text-decoration:underline;">votre compte KOVAS</a>.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const authHeader = req.headers.get('authorization') ?? ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const baseUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

  const now = new Date()
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const prevMonthLabel = prevMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const { data: subsRaw } = await supabase
    .from('subscriptions')
    .select(
      'organization_id, organizations!inner(owner_user_id, profiles:owner_user_id(email, full_name))',
    )
    .in('status', ['trialing', 'active'])

  type SubRow = {
    organization_id: string
    organizations: {
      owner_user_id: string
      profiles: { email: string | null; full_name: string | null } | null
    } | null
  }
  const subs = (subsRaw ?? []) as SubRow[]
  let sent = 0
  let skipped = 0

  for (const sub of subs) {
    const ownerId = sub.organizations?.owner_user_id
    const email = sub.organizations?.profiles?.email
    const fullName = sub.organizations?.profiles?.full_name ?? ''
    if (!ownerId || !email) {
      skipped++
      continue
    }

    // Opt-in check
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('monthly_report_email_enabled')
      .eq('user_id', ownerId)
      .maybeSingle()
    const optedIn =
      ((prefs as { monthly_report_email_enabled?: boolean } | null)?.monthly_report_email_enabled ??
        true) !== false
    if (!optedIn) {
      skipped++
      continue
    }

    // Stats prev month
    const [{ count: missionsCount }, { count: invoicesCount }, { count: leadsCount }] =
      await Promise.all([
        supabase
          .from('missions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', sub.organization_id)
          .is('deleted_at', null)
          .gte('created_at', prevMonth.toISOString())
          .lt('created_at', prevMonthEnd.toISOString()),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', sub.organization_id)
          .gte('created_at', prevMonth.toISOString())
          .lt('created_at', prevMonthEnd.toISOString()),
        supabase
          .from('user_behavior_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', ownerId)
          .eq('event_type', 'lead_received')
          .gte('created_at', prevMonth.toISOString())
          .lt('created_at', prevMonthEnd.toISOString()),
      ])

    const missions = missionsCount ?? 0
    const invoices = invoicesCount ?? 0
    const leads = leadsCount ?? 0
    const hoursSavedEstimate = Math.round(missions * 1.5 * 10) / 10 // 1h30/mission

    // Top 1-2 suggestions pending non encore shown_email
    const { data: suggestionsRaw } = await supabase
      .from('upsell_suggestions')
      .select(
        'id, suggestion_type, suggested_target, reason_label, reason_benefit, estimated_value_eur, priority',
      )
      .eq('user_id', ownerId)
      .in('status', ['pending', 'shown_in_app'])
      .is('shown_email_at', null)
      .order('priority', { ascending: false })
      .limit(2)
    const suggestions = (suggestionsRaw ?? []) as SuggestionRow[]

    if (suggestions.length === 0 && missions === 0) {
      // Rien à montrer + user inactif → on skip
      skipped++
      continue
    }

    const firstName = fullName ? fullName.split(' ')[0] : 'cher diagnostiqueur'
    const html = renderEmailHtml({
      recipientFirstName: firstName,
      monthLabel: prevMonthLabel,
      missionsCount: missions,
      invoicesCount: invoices,
      leadsCount: leads,
      hoursSavedEstimate,
      suggestions,
      baseUrl,
    })

    // Send via Resend
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${resendKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: 'KOVAS <contact@kovas.fr>',
            to: [email],
            subject: `Votre activité — ${prevMonthLabel}`,
            html,
          }),
        })
      } catch (err) {
        console.warn('[monthly-upsell-digest] resend failed', err)
        skipped++
        continue
      }
    }

    // Mark suggestions as shown_email
    if (suggestions.length > 0) {
      const ids = suggestions.map((s) => s.id)
      await supabase
        .from('upsell_suggestions')
        .update({ shown_email_at: new Date().toISOString(), status: 'shown_email' })
        .in('id', ids)
    }
    sent++
  }

  return new Response(JSON.stringify({ analyzed: subs.length, sent, skipped }), {
    headers: { 'content-type': 'application/json' },
  })
})
