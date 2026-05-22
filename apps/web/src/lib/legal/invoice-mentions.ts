/**
 * Mentions obligatoires d'une facture en droit français.
 *
 * Référence : article L441-9 du Code de commerce + article 242 nonies A de l'annexe II
 * au CGI + article 289 du CGI (TVA). Sanctions : amende fiscale de 15 € par mention
 * manquante (plafonnée à 1/4 du montant facturé) — voir art. 1737 II CGI.
 *
 * Ce module centralise la liste des mentions et fournit `assertInvoiceCompliant()` pour
 * valider une facture avant émission (statut « issued »). Toute génération PDF (Factur-X
 * ou format libre) doit appeler ce validateur en amont — voir audit `scripts/audit-invoice-compliance.ts`.
 */

export interface InvoiceMentionSpec {
  /** Code court (utilisé en logs et rapports JSON). */
  readonly code: string
  /** Libellé humain en français. */
  readonly label: string
  /** Article(s) législatif(s) applicables. */
  readonly legalRef: string
  /** Niveau de criticité — `mandatory` = bloquant émission, `conditional` = applicable selon contexte. */
  readonly level: 'mandatory' | 'conditional'
}

/**
 * Liste exhaustive des mentions L441-9 + 242 nonies A annexe II CGI.
 * L'ordre suit la structure attendue sur la facture (en-tête → corps → pied).
 */
export const INVOICE_MENTIONS: readonly InvoiceMentionSpec[] = [
  {
    code: 'issue_date',
    label: 'Date d’émission de la facture',
    legalRef: 'L441-9 al. 1 — 242 nonies A 1° CGI',
    level: 'mandatory',
  },
  {
    code: 'sequential_number',
    label: 'Numéro unique séquentiel et continu (sans rupture)',
    legalRef: 'L441-9 al. 1 — 242 nonies A 2° CGI',
    level: 'mandatory',
  },
  {
    code: 'issuer_legal_name',
    label: 'Identité émetteur : raison sociale',
    legalRef: 'L441-9 al. 1 — 242 nonies A 3° CGI',
    level: 'mandatory',
  },
  {
    code: 'issuer_address',
    label: 'Identité émetteur : adresse du siège social',
    legalRef: 'L441-9 al. 1',
    level: 'mandatory',
  },
  {
    code: 'issuer_siren',
    label: 'Identité émetteur : SIREN ou SIRET',
    legalRef: 'L441-9 al. 1',
    level: 'mandatory',
  },
  {
    code: 'issuer_rcs',
    label: 'Identité émetteur : mention RCS ville + n° d’inscription',
    legalRef: 'L441-9 al. 1 — R123-237 Code commerce',
    level: 'mandatory',
  },
  {
    code: 'issuer_vat_number',
    label: 'Numéro de TVA intracommunautaire de l’émetteur',
    legalRef: '289 I-2 CGI — 242 nonies A 4° CGI',
    level: 'mandatory',
  },
  {
    code: 'issuer_ape',
    label: 'Code APE / NAF de l’émetteur',
    legalRef: 'Usage commercial — non sanctionné isolément mais requis sur facturation pro',
    level: 'conditional',
  },
  {
    code: 'issuer_capital',
    label: 'Capital social (pour les sociétés commerciales)',
    legalRef: 'R123-238 Code commerce',
    level: 'conditional',
  },
  {
    code: 'customer_identity',
    label: 'Identité destinataire : nom (ou raison sociale) + adresse',
    legalRef: 'L441-9 al. 1 — 242 nonies A 5° CGI',
    level: 'mandatory',
  },
  {
    code: 'customer_vat_number',
    label: 'Numéro de TVA intracommunautaire du client (si assujetti UE)',
    legalRef: '289 I-2 CGI',
    level: 'conditional',
  },
  {
    code: 'service_date',
    label: 'Date de réalisation de la prestation ou de livraison',
    legalRef: 'L441-9 al. 1 — 242 nonies A 6° CGI',
    level: 'mandatory',
  },
  {
    code: 'lines_detail',
    label:
      'Désignation détaillée + quantité + prix unitaire HT + total HT par ligne (et taux de TVA applicable)',
    legalRef: 'L441-9 al. 1 — 242 nonies A 7° et 8° CGI',
    level: 'mandatory',
  },
  {
    code: 'discount',
    label: 'Rabais, remises ou ristournes acquis à la date de la facture',
    legalRef: 'L441-9 al. 1',
    level: 'conditional',
  },
  {
    code: 'amount_ht',
    label: 'Montant total HT',
    legalRef: 'L441-9 al. 1 — 242 nonies A 9° CGI',
    level: 'mandatory',
  },
  {
    code: 'vat_breakdown',
    label: 'Montant de TVA détaillé par taux applicable',
    legalRef: '242 nonies A 10° et 11° CGI',
    level: 'mandatory',
  },
  {
    code: 'amount_ttc',
    label: 'Montant total TTC',
    legalRef: 'L441-9 al. 1',
    level: 'mandatory',
  },
  {
    code: 'payment_terms',
    label: 'Date d’échéance et conditions de règlement',
    legalRef: 'L441-9 al. 1',
    level: 'mandatory',
  },
  {
    code: 'late_penalties',
    label:
      'Taux des pénalités exigibles en cas de retard de paiement (au moins 3× le taux d’intérêt légal)',
    legalRef: 'L441-10 II Code commerce',
    level: 'mandatory',
  },
  {
    code: 'fixed_indemnity_40',
    label: 'Mention de l’indemnité forfaitaire de 40 € pour frais de recouvrement',
    legalRef: 'D441-5 Code commerce',
    level: 'mandatory',
  },
  {
    code: 'discount_for_early_payment',
    label: 'Conditions d’escompte applicables en cas de paiement anticipé',
    legalRef: 'L441-9 al. 1',
    level: 'mandatory',
  },
  {
    code: 'vat_exemption_293b',
    label:
      'Mention « TVA non applicable, art. 293 B du CGI » si franchise en base (auto-entrepreneur)',
    legalRef: '293 B CGI',
    level: 'conditional',
  },
  {
    code: 'reverse_charge',
    label: 'Mention « Autoliquidation » si applicable (sous-traitance BTP, intracom B2B…)',
    legalRef: '283-2 CGI',
    level: 'conditional',
  },
  {
    code: 'insurance_rcp',
    label: 'Référence assurance RC professionnelle (recommandé profession diagnostiqueur)',
    legalRef: 'Usage métier — non sanctionné',
    level: 'conditional',
  },
] as const

