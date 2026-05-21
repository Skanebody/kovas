/**
 * KOVAS — Static catalog des contenus d'upsell (titres, bénéfices, prix).
 *
 * Source de vérité côté UI pour les <UpsellModal>, <UpsellEmptyState>,
 * <DiscoverDrawer> et l'email mensuel.
 *
 * Pourquoi un catalogue dédié plutôt que `pricing-plans.ts` :
 *   - on a besoin de bénéfices "lisibles" courts (3 bullets)
 *   - on a besoin d'un trial label normalisé (14j)
 *   - on a besoin d'un CTA primary canonique par cible
 *   - on a besoin d'une icône lucide cohérente UI
 */

import type { AddonCode, AddonPackCode, PricingPlanCode } from '@/lib/pricing-plans'

export type UpsellTargetCode = AddonCode | AddonPackCode | PricingPlanCode

export type UpsellCategory = 'productivity' | 'compliance' | 'commercial' | 'cabinet'

export interface UpsellCatalogEntry {
  /** Code identifiant l'add-on / pack / tier. */
  code: UpsellTargetCode
  /** "addon" | "pack" | "tier_upgrade". */
  kind: 'addon' | 'pack' | 'tier_upgrade'
  /** Titre principal (cards / drawers). */
  title: string
  /** Description courte 1-2 phrases factuelles, jamais marketing agressif. */
  description: string
  /** 3 bullets bénéfices (ton sobre, jamais "WOW"). */
  benefits: readonly string[]
  /** Label prix (ex. "22€/mo HT"). */
  priceLabel: string
  /** Label essai (ex. "14 jours gratuits"). */
  trialLabel: string
  /** CTA primaire. */
  ctaPrimary: string
  /** Catégorie (sert au tri dans le drawer "Tout le catalogue"). */
  category: UpsellCategory
  /** Nom d'icône lucide (string, mappé côté composant). */
  icon: string
}

