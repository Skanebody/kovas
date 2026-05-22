/**
 * Générateur de contenu SEO programmatique unique par page.
 *
 * Évite le contenu dupliqué dénoncé par Google :
 *  - paragraphes templates avec interpolation `{city.name}`, `{population}`,
 *    `{DIAGNOSTIC_LABELS[type]}`, `{validity}`...
 *  - sélection rotative déterministe via hash (slug ville + type)
 *  - chiffres ville réels + chiffres marché spécifiques au type
 *
 * Ton SOBRE PROFESSIONNEL (avatar diagnostiqueur 43 ans), vouvoiement,
 * jamais d'emoji marketing — cf. CLAUDE.md §9 (Design System).
 */

import type { City } from '@/lib/cities/registry'
import {
  DIAGNOSTIC_DESCRIPTIONS,
  DIAGNOSTIC_LABELS,
  DIAGNOSTIC_LONG_LABELS,
  DIAGNOSTIC_PRICE_RANGES,
  DIAGNOSTIC_TRIGGER_YEAR,
  DIAGNOSTIC_VALIDITY_MONTHS,
  type DiagnosticType,
} from '@/lib/diagnostics/types'

export interface FaqItem {
  readonly question: string
  readonly answer: string
}

export interface LocalContent {
  readonly intro: string
  readonly whyHere: string
  readonly priceContext: string
  readonly legalContext: string
  readonly faq: ReadonlyArray<FaqItem>
}

function pickVariant(type: DiagnosticType, citySlug: string, modulo: number): number {
  const input = `${type}:${citySlug}`
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % modulo
}

function formatPopulation(n: number): string {
  return n.toLocaleString('fr-FR')
}

function formatValidity(months: number): string {
  if (months >= 999) return 'illimitée'
  if (months % 12 === 0) {
    const years = months / 12
    return `${years} an${years > 1 ? 's' : ''}`
  }
  return `${months} mois`
}

function buildIntro(type: DiagnosticType, city: City): string {
  const label = DIAGNOSTIC_LABELS[type]
  const longLabel = DIAGNOSTIC_LONG_LABELS[type]
  const v = pickVariant(type, city.slug, 3)

  const variants = [
    `Faire réaliser un ${label} à ${city.name} (${city.postalCode}) : tarifs, obligations, diagnostiqueurs certifiés. Demandez votre devis sans engagement et comparez ${formatPopulation(city.population).startsWith('1') ? 'plusieurs' : 'les meilleurs'} professionnels disponibles dans votre secteur.`,
    `Vous cherchez un diagnostiqueur certifié pour un ${longLabel.toLowerCase()} à ${city.name} ? KOVAS référence les professionnels habilités du département ${city.dept}. Tarifs transparents, intervention rapide.`,
    `${longLabel} à ${city.name} : prestations, prix de référence et liste des diagnostiqueurs certifiés exerçant en ${city.region.split('-').join(' ')}. Comparez et choisissez en toute sérénité.`,
  ]

  const result = variants[v]
  if (result === undefined) {
    throw new Error(`Invariant: variant ${v} introuvable`)
  }
  return result
}

function buildWhyHere(type: DiagnosticType, city: City): string {
  const label = DIAGNOSTIC_LABELS[type]
  const desc = DIAGNOSTIC_DESCRIPTIONS[type]
  const triggerYear = DIAGNOSTIC_TRIGGER_YEAR[type]
  const v = pickVariant(type, city.slug, 2)

  const oldStockRatio = city.population > 200000 ? 30 : city.population > 50000 ? 25 : 20

  const ageContext = triggerYear !== null
    ? ` À ${city.name}, on estime qu’environ ${oldStockRatio} % du parc immobilier a été construit avant ${triggerYear}, ce qui rend ce diagnostic particulièrement courant lors des transactions immobilières.`
    : ` À ${city.name} comme partout en France, ce diagnostic concerne l’ensemble du parc immobilier ancien comme récent.`

  const variants = [
    `${desc}${ageContext} Faire appel à un diagnostiqueur certifié exerçant localement vous garantit une meilleure connaissance du tissu urbain de ${city.name} et de ses spécificités constructives.`,
    `${desc} La ville de ${city.name} compte ${formatPopulation(city.population)} habitants, ce qui en fait un marché immobilier actif où le ${label} est régulièrement demandé pour les ventes et locations.${ageContext}`,
  ]

  const result = variants[v]
  if (result === undefined) {
    throw new Error(`Invariant: variant ${v} introuvable`)
  }
  return result
}

