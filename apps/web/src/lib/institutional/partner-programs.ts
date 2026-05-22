/**
 * KOVAS — Programmes partenaires (page /partenaires)
 *
 * Quatre verticales partenaires identifiées, avec bénéfices, témoignages
 * placeholder réalistes et cas d'usage concrets.
 */

export type PartnerProfileId =
  | 'notaires'
  | 'agences-immobilieres'
  | 'banques-courtiers'
  | 'fournisseurs-energie'

export interface PartnerProfile {
  id: PartnerProfileId
  title: string
  description: string
  benefits: readonly string[]
  testimonial: {
    /** Citation sobre, vouvoiement ou troisième personne */
    quote: string
    /** Nom + structure (placeholder OK) */
    author: string
    role: string
  }
}

export const PARTNER_PROFILES: PartnerProfile[] = [
  {
    id: 'notaires',
    title: 'Notaires',
    description:
      "Pour les études notariales qui souhaitent fluidifier la production des diagnostics avant signature et garantir la conformité des dossiers transmis aux acquéreurs.",
    benefits: [
      'Annuaire de diagnostiqueurs vérifiés et géolocalisés en France métropolitaine',
      'Commission de 8 % HT sur les missions générées par votre étude',
      "Tableau de bord dédié pour suivre l'avancement des diagnostics commandés",
      "Génération automatique de l'accusé de réception client pour intégration au dossier d'acte",
    ],
    testimonial: {
      quote:
        "L'intégration de KOVAS dans notre flux d'avant-vente nous évite de relancer les vendeurs trois fois pour récupérer les diagnostics. Les fichiers arrivent au bon format, exploitables directement.",
      author: 'Maître X. [placeholder]',
      role: 'Étude notariale partenaire — Paris',
    },
  },
  {
    id: 'agences-immobilieres',
    title: 'Agences immobilières',
    description:
      "Pour les agences mandantes qui veulent proposer un service diagnostic intégré à leurs vendeurs et accélérer la mise en marché des biens.",
    benefits: [
      "Annuaire intégrable dans votre logiciel d'agence via widget ou API (Phase 2)",
      'Tarification préférentielle pour vos vendeurs (5 % de remise sur le prix médian local)',
      'Mise à disposition de visuels conformes (étiquettes DPE générées en haute résolution)',
      'Co-marketing local : événements, contenu mutualisé sur LinkedIn et presse régionale',
    ],
    testimonial: {
      quote:
        "Le réflexe diagnostic est devenu un argument à la prise de mandat. Nos vendeurs apprécient la transparence des délais et des prix.",
      author: 'Y. [placeholder]',
      role: "Directrice d'agence — Réseau indépendant Île-de-France",
    },
  },
  {
    id: 'banques-courtiers',
    title: 'Banques et courtiers en crédit immobilier',
    description:
      "Pour les établissements financiers qui souhaitent proposer un service estimation DPE en amont du financement, dans une logique de prévention du risque énergétique.",
    benefits: [
      'Intégration du calculateur DPE gratuit dans votre simulateur immobilier',
      "Alerte automatique sur les biens classés F ou G dans les dossiers d'emprunt",
      "Rapport mensuel sur le risque énergétique de votre portefeuille de prêts immobiliers",
      'Communication conjointe sur les obligations rénovation 2025-2034',
    ],
    testimonial: {
      quote:
        "Le calculateur intégré nous a permis d'objectiver le coût de rénovation auprès des emprunteurs dès la simulation. Les conseillers gagnent un temps précieux.",
      author: 'Z. [placeholder]',
      role: 'Responsable produits crédit — Banque régionale',
    },
  },
  {
    id: 'fournisseurs-energie',
    title: 'Fournisseurs énergie',
    description:
      "Pour les énergéticiens et installateurs qui veulent proposer un parcours rénovation cohérent à leurs clients : diagnostic, recommandation, devis travaux.",
    benefits: [
      "Lead qualifié : profil énergétique du logement + contact opt-in (selon consentement RGPD du propriétaire)",
      'Carte de chaleur des biens F-G en France pour orienter votre prospection commerciale',
      "Co-construction d'offres rénovation packagées avec les diagnostiqueurs partenaires",
      'Aucun engagement minimum : facturation au lead qualifié uniquement',
    ],
    testimonial: {
      quote:
        "Les leads transmis sont qualifiés, le propriétaire connaît déjà sa classe énergétique. Nos commerciaux entrent en relation sur une conversation concrète, pas un appel à froid.",
      author: 'A. [placeholder]',
      role: 'Directeur commercial — Installateur pompes à chaleur',
    },
  },
] as const

export interface PartnerUseCase {
  id: string
  title: string
  description: string
}

export const PARTNER_USE_CASES: PartnerUseCase[] = [
  {
    id: 'notaire-avant-vente',
    title: "Un notaire propose KOVAS pour les diagnostics d'avant-vente",
    description:
      "L'étude commande le pack diagnostics directement depuis son intranet. Le vendeur reçoit un lien sécurisé pour planifier la visite. À J+5, les rapports sont transmis au format ZIP Liciel ou PDF, intégrés au dossier d'acte authentique.",
  },
  {
    id: 'agence-annuaire-crm',
    title: 'Une agence intègre notre annuaire dans son CRM',
    description:
      "L'agent recherche un diagnostiqueur dans la commune du mandat depuis son outil habituel. Les profils s'affichent avec disponibilités, certifications et prix médians. Le rendez-vous est confirmé sans changer d'écran.",
  },
  {
    id: 'banque-calculateur-dpe',
    title: 'Une banque propose le calculateur DPE dans son simulateur',
    description:
      "Dès la simulation d'emprunt, l'acquéreur estime la classe énergétique du bien convoité. En cas de note F ou G, un parcours complémentaire l'oriente vers un diagnostic certifié et une simulation de travaux éligibles à MaPrimeRénov'.",
  },
] as const