export const UPSELL_CATALOG: Record<UpsellTargetCode, UpsellCatalogEntry> = {
  // ─────────── Add-ons ───────────
  facturx_ppf: {
    code: 'facturx_ppf',
    kind: 'addon',
    title: 'Facturation Factur-X PPF',
    description:
      "Émission de factures électroniques conformes à l'obligation 2027 (PPF Iopole, format Factur-X 1.0).",
    benefits: [
      'Conformité PPF Factur-X 1.0 dès maintenant',
      '100 factures incluses chaque mois',
      'XML CII + PDF/A-3 générés automatiquement',
    ],
    priceLabel: '22€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'compliance',
    icon: 'Receipt',
  },
  pennylane_sync: {
    code: 'pennylane_sync',
    kind: 'addon',
    title: 'Synchronisation Pennylane',
    description:
      'Export automatique de vos missions et factures vers votre compte Pennylane sans ressaisie.',
    benefits: [
      'Sync 1 sens missions + factures temps réel',
      'Mapping comptable préconfiguré (701/411/445)',
      'Aucune ressaisie : gain ~2h / mois en compta',
    ],
    priceLabel: '15€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'productivity',
    icon: 'RefreshCw',
  },
  signatures_eidas: {
    code: 'signatures_eidas',
    kind: 'addon',
    title: 'Signatures électroniques eIDAS',
    description:
      'Signature qualifiée Yousign opposable juridiquement, intégrée à vos exports de rapports.',
    benefits: [
      'Signature eIDAS Yousign opposable',
      '5 signatures incluses / mois (puis 4€/sig)',
      'Intégration directe sur PDF rapport',
    ],
    priceLabel: '18€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'compliance',
    icon: 'PenLine',
  },
  bilingual_reports: {
    code: 'bilingual_reports',
    kind: 'addon',
    title: 'Rapports bilingues FR/EN',
    description:
      'Traduction professionnelle FR/EN de vos rapports de diagnostic pour clients internationaux.',
    benefits: [
      'Traduction pro pré-validée juridique FR/EN',
      '5 rapports inclus / mois (puis 8€/rapport)',
      'Mise en page miroir identique au FR',
    ],
    priceLabel: '19€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'commercial',
    icon: 'Languages',
  },
  sms_reminders: {
    code: 'sms_reminders',
    kind: 'addon',
    title: 'SMS rappel client J-1',
    description: 'Rappel SMS automatique la veille de chaque visite (France métropolitaine).',
    benefits: [
      'SMS rappel automatique veille de RDV',
      '50 SMS inclus / mois (puis 0,25€/SMS)',
      'Réduit le taux de no-show de ~30%',
    ],
    priceLabel: '12€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'commercial',
    icon: 'MessageCircle',
  },
  community_pro: {
    code: 'community_pro',
    kind: 'addon',
    title: 'Communauté Pro',
    description: 'Accès au cercle privé des diagnostiqueurs KOVAS : Q&A métier, jurisprudence, sourcing.',
    benefits: [
      'Communauté privée 250+ diagnostiqueurs FR',
      'Bibliothèque jurisprudence + cas concrets',
      'Q&A métier sous 24h en moyenne',
    ],
    priceLabel: '9€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'commercial',
    icon: 'Users',
  },
  analytics_advanced: {
    code: 'analytics_advanced',
    kind: 'addon',
    title: 'Analytics avancés cabinet',
    description: 'Tableaux de bord détaillés (KPI, benchmarks régionaux, exports analytiques).',
    benefits: [
      'KPI cabinet 30+ métriques détaillées',
      'Benchmarks régionaux anonymisés',
      'Exports CSV / XLSX pour comptable',
    ],
    priceLabel: '24€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'cabinet',
    icon: 'TrendingUp',
  },
  regulatory_watch: {
    code: 'regulatory_watch',
    kind: 'addon',
    title: 'Veille IA hebdomadaire',
    description:
      'Digest IA hebdomadaire des évolutions réglementaires du diagnostic immobilier français.',
    benefits: [
      'Digest IA tous les lundis 8h CET',
      'Couvre ADEME / DPE / Carrez / ERP / amiante',
      'Lien sources officielles + résumé exécutif',
    ],
    priceLabel: '12€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'compliance',
    icon: 'Bell',
  },
  cockpit_ademe_m2: {
    code: 'cockpit_ademe_m2',
    kind: 'addon',
    title: 'Cockpit ADEME Mode 2',
    description: 'Pilotage avancé des envois ADEME : lots, retours, anomalies, corrections groupées.',
    benefits: [
      'Pilotage lots + corrections groupées',
      'Détection anomalies et retours ADEME auto',
      'Historique 36 mois + replay correctif',
    ],
    priceLabel: '15€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'cabinet',
    icon: 'Radar',
  },

  // ─────────── Packs ───────────
  pack_growth: {
    code: 'pack_growth',
    kind: 'pack',
    title: 'Pack Croissance',
    description: 'Veille IA hebdo + Cockpit ADEME M2 + Communauté Pro à prix groupé.',
    benefits: [
      'Veille IA + Cockpit ADEME M2 + Communauté',
      "Économie ~7€/mo vs achat séparé",
      'Activable / désactivable mensuellement',
    ],
    priceLabel: '29€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'compliance',
    icon: 'Sparkles',
  },
  pack_cabinet: {
    code: 'pack_cabinet',
    kind: 'pack',
    title: 'Pack Cabinet',
    description:
      'Analytics avancés + Pennylane + Factur-X PPF (100 factures incluses) pour cabinets en croissance.',
    benefits: [
      'Analytics + Pennylane + Factur-X PPF',
      "Économie ~12€/mo vs achat séparé",
      '100 factures Factur-X incluses',
    ],
    priceLabel: '49€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'cabinet',
    icon: 'Briefcase',
  },
  pack_international: {
    code: 'pack_international',
    kind: 'pack',
    title: 'Pack International',
    description:
      '3 signatures eIDAS + 3 rapports bilingues FR/EN inclus chaque mois pour vos clients étrangers.',
    benefits: [
      'Signatures eIDAS + Rapports bilingues',
      "Économie ~15€/mo vs achat séparé",
      '3 signatures et 3 rapports inclus',
    ],
    priceLabel: '25€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'commercial',
    icon: 'Globe',
  },

  // ─────────── Tiers (upgrade) ───────────
  essential: {
    code: 'essential',
    kind: 'tier_upgrade',
    title: 'Forfait Essential',
    description: 'Pour démarrer ou tester votre flux KOVAS — 30 missions, 1h Whisper, 5 Go.',
    benefits: ['30 missions / mois', '1h Whisper', '5 Go stockage'],
    priceLabel: '19€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Essential',
    category: 'productivity',
    icon: 'Layers',
  },
  decouverte: {
    code: 'decouverte',
    kind: 'tier_upgrade',
    title: 'Forfait Découverte',
    description: 'Le tier d’entrée pour valider le gain de temps — 60 missions, 5h Whisper.',
    benefits: ['60 missions / mois', '5h Whisper', 'Templates pièces + check-lists'],
    priceLabel: '29€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Découverte',
    category: 'productivity',
    icon: 'Layers',
  },
  pro: {
    code: 'pro',
    kind: 'tier_upgrade',
    title: 'Forfait Pro',
    description:
      'Le choix recommandé pour les diagnostiqueurs actifs — 150 missions, 10h Whisper, Vision IA, Cockpit ADEME, Analytics.',
    benefits: [
      '150 missions / mois + 10h Whisper',
      'Vision IA équipements (100/mo)',
      'Cockpit ADEME M1 + Analytics + Annuaire Premium',
    ],
    priceLabel: '39€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Pro',
    category: 'productivity',
    icon: 'ArrowUpRight',
  },
  all_inclusive: {
    code: 'all_inclusive',
    kind: 'tier_upgrade',
    title: 'Forfait All Inclusive',
    description: 'Pour les power users en activité soutenue — 250 missions, 25h Whisper, accès Phase 2.',
    benefits: [
      '250 missions + 25h Whisper + Vision IA 200/mo',
      '80 Go stockage',
      'Accès anticipé fonctionnalités Phase 2',
    ],
    priceLabel: '99€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur All Inclusive',
    category: 'productivity',
    icon: 'ArrowUpRight',
  },
  cabinet: {
    code: 'cabinet',
    kind: 'tier_upgrade',
    title: 'Forfait Cabinet',
    description:
      "Jusqu'à 3 utilisateurs, 400 missions, multi-rôles et account manager dédié.",
    benefits: [
      '3 utilisateurs inclus + multi-rôles',
      '400 missions + 40h Whisper',
      'Account manager dédié',
    ],
    priceLabel: '149€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Cabinet',
    category: 'cabinet',
    icon: 'Users2',
  },

  // ─────────── V3 — Add-ons préfixés (à compléter B3) ───────────
  addon_signatures_eidas: {
    code: 'addon_signatures_eidas',
    kind: 'addon',
    title: 'Signatures électroniques eIDAS',
    description: 'Signature qualifiée Yousign opposable juridiquement.',
    benefits: [
      'Signature eIDAS Yousign opposable',
      '10 signatures incluses / mois (puis 4€/sig)',
      'Intégration directe sur PDF rapport',
    ],
    priceLabel: '19€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'compliance',
    icon: 'PenLine',
  },
  addon_pennylane_sync: {
    code: 'addon_pennylane_sync',
    kind: 'addon',
    title: 'Synchronisation Pennylane',
    description: 'Export automatique missions + factures vers Pennylane.',
    benefits: [
      'Sync missions + factures temps réel',
      'Mapping comptable préconfiguré',
      'Gain ~2h / mois sur la compta',
    ],
    priceLabel: '9€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'productivity',
    icon: 'RefreshCw',
  },
  addon_sms_reminders: {
    code: 'addon_sms_reminders',
    kind: 'addon',
    title: 'SMS rappel client J-1',
    description: 'Rappel SMS automatique la veille de chaque visite.',
    benefits: [
      'SMS rappel automatique veille de RDV',
      '50 SMS inclus / mois (puis 0,25€/SMS)',
      'Réduit le taux de no-show de ~30%',
    ],
    priceLabel: '9€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'commercial',
    icon: 'MessageCircle',
  },
  addon_community_pro: {
    code: 'addon_community_pro',
    kind: 'addon',
    title: 'Communauté Pro',
    description: 'Accès au cercle privé des diagnostiqueurs KOVAS.',
    benefits: [
      'Communauté privée 250+ diagnostiqueurs FR',
      'Bibliothèque jurisprudence + cas concrets',
      'Q&A métier sous 24h en moyenne',
    ],
    priceLabel: '9€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'commercial',
    icon: 'Users',
  },

  // ─────────── V3 — Logiciel plans (à compléter B3) ───────────
  logiciel_free: {
    code: 'logiciel_free',
    kind: 'tier_upgrade',
    title: 'Essai 14 jours',
    description: 'Pour découvrir KOVAS 360 sans CB.',
    benefits: ['30 missions sur 14 jours', '1h Whisper', 'Exports universels'],
    priceLabel: 'Gratuit',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai',
    category: 'productivity',
    icon: 'Layers',
  },
  logiciel_starter: {
    code: 'logiciel_starter',
    kind: 'tier_upgrade',
    title: 'Starter',
    description: 'Démarrer en solo sur les diagnostics standards.',
    benefits: ['60 missions / mois', '5h Whisper', '12 Go stockage'],
    priceLabel: '29€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Starter',
    category: 'productivity',
    icon: 'Layers',
  },
  logiciel_active: {
    code: 'logiciel_active',
    kind: 'tier_upgrade',
    title: 'Active',
    description: 'Le choix recommandé pour les diagnostiqueurs en activité.',
    benefits: ['150 missions / mois + 10h Whisper', 'Vision IA (100/mo)', 'Templates + support 4h'],
    priceLabel: '59€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Active',
    category: 'productivity',
    icon: 'ArrowUpRight',
  },
  logiciel_cabinet: {
    code: 'logiciel_cabinet',
    kind: 'tier_upgrade',
    title: 'Cabinet',
    description: "Jusqu'à 3 utilisateurs, audit trail, Factur-X inclus.",
    benefits: ['400 missions / mois — 3 users', '40h Whisper + Vision IA 600/mo', 'Account manager dédié'],
    priceLabel: '149€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Cabinet',
    category: 'cabinet',
    icon: 'Users2',
  },
  logiciel_enterprise: {
    code: 'logiciel_enterprise',
    kind: 'tier_upgrade',
    title: 'Enterprise',
    description: 'API publique + SLA 4h + onboarding white-glove.',
    benefits: ['Missions illimitées (fair-use)', '80h Whisper + Vision IA 1500/mo', 'API + multi-users 10+'],
    priceLabel: '299€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Enterprise',
    category: 'cabinet',
    icon: 'Briefcase',
  },

  // ─────────── Grandfather (back-office uniquement, jamais affiché public) ───────────
  essential_legacy: {
    code: 'essential_legacy',
    kind: 'tier_upgrade',
    title: 'Essential (héritage)',
    description: 'Plan grandfather E2c — prix 19€ préservé à vie.',
    benefits: ['30 missions / mois', '1h Whisper', '5 Go stockage'],
    priceLabel: '19€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Essential',
    category: 'productivity',
    icon: 'Layers',
  },
  decouverte_legacy: {
    code: 'decouverte_legacy',
    kind: 'tier_upgrade',
    title: 'Découverte (héritage)',
    description: 'Plan grandfather E2c — prix 29€ préservé à vie.',
    benefits: ['60 missions / mois', '5h Whisper', '12 Go stockage'],
    priceLabel: '29€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Découverte',
    category: 'productivity',
    icon: 'Layers',
  },
  pro_legacy: {
    code: 'pro_legacy',
    kind: 'tier_upgrade',
    title: 'Pro (héritage)',
    description: 'Plan grandfather E2c — prix 39€ préservé à vie.',
    benefits: ['150 missions / mois', '10h Whisper', 'Vision IA 100/mo'],
    priceLabel: '39€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Pro',
    category: 'productivity',
    icon: 'ArrowUpRight',
  },
  all_inclusive_legacy: {
    code: 'all_inclusive_legacy',
    kind: 'tier_upgrade',
    title: 'All Inclusive (héritage)',
    description: 'Plan grandfather E2c — prix 99€ préservé à vie.',
    benefits: ['250 missions + 25h Whisper', 'Vision IA 200/mo', '80 Go stockage'],
    priceLabel: '99€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur All Inclusive',
    category: 'productivity',
    icon: 'ArrowUpRight',
  },
  cabinet_legacy: {
    code: 'cabinet_legacy',
    kind: 'tier_upgrade',
    title: 'Cabinet (héritage)',
    description: 'Plan grandfather E2c — prix 199€ préservé à vie (400 missions, 3 users, surplus 0,80 €/mission).',
    benefits: ['400 missions — 3 users', '40h Whisper', 'Account manager dédié'],
    priceLabel: '199€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Cabinet',
    category: 'cabinet',
    icon: 'Users2',
  },
  standard_legacy: {
    code: 'standard_legacy',
    kind: 'tier_upgrade',
    title: 'Standard (héritage)',
    description: 'Plan grandfather E2c — 59 € / 60 missions / surplus 1,50 €.',
    benefits: ['60 missions / mois', '10h Whisper', 'Surplus 1,50 €/mission'],
    priceLabel: '59€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Solo Pro',
    category: 'productivity',
    icon: 'Layers',
  },
  volume_legacy: {
    code: 'volume_legacy',
    kind: 'tier_upgrade',
    title: 'Volume (héritage)',
    description: 'Plan grandfather E2c — 99 € / 150 missions / surplus 1 €.',
    benefits: ['150 missions / mois', '20h Whisper', 'Surplus 1 €/mission'],
    priceLabel: '99€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Cabinet',
    category: 'productivity',
    icon: 'ArrowUpRight',
  },
  founder_legacy: {
    code: 'founder_legacy',
    kind: 'tier_upgrade',
    title: 'Founder à vie',
    description: 'Plan bêta-testeur founder — 49 € / 70 missions / surplus 1 € préservé à vie.',
    benefits: ['70 missions / mois', '10h Whisper', 'Badge Founder + accès anticipé Phase 2'],
    priceLabel: '49€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Plan Founder actif',
    category: 'productivity',
    icon: 'Star',
  },

  // ─────────── V4 — Add-ons officiels (grille 2026-05-22) ───────────
  addon_extra_user: {
    code: 'addon_extra_user',
    kind: 'addon',
    title: 'Utilisateur supplémentaire',
    description: 'Ajouter un utilisateur au plan Cabinet ou Cabinet+ (jusqu’à 7 max).',
    benefits: [
      '1 utilisateur supplémentaire facturé 19 €/mo',
      'Réservé aux plans Cabinet et Cabinet+',
      'Gestion des rôles + audit trail',
    ],
    priceLabel: '19€/mo HT/user',
    trialLabel: 'Sans essai',
    ctaPrimary: 'Ajouter un utilisateur',
    category: 'cabinet',
    icon: 'UserPlus',
  },
  addon_ia_volume: {
    code: 'addon_ia_volume',
    kind: 'addon',
    title: 'Volume IA et Vocal',
    description: 'Capacité Whisper et Vision IA étendue (réservé Solo Pro et plus).',
    benefits: [
      'Heures Whisper supplémentaires',
      'Vision IA étendue',
      'Réservé aux plans Solo Pro et plus',
    ],
    priceLabel: '19€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'productivity',
    icon: 'Sparkles',
  },
  addon_conformite_avancee: {
    code: 'addon_conformite_avancee',
    kind: 'addon',
    title: 'Pack Conformité Avancée',
    description: 'Factur-X PPF + Cockpit ADEME M2 + signatures eIDAS incluses (Solo Pro et plus).',
    benefits: [
      'Factur-X PPF Iopole inclus',
      'Cockpit ADEME M2 (envoi direct)',
      'Signatures eIDAS incluses',
    ],
    priceLabel: '39€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'compliance',
    icon: 'ShieldCheck',
  },
  addon_international: {
    code: 'addon_international',
    kind: 'addon',
    title: 'Pack International',
    description: 'Rapports bilingues FR/EN + multi-devise + zones géographiques étendues.',
    benefits: [
      'Rapports bilingues FR/EN',
      'Multi-devise (EUR / CHF / GBP)',
      'Zones géographiques étendues (BE/LU/CH)',
    ],
    priceLabel: '25€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Démarrer mon essai 14j',
    category: 'commercial',
    icon: 'Globe',
  },

  // ─────────── V4 — Logiciel plans officiels (grille 2026-05-22) ───────────
  essai: {
    code: 'essai',
    kind: 'tier_upgrade',
    title: 'Essai gratuit 30 jours',
    description: 'Pour découvrir KOVAS 360 sans CB. Débit auto vers Solo Light à J30.',
    benefits: ['30 missions max', '1h Whisper inclus', 'Exports universels'],
    priceLabel: 'Gratuit',
    trialLabel: '30 jours gratuits',
    ctaPrimary: 'Démarrer mon essai',
    category: 'productivity',
    icon: 'Layers',
  },
  solo_light: {
    code: 'solo_light',
    kind: 'tier_upgrade',
    title: 'Solo Light',
    description: 'Démarrer en solo sur les diagnostics standards.',
    benefits: ['60 missions / mois', '5h Whisper', '12 Go stockage'],
    priceLabel: '29€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Solo Light',
    category: 'productivity',
    icon: 'Layers',
  },
  solo_pro: {
    code: 'solo_pro',
    kind: 'tier_upgrade',
    title: 'Solo Pro',
    description: 'Le choix recommandé pour les diagnostiqueurs en activité.',
    benefits: ['150 missions / mois + 10h Whisper', 'Vision IA (100/mo)', 'Templates + support 4h'],
    priceLabel: '59€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Solo Pro',
    category: 'productivity',
    icon: 'ArrowUpRight',
  },
  cabinet_plus: {
    code: 'cabinet_plus',
    kind: 'tier_upgrade',
    title: 'Cabinet+',
    description: 'API publique + SLA 4h + onboarding white-glove (jusqu’à 7 utilisateurs).',
    benefits: ['Missions illimitées (fair-use)', '80h Whisper + Vision IA 1500/mo', 'API + jusqu’à 7 utilisateurs'],
    priceLabel: '299€/mo HT',
    trialLabel: '14 jours gratuits',
    ctaPrimary: 'Passer sur Cabinet+',
    category: 'cabinet',
    icon: 'Briefcase',
  },
}

export function getUpsellEntry(code: string): UpsellCatalogEntry | null {
  return (UPSELL_CATALOG as Record<string, UpsellCatalogEntry>)[code] ?? null
}
