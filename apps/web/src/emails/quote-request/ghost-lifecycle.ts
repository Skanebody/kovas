/**
 * KOVAS — Emails cycle vie diag fantôme K1.
 *
 * 3 templates : warned (5 leads ignorés/30j) → demoted (10/60j) → soft_disabled (15/90j).
 * Ton sobre, factuel, non-culpabilisant. Levier : "réactivez votre fiche en 1 clic".
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface GhostLifecycleEmailParams {
  display_name: string
  city: string | null
  ignored_count: number
  window_days: number
  base_url: string
  reactivation_url: string
}

export function renderGhostWarnedEmail(params: GhostLifecycleEmailParams): {
  subject: string
  html: string
  text: string
} {
  const subject = `${params.ignored_count} demandes en attente sur votre fiche KOVAS`

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F7F4;margin:0;padding:24px;color:#0F1419">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:18px;padding:32px;border:1px solid #E5E7EB">
    <p style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;margin:0 0 8px">Activité de votre fiche</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0F1419">Bonjour ${escapeHtml(params.display_name)},</h1>

    <p style="margin:0 0 16px;line-height:1.6;color:#374151">
      Sur les <strong>${params.window_days} derniers jours</strong>, ${params.ignored_count} demandes
      de devis vous ont été transmises sans réponse de votre part.
    </p>

    <p style="margin:0 0 16px;line-height:1.6;color:#374151">
      Si vous êtes simplement en sous-effectif ou en pause, vous pouvez désactiver
      temporairement votre fiche pour éviter qu’elle ne perde en visibilité.
    </p>

    <div style="margin:32px 0;text-align:center">
      <a href="${escapeHtml(params.reactivation_url)}"
         style="display:inline-block;padding:12px 32px;background:#0F1419;color:#FFFFFF;text-decoration:none;border-radius:999px;font-weight:600">
        Gérer mes disponibilités
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280">
      Cet email est purement informatif — aucune action n’est requise pour le moment.
      Si vous ne répondez pas aux prochaines demandes, votre fiche sera moins prioritaire
      dans le routage automatique.
    </p>
  </div>
</body></html>
  `.trim()

  const text = [
    `Bonjour ${params.display_name},`,
    ``,
    `Sur les ${params.window_days} derniers jours, ${params.ignored_count} demandes de devis`,
    `vous ont été transmises sans réponse de votre part.`,
    ``,
    `Si vous êtes en sous-effectif, désactivez temporairement votre fiche :`,
    `${params.reactivation_url}`,
    ``,
    `— L'équipe KOVAS`,
  ].join('\n')

  return { subject, html, text }
}

export function renderGhostDemotedEmail(params: GhostLifecycleEmailParams): {
  subject: string
  html: string
  text: string
} {
  const subject = `Votre fiche KOVAS est désormais moins visible`

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F7F4;margin:0;padding:24px;color:#0F1419">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:18px;padding:32px;border:1px solid #E5E7EB">
    <p style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#D97706;margin:0 0 8px">Visibilité réduite</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0F1419">Bonjour ${escapeHtml(params.display_name)},</h1>

    <p style="margin:0 0 16px;line-height:1.6;color:#374151">
      Sur les <strong>${params.window_days} derniers jours</strong>, ${params.ignored_count} demandes
      de devis n’ont pas reçu de réponse. Pour garantir une bonne expérience aux particuliers,
      votre fiche est désormais affichée en priorité réduite dans nos résultats.
    </p>

    <p style="margin:0 0 16px;line-height:1.6;color:#374151">
      Bonne nouvelle : répondez à une seule nouvelle demande et votre visibilité
      sera restaurée immédiatement.
    </p>

    <div style="margin:32px 0;text-align:center">
      <a href="${escapeHtml(params.reactivation_url)}"
         style="display:inline-block;padding:12px 32px;background:#0F1419;color:#FFFFFF;text-decoration:none;border-radius:999px;font-weight:600">
        Voir mes demandes en attente
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280">
      Si vous êtes en congé prolongé, désactivez votre fiche depuis votre compte
      pour éviter de recevoir des leads pendant cette période.
    </p>
  </div>
</body></html>
  `.trim()

  const text = [
    `Bonjour ${params.display_name},`,
    ``,
    `Sur les ${params.window_days} derniers jours, ${params.ignored_count} demandes`,
    `de devis n'ont pas reçu de réponse. Votre fiche est désormais affichée`,
    `en priorité réduite.`,
    ``,
    `Répondez à une nouvelle demande pour restaurer votre visibilité :`,
    `${params.reactivation_url}`,
    ``,
    `— L'équipe KOVAS`,
  ].join('\n')

  return { subject, html, text }
}

export function renderGhostSoftDisabledEmail(params: GhostLifecycleEmailParams): {
  subject: string
  html: string
  text: string
} {
  const subject = `Votre fiche KOVAS a été mise en veille`

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F5F7F4;margin:0;padding:24px;color:#0F1419">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:18px;padding:32px;border:1px solid #E5E7EB">
    <p style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#DC2626;margin:0 0 8px">Fiche en veille</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0F1419">Bonjour ${escapeHtml(params.display_name)},</h1>

    <p style="margin:0 0 16px;line-height:1.6;color:#374151">
      Au cours des <strong>${params.window_days} derniers jours</strong>, ${params.ignored_count} demandes
      de devis vous ont été transmises sans aucune réponse. Pour ne pas pénaliser
      les particuliers en attente, votre fiche est temporairement retirée du routage
      automatique.
    </p>

    <p style="margin:0 0 16px;line-height:1.6;color:#374151">
      Elle reste consultable sur l’annuaire mais ne reçoit plus de nouvelles demandes
      par email.
    </p>

    <div style="margin:32px 0;text-align:center">
      <a href="${escapeHtml(params.reactivation_url)}"
         style="display:inline-block;padding:12px 32px;background:#0F1419;color:#FFFFFF;text-decoration:none;border-radius:999px;font-weight:600">
        Réactiver ma fiche en 1 clic
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280">
      Si vous ne souhaitez plus apparaître sur KOVAS, vous pouvez demander
      le retrait définitif depuis votre compte.
    </p>
  </div>
</body></html>
  `.trim()

  const text = [
    `Bonjour ${params.display_name},`,
    ``,
    `Au cours des ${params.window_days} derniers jours, ${params.ignored_count} demandes`,
    `vous ont été transmises sans réponse. Votre fiche est temporairement`,
    `retirée du routage automatique.`,
    ``,
    `Réactiver ma fiche en 1 clic : ${params.reactivation_url}`,
    ``,
    `— L'équipe KOVAS`,
  ].join('\n')

  return { subject, html, text }
}
