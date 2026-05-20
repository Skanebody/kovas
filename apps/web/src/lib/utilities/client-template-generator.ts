/**
 * KOVAS — Générateur de templates de communication client (email/SMS).
 *
 * 5 templates email + 3 templates SMS.
 * V1 = textes pré-écrits avec substitutions {{var}}. Pas d'IA Claude pour
 * cette utility — c'est un quick-win sobre.
 */

export type EmailTemplateKey =
  | 'demande_documents'
  | 'confirmation_rdv'
  | 'rappel_rdv'
  | 'rapport_envoye'
  | 'relance_paiement'

export type SmsTemplateKey = 'rappel_rdv' | 'confirmation_rdv' | 'rapport_envoye'

export type Channel = 'email' | 'sms'

export interface ClientTemplateInput {
  channel: Channel
  /** Clef du template (selon channel). */
  templateKey: EmailTemplateKey | SmsTemplateKey
  /** Données de substitution. */
  vars: Partial<TemplateVars>
  /** Si demande_documents : liste des docs cochés. */
  requestedDocuments?: string[]
}

export interface TemplateVars {
  clientName: string
  diagnosticianName: string
  diagnosticianPhone: string
  diagnosticianEmail: string
  appointmentDate: string // "vendredi 23 mai 2026"
  appointmentTime: string // "14h30"
  appointmentAddress: string
  reportLink: string
  invoiceAmount: string
  invoiceDueDate: string
}

export interface GeneratedTemplate {
  channel: Channel
  recipient: 'client'
  subject?: string
  body: string
}

const DEFAULT_VARS: TemplateVars = {
  clientName: '[Nom du client]',
  diagnosticianName: '[Votre nom]',
  diagnosticianPhone: '[Votre téléphone]',
  diagnosticianEmail: '[Votre email]',
  appointmentDate: '[Date du rendez-vous]',
  appointmentTime: '[Heure]',
  appointmentAddress: '[Adresse du bien]',
  reportLink: '[Lien rapport]',
  invoiceAmount: '[Montant]',
  invoiceDueDate: '[Date échéance]',
}

// ============================================
// Templates email
// ============================================

const EMAIL_TEMPLATES: Record<EmailTemplateKey, { subject: string; body: string }> = {
  demande_documents: {
    subject: 'Documents à préparer pour votre diagnostic immobilier',
    body: `Bonjour {{clientName}},

Pour préparer au mieux votre diagnostic prévu le {{appointmentDate}} à {{appointmentTime}}, merci de me transmettre les documents suivants avant l'intervention :

{{documentsList}}

Vous pouvez répondre directement à cet email avec les pièces jointes.

Cela me permettra de gagner du temps sur place et de vous remettre un rapport plus complet.

Bien cordialement,
{{diagnosticianName}}
{{diagnosticianPhone}} · {{diagnosticianEmail}}`,
  },
  confirmation_rdv: {
    subject: 'Confirmation de votre rendez-vous diagnostic',
    body: `Bonjour {{clientName}},

Je vous confirme notre rendez-vous :

• Date : {{appointmentDate}}
• Heure : {{appointmentTime}}
• Adresse : {{appointmentAddress}}

Merci de prévoir un accès à l'ensemble des pièces (y compris combles et cave si applicable).

À très bientôt,
{{diagnosticianName}}
{{diagnosticianPhone}}`,
  },
  rappel_rdv: {
    subject: 'Rappel — rendez-vous diagnostic demain',
    body: `Bonjour {{clientName}},

Petit rappel : nous avons rendez-vous demain {{appointmentDate}} à {{appointmentTime}} au {{appointmentAddress}}.

Si un imprévu survient, contactez-moi au {{diagnosticianPhone}}.

À demain,
{{diagnosticianName}}`,
  },
  rapport_envoye: {
    subject: 'Votre rapport de diagnostic est disponible',
    body: `Bonjour {{clientName}},

Le rapport de diagnostic est finalisé. Vous pouvez le télécharger ici :
{{reportLink}}

Je reste à votre disposition pour toute question.

Bien cordialement,
{{diagnosticianName}}
{{diagnosticianPhone}} · {{diagnosticianEmail}}`,
  },
  relance_paiement: {
    subject: 'Rappel — facture en attente',
    body: `Bonjour {{clientName}},

Sauf erreur de ma part, votre facture d'un montant de {{invoiceAmount}} (échéance {{invoiceDueDate}}) reste en attente de règlement.

Si le paiement a déjà été effectué, merci d'ignorer ce message. Dans le cas contraire, je vous serais reconnaissant de procéder au règlement à votre meilleure convenance.

Bien cordialement,
{{diagnosticianName}}`,
  },
}

// ============================================
// Templates SMS (max 160 caractères pratiques, FR sans accent sécurité GSM-7)
// ============================================

const SMS_TEMPLATES: Record<SmsTemplateKey, string> = {
  rappel_rdv:
    'Rappel KOVAS : RDV diag demain {{appointmentDate}} {{appointmentTime}} au {{appointmentAddress}}. Contact {{diagnosticianPhone}}.',
  confirmation_rdv:
    'Bonjour {{clientName}}, RDV diag confirme le {{appointmentDate}} a {{appointmentTime}}. {{diagnosticianName}} {{diagnosticianPhone}}.',
  rapport_envoye:
    'Bonjour {{clientName}}, votre rapport est dispo : {{reportLink}}. {{diagnosticianName}}.',
}

// ============================================
// Generation
// ============================================

function substitute(text: string, vars: TemplateVars, documentsList?: string): string {
  let out = text
  const allVars: Record<string, string> = { ...vars }
  if (documentsList !== undefined) {
    allVars.documentsList = documentsList
  }
  for (const [key, value] of Object.entries(allVars)) {
    out = out.replaceAll(`{{${key}}}`, value)
  }
  return out
}

export function generateTemplate(input: ClientTemplateInput): GeneratedTemplate {
  const vars: TemplateVars = { ...DEFAULT_VARS, ...input.vars }

  if (input.channel === 'email') {
    const key = input.templateKey as EmailTemplateKey
    const tpl = EMAIL_TEMPLATES[key]
    if (!tpl) {
      throw new Error(`Email template inconnu : ${String(key)}`)
    }
    const documentsList =
      input.requestedDocuments && input.requestedDocuments.length > 0
        ? input.requestedDocuments.map((d) => `  • ${d}`).join('\n')
        : '  • [À préciser]'
    return {
      channel: 'email',
      recipient: 'client',
      subject: substitute(tpl.subject, vars),
      body: substitute(tpl.body, vars, documentsList),
    }
  }

  const key = input.templateKey as SmsTemplateKey
  const tpl = SMS_TEMPLATES[key]
  if (!tpl) {
    throw new Error(`SMS template inconnu : ${String(key)}`)
  }
  return {
    channel: 'sms',
    recipient: 'client',
    body: substitute(tpl, vars),
  }
}

/** Liste des documents proposés par défaut pour `demande_documents`. */
export const DEFAULT_REQUESTED_DOCUMENTS: readonly string[] = [
  'Factures de gaz et électricité des 12 derniers mois',
  'Plans du bien (si disponibles)',
  'Ancien DPE et autres diagnostics existants',
  "Notice d'entretien chaudière / chauffe-eau",
  'Règlement de copropriété (si copropriété)',
  'Permis de construire ou date de construction',
  'Factures travaux récents (isolation, fenêtres, etc.)',
]
