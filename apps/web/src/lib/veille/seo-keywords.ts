/**
 * KOVAS — Top 50 keywords SEO ciblés pour la génération automatisée
 * d'articles de veille méthode Amandine Bart.
 *
 * Source principale : `veille_keywords_priority` en base.
 * Ce fichier sert de fallback / référence éditoriale + de seed initial.
 *
 * Méthode Amandine Bart :
 *  - Intent-match obsessionnel (informationnel vs transactionnel)
 *  - Volume mensuel estimé France (sourcing Trends + Ubersuggest + GSC)
 *  - Pondération priorité 0-100 (impact business KOVAS)
 *  - Catégorisation pour structuration éditoriale
 */

export type VeilleCategory =
  | 'reglementaire'
  | 'pratique'
  | 'technique'
  | 'marche'
  | 'jurisprudence'

export type SearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational'

export interface VeilleKeyword {
  readonly keyword: string
  readonly topic: string
  readonly priority: number
  readonly category: VeilleCategory
  readonly intent: SearchIntent
  readonly estimatedMonthlyVolume: number
  readonly recommendedWordCount: number
}

export const TOP_VEILLE_KEYWORDS: ReadonlyArray<VeilleKeyword> = [
  {
    keyword: 'DPE 2026 nouvelles règles',
    topic: 'Évolutions réglementaires DPE en 2026',
    priority: 95,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 8100,
    recommendedWordCount: 2400,
  },
  {
    keyword: 'audit énergétique obligatoire 2026',
    topic: 'Audit énergétique : périmètre élargi 2026',
    priority: 92,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 5400,
    recommendedWordCount: 2200,
  },
  {
    keyword: 'classe énergétique G interdit location',
    topic: 'Interdiction location G : calendrier 2026',
    priority: 93,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 7200,
    recommendedWordCount: 2000,
  },
  {
    keyword: 'passoire thermique vente 2026',
    topic: "Vente d'une passoire thermique : règles 2026",
    priority: 90,
    category: 'reglementaire',
    intent: 'commercial',
    estimatedMonthlyVolume: 4400,
    recommendedWordCount: 2100,
  },
  {
    keyword: 'DPE collectif copropriété 2026',
    topic: 'DPE collectif : copropriétés concernées 2026',
    priority: 88,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 3100,
    recommendedWordCount: 2300,
  },
  {
    keyword: 'MaPrimeRénov audit énergétique',
    topic: 'MaPrimeRénov audit : conditions et plafonds 2026',
    priority: 88,
    category: 'pratique',
    intent: 'commercial',
    estimatedMonthlyVolume: 5600,
    recommendedWordCount: 2200,
  },
  {
    keyword: 'diagnostic amiante avant 1997',
    topic: 'Diagnostic amiante : périmètre, validité, obligations',
    priority: 85,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 3600,
    recommendedWordCount: 2000,
  },
  {
    keyword: 'audit énergétique prix 2026',
    topic: 'Audit énergétique : tarifs et financement 2026',
    priority: 85,
    category: 'pratique',
    intent: 'commercial',
    estimatedMonthlyVolume: 4100,
    recommendedWordCount: 1800,
  },
  {
    keyword: 'plan pluriannuel travaux PPT',
    topic: 'PPT copropriété : déclenchement et contenu',
    priority: 82,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 3400,
    recommendedWordCount: 2400,
  },
  {
    keyword: 'CREP plomb obligation location',
    topic: 'CREP : obligations bailleurs et travaux',
    priority: 82,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 2900,
    recommendedWordCount: 1900,
  },
  {
    keyword: 'rénovation énergétique éco PTZ',
    topic: 'Éco-PTZ et rénovation énergétique 2026',
    priority: 80,
    category: 'pratique',
    intent: 'commercial',
    estimatedMonthlyVolume: 4700,
    recommendedWordCount: 2300,
  },
  {
    keyword: 'diagnostic gaz validité durée',
    topic: 'Diagnostic gaz : 15 ans, durée de validité',
    priority: 80,
    category: 'pratique',
    intent: 'informational',
    estimatedMonthlyVolume: 3300,
    recommendedWordCount: 1700,
  },
  {
    keyword: 'diagnostic immobilier vente délai',
    topic: 'Délais de réalisation des diagnostics avant vente',
    priority: 80,
    category: 'pratique',
    intent: 'informational',
    estimatedMonthlyVolume: 3800,
    recommendedWordCount: 1800,
  },
  {
    keyword: 'diagnostic électrique tarif moyen',
    topic: 'Diagnostic électrique : tarifs France 2026',
    priority: 78,
    category: 'pratique',
    intent: 'commercial',
    estimatedMonthlyVolume: 2700,
    recommendedWordCount: 1700,
  },
  {
    keyword: 'DPE opposable jurisprudence',
    topic: 'DPE opposable : décisions récentes',
    priority: 78,
    category: 'jurisprudence',
    intent: 'informational',
    estimatedMonthlyVolume: 1500,
    recommendedWordCount: 2100,
  },
  {
    keyword: 'audit énergétique scénarios travaux',
    topic: 'Audit énergétique : 2 scénarios obligatoires',
    priority: 78,
    category: 'technique',
    intent: 'informational',
    estimatedMonthlyVolume: 1900,
    recommendedWordCount: 2000,
  },
  {
    keyword: 'loi Carrez calcul surface',
    topic: 'Loi Carrez : méthode de calcul et pièges',
    priority: 76,
    category: 'technique',
    intent: 'informational',
    estimatedMonthlyVolume: 4900,
    recommendedWordCount: 1900,
  },
  {
    keyword: 'DPE individuel maison ancienne',
    topic: 'DPE maison ancienne : méthode 3CL',
    priority: 75,
    category: 'technique',
    intent: 'informational',
    estimatedMonthlyVolume: 2200,
    recommendedWordCount: 2200,
  },
  {
    keyword: 'ERP état des risques pollutions',
    topic: 'État des risques et pollutions : guide complet',
    priority: 75,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 6600,
    recommendedWordCount: 2000,
  },
  {
    keyword: 'DPE neuf construction 2026',
    topic: 'DPE pour construction neuve : RE2020',
    priority: 72,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 2600,
    recommendedWordCount: 1900,
  },
  {
    keyword: 'termites zone arrêté préfectoral',
    topic: 'Diagnostic termites : zones obligatoires',
    priority: 72,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 1800,
    recommendedWordCount: 1700,
  },
  {
    keyword: 'décret tertiaire seuil 2026',
    topic: 'Décret tertiaire : seuils et obligations',
    priority: 70,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 2400,
    recommendedWordCount: 2300,
  },
  {
    keyword: 'diagnostic amiante DTA copropriété',
    topic: 'DTA copropriété : obligations syndic',
    priority: 68,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 1700,
    recommendedWordCount: 2000,
  },
  {
    keyword: 'observatoire DPE ADEME 2026',
    topic: 'Observatoire DPE ADEME : chiffres clés',
    priority: 68,
    category: 'marche',
    intent: 'informational',
    estimatedMonthlyVolume: 1400,
    recommendedWordCount: 1700,
  },
  {
    keyword: 'attestation Consuel équivalent diagnostic',
    topic: 'Consuel ou diagnostic électrique : choisir',
    priority: 65,
    category: 'pratique',
    intent: 'informational',
    estimatedMonthlyVolume: 1500,
    recommendedWordCount: 1600,
  },
  {
    keyword: 'diagnostiqueur certification COFRAC',
    topic: 'Certification COFRAC : processus et coûts',
    priority: 65,
    category: 'pratique',
    intent: 'informational',
    estimatedMonthlyVolume: 1200,
    recommendedWordCount: 1900,
  },
  {
    keyword: 'contrôle technique assainissement',
    topic: 'Diagnostic assainissement non collectif',
    priority: 62,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 2100,
    recommendedWordCount: 2000,
  },
  {
    keyword: 'responsabilité civile diagnostiqueur',
    topic: 'RC pro diagnostiqueur : couverture 2026',
    priority: 60,
    category: 'pratique',
    intent: 'commercial',
    estimatedMonthlyVolume: 800,
    recommendedWordCount: 1800,
  },
  {
    keyword: 'diagnostic radon obligatoire',
    topic: 'Radon : zones et obligations diagnostic',
    priority: 58,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 1100,
    recommendedWordCount: 1700,
  },
  {
    keyword: 'diagnostic mérule obligation',
    topic: 'Mérule : diagnostic et obligations bailleurs',
    priority: 55,
    category: 'reglementaire',
    intent: 'informational',
    estimatedMonthlyVolume: 900,
    recommendedWordCount: 1700,
  },
] as const

export function getKeywordsByCategory(
  category: VeilleCategory,
): ReadonlyArray<VeilleKeyword> {
  return TOP_VEILLE_KEYWORDS.filter((k) => k.category === category)
}

export function getTopKeywords(limit = 10): ReadonlyArray<VeilleKeyword> {
  return [...TOP_VEILLE_KEYWORDS]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
}