/**
 * Phrases obligatoires standardisées — usage : injection PDF + assertion validation.
 * Le tableau exporte les libellés exacts à apposer sur la facture.
 */
export const STANDARD_MENTIONS = {
  latePenalties: (legalRateAnnualPct: number) =>
    `En cas de retard de paiement, des pénalités seront dues, calculées au taux annuel de ${(
      legalRateAnnualPct * 3
    ).toFixed(
      2,
    )} % (soit trois fois le taux d’intérêt légal en vigueur de ${legalRateAnnualPct.toFixed(
      2,
    )} %, art. L441-10 du Code de commerce).`,
  fixedIndemnity40:
    'Tout retard de paiement entraîne, de plein droit, le versement d’une indemnité forfaitaire pour frais de recouvrement d’un montant de 40 € (art. D441-5 du Code de commerce).',
  noDiscountForEarlyPayment: 'Pas d’escompte pour règlement anticipé.',
  vatExemption293B:
    'TVA non applicable, art. 293 B du CGI (franchise en base — auto-entrepreneur).',
  reverseCharge: 'Autoliquidation — TVA due par le preneur (art. 283-2 du CGI).',
} as const

/**
 * Modèle minimal d'une facture utilisé pour la validation.
 * `lines` est typé avec les champs strictement nécessaires à la vérification L441-9.
 */
