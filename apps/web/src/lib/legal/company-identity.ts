/**
 * KOVAS — Identité légale officielle de la société éditrice (source unique de vérité)
 *
 * IMPORTANT : ces constantes sont consommées par :
 *   - Mentions légales (docs/legal/01-mentions-legales.md)
 *   - CGV (docs/legal/03-cgv.md)
 *   - Politique de confidentialité (docs/legal/04-politique-confidentialite.md)
 *   - Footer public (components/public/PublicFooter.tsx)
 *   - PDFs devis & factures (lib/quotes/generate-pdf.ts, lib/invoices/generate-pdf.ts)
 *   - vCard carte de visite (lib/business-card/vcard.ts)
 *   - Emails marketing & transactionnels
 *
 * Source : extrait Pappers/INPI au 21/05/2026.
 * Toute modification ici doit déclencher revue manuelle des docs juridiques + redéploiement.
 */

export const COMPANY_IDENTITY = {
  /** Dénomination sociale officielle (raison sociale, RCS) */
  legalName: 'NEXUS 1993',

  /** Nom commercial historique (apparaît dans Pappers, peut être abandonné si non utilisé) */
  tradeName: 'IDOL TALK',

  /** Marques commerciales actives */
  brands: {
    /** Marque ombrelle + service B2C annuaire gratuit */
    umbrella: 'KOVAS',
    /** Service B2C annuaire — désignation explicite */
    b2cService: 'KOVAS Annuaire',
    /** Produit SaaS B2B payant pour diagnostiqueurs */
    b2bProduct: 'KOVAS 360',
  },

  /** Forme juridique */
  legalForm: 'Société par actions simplifiée unipersonnelle (SASU)',

  /** Capital social (libéré intégralement) */
  capitalEur: 500,
  capitalLabel: '500,00 €',

  /** SIREN — 9 chiffres */
  siren: '982786154',
  sirenFormatted: '982 786 154',

  /** SIRET du siège — 14 chiffres */
  siret: '98278615400012',
  siretFormatted: '982 786 154 00012',

  /** Numéro de TVA intracommunautaire FR + 11 chiffres */
  vatIntracom: 'FR18982786154',

  /** Inscription RCS (Registre du commerce et des sociétés) */
  rcs: {
    city: 'Paris',
    number: '982 786 154 R.C.S. Paris',
    registrationDate: '2023-12-27',
  },

  /** Date de constitution */
  incorporatedAt: '2023-12-19',

  /** Code APE / NAF (Édition de logiciels applicatifs) */
  apeCode: '58.29C',
  apeLabel: 'Édition de logiciels applicatifs',

  /** Convention collective (supposée — IDCC 1486 Bureaux d'études) */
  collectiveAgreement: {
    idcc: '1486',
    label: 'Bureaux d’études techniques et sociétés de conseils',
  },

  /** Date clôture exercice comptable */
  fiscalYearEnd: '12-31',

  /** Adresse du siège social */
  address: {
    line1: '66 Avenue des Champs Élysées',
    postalCode: '75008',
    city: 'Paris',
    country: 'France',
    full: '66 Avenue des Champs Élysées, 75008 Paris, France',
    /** Domiciliation (à mentionner dans certains contextes : sous-traitance HelloDom) */
    domiciliation: 'HelloDom',
  },

  /** Représentant légal */
  legalRepresentative: {
    civility: 'Monsieur',
    firstName: 'Benjamin',
    lastName: 'BEL',
    fullName: 'Benjamin BEL',
    role: 'Président',
    legalBasis: 'article L.227-6 du Code de commerce',
  },

  /** Directeur de la publication (loi 1982-652 art. 93-2) */
  publicationDirector: {
    fullName: 'Benjamin BEL',
    email: 'direction@kovas.fr',
  },

  /** Contact RGPD (point de contact dédié — pas DPO formel, pas obligatoire pour cette taille) */
  dpoContact: {
    fullName: 'Benjamin BEL',
    email: 'dpo@kovas.fr',
    postalAddress:
      'KOVAS — Service Protection des Données — 66 Avenue des Champs Élysées, 75008 Paris',
  },

  /** Domaines */
  domains: {
    web: 'kovas.fr',
    webFull: 'https://kovas.fr',
  },

  /**
   * Adresses email officielles.
   *
   * Décision opérationnelle (2026-05-21) : tant que les mailboxes role-based
   * (support@, direction@, dpo@, signalement@, benjamin@) ne sont pas
   * provisionnées chez le provider mail, **toutes** sont aliasées vers
   * `contact@kovas.fr`. Les helpers (footers, templates Brevo, formulaires
   * publics) référencent ces clés — le rebranding mailbox-par-mailbox se
   * fera ici en un point unique quand les boîtes seront créées.
   */
  emails: {
    contactGeneral: 'contact@kovas.fr',
    direction: 'contact@kovas.fr',
    dpo: 'contact@kovas.fr',
    support: 'contact@kovas.fr',
    benjaminPersonal: 'contact@kovas.fr',
    signalement: 'contact@kovas.fr',
  },

  /** Téléphone (à compléter si besoin pour LCEN mentions légales) */
  phone: null as string | null,

  /** Greffe d'immatriculation */
  greffe: {
    city: 'Paris',
    courtFull: 'Greffe du tribunal de commerce de Paris',
  },

  /** Tribunaux compétents en cas de litige (siège social Paris) */
  competentCourts: {
    locality: 'Paris',
    courtOfAppeal: 'Cour d’appel de Paris',
  },
} as const

/** Helper formaté pour affichage standardisé "Société, SAS, capital social, SIREN, RCS" */
export function formatLegalMentions(): string {
  const c = COMPANY_IDENTITY
  return `${c.legalName} — SASU au capital de ${c.capitalLabel} — SIREN ${c.sirenFormatted} — ${c.rcs.number} — TVA ${c.vatIntracom} — Siège social : ${c.address.full}`
}

/** Helper court pour pied de facture/devis */
export function formatInvoiceFooter(): string {
  const c = COMPANY_IDENTITY
  return `${c.legalName} · SASU au capital de ${c.capitalLabel} · SIREN ${c.sirenFormatted} · ${c.rcs.number} · TVA ${c.vatIntracom}`
}

/** Mentions Factur-X / facture (à inclure dans le PDF) */
export function buildInvoiceLegalBlock() {
  const c = COMPANY_IDENTITY
  return {
    emetteurNom: c.legalName,
    emetteurAdresse: c.address.full,
    emetteurSiret: c.siretFormatted,
    emetteurRcs: c.rcs.number,
    emetteurTva: c.vatIntracom,
    emetteurCapital: c.capitalLabel,
    emetteurFormeJuridique: 'SASU',
    emetteurApe: c.apeCode,
    pmcMention:
      'Pénalités de retard : 10,05% (taux directeur BCE + 10 points). Indemnité forfaitaire de recouvrement : 40 € HT (L.441-10 du Code de commerce). Aucun escompte pour paiement anticipé.',
    factorxProfile: 'EN16931',
  }
}