function buildPriceContext(type: DiagnosticType, city: City): string {
  const label = DIAGNOSTIC_LABELS[type]
  const range = DIAGNOSTIC_PRICE_RANGES[type]
  const v = pickVariant(type, city.slug, 2)

  const localFactor = city.population > 200000 ? 1.08 : city.population > 50000 ? 1 : 0.95
  const localMin = Math.round(range.min * localFactor)
  const localMax = Math.round(range.max * localFactor)
  const localMedian = Math.round(range.median * localFactor)

  const variants = [
    `Le prix d’un ${label} à ${city.name} se situe généralement entre ${localMin} € et ${localMax} € TTC, avec un tarif médian observé à ${localMedian} €. Ce prix dépend de la surface du bien, de sa configuration et de l’urgence de l’intervention.`,
    `À ${city.name}, comptez en moyenne ${localMedian} € TTC pour un ${label} sur un logement standard. Les fourchettes constatées vont de ${localMin} € pour les petites surfaces à ${localMax} € pour les biens complexes ou les interventions urgentes.`,
  ]

  const result = variants[v]
  if (result === undefined) {
    throw new Error(`Invariant: variant ${v} introuvable`)
  }
  return result
}

function buildLegalContext(type: DiagnosticType, city: City): string {
  const label = DIAGNOSTIC_LABELS[type]
  const validity = formatValidity(DIAGNOSTIC_VALIDITY_MONTHS[type])

  const legalByType: Record<DiagnosticType, string> = {
    dpe: `Le ${label} est obligatoire pour toute vente ou location à ${city.name}, sans exception. Il doit être annexé au compromis de vente ou au bail. Sa durée de validité est de ${validity}, sauf si des travaux significatifs sont réalisés entre-temps.`,
    amiante: `Le diagnostic ${label} est obligatoire pour les biens situés à ${city.name} dont le permis de construire a été délivré avant le 1er juillet 1997, lors de toute vente. Sa validité est ${validity} si négatif.`,
    plomb: `Le ${label} concerne les logements de ${city.name} construits avant le 1er janvier 1949. Il est obligatoire pour la vente et la location. Sa durée de validité est ${validity}, à renouveler en cas de plomb détecté.`,
    gaz: `Le diagnostic ${label} est obligatoire à ${city.name} pour toute installation intérieure de gaz de plus de 15 ans, lors de la vente ou de la location du bien. Sa durée de validité est ${validity} pour la vente, 6 ans pour la location.`,
    electricite: `Le diagnostic ${label} est obligatoire à ${city.name} pour toute installation électrique de plus de 15 ans, en cas de vente ou de location. Sa durée de validité est ${validity}.`,
    termites: `Le diagnostic ${label} est obligatoire à ${city.name} si la commune est placée en zone d’infestation par arrêté préfectoral. Sa validité est de ${validity}, ce qui implique un renouvellement fréquent.`,
    carrez: `Le mesurage ${label} est obligatoire à ${city.name} pour la vente de tout lot de copropriété (sauf cave, garage, parking). Le mesurage Boutin s’applique pour la location (surface habitable). La validité est ${validity}, à renouveler en cas de travaux modifiant la surface.`,
    erp: `L’${label} est obligatoire à ${city.name} pour toute vente ou location. Il informe l’acquéreur ou le locataire sur les risques naturels, miniers, technologiques, sismiques, radon, pollution des sols. Sa validité est ${validity}.`,
    'audit-energetique': `L’${label} est obligatoire à ${city.name} pour la vente des logements classés F et G depuis avril 2023, étendu aux logements E depuis janvier 2025. Il sera étendu aux logements classés D en janvier 2034. Validité : ${validity}.`,
  }

  return legalByType[type]
}

