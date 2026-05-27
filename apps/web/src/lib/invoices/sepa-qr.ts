/**
 * QR code paiement SEPA Credit Transfer — format EPC069-12 (European Payments
 * Council "Quick Response Code: Guidelines to Enable Data Capture for the
 * Initiation of a SEPA Credit Transfer").
 *
 * Spec : https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation
 *
 * Le payload comporte 11 lignes séparées par \n :
 *   1. Service Tag         : "BCD"
 *   2. Version             : "002"
 *   3. Character set       : "1" (UTF-8)
 *   4. Identification      : "SCT" (SEPA Credit Transfer)
 *   5. BIC                 : 8 ou 11 chars (optionnel V2 SEPA Zone)
 *   6. Beneficiary name    : max 70 chars
 *   7. IBAN                : max 34 chars
 *   8. Amount              : EUR<montant.2décimales> (ex: EUR123.45)
 *   9. Purpose code        : 4 chars (optionnel)
 *  10. Reference           : RF + ISO 11649 OU texte libre (max 35)
 *  11. Beneficiary to originator info : libre, max 70
 *
 * Tous les scanners bancaires majeurs FR (BNP, SG, CA, BPCE, La Banque Postale)
 * supportent ce format depuis 2017.
 */

export interface SepaQrPayload {
  /** BIC (8 ou 11 chars). Optionnel mais recommandé. */
  bic?: string | null
  /** Nom du bénéficiaire (max 70 chars) */
  beneficiaryName: string
  /** IBAN sans espaces */
  iban: string
  /** Montant en euros (float) */
  amountEur: number
  /** Référence (max 35 chars) — ex: numéro de facture */
  reference: string
  /** Info libre (max 70) — ex: "KOVAS Diag DPE" */
  remittanceInfo?: string
}

/**
 * Normalise un IBAN : supprime espaces et passe en majuscules.
 */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase()
}

/**
 * Produit la chaîne payload EPC069-12 à encoder dans le QR code.
 *
 * Retourne null si données invalides (montant <= 0, IBAN absent, etc.).
 */
export function buildSepaQrPayload(input: SepaQrPayload): string | null {
  const iban = normalizeIban(input.iban ?? '')
  if (iban.length === 0 || iban.length > 34) return null
  if (input.amountEur <= 0) return null

  const name = input.beneficiaryName.trim().slice(0, 70)
  if (!name) return null

  const amount = `EUR${input.amountEur.toFixed(2)}`
  const bic = (input.bic ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 11)
  const ref = (input.reference ?? '').trim().slice(0, 35)
  const remit = (input.remittanceInfo ?? '').trim().slice(0, 70)

  // Ordre EPC069 strict.
  const lines = [
    'BCD', // Service tag
    '002', // Version
    '1', // Char set UTF-8
    'SCT', // SEPA Credit Transfer
    bic, // BIC (peut être vide en SEPA Zone V2)
    name, // Beneficiary name
    iban, // IBAN
    amount, // Amount
    '', // Purpose code (vide)
    ref, // Reference
    remit, // Beneficiary to originator info
  ]
  return lines.join('\n')
}

/**
 * Génère un Data URL (`data:image/png;base64,...`) pour le QR code SEPA d'une
 * facture, ou null si payload invalide / lib qrcode indisponible.
 *
 * Server-only — `qrcode` dépend de `canvas` côté Node.
 */
export async function generateSepaQrDataUrl(input: SepaQrPayload): Promise<string | null> {
  const payload = buildSepaQrPayload(input)
  if (!payload) return null

  try {
    // Import dynamique pour éviter de bundler côté client.
    const QRCode = await import('qrcode')
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: { dark: '#0F1419', light: '#FFFFFF' },
    })
    return dataUrl
  } catch (err) {
    // Lib pas installée / erreur — silent fail, le PDF se génère sans QR
    console.warn('[sepa-qr] generation failed', err)
    return null
  }
}
