// Edge Function: leads-weekly-digest
// Cron: 0 9 * * 1 (lundi 9h UTC ≈ 10h-11h CET)
//
// Pour chaque diag avec claim_status='unclaimed' ET leads_received_count > 0
// ce mois, envoie un email récap "Vous avez X demandes de devis en attente.
// Vous ratez peut-être Y€ ce mois (X × 300€ × 30% conversion potentielle)".
//
// Variables d'env requises :
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - RESEND_API_KEY
// - NEXT_PUBLIC_APP_URL (base URL pour les CTA)

// @ts-nocheck — Deno runtime (Supabase Edge Functions). Le worktree principal
// utilise tsc Node — ce fichier est typé séparément à l'exécution Deno.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AVG_QUOTE_VALUE_EUR = 300
const CONVERSION_RATE_POTENTIAL = 0.3

interface UnclaimedDiagWithLeads {
  id: string
  slug: string
  display_name: string | null
  email: string | null
  leads_received_count: number
  last_lead_received_at: string | null
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Diag unclaimed ayant reçu ≥1 lead dans les 30 derniers jours
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: diags, error } = await supabase
    .from('diagnosticians')
    .select('id, slug, display_name, email, leads_received_count, last_lead_received_at')
    .eq('claim_status', 'unclaimed')
    .gte('last_lead_received_at', thirtyDaysAgo)
    .gt('leads_received_count', 0)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const baseUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

  let sent = 0
  let skipped = 0

  for (const diag of (diags ?? []) as UnclaimedDiagWithLeads[]) {
    if (!diag.email) {
      skipped++
      continue
    }

    // Compte les leads en attente du mois courant
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const { count: leadsThisMonth } = await supabase
      .from('quote_requests')
      .select('id', { count: 'exact', head: true })
      .eq('diagnostician_id', diag.id)
      .gte('created_at', monthStart.toISOString())

    const pending = leadsThisMonth ?? 0
    if (pending === 0) {
      skipped++
      continue
    }

    const estimatedMissedRevenue = Math.round(
      pending * AVG_QUOTE_VALUE_EUR * CONVERSION_RATE_POTENTIAL,
    )
    const firstName = (diag.display_name ?? '').split(' ')[0] || 'à vous'
    const claimUrl = `${baseUrl}/reclamer-ma-fiche/${diag.id}?utm_source=weekly_digest`
    const pendingUrl = `${baseUrl}/diagnostiqueurs/${diag.id}/leads-en-attente`

    const html = renderDigestEmail({
      firstName,
      pendingCount: pending,
      estimatedMissedRevenue,
      claimUrl,
      pendingUrl,
    })

    const subject = `${pending} demande${pending > 1 ? 's' : ''} de devis en attente sur KOVAS`

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'KOVAS <contact@kovas.fr>',
          to: diag.email,
          subject,
          html,
        }),
      })
      if (res.ok) sent++
      else skipped++
    } else {
      sent++
    }
  }

  return new Response(JSON.stringify({ sent, skipped, total: diags?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function renderDigestEmail(args: {
  firstName: string
  pendingCount: number
  estimatedMissedRevenue: number
  claimUrl: string
  pendingUrl: string
}): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><title>Demandes de devis en attente</title></head>
<body style="font-family: -apple-system, sans-serif; background: #fafbfc; color: #0b1d33; padding: 32px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <p><strong style="color: #0b1d33;">KOVAS</strong> · Récapitulatif hebdomadaire</p>
    <h1 style="font-size: 22px; margin: 24px 0 16px;">${args.pendingCount} demande${args.pendingCount > 1 ? 's' : ''} de devis vous attendent</h1>
    <p>Bonjour ${args.firstName},</p>
    <p>Cette semaine, <strong>${args.pendingCount}</strong> personne${args.pendingCount > 1 ? 's ont' : ' a'} cherché un diagnostiqueur dans votre zone et déposé une demande de devis sur votre fiche KOVAS.</p>
    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0; color: #9a3412;">
      <strong>Estimation perdue : ~${args.estimatedMissedRevenue}€ ce mois</strong><br />
      <span style="font-size: 13px;">Base ${AVG_QUOTE_VALUE_EUR}€/devis × ${Math.round(CONVERSION_RATE_POTENTIAL * 100)}% conversion potentielle.</span>
    </div>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${args.claimUrl}" style="display: inline-block; background: #0b1d33; color: white; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: 600;">Réclamer ma fiche</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">Voir le détail anonymisé : <a href="${args.pendingUrl}" style="color: #0b1d33;">${args.pendingUrl}</a></p>
    <p style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">KOVAS · SASU Nexus 1993 · Récapitulatif hebdomadaire automatique. Vous pouvez demander le retrait de votre fiche à tout moment.</p>
  </div>
</body>
</html>`
}