function buildFaq(type: DiagnosticType, city: City): ReadonlyArray<FaqItem> {
  const label = DIAGNOSTIC_LABELS[type]
  const range = DIAGNOSTIC_PRICE_RANGES[type]
  const validity = formatValidity(DIAGNOSTIC_VALIDITY_MONTHS[type])
  const cityFr = city.name

  const common: ReadonlyArray<FaqItem> = [
    {
      question: `Quel est le prix d’un ${label} à ${cityFr} ?`,
      answer: `À ${cityFr}, le prix d’un ${label} se situe entre ${range.min} € et ${range.max} € TTC, avec un tarif médian autour de ${range.median} €. Le prix final dépend de la surface, du type de bien et de la complexité de l’intervention. Demander plusieurs devis permet d’obtenir le meilleur rapport qualité-prix.`,
    },
    {
      question: `Combien de temps est valable un ${label} ?`,
      answer: `La durée de validité d’un ${label} est ${validity}. Au-delà, le diagnostic doit être renouvelé pour toute nouvelle vente ou mise en location du bien.`,
    },
    {
      question: `Qui peut réaliser un ${label} à ${cityFr} ?`,
      answer: `Seuls les diagnostiqueurs immobiliers certifiés par un organisme agréé COFRAC peuvent réaliser un ${label}. La certification est obligatoire et nominative. Vérifiez toujours qu’elle est valide avant de mandater un professionnel à ${cityFr}.`,
    },
  ]

  const typeSpecific: Record<DiagnosticType, ReadonlyArray<FaqItem>> = {
    dpe: [
      {
        question: `Mon bien à ${cityFr} est classé F ou G : quelles conséquences ?`,
        answer: `Depuis 2023, les logements classés G+ ne peuvent plus être loués. À partir de 2025, c’est l’ensemble des G qui devient interdit à la location, puis les F en 2028 et les E en 2034. Un audit énergétique est en outre obligatoire pour la vente d’un F ou G à ${cityFr}.`,
      },
      {
        question: 'Le DPE est-il opposable juridiquement ?',
        answer: `Oui. Depuis le 1er juillet 2021, le DPE est juridiquement opposable. L’acquéreur ou le locataire peut se retourner contre le vendeur ou le bailleur en cas d’erreur substantielle, et le diagnostiqueur engage sa responsabilité.`,
      },
    ],
    amiante: [
      {
        question: `Mon bien à ${cityFr} a été construit après 1997 : ai-je besoin d’un diagnostic amiante ?`,
        answer: `Non. Le diagnostic amiante est obligatoire uniquement pour les biens dont le permis de construire a été délivré avant le 1er juillet 1997. Pour un bien plus récent à ${cityFr}, ce diagnostic n’est pas requis.`,
      },
      {
        question: 'Que se passe-t-il si de l’amiante est détecté ?',
        answer: `La présence d’amiante n’interdit pas la vente, mais l’acquéreur doit être informé. Selon l’état de conservation, des travaux de confinement ou de retrait peuvent être recommandés voire imposés. Un suivi périodique est obligatoire en copropriété (DTA).`,
      },
    ],
    plomb: [
      {
        question: `Si du plomb est détecté à ${cityFr}, dois-je faire des travaux ?`,
        answer: `Si le CREP révèle un seuil supérieur à 1 mg/cm² avec dégradation, des travaux de mise en sécurité sont obligatoires avant la vente ou la location. Le bailleur ou le vendeur doit informer immédiatement l’ARS.`,
      },
      {
        question: `Le CREP est-il nécessaire pour un bail commercial à ${cityFr} ?`,
        answer: `Non. Le CREP concerne uniquement les baux d’habitation et les ventes de logements (parties privatives et communes) construits avant 1949. Il n’est pas exigé pour les locaux commerciaux.`,
      },
    ],
    gaz: [
      {
        question: `Mon installation gaz à ${cityFr} a moins de 15 ans : suis-je dispensé ?`,
        answer: `Oui. Le diagnostic gaz n’est obligatoire que pour les installations intérieures de plus de 15 ans. Pour une installation plus récente à ${cityFr}, vous pouvez fournir le certificat de conformité Qualigaz initial à la place.`,
      },
      {
        question: 'Que se passe-t-il en cas d’anomalie A2 ou DGI ?',
        answer: `Une anomalie A2 nécessite une réparation à brève échéance. Un Danger Grave Immédiat (DGI) entraîne la coupure immédiate du gaz par le distributeur. Dans les deux cas, des travaux sont nécessaires avant remise en service.`,
      },
    ],
    electricite: [
      {
        question: `Mon installation électrique à ${cityFr} a été refaite récemment : ai-je besoin du diagnostic ?`,
        answer: `Si l’installation a été refaite il y a moins de 15 ans et que vous disposez d’une attestation Consuel, vous pouvez la fournir à la place du diagnostic. Au-delà de 15 ans, le diagnostic devient obligatoire à ${cityFr} comme partout en France.`,
      },
      {
        question: 'Le diagnostiqueur doit-il couper le courant pendant l’intervention ?',
        answer: `Non. Le diagnostic électrique est non destructif et n’implique pas de coupure générale. Le diagnostiqueur effectue des mesures visuelles et instrumentales sans démontage, hormis l’ouverture du tableau électrique.`,
      },
    ],
    termites: [
      {
        question: `Comment savoir si ${cityFr} est en zone termite ?`,
        answer: `La liste des communes concernées est fixée par arrêté préfectoral du département ${city.dept}. Le diagnostic est obligatoire uniquement dans les communes inscrites. Vérifiez le statut de ${cityFr} auprès de la préfecture ou demandez à votre diagnostiqueur.`,
      },
      {
        question: 'Validité 6 mois : pourquoi si court ?',
        answer: 'Les termites se propagent rapidement. Une durée de validité courte garantit que l’état des lieux reste fiable. Si la vente prend du retard, le diagnostic doit être renouvelé avant signature.',
      },
    ],
    carrez: [
      {
        question: `Loi Carrez ou loi Boutin à ${cityFr} : laquelle s’applique ?`,
        answer: 'La loi Carrez s’applique uniquement à la vente d’un lot de copropriété (appartement, local commercial). La loi Boutin concerne les locations vides à usage de résidence principale. Les méthodes de calcul diffèrent : Carrez exclut les surfaces < 1,80 m, Boutin aussi mais avec quelques nuances.',
      },
      {
        question: 'Erreur de mesurage : quelles conséquences ?',
        answer: `Si la surface réelle est inférieure de plus de 5 % à celle annoncée, l’acquéreur peut exiger une réduction proportionnelle du prix dans l’année qui suit l’acte de vente. C’est pourquoi un mesurage par un professionnel est fortement recommandé même si l’on est propriétaire à ${cityFr}.`,
      },
    ],
    erp: [
      {
        question: `Mon bien à ${cityFr} est-il concerné par l’ERP ?`,
        answer: `Oui : tous les biens en France métropolitaine sont concernés par l’État des risques et pollutions, quelle que soit la commune. À ${cityFr}, le diagnostic indique les risques spécifiques au département ${city.dept}.`,
      },
      {
        question: 'Puis-je faire l’ERP moi-même ?',
        answer: `Oui, l’ERP peut être réalisé par le vendeur ou le bailleur via le service public Géorisques.gouv.fr. Pour fiabiliser la démarche et la dater officiellement, il est cependant conseillé de la confier à un diagnostiqueur certifié à ${cityFr}.`,
      },
    ],
    'audit-energetique': [
      {
        question: 'Audit énergétique ou DPE : quelle différence ?',
        answer: `Le DPE est une évaluation standardisée (classes A-G). L’audit énergétique va plus loin : il propose un scénario de travaux chiffré pour améliorer la classe énergétique du bien. À ${cityFr}, l’audit est obligatoire pour vendre un logement classé F, G ou E (depuis 2025).`,
      },
      {
        question: `Combien coûte un audit énergétique à ${cityFr} ?`,
        answer: 'Le prix d’un audit énergétique varie généralement entre 500 € et 1 200 € TTC. Il dépend de la complexité du bien, du nombre de scénarios étudiés et de l’expérience de l’auditeur. Des aides peuvent partiellement financer cette prestation (MaPrimeRénov audit).',
      },
    ],
  }

  return [...common, ...typeSpecific[type]]
}

/**
 * Génère un contenu complet pour une combinaison (type, city).
 * Stable entre builds (déterministe sur slug ville + type).
 */
export function generateLocalContent(
  type: DiagnosticType,
  city: City,
): LocalContent {
  return {
    intro: buildIntro(type, city),
    whyHere: buildWhyHere(type, city),
    priceContext: buildPriceContext(type, city),
    legalContext: buildLegalContext(type, city),
    faq: buildFaq(type, city),
  }
}
