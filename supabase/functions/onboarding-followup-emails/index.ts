// ============================================
// KOVAS — Cron emails follow-up onboarding diagnostiqueur (VAL-2)
// Schedule : toutes les heures (cf. Supabase pg_cron : `0 * * * *`)
// Auth     : Authorization: Bearer ${CRON_SECRET}
// ============================================
//
// Comportement :
//   - Récupère les diagnosticians avec verification_status = 'in_review'
//   - Sépare deux populations :
//       a) created_at ∈ [now - 13h, now - 11h]  → email T+12h "en cours"
//       b) created_at ∈ [now - 49h, now - 47h]  → email T+48h selon overall_status
//   - Anti-doublon : marque le flag dans verification_checks_log
//     (check_type = 'onboarding_followup_12h' | 'onboarding_followup_48h')
//   - Envoie via Resend (RESEND_API_KEY).
//
// Ton : avatar SOBRE PROFESSIONNEL, vouvoiement, signature humaine Benjamin.
// ============================================

// @ts-expect-error : import deno standard
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-expect-error : Deno global disponible au runtime Edge
const Deno = globalThis.Deno as {
  env: { get(key: string): string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://kovas.fr'
const FROM_EMAIL = 'KOVAS 360 <contact@kovas.fr>'

interface DiagRow {
  id: string
  email: string | null
  created_at: string
  verification: {
    overall_status: 'pending' | 'verified' | 'rejected' | 'expired'
    identity_status: string
    cofrac_status: string
    rcpro_status: string
    sirene_status: string
  } | null
}

function emailT12h(): { subject: string; html: string } {
  return {
    subject: 'Votre validation KOVAS 360 est en cours',
    html: `
<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F1419;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
<p>Bonjour,</p>
<p>Merci d'avoir choisi KOVAS 360. Nous avons bien reçu votre dossier et la vérification des quatre phases (identité civile, COFRAC, RC Pro, SIRENE) est en cours.</p>
<p><strong>Délai moyen : 24 à 48 heures.</strong> Pendant ce temps, vous pouvez configurer votre compte, importer vos contacts et paramétrer votre agenda. Dès validation, votre profil apparaîtra dans l'annuaire public et vous pourrez recevoir des leads du calculateur DPE gratuit.</p>
<p>Vous pouvez consulter le détail de l'avancement à tout moment :</p>
<p><a href="${APP_URL}/dashboard/account/verification" style="display:inline-block;background:#0F1419;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;">Voir l'avancement</a></p>
<p>Si vous avez la moindre question, répondez simplement à cet email.</p>
<p>Cordialement,<br/>Benjamin Bel<br/>Fondateur de KOVAS 360</p>
<hr style="border:none;border-top:1px solid #0F1419;opacity:0.08;margin:24px 0;"/>
<p style="font-size:12px;color:#0F1419;opacity:0.55;">SASU Nexus 1993 · SIREN 944 037 220 · Paris 8</p>
</body></html>`.trim(),
  }
}

function emailT48hValidated(): { subject: string; html: string } {
  return {
    subject: 'Votre compte KOVAS 360 est validé',
    html: `
<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F1419;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
<p>Bonjour,</p>
<p>Bonne nouvelle : <strong>les quatre phases de validation sont maintenant vert</strong> (identité, COFRAC, RC Pro, SIRENE).</p>
<p>Votre profil est désormais visible dans l'annuaire public de KOVAS 360 et vous êtes éligible aux leads du calculateur DPE gratuit. Le badge "Diagnostiqueur vérifié" s'affiche sur votre fiche publique.</p>
<p><a href="${APP_URL}/dashboard" style="display:inline-block;background:#0F1419;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;">Aller au dashboard</a></p>
<p>Cordialement,<br/>Benjamin Bel<br/>Fondateur de KOVAS 360</p>
<hr style="border:none;border-top:1px solid #0F1419;opacity:0.08;margin:24px 0;"/>
<p style="font-size:12px;color:#0F1419;opacity:0.55;">SASU Nexus 1993 · SIREN 944 037 220 · Paris 8</p>
</body></html>`.trim(),
  }
}

function emailT48hAdditionalDoc(): { subject: string; html: string } {
  return {
    subject: 'Document complémentaire requis — KOVAS 360',
    html: `
<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F1419;line-height:1.55;max-width:560px;margin:0 auto;padding:24px;">
<p>Bonjour,</p>
<p>Votre vérification est presque terminée. Nous avons besoin d'un document complémentaire pour finaliser la validation.</p>
<p>Le détail figure dans votre tableau de bord :</p>
<p><a href="${APP_URL}/dashboard/account/verification" style="display:inline-block;background:#0F1419;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;">Voir ce qui manque</a></p>
<p>Cordialement,<br/>Benjamin Bel<br/>Fondateur de KOVAS 360</p>
<hr style="border:none;border-top:1px solid #0F1419;opacity:0.08;margin:24px 0;"/>
<p style="font-size:12px;color:#0F1419;opacity:0.55;">SASU Nexus 1993 · SIREN 944 037 220 · Paris 8</p>
</body></html>`.trim(),
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Resend ${res.status}: ${txt}`)
  }
  return res.json()
}

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = Date.now()
  const t12Start = new Date(now - 13 * 3600 * 1000).toISOString()
  const t12End = new Date(now - 11 * 3600 * 1000).toISOString()
  const t48Start = new Date(now - 49 * 3600 * 1000).toISOString()
  const t48End = new Date(now - 47 * 3600 * 1000).toISOString()

  let sent12h = 0
  let sent48h = 0

  // ─── T+12h ───────────────────────────────────────────────────────────
  const { data: t12Diags } = await supa
    .from('diagnostician_verification_status')
    .select(
      'diagnostician_id, overall_status, identity_status, cofrac_status, rcpro_status, sirene_status, created_at',
    )
    .gte('created_at', t12Start)
    .lte('created_at', t12End)
    .neq('overall_status', 'verified')

  for (const row of (t12Diags as Array<{ diagnostician_id: string }> | null) ?? []) {
    // Anti-doublon
    const { data: existing } = await supa
      .from('verification_checks_log')
      .select('id')
      .eq('diagnostician_id', row.diagnostician_id)
      .eq('check_type', 'onboarding_followup_12h')
      .limit(1)
    if (existing && existing.length > 0) continue

    const { data: diag } = await supa
      .from('diagnosticians')
      .select('email')
      .eq('id', row.diagnostician_id)
      .maybeSingle()
    if (!diag?.email) continue

    try {
      const tpl = emailT12h()
      await sendEmail(diag.email, tpl.subject, tpl.html)
      await supa.from('verification_checks_log').insert({
        diagnostician_id: row.diagnostician_id,
        check_type: 'onboarding_followup_12h',
        check_source: 'cron',
        status: 'success',
        triggered_by: 'system',
      })
      sent12h++
    } catch (e) {
      console.error('T+12h send failed:', e)
    }
  }

  // ─── T+48h ───────────────────────────────────────────────────────────
  const { data: t48Diags } = await supa
    .from('diagnostician_verification_status')
    .select('diagnostician_id, overall_status, created_at')
    .gte('created_at', t48Start)
    .lte('created_at', t48End)

  for (const row of (t48Diags as Array<{
    diagnostician_id: string
    overall_status: 'pending' | 'verified' | 'rejected' | 'expired'
  }> | null) ?? []) {
    const { data: existing } = await supa
      .from('verification_checks_log')
      .select('id')
      .eq('diagnostician_id', row.diagnostician_id)
      .eq('check_type', 'onboarding_followup_48h')
      .limit(1)
    if (existing && existing.length > 0) continue

    const { data: diag } = await supa
      .from('diagnosticians')
      .select('email')
      .eq('id', row.diagnostician_id)
      .maybeSingle()
    if (!diag?.email) continue

    const tpl = row.overall_status === 'verified' ? emailT48hValidated() : emailT48hAdditionalDoc()
    try {
      await sendEmail(diag.email, tpl.subject, tpl.html)
      await supa.from('verification_checks_log').insert({
        diagnostician_id: row.diagnostician_id,
        check_type: 'onboarding_followup_48h',
        check_source: 'cron',
        status: 'success',
        result: { overall_status: row.overall_status },
        triggered_by: 'system',
      })
      sent48h++
    } catch (e) {
      console.error('T+48h send failed:', e)
    }
  }

  return new Response(
    JSON.stringify({ sent_12h: sent12h, sent_48h: sent48h, ts: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