export interface InvoiceForCompliance {
  readonly reference?: string | null
  readonly issued_at?: string | Date | null
  readonly service_date?: string | Date | null
  readonly due_date?: string | Date | null
  readonly amount_ht?: number | string | null
  readonly amount_tva?: number | string | null
  readonly amount_ttc?: number | string | null
  readonly tva_rate?: number | string | null
  readonly line_items?: ReadonlyArray<{
    readonly designation?: string
    readonly quantity?: number
    readonly unit_price_ht?: number
    readonly total_ht?: number
    readonly tva_rate?: number
  }>
  readonly client_snapshot?: {
    readonly name?: string
    readonly address?: string
    readonly vat_number?: string | null
  } | null
  readonly issuer_snapshot?: {
    readonly legal_name?: string
    readonly address?: string
    readonly siret?: string
    readonly rcs?: string
    readonly vat_number?: string
    readonly capital?: string
    readonly ape_code?: string
  } | null
  readonly mentions?: ReadonlyArray<string> | null
  readonly is_reverse_charge?: boolean | null
  readonly is_vat_exempt_293b?: boolean | null
  readonly payment_terms?: string | null
  readonly late_penalty_clause?: string | null
  readonly fixed_indemnity_clause?: string | null
  readonly discount_for_early_payment?: string | null
}

export interface ComplianceIssue {
  readonly code: string
  readonly label: string
  readonly legalRef: string
  readonly severity: 'error' | 'warning'
  readonly hint: string
}

export interface ComplianceReport {
  readonly compliant: boolean
  readonly errors: readonly ComplianceIssue[]
  readonly warnings: readonly ComplianceIssue[]
}

/**
 * Vérifie la conformité L441-9 d'une facture. Renvoie un rapport structuré.
 *
 * Cette fonction NE LANCE PAS — pour bloquer l'émission, utiliser `assertInvoiceCompliant`.
 */
