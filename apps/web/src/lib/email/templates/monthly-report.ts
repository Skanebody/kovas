/**
 * Template email — Rapport mensuel d'activité (CLAUDE.md §21bis V1.5).
 *
 * Ton SOBRE PROFESSIONNEL OBLIGATOIRE — avatar diagnostiqueur 35-55 ans,
 * ex-cadre reconverti. Pas d'émojis fun, pas de "Hero/Légende/Wrapped",
 * vouvoiement, chiffres précis, signature humaine "— Benjamin / KOVAS".
 *
 * Format HTML inline minimal (compatible Gmail/Outlook/Apple Mail) +
 * version texte pour clients qui n'affichent pas l'HTML.
 */

import { formatLegalMentions } from '@/lib/legal/company-identity'

export interface MonthlyReportData {
  recipientName: string
  recipientEmail: string
  periodYear: number
  periodMonth: number // 1-12
  missionsCount: number
  /** Pour comparaison mois-1 (trend indicator). Null si pas d'historique. */
  missionsCountPrevious: number | null
  timeSavedMinutes: number
  valueGeneratedCents: number
  topDiagnosticType: string | null
  /** URL absolue vers /app/gain (lien CTA). */
  dashboardUrl: string
  /** URL absolue vers /app/account (lien désinscription). */
  unsubscribeUrl: string
}

export interface MonthlyReportContent {
  subject: string
  html: string
  text: string
}

// ============================================
// Helpers de formatage (ton sobre)
// ============================================

const MONTH_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const

