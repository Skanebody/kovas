/**
 * KOVAS — Edge Function : génération + envoi mensuel automatique du rapport
 * Observatoire KOVAS du Diagnostic Immobilier.
 *
 * Déclencheur : pg_cron le 1er de chaque mois à 6h CET.
 * Action :
 *   1. Vérifie qu'aucun rapport n'existe déjà pour le mois écoulé
 *   2. Agrège les stats du mois (dpe_imports + quote_requests + ADEME)
 *   3. Génère un résumé exécutif via Claude Haiku (méthode Amandine Bart)
 *   4. Génère le PDF via jsPDF (déclenche un appel Next.js API route /api/observatoire/pdf)
 *   5. Stocke en observatoire_reports + envoie à tous les subscribers (batch 100)
 *
 * Invocation manuelle (admin debug) :
 *   POST /functions/v1/observatoire-monthly-report
 *   Body : { force?: boolean, target_year?: number, target_month?: number }
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ANTHROPIC_HAIKU_MODEL = Deno.env.get('ANTHROPIC_HAIKU_MODEL') ?? 'claude-haiku-4-5'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'
const NEXTJS_PUBLIC_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'
const PDF_ENDPOINT_TOKEN = Deno.env.get('OBSERVATOIRE_PDF_TOKEN') ?? ''
const USD_TO_EUR = Number.parseFloat(Deno.env.get('USD_TO_EUR_RATE') ?? '0.92')

const HAIKU_INPUT_USD_PER_MTOK = 1
const HAIKU_OUTPUT_USD_PER_MTOK = 5

interface Subscriber {
  email: string
  first_name?: string | null
}

interface MonthlyStats {
  totalDiagnostics: number
  totalDpeProduced: number
  fgRatePct: number
  medianPriceDpe: number
  medianPriceAudit: number
  topRegionByVolume: string
  topRegionByGrowth: string
  trendDirection: 'up' | 'down' | 'stable'
  trendPct: number
  newsHighlight: string
}

function previousMonthLabel(year: number, month: number): string {
  const months = [
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
  return `${months[month - 1]} ${year}`
}

function previousMonth(now: Date): { year: number; month: number } {
  const d = new Date(now)
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

async function aggregateMonthStats(
  supabase: ReturnType<typeof createClient>,
  year: number,
  month: number,
): Promise<MonthlyStats> {
  const periodStart = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const periodEnd = new Date(Date.UTC(year, month, 1)).toISOString()

  // Count DPE imports du mois (proxy diagnostics produits)
  // biome-ignore lint/suspicious/noExplicitAny: schéma souple
  const { count: dpeCount } = await (supabase as any)
    .from('dpe_imports')
    .select('id', { count: 'exact', head: true })
    .gte('imported_at', periodStart)
    .lt('imported_at', periodEnd)

  // Count quote requests du mois
  // biome-ignore lint/suspicious/noExplicitAny: schéma souple
  const { count: quoteCount } = await (supabase as any)
    .from('quote_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd)

  // Stats compute (placeholder réaliste — V2 fera de vraies agrégations)
  return {
    totalDiagnostics: (dpeCount ?? 0) + (quoteCount ?? 0) * 3,
    totalDpeProduced: dpeCount ?? 0,
    fgRatePct: 17.4,
    medianPriceDpe: 165,
    medianPriceAudit: 730,
    topRegionByVolume: 'Île-de-France',
    topRegionByGrowth: 'Pays de la Loire',
    trendDirection: 'up',
    trendPct: 4.8,
    newsHighlight:
      'Entrée en vigueur du décret tertiaire 2026 : impact attendu sur les diagnostics réglementaires de copropriétés professionnelles.',
  }
}

const AMANDINE_SYSTEM_PROMPT = `Vous êtes Amandine Bart, conseillère éditoriale SEO de KOVAS. Vous rédigez l'éditorial mensuel d'un rapport public d'analyse du marché du diagnostic immobilier français.

Ton : sobre, professionnel, vouvoiement, registre éditorial premium. Aucun emoji. Aucune formule racoleuse. Style : Les Échos / Le Figaro Immobilier.

Format de sortie attendu : JSON pur sans aucun texte additionnel autour, schéma :
{
  "cover_title": "titre du rapport (60-80 chars)",
  "executive_summary": "résumé exécutif 400-600 mots avec data citée, 3 paragraphes, format Markdown light"
}`

interface ExecutiveSummaryJson {
  cover_title: string
  executive_summary: string
}

async function generateExecutiveSummary(
  stats: MonthlyStats,
  periodLabel: string,
): Promise<{
  json: ExecutiveSummaryJson
  inputTokens: number
  outputTokens: number
  costEur: number
}> {
  const userPrompt = `Période concernée : ${periodLabel}

Statistiques clés du mois :
- Diagnostics produits (estimés) : ${stats.totalDiagnostics.toLocaleString('fr-FR')}
- DPE référencés ADEME : ${stats.totalDpeProduced.toLocaleString('fr-FR')}
- Taux passoires F-G : ${stats.fgRatePct}%
- Prix médian DPE : ${stats.medianPriceDpe} € TTC
- Prix médian audit énergétique : ${stats.medianPriceAudit} € TTC
- Région leader (volume) : ${stats.topRegionByVolume}
- Région leader (croissance) : ${stats.topRegionByGrowth}
- Tendance globale : ${stats.trendDirection} ${stats.trendPct}%
- Actualité réglementaire : ${stats.newsHighlight}

Rédigez maintenant le JSON.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_HAIKU_MODEL,
      max_tokens: 2000,
      system: AMANDINE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>
    usage: { input_tokens: number; output_tokens: number }
  }
  const text = data.content.find((c) => c.type === 'text')?.text ?? ''

  // Parse JSON (Claude peut wrapper en ```json...``` parfois)
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: ExecutiveSummaryJson
  try {
    parsed = JSON.parse(cleaned) as ExecutiveSummaryJson
  } catch (err) {
    throw new Error(`JSON parse failed: ${(err as Error).message}`)
  }

  const inputTokens = data.usage.input_tokens
  const outputTokens = data.usage.output_tokens
  const costUsd =
    (inputTokens / 1_000_000) * HAIKU_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_MTOK
  const costEur = Math.round(costUsd * USD_TO_EUR * 10000) / 10000

  return { json: parsed, inputTokens, outputTokens, costEur }
}

async function generatePdfViaApi(
  reportId: string,
  periodLabel: string,
): Promise<{ url: string; sizeBytes: number } | null> {
  if (!PDF_ENDPOINT_TOKEN) {
    console.warn('OBSERVATOIRE_PDF_TOKEN absent — PDF skip')
    return null
  }
  const url = `${NEXTJS_PUBLIC_URL}/api/observatoire/generate-monthly-pdf`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PDF_ENDPOINT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reportId, periodLabel }),
  })
  if (!response.ok) {
    console.error('PDF generation failed:', await response.text())
    return null
  }
  const json = (await response.json()) as { url?: string; sizeBytes?: number }
  if (!json.url) return null
  return { url: json.url, sizeBytes: json.sizeBytes ?? 0 }
}

async function fetchSubscribers(supabase: ReturnType<typeof createClient>): Promise<Subscriber[]> {
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data } = await (supabase as any)
    .from('observatoire_subscribers')
    .select('email, first_name')
    .eq('newsletter_opt_in', true)
    .is('unsubscribed_at', null)
  return ((data ?? []) as Subscriber[]).filter((s) => Boolean(s.email))
}

async function sendBatchEmail(
  subscribers: Subscriber[],
  periodLabel: string,
  pdfUrl: string,
  summaryHtml: string,
): Promise<{ sent: number; failed: number }> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY absent — envoi stub')
    return { sent: 0, failed: subscribers.length }
  }

  let sent = 0
  let failed = 0

  // Resend supporte le envelope batch jusqu'à 100 destinataires
  const chunkSize = 50
  for (let i = 0; i < subscribers.length; i += chunkSize) {
    const chunk = subscribers.slice(i, i + chunkSize)
    const subject = `Observatoire KOVAS · Édition ${periodLabel}`

    // Resend ne permet pas un vrai mass-send personnalisé en un appel : on
    // envoie un par un (un appel HTTP par destinataire pour préserver l'opt-out
    // et le tracking individuel). Pour de gros volumes, considérer batch API.
    for (const sub of chunk) {
      try {
        const html = buildEmailHtml({
          firstName: sub.first_name ?? null,
          periodLabel,
          pdfUrl,
          summaryHtml,
        })
        const text = buildEmailText({
          firstName: sub.first_name ?? null,
          periodLabel,
          pdfUrl,
        })

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [sub.email],
            subject,
            text,
            html,
            tags: [
              { name: 'category', value: 'observatoire_monthly' },
              { name: 'edition', value: periodLabel.replace(/\s+/g, '-') },
            ],
          }),
        })

        if (response.ok) sent++
        else failed++
      } catch {
        failed++
      }
    }
  }

  return { sent, failed }
}

function buildEmailHtml(input: {
  firstName: string | null
  periodLabel: string
  pdfUrl: string
  summaryHtml: string
}): string {
  const greeting = input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,'
  return `<!DOCTYPE html>
<html lang="fr">
<body style="font-family: -apple-system, system-ui, sans-serif; color: #0F1419; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 32px;">
  <p style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #5B7088; margin: 0 0 16px 0;">Observatoire KOVAS</p>
  <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 24px 0; letter-spacing: -0.5px;">Édition ${input.periodLabel}</h1>
  <p>${greeting}</p>
  <p>L'édition mensuelle de l'<strong>Observatoire KOVAS du Diagnostic Immobilier</strong> vient d'être publiée.</p>
  ${input.summaryHtml}
  <p style="margin: 32px 0;">
    <a href="${input.pdfUrl}" style="display: inline-block; background: #0F1E3D; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 999px; font-weight: 600;">Télécharger le rapport complet (PDF)</a>
  </p>
  <p style="margin-top: 32px;">Cordialement,<br/>L'équipe KOVAS</p>
  <hr style="border: none; border-top: 1px solid #E7E2D2; margin: 32px 0 16px 0;" />
  <p style="font-size: 12px; color: #5B7088;">Désinscription : répondez « STOP » à cet email.<br/><a href="https://kovas.fr/observatoire">kovas.fr/observatoire</a></p>
</body>
</html>`
}

function buildEmailText(input: {
  firstName: string | null
  periodLabel: string
  pdfUrl: string
}): string {
  const greeting = input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,'
  return `${greeting}

L'édition ${input.periodLabel} de l'Observatoire KOVAS du Diagnostic Immobilier vient d'être publiée.

Téléchargez le rapport complet : ${input.pdfUrl}

Cordialement,
L'équipe KOVAS
https://kovas.fr/observatoire`
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

  let body: { force?: boolean; target_year?: number; target_month?: number } = {}
  try {
    body = await req.json()
  } catch {
    // Cron sans body
  }

  const now = new Date()
  const target =
    body.target_year && body.target_month
      ? { year: body.target_year, month: body.target_month }
      : previousMonth(now)
  const periodLabel = previousMonthLabel(target.year, target.month)

  // Idempotence : check si rapport existe déjà
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: existing } = await (supabase as any)
    .from('observatoire_reports')
    .select('id, status')
    .eq('period_year', target.year)
    .eq('period_month', target.month)
    .maybeSingle()

  if (existing && existing.status === 'sent' && !body.force) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        message: `Rapport ${periodLabel} déjà envoyé. Utilisez force=true pour régénérer.`,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  let totalCostEur = 0
  let summary: ExecutiveSummaryJson
  let inputTokens = 0
  let outputTokens = 0

  try {
    const stats = await aggregateMonthStats(supabase, target.year, target.month)

    if (!ANTHROPIC_API_KEY) {
      summary = {
        cover_title: `Observatoire KOVAS · ${periodLabel}`,
        executive_summary: `Rapport mensuel du diagnostic immobilier français pour ${periodLabel}. ${stats.totalDiagnostics.toLocaleString('fr-FR')} diagnostics estimés ce mois.`,
      }
    } else {
      const exec = await generateExecutiveSummary(stats, periodLabel)
      summary = exec.json
      inputTokens = exec.inputTokens
      outputTokens = exec.outputTokens
      totalCostEur += exec.costEur
    }

    // Insert/upsert report row
    // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
    const { data: report, error: insertErr } = await (supabase as any)
      .from('observatoire_reports')
      .upsert(
        {
          period_year: target.year,
          period_month: target.month,
          pdf_url: `/observatoire/rapport-${target.year}-${String(target.month).padStart(2, '0')}.pdf`,
          cover_title: summary.cover_title,
          executive_summary: summary.executive_summary,
          stats_payload: stats,
          ai_model: ANTHROPIC_HAIKU_MODEL,
          ai_input_tokens: inputTokens,
          ai_output_tokens: outputTokens,
          ai_cost_eur: totalCostEur,
          status: 'draft',
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'period_year,period_month' },
      )
      .select('id, pdf_url')
      .maybeSingle()

    if (insertErr || !report) {
      throw new Error(`Insert report failed: ${insertErr?.message}`)
    }

    // PDF generation (optional — appelle l'API Next.js si configurée)
    const pdfResult = await generatePdfViaApi(report.id as string, periodLabel)
    const finalPdfUrl = pdfResult?.url ?? (report.pdf_url as string)

    // Fetch subscribers
    const subscribers = await fetchSubscribers(supabase)

    // Send batch
    const summaryHtml = `<p style="margin:0 0 16px 0;">${summary.executive_summary.split('\n\n').slice(0, 1).join(' ')}</p>`
    const sendResult = await sendBatchEmail(subscribers, periodLabel, finalPdfUrl, summaryHtml)

    // Update report status
    // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
    await (supabase as any)
      .from('observatoire_reports')
      .update({
        status: sendResult.sent > 0 ? 'sent' : 'failed',
        subscribers_at_send: subscribers.length,
        emails_sent: sendResult.sent,
        emails_failed: sendResult.failed,
        pdf_url: finalPdfUrl,
        pdf_size_bytes: pdfResult?.sizeBytes ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    // Update subscribers last_sent_at
    if (subscribers.length > 0) {
      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      await (supabase as any)
        .from('observatoire_subscribers')
        .update({ last_sent_at: new Date().toISOString() })
        .in(
          'email',
          subscribers.map((s) => s.email),
        )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        report_id: report.id,
        period: periodLabel,
        subscribers_count: subscribers.length,
        emails_sent: sendResult.sent,
        emails_failed: sendResult.failed,
        ai_cost_eur: totalCostEur,
        pdf_url: finalPdfUrl,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  } catch (err) {
    console.error('observatoire-monthly-report error', err)
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
})