export function checkInvoiceCompliance(invoice: InvoiceForCompliance): ComplianceReport {
  const errors: ComplianceIssue[] = []
  const warnings: ComplianceIssue[] = []

  const push = (
    target: 'error' | 'warning',
    code: string,
    label: string,
    legalRef: string,
    hint: string,
  ) => {
    const issue: ComplianceIssue = { code, label, legalRef, severity: target, hint }
    if (target === 'error') {
      errors.push(issue)
    } else {
      warnings.push(issue)
    }
  }

  // Numéro séquentiel — pattern FAC-YYYY-NNNNN
  const reference = (invoice.reference ?? '').trim()
  if (!reference) {
    push(
      'error',
      'sequential_number',
      'Numéro de facture manquant',
      'L441-9 al. 1 — 242 nonies A 2° CGI',
      'Renseigner reference via next_reference(org, "invoice") avant émission.',
    )
  } else if (!/^FAC-\d{4}-\d{5,}$/.test(reference)) {
    push(
      'error',
      'sequential_number',
      'Numéro de facture au format invalide',
      'L441-9 al. 1 — 242 nonies A 2° CGI',
      'Format attendu : FAC-YYYY-NNNNN (5 chiffres minimum, continu et croissant).',
    )
  }

  // Date d'émission
  if (!invoice.issued_at) {
    push(
      'error',
      'issue_date',
      'Date d’émission manquante',
      'L441-9 al. 1',
      'Définir issued_at avant passage au statut « issued ».',
    )
  }

  // Date de prestation
  if (!invoice.service_date) {
    push(
      'error',
      'service_date',
      'Date de prestation manquante',
      '242 nonies A 6° CGI',
      'Renseigner service_date (date de réalisation des diagnostics).',
    )
  }

  // Date d'échéance
  if (!invoice.due_date) {
    push(
      'error',
      'payment_terms',
      'Date d’échéance manquante',
      'L441-9 al. 1',
      'Renseigner due_date (par défaut : émission + 30 jours, art. L441-10).',
    )
  }

  // Montants
  const ht = toNumber(invoice.amount_ht)
  const tva = toNumber(invoice.amount_tva)
  const ttc = toNumber(invoice.amount_ttc)
  if (ht === null) {
    push('error', 'amount_ht', 'Montant HT manquant', 'L441-9 al. 1', 'Calculer amount_ht.')
  }
  if (tva === null) {
    push(
      'error',
      'vat_breakdown',
      'Montant TVA manquant',
      '242 nonies A 11° CGI',
      'Calculer amount_tva.',
    )
  }
  if (ttc === null) {
    push('error', 'amount_ttc', 'Montant TTC manquant', 'L441-9 al. 1', 'Calculer amount_ttc.')
  }
  if (ht !== null && tva !== null && ttc !== null) {
    const expected = Math.round((ht + tva) * 100) / 100
    if (Math.abs(expected - ttc) > 0.02) {
      push(
        'error',
        'amount_ttc',
        `Incohérence HT + TVA ≠ TTC (HT ${ht} + TVA ${tva} = ${expected}, mais TTC = ${ttc})`,
        'L441-9 al. 1',
        'Recalculer les totaux avant émission.',
      )
    }
  }

  // Lignes
  if (!invoice.line_items || invoice.line_items.length === 0) {
    push(
      'error',
      'lines_detail',
      'Aucune ligne de prestation',
      '242 nonies A 7° et 8° CGI',
      'Ajouter au moins une ligne (désignation + quantité + PU HT + total HT).',
    )
  } else {
    invoice.line_items.forEach((line, idx) => {
      if (!line.designation || line.designation.trim().length === 0) {
        push(
          'error',
          'lines_detail',
          `Ligne ${idx + 1} : désignation manquante`,
          '242 nonies A 7° CGI',
          'Préciser la nature du diagnostic (DPE, Amiante, Plomb, etc.).',
        )
      }
      if (typeof line.quantity !== 'number' || line.quantity <= 0) {
        push(
          'error',
          'lines_detail',
          `Ligne ${idx + 1} : quantité invalide`,
          '242 nonies A 7° CGI',
          'Renseigner quantity > 0.',
        )
      }
      if (typeof line.unit_price_ht !== 'number' || line.unit_price_ht < 0) {
        push(
          'error',
          'lines_detail',
          `Ligne ${idx + 1} : prix unitaire HT invalide`,
          '242 nonies A 8° CGI',
          'Renseigner unit_price_ht ≥ 0.',
        )
      }
      if (typeof line.total_ht !== 'number') {
        push(
          'error',
          'lines_detail',
          `Ligne ${idx + 1} : total HT manquant`,
          'L441-9 al. 1',
          'Calculer total_ht (= quantity × unit_price_ht).',
        )
      }
    })
  }

  // Snapshot émetteur (raison sociale, adresse, SIRET, RCS, TVA)
  const issuer = invoice.issuer_snapshot
  if (!issuer || !issuer.legal_name) {
    push(
      'error',
      'issuer_legal_name',
      'Raison sociale émetteur manquante',
      'L441-9 al. 1 — 242 nonies A 3° CGI',
      'Snapshotter l’organisation à l’émission (champ issuer_snapshot).',
    )
  }
  if (!issuer?.address) {
    push(
      'error',
      'issuer_address',
      'Adresse émetteur manquante',
      'L441-9 al. 1',
      'Renseigner issuer_snapshot.address.',
    )
  }
  if (!issuer?.siret) {
    push(
      'error',
      'issuer_siren',
      'SIRET émetteur manquant',
      'L441-9 al. 1',
      'Renseigner issuer_snapshot.siret.',
    )
  }
  if (!issuer?.rcs) {
    push(
      'error',
      'issuer_rcs',
      'Mention RCS émetteur manquante',
      'R123-237 Code commerce',
      'Renseigner issuer_snapshot.rcs (ex : « 123 456 789 R.C.S. Paris »).',
    )
  }
  if (!issuer?.vat_number && !invoice.is_vat_exempt_293b) {
    push(
      'error',
      'issuer_vat_number',
      'Numéro TVA intracom émetteur manquant',
      '289 I-2 CGI',
      'Renseigner issuer_snapshot.vat_number — ou cocher is_vat_exempt_293b si franchise en base.',
    )
  }
  if (!issuer?.ape_code) {
    push(
      'warning',
      'issuer_ape',
      'Code APE émetteur recommandé',
      'Usage commercial',
      'Renseigner issuer_snapshot.ape_code (recommandé sur facturation pro).',
    )
  }
  if (!issuer?.capital) {
    push(
      'warning',
      'issuer_capital',
      'Capital social non mentionné',
      'R123-238 Code commerce',
      'Renseigner issuer_snapshot.capital si société commerciale.',
    )
  }

  // Snapshot client
  const customer = invoice.client_snapshot
  if (!customer || !customer.name) {
    push(
      'error',
      'customer_identity',
      'Identité client manquante',
      '242 nonies A 5° CGI',
      'Snapshotter le client à l’émission (client_snapshot.name).',
    )
  }
  if (!customer?.address) {
    push(
      'error',
      'customer_identity',
      'Adresse client manquante',
      '242 nonies A 5° CGI',
      'Renseigner client_snapshot.address.',
    )
  }

  // Mentions textuelles obligatoires
  const mentionsBlob = [
    invoice.late_penalty_clause ?? '',
    invoice.fixed_indemnity_clause ?? '',
    invoice.discount_for_early_payment ?? '',
    invoice.payment_terms ?? '',
    ...(invoice.mentions ?? []),
  ]
    .join(' | ')
    .toLowerCase()

  if (!/(taux d.int|p.nalit|3.{0,3}fois)/i.test(mentionsBlob)) {
    push(
      'error',
      'late_penalties',
      'Mention des pénalités de retard manquante (au moins 3× taux légal)',
      'L441-10 II Code commerce',
      `Apposer la mention type : « ${STANDARD_MENTIONS.latePenalties(0.0407)} »`,
    )
  }
  if (!/40\s*€|40\s*euros|indemnit.{0,30}forfaitaire/i.test(mentionsBlob)) {
    push(
      'error',
      'fixed_indemnity_40',
      'Mention de l’indemnité forfaitaire 40 € manquante',
      'D441-5 Code commerce',
      `Apposer la mention type : « ${STANDARD_MENTIONS.fixedIndemnity40} »`,
    )
  }
  if (!/(escompte|paiement anticip)/i.test(mentionsBlob)) {
    push(
      'error',
      'discount_for_early_payment',
      'Mention des conditions d’escompte manquante',
      'L441-9 al. 1',
      `Apposer la mention type : « ${STANDARD_MENTIONS.noDiscountForEarlyPayment} »`,
    )
  }

  // Franchise en base 293 B (auto-entrepreneur)
  if (invoice.is_vat_exempt_293b) {
    if (!/293\s*B/i.test(mentionsBlob)) {
      push(
        'error',
        'vat_exemption_293b',
        'Mention TVA non applicable art. 293 B CGI manquante (franchise en base)',
        '293 B CGI',
        `Apposer la mention obligatoire : « ${STANDARD_MENTIONS.vatExemption293B} »`,
      )
    }
    if (tva !== null && tva > 0) {
      push(
        'error',
        'vat_exemption_293b',
        'TVA non nulle alors que franchise en base (293 B CGI) déclarée',
        '293 B CGI',
        'Mettre amount_tva à 0 ou décocher is_vat_exempt_293b.',
      )
    }
  }

  // Autoliquidation
  if (invoice.is_reverse_charge && !/autoliquidation/i.test(mentionsBlob)) {
    push(
      'error',
      'reverse_charge',
      'Mention « Autoliquidation » manquante',
      '283-2 CGI',
      `Apposer la mention : « ${STANDARD_MENTIONS.reverseCharge} »`,
    )
  }

  return {
    compliant: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Lance une exception si la facture n'est pas conforme L441-9.
 * À appeler systématiquement avant tout passage au statut « issued » ou avant export PDF.
 */
export function assertInvoiceCompliant(invoice: InvoiceForCompliance): void {
  const report = checkInvoiceCompliance(invoice)
  if (!report.compliant) {
    const summary = report.errors.map((e) => `[${e.code}] ${e.label} (${e.legalRef})`).join(' ; ')
    throw new InvoiceComplianceError(
      `Facture non conforme L441-9 — ${report.errors.length} erreur(s) : ${summary}`,
      report,
    )
  }
}

export class InvoiceComplianceError extends Error {
  readonly report: ComplianceReport
  constructor(message: string, report: ComplianceReport) {
    super(message)
    this.name = 'InvoiceComplianceError'
    this.report = report
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}
