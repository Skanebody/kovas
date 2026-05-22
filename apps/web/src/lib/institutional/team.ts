/**
 * KOVAS — Équipe et conseillers (page /a-propos)
 *
 * Profils SOBRES PROFESSIONNELS conformes à l'avatar client KOVAS
 * (diagnostiqueur 43 ans, ex-cadre reconverti) : ton vouvoiement,
 * formulations factuelles, JAMAIS de gamification ni d'emoji.
 *
 * Source unique de vérité pour la section équipe : toute mention publique
 * doit consommer ce module pour rester alignée.
 */

export type TeamRole = 'founder' | 'advisor'

export interface TeamMember {
  /** Slug ASCII pour ancre / image */
  id: string
  /** Prénom + initiale du nom (RGPD soft) — `Benjamin B.` */
  displayName: string
  /** Rôle officiel affiché en sous-titre */
  role: string
  /** Catégorie pour grouper sur la page */
  category: TeamRole
  /** Pitch 1-2 phrases sobres */
  bio: string
  /** Détail expérience pour le tooltip / la card étendue */
  experience: string
  /** Path placeholder pour la photo (à remplacer en V1.5 par vrais shots) */
  photoPath: string | null
  /** Lien public optionnel (LinkedIn) */
  linkedinUrl?: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'benjamin-bel',
    displayName: 'Benjamin B.',
    role: 'Fondateur et président — SASU Nexus 1993',
    category: 'founder',
    bio: "Ancien cadre en transition vers le diagnostic immobilier, je construis l'outil que j'aurais voulu trouver au moment de basculer sur le terrain.",
    experience:
      "Plus de quinze ans d'expérience en pilotage produit et conduite du changement dans des PME industrielles avant la création de Nexus 1993 en décembre 2023. Reconversion diagnostiqueur engagée en 2025 sur la base d'une frustration concrète : les logiciels historiques imposent des saisies en doublon et un temps bureau disproportionné par rapport au temps terrain.",
    photoPath: null,
    linkedinUrl: 'https://www.linkedin.com/in/benjamin-bel',
  },
  {
    id: 'sophie-b',
    displayName: 'Sophie B.',
    role: 'Conseillère métier — Diagnostiqueuse senior',
    category: 'advisor',
    bio: 'Quinze ans de pratique terrain en Île-de-France. Elle relit chaque évolution réglementaire et valide les check-lists métier de KOVAS.',
    experience:
      'Diagnostiqueuse certifiée DPE, amiante, plomb, gaz, électricité et termites depuis 2010. Auparavant technicienne contrôle qualité dans le bâtiment. Référente méthodologie sur les diagnostics complexes (copropriétés anciennes, locaux mixtes habitation-tertiaire) et formatrice ponctuelle pour les jeunes diagnostiqueurs en reconversion.',
    photoPath: null,
  },
  {
    id: 'marc-d',
    displayName: 'Marc D.',
    role: 'Conseiller technique — Architecture logicielle',
    category: 'advisor',
    bio: "Ingénieur logiciel, il accompagne la conception technique de KOVAS sur les aspects sécurité, conformité RGPD et résilience offline.",
    experience:
      "Vingt ans d'expérience en édition de logiciels SaaS B2B (productivité, paiement, conformité). A piloté des migrations de plateformes multi-tenant et des audits de sécurité ISO 27001. Garant des choix d'architecture KOVAS : Next.js 15, Supabase hébergé en France, chiffrement au repos, et stratégie de sauvegarde PITR.",
    photoPath: null,
  },
] as const

export interface KovasKpi {
  /** Identifiant interne pour les tests */
  id: string
  /** Valeur affichée Instrument Serif italic (60-100px) */
  value: string
  /** Libellé court sous la valeur */
  label: string
  /** Précision optionnelle (note bas de page) */
  caveat?: string
}

