/**
 * KOVAS — Exporter "Envoyer au client" (Partition D).
 *
 * 1. Génère le PDF agrégé du dossier (PdfReportExporter)
 * 2. Upload vers Storage bucket `dossier-exports/<orgId>/<dossierId>/<token>.{ext}`
 * 3. Génère un token sécurisé (32 chars hex)
 * 4. Envoie un email Resend au client avec le lien public 30 jours
 * 5. Retourne `{ token, expiresAt, recipientEmail }` (l'INSERT dossier_exports
 *    est piloté côté API route, qui connaît `was_complete` + `missing_fields_snapshot`)
 *
 * Cf. CLAUDE.md §3 feature 8 + lib/email/send.ts.
 */
import { randomBytes } from 'node:crypto'
import { sendEmail } from '@/lib/email/send'
import { exportPdfReports } from './PdfReportExporter'
import { getAdminClient, loadDossierContext } from './_common'

export interface ClientEmailExportResult {
  token: string
  expiresAt: string
  recipientEmail: string
  storagePath: string
  shareUrl: string
}

const BUCKET = 'dossier-exports'
const EXPIRES_DAYS = 30

export async function sendDossierToClient(
  dossierId: string,
  orgId: string,
): Promise<ClientEmailExportResult> {
  const ctx = await loadDossierContext(dossierId, orgId)
  if (!ctx.client?.email) {
    throw new Error('Aucun email client renseigné sur ce dossier.')
  }

  // 1. Génère le PDF agrégé
  const { buffer, contentType } = await exportPdfReports(dossierId, orgId)
  const fileExt = contentType === 'application/zip' ? 'zip' : 'pdf'

  // 2. Token sécurisé + chemin Storage
  const token = randomBytes(16).toString('hex') // 32 chars hex
  const storagePath = `${orgId}/${dossierId}/${token}.${fileExt}`

  // 3. Upload Storage (admin client, service_role)
  const admin = getAdminClient()
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  })
  if (upErr) {
    throw new Error(`Upload Storage échoué : ${upErr.message}`)
  }

  // 4. URL publique (route share/<token> à créer côté agent C, ici on construit le lien)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'
  const shareUrl = `${baseUrl}/share/dossier/${token}`

  // 5. Email transactionnel
  const recipientEmail = ctx.client.email
  const clientName = ctx.client.display_name ?? 'Bonjour'
  const subject = `Votre rapport de diagnostic — dossier ${ctx.dossier.reference}`
  const text = [
    `Bonjour ${clientName},`,
    '',
    `Vous trouverez ci-joint le rapport de diagnostic correspondant à votre dossier ${ctx.dossier.reference}.`,
    '',
    'Lien de téléchargement (valable 30 jours) :',
    shareUrl,
    '',
    'Conservez ce lien — il est unique et personnel.',
    '',
    'Cordialement,',
    'KOVAS',
  ].join('\n')

  const emailResult = await sendEmail({
    to: recipientEmail,
    subject,
    text,
    category: 'transactional',
  })
  if (!emailResult.success) {
    // Log mais ne casse pas : le fichier est uploadé, le token est valide.
    console.warn('[ClientEmailExporter] Resend a échoué :', emailResult.error)
  }

  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString()

  return {
    token,
    expiresAt,
    recipientEmail,
    storagePath: `${BUCKET}/${storagePath}`,
    shareUrl,
  }
}
