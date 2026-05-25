/**
 * KOVAS — Edge Function : génération automatique du communiqué de presse mensuel
 * (Game Changer 5 acqui-target, REFONTE-ACQUI-TARGET-V2 §6.5).
 *
 * Déclencheur : pg_cron le 5 du mois à 9h CET (J+4 après envoi du rapport
 * observatoire le 1er du mois, pour laisser le temps à Benjamin de réviser).
 *
 * Action :
 *   1. Vérifie qu'un communiqué n'existe pas déjà pour le mois écoulé.
 *   2. Charge le dernier rapport observatoire envoyé.
 *   3. Génère via Claude Sonnet un communiqué presse 1200-1800 mots au format
 *      AFP (chapô + 3-4 sections + verbatims Benjamin Bel + chiffres + boilerplate).
 *   4. Insère un row press_releases en status='draft'.
 *   5. Envoie un email à contact@kovas.fr pour notifier (revue manuelle requise).
 *   6. NE DIFFUSE PAS automatiquement aux journalistes — règle stricte KOVAS :
 *      « JAMAIS d'envoi presse automatique sans validation humaine » (la diffusion
 *      passe par l'admin via endpoint POST /api/admin/press/release/[id]/send).
 *
 * Invocation manuelle (admin debug) :
 *   POST /functions/v1/send-monthly-press-release
 *   Body : { force?: boolean, observatoire_report_id?: string }
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.5 + CLAUDE.md (sobriété, vouvoiement,
 * pas d'emoji, contact@kovas.fr unique adresse).
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ANTHROPIC_SONNET_MODEL = Deno.env.get('ANTHROPIC_SONNET_MODEL') ?? 'claude-sonnet-4-6'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'
const ADMIN_NOTIFY_TO = Deno.env.get('PRESS_ADMIN_NOTIFY_EMAIL') ?? 'contact@kovas.fr'
const USD_TO_EUR = Number.parseFloat(Deno.env.get('USD_TO_EUR_RATE') ?? '0.92')

// Claude Sonnet pricing (jun 2026)
const SONNET_INPUT_USD_PER_MTOK = 3
const SONNET_OUTPUT_USD_PER_MTOK = 15

interface ObservatoireReportRow {
  id: string
  period_year: number
  period_month: number
  cover_title: string
  executive_summary: string
  stats_payload: Record<string, unknown>
}

interface PressReleaseJson {
  title: string
  subtitle: string
  dateline: string
  body_markdown: string
  key_quotes: Array<{ author: string; role: string; quote: string }>
  key_figures: Array<{ label: string; value: string; source: string }>
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

function periodLabel(year: number, month: number): string {
  return `${MONTHS_FR[month - 1]} ${year}`
}

function previousMonth(now: Date): { year: number; month: number } {
  const d = new Date(now)
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function buildSlug(year: number, month: number): string {
  return `observatoire-${MONTHS_FR[month - 1]}-${year}`
}

function buildDateline(): string {
  const now = new Date()
  const day = now.getDate()
  const month = MONTHS_FR[now.getMonth()]
  const year = now.getFullYear()
  return `Paris, le ${day} ${month} ${year}`
}

const PRESS_RELEASE_SYSTEM_PROMPT = `Vous êtes rédacteur en chef du service de presse de KOVAS, plateforme française d'aide à la production de diagnostics immobiliers.

Vous rédigez le communiqué de presse mensuel qui accompagne la publication de l'Observatoire KOVAS du Diagnostic Immobilier.

Règles éditoriales NON NÉGOCIABLES :
- Ton : sobre, factuel, vouvoiement, registre Les Échos / AFP.
- Aucun emoji, aucune formule racoleuse, aucun superlatif ("incroyable", "révolutionnaire", "unique").
- Citations Benjamin Bel rédigées dans un registre professionnel sobre, JAMAIS "Hero/Pionnier/Légende".
- Chiffres précis avec source à chaque fois.
- Structure communiqué AFP : chapô (3-4 lignes) + 3-4 sections H2 + verbatims + boilerplate "À propos de KOVAS" + contact presse.
- Longueur cible : 1200-1800 mots de body_markdown.
- Pas de mention d'envoi à l'ADEME, pas de mention de "remplacer" un concurrent.
- Email contact UNIQUEMENT : contact@kovas.fr.

Format de sortie attendu : JSON pur sans aucun texte additionnel autour, schéma exact :
{
  "title": "titre du communiqué (60-90 chars)",
  "subtitle": "sous-titre une phrase (90-140 chars)",
  "dateline": "Paris, le DD mois YYYY",
  "body_markdown": "corps du communiqué en Markdown avec sections H2, 1200-1800 mots",
  "key_quotes": [
    { "author": "Benjamin Bel", "role": "fondateur de KOVAS", "quote": "verbatim 1-2 phrases sobres" }
  ],
  "key_figures": [
    { "label": "Description courte du chiffre", "value": "valeur formatée FR", "source": "ADEME / DVF / INSEE / etc." }
  ]
}`

async function generatePressRelease(report: ObservatoireReportRow): Promise<{
  json: PressReleaseJson
  inputTokens: number
  outputTokens: number
  costEur: number
}> {
  const period = periodLabel(report.period_year, report.period_month)
  const stats = report.stats_payload as Record<string, unknown>

  const userPrompt = `Édition de l'Observatoire concernée : ${period}.

Titre du rapport observatoire : ${report.cover_title}

Résumé exécutif du rapport (à reformuler en communiqué, NE PAS recopier mot pour mot) :
${report.executive_summary}

Statistiques agrégées du mois (à utiliser, sourcer, contextualiser) :
${JSON.stringify(stats, null, 2)}

Rédigez maintenant le JSON du communiqué de presse selon les règles éditoriales.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_SONNET_MODEL,
      max_tokens: 4000,
      system: PRESS_RELEASE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude Sonnet ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>
    usage: { input_tokens: number; output_tokens: number }
  }
  const text = data.content.find((c) => c.type === 'text')?.text ?? ''

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: PressReleaseJson
  try {
    parsed = JSON.parse(cleaned) as PressReleaseJson
  } catch (err) {
    throw new Error(`JSON parse failed: ${(err as Error).message} — raw: ${text.slice(0, 500)}`)
  }

  // Garde-fou : longueur body minimale
  if (!parsed.body_markdown || parsed.body_markdown.length < 1200) {
    throw new Error(`Body too short (${parsed.body_markdown?.length ?? 0} chars)`)
  }

  const inputTokens = data.usage.input_tokens
  const outputTokens = data.usage.output_tokens
  const costUsd =
    (inputTokens / 1_000_000) * SONNET_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * SONNET_OUTPUT_USD_PER_MTOK
  const costEur = Math.round(costUsd * USD_TO_EUR * 10000) / 10000

  return { json: parsed, inputTokens, outputTokens, costEur }
}

async function notifyAdminDraftReady(
  releaseSlug: string,
  releaseTitle: string,
  period: string,
  costEur: number,
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY absent — skip notification')
    return
  }
  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:-apple-system,system-ui,sans-serif;color:#0F1419;line-height:1.6;max-width:640px;margin:0 auto;padding:32px;">
  <p style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5B7088;margin:0 0 16px 0;">Communiqué presse — brouillon</p>
  <h1 style="font-size:24px;font-weight:700;margin:0 0 24px 0;">Un communiqué de presse a été généré pour ${period}.</h1>
  <p>Le brouillon est disponible dans l'admin et attend votre relecture avant diffusion :</p>
  <p style="background:#F8F5EE;padding:16px;border-radius:8px;margin:16px 0;">
    <strong>Titre :</strong> ${releaseTitle}<br/>
    <strong>Slug :</strong> ${releaseSlug}<br/>
    <strong>Coût IA :</strong> ${costEur.toFixed(4)} €
  </p>
  <p>
    <a href="https://kovas.fr/admin/press/releases/${releaseSlug}" style="display:inline-block;background:#0F1E3D;color:#fff;padding:12px 24px;text-decoration:none;border-radius:999px;font-weight:600;">Relire et publier</a>
  </p>
  <p style="margin-top:32px;color:#5B7088;font-size:13px;">Aucune diffusion automatique aux journalistes n'a eu lieu. La diffusion nécessite votre validation explicite dans l'admin.</p>
</body>
</html>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [ADMIN_NOTIFY_TO],
      subject: `Communiqué presse ${period} — relecture requise`,
      html,
      tags: [{ name: 'category', value: 'press_release_draft' }],
    }),
  }).catch((err) => console.error('Notify admin failed', err))
}

Deno.serve(async (req: Request) => {
  if (!SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'missing service role' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let body: { force?: boolean; observatoire_report_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    // Cron sans body
  }

  try {
    // 1. Charge le rapport observatoire cible
    let report: ObservatoireReportRow | null = null
    if (body.observatoire_report_id) {
      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      const { data } = await (supabase as any)
        .from('observatoire_reports')
        .select('id, period_year, period_month, cover_title, executive_summary, stats_payload')
        .eq('id', body.observatoire_report_id)
        .maybeSingle()
      report = data as ObservatoireReportRow | null
    } else {
      // Auto : mois précédent
      const target = previousMonth(new Date())
      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      const { data } = await (supabase as any)
        .from('observatoire_reports')
        .select('id, period_year, period_month, cover_title, executive_summary, stats_payload')
        .eq('period_year', target.year)
        .eq('period_month', target.month)
        .eq('status', 'sent')
        .maybeSingle()
      report = data as ObservatoireReportRow | null
    }

    if (!report) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'no observatoire report found for target period (status=sent required)',
        }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      )
    }

    const period = periodLabel(report.period_year, report.period_month)
    const slug = buildSlug(report.period_year, report.period_month)

    // 2. Idempotence : check si press_release existe déjà
    // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
    const { data: existing } = await (supabase as any)
      .from('press_releases')
      .select('id, slug, status')
      .eq('slug', slug)
      .maybeSingle()

    if (existing && !body.force) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          message: `Communiqué ${slug} déjà existant (status=${existing.status}). force=true pour régénérer.`,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    // 3. Génération IA
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'ANTHROPIC_API_KEY absent' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    const generated = await generatePressRelease(report)

    // 4. Insert/upsert press_releases (draft)
    // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
    const { data: release, error: insertErr } = await (supabase as any)
      .from('press_releases')
      .upsert(
        {
          slug,
          observatoire_report_id: report.id,
          title: generated.json.title,
          subtitle: generated.json.subtitle,
          dateline: generated.json.dateline || buildDateline(),
          category: 'observatoire',
          body_markdown: generated.json.body_markdown,
          key_quotes: generated.json.key_quotes,
          key_figures: generated.json.key_figures,
          ai_model: ANTHROPIC_SONNET_MODEL,
          ai_input_tokens: generated.inputTokens,
          ai_output_tokens: generated.outputTokens,
          ai_cost_eur: generated.costEur,
          status: 'draft',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select('id, slug')
      .maybeSingle()

    if (insertErr || !release) {
      throw new Error(`Insert press_releases failed: ${insertErr?.message}`)
    }

    // 5. Notification admin (revue humaine)
    await notifyAdminDraftReady(slug, generated.json.title, period, generated.costEur)

    return new Response(
      JSON.stringify({
        ok: true,
        release_id: release.id,
        slug: release.slug,
        period,
        ai_cost_eur: generated.costEur,
        word_count: generated.json.body_markdown.split(/\s+/).length,
        status: 'draft',
        message:
          'Communiqué généré en brouillon. Diffusion manuelle requise via /admin/press après relecture.',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-monthly-press-release error', err)
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
})
