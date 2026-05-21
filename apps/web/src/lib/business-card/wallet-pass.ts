/**
 * KOVAS — Générateur Apple Wallet pass (.pkpass) pour carte de visite.
 *
 * Format : ZIP signé contenant
 *   - pass.json       (manifest data : champs visibles, couleurs, NFC, etc.)
 *   - manifest.json   (SHA-1 de chaque asset)
 *   - signature       (PKCS#7 detached signature du manifest)
 *   - icon.png        (29×29) + icon@2x.png (58×58) + icon@3x.png (87×87)
 *   - logo.png        (160×50 max) + variantes 2x/3x
 *
 * Signature : nécessite un certificat Apple Developer
 *   - Pass Type ID Certificate (.p12)
 *   - Apple WWDR intermediate certificate
 *
 * En l'absence de configuration, `generateWalletPass` retourne `null` et
 * l'UI désactive le bouton Wallet (mode dev/staging).
 *
 * Implémentation production attendue (M9+) :
 *   - lib `passkit-generator` (npm) à ajouter au package.json
 *   - env vars : APPLE_WALLET_CERT_PATH, APPLE_WALLET_CERT_PASSWORD,
 *     APPLE_WALLET_PASS_TYPE_ID, APPLE_WALLET_TEAM_ID
 *   - Charger cert + WWDR (peut être bundle dans /private/apple-wallet-certs/)
 *   - Instancier PKPass.from({ model: 'generic', certificates: ... })
 *   - .setBarcodes({ format: 'PKBarcodeFormatQR', message: vcardText })
 *   - .getAsBuffer()
 *
 * Tant que le certificat n'est pas configuré, la route /api/business-card/wallet
 * répond 503 avec un message FR sobre.
 */

import type { VCardInput } from './vcard'

export interface WalletPassConfig {
  passTypeId: string
  teamId: string
  certPath: string
  certPassword: string
}

/**
 * Lit la config Wallet depuis les env vars. Retourne `null` si incomplète.
 * Cette fonction permet de centraliser la vérification dans l'UI et la route
 * API (l'UI consulte `isWalletPassEnabled()` pour décider si elle affiche le
 * bouton "Apple Wallet").
 */
export function loadWalletPassConfig(): WalletPassConfig | null {
  const passTypeId = process.env.APPLE_WALLET_PASS_TYPE_ID
  const teamId = process.env.APPLE_WALLET_TEAM_ID
  const certPath = process.env.APPLE_WALLET_CERT_PATH
  const certPassword = process.env.APPLE_WALLET_CERT_PASSWORD

  if (!passTypeId || !teamId || !certPath || !certPassword) return null
  return { passTypeId, teamId, certPath, certPassword }
}

export function isWalletPassEnabled(): boolean {
  return loadWalletPassConfig() !== null
}

/**
 * Génère un fichier .pkpass signé Apple Wallet.
 *
 * En V1 sans certificat configuré → retourne `null`. La route API renvoie
 * alors 503 avec un message FR sobre.
 *
 * @param organizationId  ID de l'organisation propriétaire de la carte
 * @param vcardInput      Informations à embarquer dans le pass
 * @param publicToken     Token public de la carte (pour le QR + l'URL de
 *                        web service de mise à jour du pass)
 */
export async function generateWalletPass(
  organizationId: string,
  vcardInput: VCardInput,
  publicToken: string,
): Promise<Buffer | null> {
  const config = loadWalletPassConfig()
  if (!config) return null

  // La génération réelle nécessite `passkit-generator` et un certificat Apple
  // valide. Stub volontaire : on ne tente pas l'import pour éviter une erreur
  // de build/typecheck si la lib n'est pas installée. Quand l'org sera prête
  // (M9+ — cert Apple Developer Enterprise validé), remplacer ce bloc par :
  //
  //   const { PKPass } = await import('passkit-generator')
  //   const pass = await PKPass.from({
  //     model: { ...modèle pass } ,
  //     certificates: {
  //       signerCert: fs.readFileSync(certPath),
  //       signerKey: fs.readFileSync(certPath),
  //       signerKeyPassphrase: config.certPassword,
  //       wwdr: fs.readFileSync(wwdrPath),
  //     },
  //   }, {
  //     serialNumber: `${organizationId}-${publicToken}`,
  //     passTypeIdentifier: config.passTypeId,
  //     teamIdentifier: config.teamId,
  //     organizationName: vcardInput.organization,
  //     description: 'Carte de visite KOVAS',
  //     foregroundColor: 'rgb(255, 255, 255)',
  //     backgroundColor: 'rgb(15, 20, 25)',
  //     labelColor: 'rgb(212, 245, 66)',
  //   })
  //   pass.primaryFields.add({
  //     key: 'name',
  //     label: 'Nom',
  //     value: `${vcardInput.firstName} ${vcardInput.lastName}`,
  //   })
  //   pass.secondaryFields.add({
  //     key: 'role',
  //     label: 'Fonction',
  //     value: vcardInput.title ?? 'Diagnostiqueur immobilier',
  //   })
  //   pass.auxiliaryFields.add({
  //     key: 'company',
  //     label: 'Cabinet',
  //     value: vcardInput.organization,
  //   })
  //   pass.backFields.add(...)  // tel, email, web, address, note
  //   pass.setBarcodes({ format: 'PKBarcodeFormatQR', message: vcardText, ... })
  //   return pass.getAsBuffer()

  // Référence aux paramètres pour éviter les warnings unused (gardés pour la
  // future implémentation).
  void organizationId
  void vcardInput
  void publicToken
  return null
}
