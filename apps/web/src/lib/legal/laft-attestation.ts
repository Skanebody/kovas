/**
 * Génération du contenu de l'attestation LAFT (Loi Anti-Fraude TVA — art. 286 I 3° bis CGI).
 *
 * KOVAS, éditeur du logiciel de facturation, fournit à chaque diagnostiqueur client
 * une attestation individuelle nominative certifiant que le module Factures satisfait
 * les 4 conditions cumulatives prévues à l'art. 286 I 3° bis CGI :
 *   1. Inaltérabilité des enregistrements
 *   2. Sécurisation (traçabilité, journal d'audit, chaînage)
 *   3. Conservation durant la durée légale (6 ans CGI, étendu à 10 ans Code commerce L123-22)
 *   4. Archivage périodique avec horodatage
 *
 * KOVAS recourt à l'attestation individuelle d'éditeur — la seconde voie reconnue par
 * l'art. 286 I 3° bis CGI (la première étant la certification NF 525 par organisme tiers).
 *
 * Sanction en cas d'absence d'attestation : amende fiscale 7 500 € par logiciel non
 * attesté + obligation de mise en conformité sous 60 jours (BOI-CF-COM-20-30-20 §70 et s.).
 *
 * Ce module exporte un générateur HTML (utilisable en aperçu in-app) et la structure
 * de données consommée par l'endpoint PDF (`/api/legal/laft-attestation/[orgId]`).
 */

import { COMPANY_IDENTITY } from './company-identity'

type CompanyIdentity = typeof COMPANY_IDENTITY
function formatAddressLine(editor: CompanyIdentity): string {
  return editor.address.full
}

export interface DiagnostiqueurIdentity {
  /** Raison sociale du cabinet de diagnostiqueur (client KOVAS). */
  readonly legalName: string
  /** SIREN ou SIRET du cabinet. */
  readonly siren: string | null
  /** Adresse postale du cabinet. */
  readonly address: string | null
  /** Code postal. */
  readonly postalCode: string | null
  /** Ville. */
  readonly city: string | null
  /** Numéro de certification COFRAC (information complémentaire). */
  readonly certificationN: string | null
  /** Identifiant interne KOVAS de l'organisation (UUID). */
  readonly orgId: string
}

export interface LaftAttestationData {
  /** Identité du diagnostiqueur destinataire de l'attestation. */
  readonly client: DiagnostiqueurIdentity
  /** Identité de l'éditeur KOVAS. */
  readonly editor: CompanyIdentity
  /** Numéro d'attestation (référence unique persistée). */
  readonly attestationNumber: string
  /** Date d'émission ISO 8601 (UTC). */
  readonly issuedAt: string
  /** Version du logiciel KOVAS attestée. */
  readonly softwareVersion: string
  /** Périmètre du logiciel attesté (modules). */
  readonly scope: string
}

/**
 * Construit un numéro d'attestation au format `LAFT-{YYYY}-{orgId8}`.
 * Stable pour un même couple (année, org) — permet la ré-émission idempotente.
 */
export function buildAttestationNumber(orgId: string, issuedAt: Date = new Date()): string {
  const year = issuedAt.getUTCFullYear()
  const slug = orgId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `LAFT-${year}-${slug}`
}

/**
 * Formate une date ISO en `JJ/MM/AAAA` (français).
 */