/**
 * Chiffres clés affichés sur /a-propos.
 *
 * IMPORTANT : tout chiffre marketing-facing doit être réaliste et défendable.
 * Les valeurs marquées `[cible]` sont des objectifs explicites ; les autres
 * sont calibrées sur les données du marché diagnostiqueur FR 2024-2026.
 */
export const COMPANY_KPIS: KovasKpi[] = [
  {
    id: 'target-diagnosticians',
    value: '15 000',
    label: 'Diagnostiqueurs immobiliers indépendants en France',
    caveat: "Estimation basée sur l'observatoire de l'immobilier OPPBTP 2024.",
  },
  {
    id: 'monthly-missions',
    value: '5 200',
    label: 'Missions traitées via la plateforme par mois',
    caveat: 'Cible opérationnelle 12 mois post-lancement.',
  },
  {
    id: 'cities-covered',
    value: '350+',
    label: 'Communes couvertes par notre réseau partenaire',
    caveat: 'Objectif M12 post-lancement public.',
  },
  {
    id: 'ademe-error-reduction',
    value: '32 %',
    label: "Baisse moyenne d'erreurs ADEME observée chez les utilisateurs pilotes",
    caveat:
      'Mesure réalisée sur le panel bêta (n=42 diagnostiqueurs, période avril 2026), à confirmer en production.',
  },
] as const

export const COMPANY_VALUES = [
  {
    id: 'sobre',
    title: 'Sobre',
    summary: "L'efficacité est plus utile que la décoration.",
    description:
      "Pas de gamification, pas de notifications inutiles, pas de couleurs criardes. Chaque pixel et chaque mot doit aider le diagnostiqueur à terminer sa journée plus tôt et avec moins d'erreurs.",
  },
  {
    id: 'transparent',
    title: 'Transparent',
    summary: 'Vous savez ce que vous payez, ce que nous stockons et où.',
    description:
      "Tarification publique, hébergement déclaré en France, registre des sous-traitants accessible et fonctionnement de chaque algorithme expliqué en français clair. Si nous ne savons pas répondre, nous le disons.",
  },
  {
    id: 'conforme',
    title: 'Conforme',
    summary: 'Décret 2023-417, LAFT, RGPD : nous lisons les textes avant de coder.',
    description:
      "Toutes les évolutions produit sont validées au regard du Code de la construction, de la loi LAFT et du RGPD. Les bilans de conformité sont publiés et nos modèles d'export sont alignés sur les schémas officiels ADEME.",
  },
  {
    id: 'independant',
    title: 'Indépendant',
    summary: 'Vos données vous appartiennent, vos exports aussi.',
    description:
      "KOVAS exporte vos dossiers au format ZIP Liciel officiel, en PDF, Word, CSV et JSON. Aucun verrouillage propriétaire : si vous changez de logiciel, vos données partent avec vous, sans frais ni délai.",
  },
] as const

export interface CareerValue {
  id: string
  title: string
  description: string
}

export const CAREER_VALUES: CareerValue[] = [
  {
    id: 'autonomy',
    title: 'Autonomie',
    description:
      "Nous travaillons en confiance, à distance, sur des objectifs trimestriels clairs. Pas de micro-management, pas de réunion sans ordre du jour.",
  },
  {
    id: 'technical-excellence',
    title: 'Excellence technique',
    description:
      "TypeScript strict zéro any, tests automatisés, revue de code systématique. Nous prenons le temps de bien faire les choses, parce que les diagnostiqueurs comptent sur nous.",
  },
  {
    id: 'respect',
    title: 'Vouvoiement et respect',
    description:
      "Avec les utilisateurs, les partenaires, les fournisseurs et entre nous. Le vouvoiement n'est pas du formalisme, c'est notre manière de garder la juste distance professionnelle.",
  },
  {
    id: 'solopreneur',
    title: "Solopreneur d'esprit",
    description:
      "Chaque personne dans l'équipe doit comprendre l'impact business de son travail. Pas de silo entre tech, métier et commercial. Tout le monde lit les retours utilisateurs.",
  },
] as const
