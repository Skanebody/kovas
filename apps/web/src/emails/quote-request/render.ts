/**
 * Render des templates email transactionnels pour les demandes de devis B2C.
 * HTML inline (Resend compat) — pas de framework email engine en V1.
 */

import { DIAGNOSTIC_LABEL, type DiagnosticCode } from '@/lib/quote-request/diagnostics'

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  local_commercial: 'Local commercial',
  autre: 'Autre',
}

const PROPERTY_SITUATION_LABEL: Record<string, string> = {
  vente: 'Vente',
  location: 'Location',
  travaux: 'Travaux',
  audit: 'Audit',
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface DiagnosticianRenderContext {
  display_name: string
  city: string
  base_url: string
  request_id: string
}

export interface RequesterRenderContext {
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  property_type: string
  property_situation: string
  property_address?: string | null
  property_postal_code?: string | null
  property_city?: string | null
  property_surface_m2?: number | null
  property_year_built?: number | null
  diagnostics_requested: DiagnosticCode[]
  message?: string | null
}

/**
 * Email envoyé au diagnostiqueur — "Nouvelle demande de devis sur KOVAS".
 */
export function renderEmailToDiagnostician(
  diag: DiagnosticianRenderContext,
  req: RequesterRenderContext,
): { subject: string; html: string; text: string } {
  const city = req.property_city ?? diag.city
  const propertyType = PROPERTY_TYPE_LABEL[req.property_type] ?? req.property_type
  const subject = `Nouvelle demande de devis sur KOVAS — ${propertyType} à ${city}`

  const diagList = req.diagnostics_requested
    .map((d) => `<li>${escapeHtml(DIAGNOSTIC_LABEL[d] ?? d)}</li>`)
    .join('')

  const fullName = `${req.first_name} ${req.last_name}`.trim()
  const phoneLine = req.phone
    ? `<p style="margin:4px 0"><strong>Téléphone :</strong> ${escapeHtml(req.phone)}</p>`
    : ''
  const addressLine = req.property_address
    ? `<p style="margin:4px 0"><strong>Adresse :</strong> ${escapeHtml(req.property_address)}</p>`
    : ''
  const surfaceLine = req.property_surface_m2
    ? `<p style="margin:4px 0"><strong>Surface :</strong> ${req.property_surface_m2} m²</p>`
    : ''
  const yearLine = req.property_year_built
    ? `<p style="margin:4px 0"><strong>Année :</strong> ${req.property_year_built}</p>`
    : ''
  const messageBlock = req.message
    ? `<div style="margin-top:16px;padding:12px;background:#FDFBF6;border-radius:8px"><strong>Message :</strong><br>${escapeHtml(req.message).replace(/\n/g, '<br>')}</div>`
    : ''

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F8F5EE;margin:0;padding:24px;color:#0F1E3D">
  <div style="max-width:600px;margin:0 auto;background:#FDFBF6;border-radius:18px;padding:32px;border:1px solid #D5CDB8">
    <p style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#7E8AA4;margin:0 0 8px">Nouvelle demande</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:#0F1E3D">${escapeHtml(fullName)} vous contacte</h1>
    <p style="margin:0 0 24px;color:#4A5878">Reçue via votre fiche KOVAS.</p>

    <h2 style="font-size:14px;color:#0F1E3D;margin:24px 0 8px">Contact</h2>
    <p style="margin:4px 0"><strong>Email :</strong> <a href="mailto:${escapeHtml(req.email)}" style="color:#0F1E3D">${escapeHtml(req.email)}</a></p>
    ${phoneLine}

    <h2 style="font-size:14px;color:#0F1E3D;margin:24px 0 8px">Bien</h2>
    <p style="margin:4px 0"><strong>Type :</strong> ${escapeHtml(propertyType)}</p>
    <p style="margin:4px 0"><strong>Situation :</strong> ${escapeHtml(PROPERTY_SITUATION_LABEL[req.property_situation] ?? req.property_situation)}</p>
    ${addressLine}
    ${surfaceLine}
    ${yearLine}

    <h2 style="font-size:14px;color:#0F1E3D;margin:24px 0 8px">Diagnostics demandés</h2>
    <ul style="margin:8px 0;padding-left:20px;color:#1F2E4D">${diagList}</ul>

    ${messageBlock}

    <div style="margin-top:32px;text-align:center">
      <a href="${escapeHtml(diag.base_url)}/app/devis/quote-requests/${escapeHtml(diag.request_id)}"
         style="display:inline-block;padding:12px 32px;background:#0F1E3D;color:#F8F5EE;text-decoration:none;border-radius:999px;font-weight:600">
        Voir la demande
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #D5CDB8;margin:32px 0">
    <p style="font-size:12px;color:#7E8AA4;margin:0">
      Vous recevez cet email car votre fiche publique <strong>${escapeHtml(diag.display_name)}</strong> est référencée sur KOVAS.
    </p>
  </div>
</body></html>
  `.trim()

  const text = [
    `Nouvelle demande de devis sur KOVAS`,
    ``,
    `Contact : ${fullName} <${req.email}>`,
    req.phone ? `Téléphone : ${req.phone}` : '',
    ``,
    `Bien : ${propertyType} — ${PROPERTY_SITUATION_LABEL[req.property_situation] ?? req.property_situation}`,
    req.property_address ? `Adresse : ${req.property_address}` : '',
    req.property_surface_m2 ? `Surface : ${req.property_surface_m2} m²` : '',
    req.property_year_built ? `Année : ${req.property_year_built}` : '',
    ``,
    `Diagnostics : ${req.diagnostics_requested.map((d) => DIAGNOSTIC_LABEL[d] ?? d).join(', ')}`,
    ``,
    req.message ? `Message :\n${req.message}` : '',
    ``,
    `Voir : ${diag.base_url}/app/devis/quote-requests/${diag.request_id}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}

/**
 * Email de confirmation envoyé au requester — "Votre demande a bien été reçue".
 */
export function renderEmailToRequester(
  diag: { display_name: string; city: string; base_url: string },
  req: RequesterRenderContext,
): { subject: string; html: string; text: string } {
  const subject = `Votre demande a bien été reçue par ${diag.display_name}`
  const fullName = `${req.first_name} ${req.last_name}`.trim()

  const diagList = req.diagnostics_requested
    .map((d) => `<li>${escapeHtml(DIAGNOSTIC_LABEL[d] ?? d)}</li>`)
    .join('')

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F8F5EE;margin:0;padding:24px;color:#0F1E3D">
  <div style="max-width:600px;margin:0 auto;background:#FDFBF6;border-radius:18px;padding:32px;border:1px solid #D5CDB8">
    <p style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#7E8AA4;margin:0 0 8px">Confirmation</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:#0F1E3D">Bonjour ${escapeHtml(req.first_name)},</h1>

    <p style="margin:0 0 16px;line-height:1.6;color:#1F2E4D">
      Votre demande de devis a bien été transmise à <strong>${escapeHtml(diag.display_name)}</strong>.
      Le diagnostiqueur vous contactera directement sous <strong>24 à 48 heures ouvrées</strong>.
    </p>

    <div style="margin:24px 0;padding:16px;background:#F8F5EE;border-radius:12px;border:1px solid #D5CDB8">
      <p style="margin:0 0 8px;font-size:12px;color:#4A5878;font-weight:600">Récapitulatif</p>
      <p style="margin:2px 0;font-size:14px"><strong>Bien :</strong> ${escapeHtml(PROPERTY_TYPE_LABEL[req.property_type] ?? req.property_type)} — ${escapeHtml(PROPERTY_SITUATION_LABEL[req.property_situation] ?? req.property_situation)}</p>
      ${req.property_address ? `<p style="margin:2px 0;font-size:14px"><strong>Adresse :</strong> ${escapeHtml(req.property_address)}</p>` : ''}
      <p style="margin:8px 0 0;font-size:14px"><strong>Diagnostics demandés :</strong></p>
      <ul style="margin:4px 0;padding-left:20px;font-size:14px;color:#1F2E4D">${diagList}</ul>
    </div>

    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#1F2E4D">
      Bien à vous,<br>
      <strong>L’équipe KOVAS</strong>
    </p>

    <hr style="border:none;border-top:1px solid #D5CDB8;margin:32px 0">
    <p style="font-size:12px;color:#7E8AA4;margin:0">
      KOVAS met en relation particuliers et diagnostiqueurs immobiliers certifiés.
      Vous n’avez pas de compte à créer — votre demande est gratuite.
    </p>
  </div>
</body></html>
  `.trim()

  const text = [
    `Bonjour ${req.first_name},`,
    ``,
    `Votre demande de devis a bien été transmise à ${diag.display_name}.`,
    `Le diagnostiqueur vous contactera directement sous 24 à 48 heures ouvrées.`,
    ``,
    `Récapitulatif :`,
    `Bien : ${PROPERTY_TYPE_LABEL[req.property_type] ?? req.property_type} — ${PROPERTY_SITUATION_LABEL[req.property_situation] ?? req.property_situation}`,
    req.property_address ? `Adresse : ${req.property_address}` : '',
    `Diagnostics : ${req.diagnostics_requested.map((d) => DIAGNOSTIC_LABEL[d] ?? d).join(', ')}`,
    ``,
    `Merci de votre confiance,`,
    `L'équipe KOVAS`,
    ``,
    `— Référence : ${diag.base_url}`,
  ]
    .filter(Boolean)
    .join('\n')

  // Suppress unused fullName warning
  void fullName

  return { subject, html, text }
}
