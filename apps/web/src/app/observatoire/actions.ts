'use server'

/**
 * Server Actions pour la page publique /observatoire.
 *
 * `requestObservatoireReport` :
 *   1. Valide le payload via Zod
 *   2. UPSERT email dans `observatoire_subscribers` (via service role)
 *   3. Génère le PDF via `generateObservatoireReportPdf`
 *   4. Envoie l'email Resend (HTTP direct + pièce jointe base64)
 *   5. Le tracking PostHog `observatoire.report.requested` est délégué au
 *      client (form `lead-magnet.tsx`) car PostHog est browser-only.
 *
 * RGPD : l'email est stocké sans aucune autre donnée personnelle (pas de nom,
 * pas d'IP). Désinscription via lien unique dans chaque email reçu.
 */

import { generateObservatoireReportPdf } from '@/lib/observatoire/pdf-generator'
import {
  getObservatoireStats,
  getTopCities,
} from '@/lib/observatoire/stats-aggregator'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RESEND_FROM_DEFAULT = process.env.RESEND_FROM ?? 'KOVAS <contact@kovas.fr>'

const RequestSchema = z.object({
  email: z.string().email("Adresse email invalide").max(254),
  newsletterOptIn: z.boolean().optional().default(false),
})

export interface RequestReportResult {
  success: boolean
  /** Message localisé fr — affiché tel quel à l'utilisateur. */
  message: string
}

export async function requestObservatoireReport(input: {
  email: string
  newsletterOptIn?: boolean
}): Promise<RequestReportResult> {
  // ============ 1. Validation Zod ============
  const parsed = RequestSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false,
      message: firstIssue?.message ?? 'Données invalides',
    }
  }
  const { email, newsletterOptIn } = parsed.data
  const normalizedEmail = email.trim().toLowerCase()

  // ============ 2. UPSERT subscriber ============
  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: types Database non régénérés pour cette table jeune
    const { error } = await (supabase as any)
      .from('observatoire_subscribers')
      .upsert(
        {
          email: normalizedEmail,
          newsletter_opt_in: newsletterOptIn,
          last_sent_at: new Date().toISOString(),
        },
        { onConflict: 'email' },
      )
    if (error) {
      console.error('[observatoire] upsert error', error)
      // On continue : le rapport peut être envoyé même si l'insert échoue
      // (par ex. RLS sans service role en local dev)
    }
  } catch (err) {
    console.error('[observatoire] supabase upsert failed', err)
  }

  // ============ 3. Génération PDF ============
  let pdfBytes: Uint8Array
  let stats: Awaited<ReturnType<typeof getObservatoireStats>>
  try {
    stats = await getObservatoireStats()
    const topCities = await getTopCities()
    pdfBytes = generateObservatoireReportPdf({ stats, topCities })
  } catch (err) {
    console.error('[observatoire] PDF generation failed', err)
    return {
      success: false,
      message:
        'Une erreur est survenue lors de la génération du rapport. Merci de réessayer dans un instant.',
    }
  }

  // ============ 4. Envoi Resend HTTP avec pièce jointe ============
  const pdfBase64 = uint8ToBase64(pdfBytes)
  const editionSlug = stats.lastUpdatedLabel.toLowerCase().replace(/\s+/g, '-')
  const filename = `observatoire-kovas-${editionSlug}.pdf`

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Mode dev / staging sans clé Resend — log + retour stub success
    console.log('[observatoire:email-stub]', {
      to: normalizedEmail,
      subject: `Observatoire KOVAS · Édition ${stats.lastUpdatedLabel}`,
      pdfSize: pdfBytes.byteLength,
    })
    return {
      success: true,
      message: `Mode développement — le rapport ${stats.lastUpdatedLabel} sera envoyé une fois Resend configuré.`,
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_DEFAULT,
        to: [normalizedEmail],
        subject: `Observatoire KOVAS · Édition ${stats.lastUpdatedLabel}`,
        text: buildEmailText(stats.lastUpdatedLabel),
        html: buildEmailHtml(stats.lastUpdatedLabel),
        tags: [
          { name: 'category', value: 'digest' },
          { name: 'lead_magnet', value: 'observatoire_report' },
        ],
        attachments: [
          {
            filename,
            content: pdfBase64,
            content_type: 'application/pdf',
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`)
      console.error('[observatoire] resend error', errText)
      return {
        success: false,
        message: errText.toLowerCase().includes('rate')
          ? 'Trop de demandes — veuillez réessayer dans quelques minutes.'
          : "L'envoi a échoué. Vérifiez votre adresse email et réessayez.",
      }
    }

    return {
      success: true,
      message: `Le rapport ${stats.lastUpdatedLabel} vient d'être envoyé à ${normalizedEmail}.`,
    }
  } catch (err) {
    console.error('[observatoire] resend network error', err)
    return {
      success: false,
      message: 'Réseau indisponible. Merci de réessayer dans un instant.',
    }
  }
}

// ============================================
// Helpers
// ============================================

function buildEmailText(edition: string): string {
  return `Bonjour,

Vous trouverez ci-joint l'édition ${edition} de l'Observatoire KOVAS du Diagnostic Immobilier.

Ce rapport mensuel contient :
- Les prix médians des 8 diagnostics réglementaires, par région
- La distribution des classes énergétiques A à G
- L'évolution de la rénovation énergétique sur 24 mois
- Le classement des villes en transition

Les données sont publiées sous licence CC BY 4.0 : vous pouvez les citer librement à condition de mentionner la source (kovas.fr/observatoire).

Si vous souhaitez recevoir automatiquement les prochaines éditions, conservez cet email — vous êtes désormais inscrit à la liste de diffusion mensuelle (un email par mois maximum, désinscription possible à tout moment).

Cordialement,
L'équipe KOVAS
https://kovas.fr/observatoire
`
}

function buildEmailHtml(edition: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<body style="font-family: -apple-system, system-ui, sans-serif; color: #0F1419; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 32px;">
  <p style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #5B7088; margin: 0 0 16px 0;">Observatoire KOVAS</p>
  <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 24px 0;">Édition ${edition}</h1>
  <p>Bonjour,</p>
  <p>Vous trouverez en pièce jointe l'édition ${edition} de l'<strong>Observatoire KOVAS du Diagnostic Immobilier</strong>.</p>
  <p>Ce rapport mensuel contient&nbsp;:</p>
  <ul>
    <li>Les prix médians des 8 diagnostics réglementaires, par région</li>
    <li>La distribution des classes énergétiques A à G</li>
    <li>L'évolution de la rénovation énergétique sur 24 mois</li>
    <li>Le classement des villes en transition</li>
  </ul>
  <p>Les données sont publiées sous licence <strong>CC BY 4.0</strong>&nbsp;: vous pouvez les citer librement à condition de mentionner la source (<a href="https://kovas.fr/observatoire">kovas.fr/observatoire</a>).</p>
  <p>Si vous souhaitez recevoir automatiquement les prochaines éditions, conservez cet email — vous êtes désormais inscrit à la liste de diffusion mensuelle (un email par mois maximum).</p>
  <p style="margin-top: 32px;">Cordialement,<br/>L'équipe KOVAS</p>
  <hr style="border: none; border-top: 1px solid #E7E2D2; margin: 32px 0 16px 0;" />
  <p style="font-size: 12px; color: #5B7088;">Désinscription&nbsp;: répondez simplement « STOP » à cet email.<br/><a href="https://kovas.fr/observatoire">kovas.fr/observatoire</a></p>
</body>
</html>`
}

/** Encode un Uint8Array en base64 — Node.js (Buffer) ou Web (btoa fallback). */
function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