/** Format "23 h 47 min" — chiffres précis, jamais "plein de temps". */
function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 h'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')} min`
}

/** Format "2 350 €" sobre, sans décimales (centimes implicites). */
function formatEuros(cents: number): string {
  const euros = Math.round(cents / 100)
  return new Intl.NumberFormat('fr-FR').format(euros) + ' €'
}

/** Mapping diag enum → label lisible (court, sobre). */
const DIAGNOSTIC_LABELS: Record<string, string> = {
  dpe_vente: 'DPE Vente',
  dpe_location: 'DPE Location',
  copropriete: 'DPE Copropriété',
  amiante_vente: 'Amiante',
  amiante_avant_travaux: 'Amiante avant travaux',
  plomb_crep: 'Plomb (CREP)',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez_boutin: 'Carrez / Boutin',
  erp: 'ERP',
}

function labelDiagnostic(raw: string | null): string {
  if (!raw) return 'Diagnostic'
  return DIAGNOSTIC_LABELS[raw] ?? raw.toUpperCase()
}

/** Indicateur de tendance discret (flèche unicode, pas d'émoji). */
function trendIndicator(current: number, previous: number | null): string {
  if (previous === null || previous === 0) return ''
  if (current > previous) return ` ↗ +${current - previous} vs mois précédent`
  if (current < previous) return ` ↘ −${previous - current} vs mois précédent`
  return ' = stable vs mois précédent'
}

// ============================================
// Rendu HTML — design sobre, navy + cream
// ============================================

const COLOR_INK = '#0F1E3D'
const COLOR_INK_MUTE = '#4A5878'
const COLOR_BG = '#F8F5EE'
const COLOR_PAPER = '#FDFBF6'
const COLOR_RULE = '#D5CDB8'

function renderHtml(d: MonthlyReportData): string {
  const monthLabel = MONTH_NAMES_FR[d.periodMonth - 1] ?? ''
  const trend = trendIndicator(d.missionsCount, d.missionsCountPrevious)
  const topLabel = labelDiagnostic(d.topDiagnosticType)
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName

  // HTML inline pour compatibilité clients mail (pas de classes Tailwind)
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Rapport mensuel KOVAS — ${monthLabel} ${d.periodYear}</title>
</head>
<body style="margin:0; padding:0; background-color:${COLOR_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:${COLOR_INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR_BG}; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background-color:${COLOR_PAPER}; border:1px solid ${COLOR_RULE}; border-radius:12px; overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="padding:28px 32px 16px 32px; border-bottom:1px solid ${COLOR_RULE};">
              <p style="margin:0 0 6px 0; font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:${COLOR_INK_MUTE};">
                KOVAS — Rapport mensuel
              </p>
              <h1 style="margin:0; font-size:24px; font-weight:700; letter-spacing:-0.01em; color:${COLOR_INK};">
                Votre activité de ${monthLabel.toLowerCase()} ${d.periodYear}
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <p style="margin:0 0 20px 0; font-size:15px; line-height:1.55; color:${COLOR_INK};">
                Bonjour ${firstName},<br /><br />
                Voici le récapitulatif de votre activité enregistrée dans KOVAS pour le mois de ${monthLabel.toLowerCase()} ${d.periodYear}.
              </p>

              <!-- KPI principaux -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
                <tr>
                  <td style="padding:14px 16px; border:1px solid ${COLOR_RULE}; border-radius:8px; background-color:#FBF8F0;">
                    <p style="margin:0 0 4px 0; font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:${COLOR_INK_MUTE};">
                      Missions réalisées
                    </p>
                    <p style="margin:0; font-size:28px; font-weight:700; color:${COLOR_INK}; line-height:1.1;">
                      ${d.missionsCount}<span style="font-size:13px; font-weight:400; color:${COLOR_INK_MUTE};">${trend}</span>
                    </p>
                  </td>
                </tr>
                <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 16px; border:1px solid ${COLOR_RULE}; border-radius:8px; background-color:#FBF8F0;">
                    <p style="margin:0 0 4px 0; font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:${COLOR_INK_MUTE};">
                      Temps économisé estimé
                    </p>
                    <p style="margin:0; font-size:28px; font-weight:700; color:${COLOR_INK}; line-height:1.1;">
                      ${formatDuration(d.timeSavedMinutes)}
                    </p>
                    <p style="margin:6px 0 0 0; font-size:12px; color:${COLOR_INK_MUTE};">
                      Estimation basée sur 1 h 30 économisées par mission (terrain + retour bureau).
                    </p>
                  </td>
                </tr>
                <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 16px; border:1px solid ${COLOR_RULE}; border-radius:8px; background-color:#FBF8F0;">
                    <p style="margin:0 0 4px 0; font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:${COLOR_INK_MUTE};">
                      Valeur générée
                    </p>
                    <p style="margin:0; font-size:28px; font-weight:700; color:${COLOR_INK}; line-height:1.1;">
                      ${formatEuros(d.valueGeneratedCents)}
                    </p>
                    <p style="margin:6px 0 0 0; font-size:12px; color:${COLOR_INK_MUTE};">
                      Calcul indicatif à 50 € HT de l'heure (tarif horaire moyen diagnostiqueur).
                    </p>
                  </td>
                </tr>
              </table>

              ${
                d.topDiagnosticType && d.missionsCount > 0
                  ? `
              <p style="margin:0 0 20px 0; font-size:14px; line-height:1.55; color:${COLOR_INK};">
                Type de mission majoritaire ce mois : <strong>${topLabel}</strong>.
              </p>`
                  : ''
              }

              <p style="margin:0 0 24px 0; font-size:14px; line-height:1.55; color:${COLOR_INK};">
                Pour voir le détail mission par mission et l'historique cumulé :
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background-color:${COLOR_INK}; border-radius:999px;">
                    <a href="${d.dashboardUrl}" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:600; color:${COLOR_BG}; text-decoration:none;">
                      Voir le détail dans KOVAS
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Signature -->
              <p style="margin:0 0 6px 0; font-size:14px; line-height:1.55; color:${COLOR_INK};">
                Bonne fin de semaine,
              </p>
              <p style="margin:0; font-size:14px; line-height:1.55; color:${COLOR_INK};">
                — Benjamin / KOVAS
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px 24px 32px; border-top:1px solid ${COLOR_RULE}; background-color:${COLOR_BG};">
              <p style="margin:0 0 8px 0; font-size:11px; line-height:1.6; color:${COLOR_INK_MUTE};">
                ${formatLegalMentions()}
              </p>
              <p style="margin:0; font-size:11px; line-height:1.6; color:${COLOR_INK_MUTE};">
                <a href="${d.dashboardUrl}" style="color:${COLOR_INK_MUTE}; text-decoration:underline;">Tableau de bord</a>
                &nbsp;·&nbsp;
                <a href="${d.unsubscribeUrl}" style="color:${COLOR_INK_MUTE}; text-decoration:underline;">Ne plus recevoir ce rapport</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ============================================
// Rendu texte (fallback clients mail sans HTML)
// ============================================

function renderText(d: MonthlyReportData): string {
  const monthLabel = MONTH_NAMES_FR[d.periodMonth - 1] ?? ''
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName
  const trend = trendIndicator(d.missionsCount, d.missionsCountPrevious)
  const topLabel = labelDiagnostic(d.topDiagnosticType)

  const topLine =
    d.topDiagnosticType && d.missionsCount > 0
      ? `Type de mission majoritaire ce mois : ${topLabel}.\n\n`
      : ''

  return `Bonjour ${firstName},

Voici le récapitulatif de votre activité enregistrée dans KOVAS pour le mois de ${monthLabel.toLowerCase()} ${d.periodYear}.

Missions réalisées : ${d.missionsCount}${trend}
Temps économisé estimé : ${formatDuration(d.timeSavedMinutes)} (basé sur 1 h 30 par mission)
Valeur générée : ${formatEuros(d.valueGeneratedCents)} (à 50 € HT de l'heure)

${topLine}Pour voir le détail mission par mission :
${d.dashboardUrl}

Bonne fin de semaine,
— Benjamin / KOVAS

---
${formatLegalMentions()}
Ne plus recevoir ce rapport : ${d.unsubscribeUrl}
`
}

// ============================================
// Export principal
// ============================================

export function buildMonthlyReportEmail(data: MonthlyReportData): MonthlyReportContent {
  const monthLabel = MONTH_NAMES_FR[data.periodMonth - 1] ?? ''
  return {
    subject: `Rapport mensuel KOVAS — ${monthLabel} ${data.periodYear}`,
    html: renderHtml(data),
    text: renderText(data),
  }
}