export function formatFrenchDate(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Quatre conditions LAFT — texte officiel + description fonctionnelle KOVAS.
 * Utilisé pour le rendu HTML/PDF et pour les tests automatiques de conformité.
 */
export const LAFT_CONDITIONS = [
  {
    code: 'inalterabilite',
    title: '1. Inaltérabilité',
    legal: 'Garantir l’inaltérabilité des données d’origine relatives aux opérations de paiement.',
    kovas:
      'Toute facture émise (statut « issued ») est figée : modification interdite côté base via trigger PostgreSQL `tg_invoices_no_update_after_issued`. Toute correction passe obligatoirement par l’émission d’un avoir conformément à l’art. 272-2 du CGI. Un journal d’événements immuable (table `events`, append-only) consigne chaque action.',
  },
  {
    code: 'securisation',
    title: '2. Sécurisation',
    legal:
      'Sécuriser les données enregistrées afin de garantir leur intégrité et leur traçabilité.',
    kovas:
      'Authentification Supabase Auth (PKCE + RLS multi-tenant). Chaînage cryptographique des factures via `previous_invoice_hash` (chaque facture stocke le SHA-256 de la précédente, dans l’ordre séquentiel par organisation). Numérotation continue et croissante garantie par fonction `next_reference()` sous verrou applicatif `pg_advisory_xact_lock`.',
  },
  {
    code: 'conservation',
    title: '3. Conservation',
    legal:
      'Conserver les données dans leur intégrité durant le délai prévu par la loi (6 ans CGI, 10 ans Code commerce).',
    kovas:
      'Toutes les factures sont conservées 10 ans à compter de la date d’émission (art. L123-22 Code de commerce). La suppression définitive (hard delete) est interdite pendant cette période par trigger `tg_invoices_no_hard_delete_before_10y`. En cas de résiliation du compte, le diagnostiqueur conserve un accès en lecture seule à ses factures durant les 10 ans (RLS dédiée).',
  },
  {
    code: 'archivage',
    title: '4. Archivage',
    legal: 'Procéder à un archivage périodique des données, horodaté, lisible et exportable.',
    kovas:
      'Archivage automatique mensuel : export ZIP horodaté contenant PDF + JSON + Factur-X XML de chaque facture, stocké dans le bucket Supabase chiffré `archives-laft` (rétention 10 ans + 1). Un manifeste SHA-256 garantit l’intégrité. Exportable à tout instant depuis Mon compte → Attestations légales.',
  },
] as const

/**
 * Génère le contenu HTML autonome (CSS inline) de l'attestation LAFT.
 * Sortie destinée :
 *   - à l'aperçu in-app dans `<iframe>` ou page dédiée,
 *   - à la conversion PDF via le moteur de rendu serveur (jsPDF côté API).
 *
 * Le HTML n'utilise volontairement aucun token Tailwind / shadcn — il doit
 * survivre à toute évolution du design system et rester imprimable en clair.
 */
export function renderLaftAttestationHtml(data: LaftAttestationData): string {
  const { client, editor, attestationNumber, issuedAt, softwareVersion, scope } = data
  const issuedFr = formatFrenchDate(issuedAt)
  const clientAddress = [client.address, [client.postalCode, client.city].filter(Boolean).join(' ')]
    .filter((s) => s && s.length > 0)
    .join(' — ')

  const conditionsHtml = LAFT_CONDITIONS.map(
    (c) => `
    <section class="condition">
      <h3>${c.title}</h3>
      <p class="legal"><em>Texte légal :</em> ${escapeHtml(c.legal)}</p>
      <p class="kovas"><em>Mise en œuvre KOVAS :</em> ${escapeHtml(c.kovas)}</p>
    </section>`,
  ).join('\n')

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Attestation LAFT — ${escapeHtml(client.legalName)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0F1E3D; font-size: 11pt; line-height: 1.5; }
  header { border-bottom: 2px solid #0F1E3D; padding-bottom: 12pt; margin-bottom: 18pt; }
  h1 { font-size: 18pt; margin: 0 0 6pt; letter-spacing: -0.02em; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; color: #0F1E3D; }
  h3 { font-size: 11pt; margin: 12pt 0 4pt; color: #0F1E3D; }
  p { margin: 4pt 0; }
  .meta { font-size: 9pt; color: #4A5878; }
  .ref { font-family: "JetBrains Mono", "SF Mono", Consolas, monospace; font-weight: 600; font-size: 10pt; }
  .party { background: #F8F5EE; padding: 10pt 12pt; border-radius: 6pt; margin: 8pt 0; }
  .party strong { display: block; margin-bottom: 4pt; }
  .condition { margin: 10pt 0; padding-bottom: 6pt; border-bottom: 1px dotted #D5CDB8; }
  .condition p.legal { color: #4A5878; font-size: 10pt; }
  .condition p.kovas { font-size: 10.5pt; }
  .declaration { background: #FFF7E8; border-left: 3pt solid #D97706; padding: 10pt 12pt; margin: 14pt 0; font-size: 10.5pt; }
  footer { margin-top: 24pt; padding-top: 10pt; border-top: 1px solid #D5CDB8; font-size: 9pt; color: #4A5878; }
  .sign { margin-top: 20pt; }
  .sign strong { display: block; }
</style>
</head>
<body>
<header>
  <h1>Attestation individuelle d’éditeur de logiciel</h1>
  <p class="meta">Loi anti-fraude TVA — Article 286, I, 3° bis du Code général des impôts</p>
  <p class="meta">Référence : <span class="ref">${escapeHtml(attestationNumber)}</span> · Émise le ${escapeHtml(issuedFr)}</p>
</header>

<h2>1. Éditeur attestant</h2>
<div class="party">
  <strong>${escapeHtml(editor.legalForm)} ${escapeHtml(editor.legalName)}</strong>
  Capital social : ${escapeHtml(editor.capitalLabel)}<br />
  Siège social : ${escapeHtml(formatAddressLine(editor))}<br />
  ${escapeHtml(editor.rcs.number)} — SIREN ${escapeHtml(editor.siren)} — SIRET ${escapeHtml(editor.siret)}<br />
  TVA intracommunautaire : ${escapeHtml(editor.vatIntracom)} — APE ${escapeHtml(editor.apeCode)}<br />
  Représenté par : ${escapeHtml(editor.legalRepresentative.fullName)}, Président
</div>

<h2>2. Client utilisateur du logiciel</h2>
<div class="party">
  <strong>${escapeHtml(client.legalName)}</strong>
  ${client.siren ? `SIREN/SIRET : ${escapeHtml(client.siren)}<br />` : ''}
  ${clientAddress ? `Adresse : ${escapeHtml(clientAddress)}<br />` : ''}
  ${client.certificationN ? `Certification COFRAC : ${escapeHtml(client.certificationN)}<br />` : ''}
  Identifiant compte KOVAS : <span class="ref">${escapeHtml(client.orgId)}</span>
</div>

<h2>3. Logiciel concerné</h2>
<div class="party">
  <strong>${escapeHtml(editor.brands.b2bProduct)} — Module Devis &amp; Factures</strong>
  Version logicielle attestée : ${escapeHtml(softwareVersion)}<br />
  Périmètre : ${escapeHtml(scope)}<br />
  Domaine : ${escapeHtml(editor.domains.web)}
</div>

<h2>4. Déclaration de conformité</h2>
<div class="declaration">
  Je soussigné, ${escapeHtml(editor.legalRepresentative.fullName)}, Président de ${escapeHtml(editor.legalForm)} ${escapeHtml(editor.legalName)}, éditeur du logiciel ${escapeHtml(editor.brands.b2bProduct)}, atteste sur l’honneur que le logiciel délivré à <strong>${escapeHtml(client.legalName)}</strong> satisfait, dans sa version ${escapeHtml(softwareVersion)} et pour le périmètre ci-dessus, aux quatre conditions cumulatives prévues à l’article 286, I, 3° bis du Code général des impôts, telles que définies par le BOI-TVA-DECLA-30-10-30 et le BOI-CF-COM-20-30-20.
</div>

${conditionsHtml}

<h2>5. Portée et limites</h2>
<p>La présente attestation couvre exclusivement la fonction « tenue d’un journal des opérations de caisse » au sens de l’art. 286 I 3° bis CGI, appliquée aux factures émises par ${escapeHtml(client.legalName)} via le module Devis &amp; Factures du logiciel ${escapeHtml(editor.brands.b2bProduct)}. Elle ne couvre pas les opérations de caisse réalisées hors du logiciel ni les éventuels paramétrages contraires à la documentation utilisateur. Sa validité est conditionnée à l’usage du logiciel conforme aux conditions générales d’utilisation, sans contournement des mécanismes d’inaltérabilité et de sécurisation.</p>
<p>En cas d’évolution majeure du logiciel susceptible d’affecter la conformité, une nouvelle attestation est émise automatiquement et notifiée par email à l’adresse du compte. La conservation de la présente attestation incombe au client utilisateur (durée recommandée : durée du contrat + 6 ans).</p>

<h2>6. Référentiels et textes applicables</h2>
<ul>
  <li>Article 286, I, 3° bis du Code général des impôts (Loi de finances 2016 — LAFT)</li>
  <li>BOI-TVA-DECLA-30-10-30 — Obligations des assujettis utilisant un logiciel de caisse</li>
  <li>BOI-CF-COM-20-30-20 — Contrôle des logiciels de comptabilité ou de caisse</li>
  <li>Article L123-22 du Code de commerce — conservation des documents comptables (10 ans)</li>
  <li>Article L441-9 du Code de commerce — mentions obligatoires sur les factures</li>
</ul>

<div class="sign">
  <p>Fait à ${escapeHtml(editor.address.city)}, le ${escapeHtml(issuedFr)}.</p>
  <strong>${escapeHtml(editor.legalRepresentative.fullName)}</strong>
  Président, ${escapeHtml(editor.legalForm)} ${escapeHtml(editor.legalName)}
</div>

<footer>
  ${escapeHtml(editor.legalForm)} ${escapeHtml(editor.legalName)} — Capital ${escapeHtml(editor.capitalLabel)} — ${escapeHtml(editor.rcs.number)}<br />
  ${escapeHtml(formatAddressLine(editor))} — SIREN ${escapeHtml(editor.siren)} — TVA ${escapeHtml(editor.vatIntracom)} — APE ${escapeHtml(editor.apeCode)}<br />
  Document généré automatiquement — Référence ${escapeHtml(attestationNumber)} — ${escapeHtml(editor.domains.web)}
</footer>
</body>
</html>`
}

/**
 * Construit la structure de données d'attestation depuis l'identité d'une organisation.
 * Utilisé par l'endpoint API et par les tests unitaires.
 */
export function buildAttestationData(
  client: DiagnostiqueurIdentity,
  options: {
    readonly issuedAt?: Date
    readonly softwareVersion?: string
    readonly scope?: string
    readonly editor?: CompanyIdentity
  } = {},
): LaftAttestationData {
  const issuedAt = options.issuedAt ?? new Date()
  const editor = options.editor ?? COMPANY_IDENTITY
  return {
    client,
    editor,
    attestationNumber: buildAttestationNumber(client.orgId, issuedAt),
    issuedAt: issuedAt.toISOString(),
    softwareVersion: options.softwareVersion ?? `KOVAS v${getSoftwareVersion()}`,
    scope:
      options.scope ??
      'Module Devis & Factures — émission, numérotation, conservation et archivage des factures du diagnostiqueur',
  }
}

/**
 * Lecture de la version logicielle. Stable côté build, ne dépend d'aucun secret runtime.
 */
function getSoftwareVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'
}

/**
 * Échappement HTML minimal — uniquement les 5 caractères XML / HTML obligatoires.
 * Suffisant car notre HTML est construit en interne (pas d'inputs utilisateur exotiques).
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
