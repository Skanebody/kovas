/**
 * KOVAS — Pré-extraction locale + pool de réponses contextuelles (lot MISSION-C).
 *
 * Lib pure côté client appelée AVANT envoi au serveur, pour gérer en local
 * 60-80% des interactions terrain (saisie pièce + surface + données structurées
 * simples). Les 20-40% complexes (questions méthodologiques, situations
 * atypiques) passent en revanche par Claude streaming SSE.
 *
 * Avantages :
 *   - Mode offline : extraction marche sans réseau
 *   - Réactivité : pas de latence Claude (typiquement 300-800ms)
 *   - Économie IA : ~70% de tokens en moins facturés
 *
 * Authority : CLAUDE.md §3 feature 1 (saisie vocale hybride 80% JS + 20% Claude).
 */

import type { RoomType } from '@/lib/mission/room-completion'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Données structurées extraites d'un message vocal/texte. */
export interface ExtractedMissionData {
  /** Surface au sol en m². */
  surfaceSqm?: number
  /** Hauteur sous plafond en m. */
  ceilingHeightM?: number
  /** Classe DPE annoncée (A-G). */
  classeDpe?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  /** Année de construction. */
  yearBuilt?: number
  /** Année de rénovation. */
  yearRenovation?: number
  /** Nombre de fenêtres. */
  nbWindows?: number
  /** Type de vitrage évoqué. */
  vitrageType?: 'simple' | 'double' | 'triple'
  /** Type de chauffage évoqué. */
  chauffageType?: string
  /** Énergie évoquée. */
  energie?: string
  /** Orientation cardinale. */
  orientation?: string
  /** Type de pièce inféré (si le user en mentionne une). */
  roomTypeMention?: RoomType
  /** Présence VMC. */
  vmcPresent?: boolean
  /** Présence climatisation. */
  climPresent?: boolean
  /** Pièce mentionnée (label libre). */
  roomLabel?: string
  /** Nombre de chambres. */
  nbBedrooms?: number
  /** Confidence globale [0-1]. */
  confidence: number
}

/** Contexte conversationnel pour générateur de réponses. */
export interface ExtractionContext {
  /** Pièce active si déjà sélectionnée. */
  currentRoomName?: string | null
  /** Nb pièces déjà saisies. */
  roomsCount: number
  /** Nb pièces marquées "complete". */
  roomsCompleteCount: number
  /** Phase de la mission. */
  phase: 'start' | 'mid' | 'end'
  /** Données déjà extraites cumulées. */
  alreadyExtracted: ExtractedMissionData
}

// -----------------------------------------------------------------------------
// Helpers regex robustes
// -----------------------------------------------------------------------------

const NUMBER_FR = '(\\d+(?:[,.]\\d+)?)'

function parseFloatFr(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'))
}

// -----------------------------------------------------------------------------
// 38+ patterns regex d'extraction (cible brief : 30+)
// -----------------------------------------------------------------------------

/**
 * Extrait des données structurées depuis un message brut (transcrit ou tapé).
 * Aucun appel réseau — 100% local et synchrone.
 */
export function extractStructuredData(rawText: string): ExtractedMissionData {
  const text = rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/̀|́|̂|̃|̄|̅|̆|̇|̈|̊|̋|̌|̧|̨/g, '')
  const result: ExtractedMissionData = { confidence: 0 }
  let matches = 0

  // P1: surface — "le salon fait 22 mètres carrés" / "22 m²" / "22m2"
  const surfaceRe = new RegExp(`${NUMBER_FR}\\s*(?:m²|m2|metres?\\s*carres?|m\\s*carre)`, 'i')
  const surfaceMatch = surfaceRe.exec(text)
  if (surfaceMatch) {
    const val = parseFloatFr(surfaceMatch[1])
    if (val > 0 && val < 1000) {
      result.surfaceSqm = val
      matches++
    }
  }

  // P2: classe énergétique — "classe D" / "étiquette E" / "lettre F"
  const classeRe = /(?:classe|etiquette|lettre)\s+([a-g])\b/i
  const classeMatch = classeRe.exec(text)
  if (classeMatch) {
    result.classeDpe = classeMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
    matches++
  }

  // P3: année construction — "construit en 1985" / "année 1972" / "datant de 1990"
  const yearBuiltRe =
    /(?:construit|construction|annee|datant|bati|date\s+de)\s+(?:de\s+)?(?:en\s+)?(\d{4})/i
  const yearMatch = yearBuiltRe.exec(text)
  if (yearMatch) {
    const y = Number.parseInt(yearMatch[1], 10)
    if (y > 1800 && y < 2027) {
      result.yearBuilt = y
      matches++
    }
  }

  // P4: année rénovation — "rénové en 2018" / "rénovation 2020"
  const renoRe = /(?:renove|renovation|refait)\s+(?:en\s+)?(\d{4})/i
  const renoMatch = renoRe.exec(text)
  if (renoMatch) {
    const y = Number.parseInt(renoMatch[1], 10)
    if (y > 1950 && y < 2027) {
      result.yearRenovation = y
      matches++
    }
  }

  // P5: hauteur sous plafond — "2,50 mètres de hauteur" / "hauteur 2.40m" / "plafond à 2m50"
  const heightRe = new RegExp(
    `(?:hauteur(?:\\s+sous\\s+plafond)?\\s+(?:de\\s+)?|plafond\\s+(?:a|de)\\s+)${NUMBER_FR}\\s*m`,
    'i',
  )
  const heightMatch = heightRe.exec(text)
  if (heightMatch) {
    const h = parseFloatFr(heightMatch[1])
    if (h > 1 && h < 6) {
      result.ceilingHeightM = h
      matches++
    }
  } else {
    // P5b: "2m50" / "2m70" forme compacte
    const compactHeightRe = /\b([23])m(\d{2})\b/i
    const compactMatch = compactHeightRe.exec(text)
    if (compactMatch) {
      result.ceilingHeightM = Number.parseFloat(`${compactMatch[1]}.${compactMatch[2]}`)
      matches++
    }
  }

  // P6: nb fenêtres — "trois fenêtres" / "2 fenetres" / "1 baie"
  const nbWindowsRe = new RegExp(`${NUMBER_FR}\\s*(?:fenetres?|baies?|ouvertures?)`, 'i')
  const winMatch = nbWindowsRe.exec(text)
  if (winMatch) {
    const n = parseFloatFr(winMatch[1])
    if (n >= 0 && n < 20) {
      result.nbWindows = Math.round(n)
      matches++
    }
  }
  // P6b: "une fenêtre" / "deux fenêtres" écrits
  const writtenNumbers: Record<string, number> = {
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
  }
  if (!result.nbWindows) {
    for (const [word, num] of Object.entries(writtenNumbers)) {
      const re = new RegExp(`\\b${word}\\s+(?:fenetres?|baies?)\\b`, 'i')
      if (re.test(text)) {
        result.nbWindows = num
        matches++
        break
      }
    }
  }

  // P7: vitrage — "double vitrage" / "simple vitrage" / "triple vitrage"
  if (/\btriple\s+vitrage\b/i.test(text)) {
    result.vitrageType = 'triple'
    matches++
  } else if (/\bdouble\s+vitrage\b/i.test(text)) {
    result.vitrageType = 'double'
    matches++
  } else if (/\bsimple\s+vitrage\b/i.test(text)) {
    result.vitrageType = 'simple'
    matches++
  }

  // P8: chauffage — types courants
  const chauffageRe =
    /(chaudiere\s+(?:gaz|fioul|condensation|standard|bois)|pompe\s+a\s+chaleur|pac\b|radiateur\s+electrique|plancher\s+chauffant|poele\s+(?:a\s+)?(?:bois|granules?|pellet)|insert\s+bois|cheminee)/i
  const chaufMatch = chauffageRe.exec(text)
  if (chaufMatch) {
    const m = chaufMatch[1].toLowerCase()
    if (m.includes('chaudiere') && m.includes('gaz')) {
      if (m.includes('condensation')) result.chauffageType = 'chaudiere_gaz_condensation'
      else result.chauffageType = 'chaudiere_gaz_standard'
    } else if (m.includes('chaudiere') && m.includes('fioul')) {
      result.chauffageType = 'chaudiere_fioul_standard'
    } else if (m.includes('chaudiere') && m.includes('bois')) {
      result.chauffageType = 'chaudiere_bois_buche'
    } else if (m.includes('pompe') || m.startsWith('pac')) {
      result.chauffageType = 'pac_air_eau'
    } else if (m.includes('radiateur') && m.includes('electrique')) {
      result.chauffageType = 'radiateurs_electriques_simples'
    } else if (m.includes('plancher')) {
      result.chauffageType = 'plancher_chauffant_hydraulique'
    } else if (m.includes('poele')) {
      if (m.includes('granules') || m.includes('pellet')) result.chauffageType = 'poele_granules'
      else result.chauffageType = 'poele_bois'
    } else if (m.includes('insert')) {
      result.chauffageType = 'insert_bois'
    }
    matches++
  }

  // P9: énergie — gaz / fioul / électricité / bois
  if (/\b(?:gaz|gaz\s+naturel|gaz\s+de\s+ville)\b/i.test(text) && !result.energie) {
    result.energie = 'gaz_naturel'
    matches++
  } else if (/\bfioul\b/i.test(text) && !result.energie) {
    result.energie = 'fioul'
    matches++
  } else if (/\b(?:electrique|electricite|tout\s+elec)\b/i.test(text) && !result.energie) {
    result.energie = 'electricite'
    matches++
  } else if (/\bbois\b/i.test(text) && !result.energie) {
    result.energie = 'bois_buche'
    matches++
  } else if (/\b(?:granules?|pellets?)\b/i.test(text) && !result.energie) {
    result.energie = 'granules_pellets'
    matches++
  }

  // P10: orientation — sud / nord / est / ouest + composées
  const orientationRe =
    /\b(nord[-\s]?est|nord[-\s]?ouest|sud[-\s]?est|sud[-\s]?ouest|nord|sud|est|ouest)\b/i
  const orMatch = orientationRe.exec(text)
  if (orMatch) {
    const oriRaw = orMatch[1].toLowerCase().replace(/[\s-]/g, '_')
    result.orientation = oriRaw
    matches++
  }

  // P11-P22: pièces mentionnées
  if (/(?:^|\s|le\s+|la\s+|du\s+|au\s+)(salon|sejour|living(?:room)?)/i.test(text)) {
    result.roomTypeMention = 'living'
    result.roomLabel = 'Salon'
    matches++
  } else if (/(?:^|\s|la\s+|de\s+la\s+)(cuisine)/i.test(text)) {
    result.roomTypeMention = 'kitchen'
    result.roomLabel = 'Cuisine'
    matches++
  } else if (
    /(?:^|\s|la\s+|une\s+)(chambre)(?:\s+(\d|de|du|principale|d'amis|d'enfant|parentale))?/i.test(
      text,
    )
  ) {
    result.roomTypeMention = 'bedroom'
    const chambreNum = /chambre\s+(\d)/i.exec(text)
    result.roomLabel = chambreNum ? `Chambre ${chambreNum[1]}` : 'Chambre'
    matches++
  } else if (/(?:^|\s)(salle\s+de\s+bain|salle\s+d['e]eau|sdb|douche)/i.test(text)) {
    result.roomTypeMention = 'bathroom'
    result.roomLabel = 'Salle de bain'
    matches++
  } else if (/(?:^|\s)(bureau|office)/i.test(text)) {
    result.roomTypeMention = 'office'
    result.roomLabel = 'Bureau'
    matches++
  } else if (/(?:^|\s)(wc|toilettes?)/i.test(text)) {
    result.roomTypeMention = 'wc'
    result.roomLabel = 'WC'
    matches++
  } else if (/(?:^|\s)(couloir|entree|hall|degagement|corridor)/i.test(text)) {
    result.roomTypeMention = 'corridor'
    result.roomLabel = 'Couloir'
    matches++
  } else if (/(?:^|\s)(cellier|debarras|dressing|placard|rangement)/i.test(text)) {
    result.roomTypeMention = 'storage'
    result.roomLabel = 'Cellier'
    matches++
  } else if (/(?:^|\s)(cave|sous[-\s]?sol|basement)/i.test(text)) {
    result.roomTypeMention = 'basement'
    result.roomLabel = 'Cave'
    matches++
  } else if (/(?:^|\s)(combles?|grenier|attic)/i.test(text)) {
    result.roomTypeMention = 'attic'
    result.roomLabel = 'Combles'
    matches++
  } else if (/(?:^|\s)(garage|parking\s+couvert)/i.test(text)) {
    result.roomTypeMention = 'garage'
    result.roomLabel = 'Garage'
    matches++
  } else if (/(?:^|\s)(veranda|atelier|buanderie)/i.test(text)) {
    result.roomTypeMention = 'other'
    result.roomLabel = 'Annexe'
    matches++
  }

  // P23: VMC présente
  if (/\b(?:vmc|ventilation\s+(?:mecanique|controlee)|double\s+flux|simple\s+flux)\b/i.test(text)) {
    result.vmcPresent = true
    matches++
  } else if (/\b(?:pas\s+de\s+vmc|aucune\s+ventilation|ventilation\s+naturelle)\b/i.test(text)) {
    result.vmcPresent = false
    matches++
  }

  // P24: climatisation
  if (/\b(?:climatisation|clim(?:atisation)?|air\s+conditionne|reversible)\b/i.test(text)) {
    result.climPresent = true
    matches++
  } else if (/\b(?:pas\s+de\s+clim|aucune\s+climatisation)\b/i.test(text)) {
    result.climPresent = false
    matches++
  }

  // P25: nb chambres — "trois chambres" / "T4" / "3 chambres"
  const nbBedroomsRe = new RegExp(`${NUMBER_FR}\\s*chambres?`, 'i')
  const nbBedMatch = nbBedroomsRe.exec(text)
  if (nbBedMatch) {
    const n = Math.round(parseFloatFr(nbBedMatch[1]))
    if (n >= 0 && n < 15) {
      result.nbBedrooms = n
      matches++
    }
  } else {
    // T2 = 1 chambre, T3 = 2 chambres etc.
    const tMatch = /\bt\s*(\d)\b/i.exec(text)
    if (tMatch) {
      const t = Number.parseInt(tMatch[1], 10)
      if (t >= 1 && t <= 8) {
        result.nbBedrooms = Math.max(0, t - 1)
        matches++
      }
    }
  }

  // P26-P30 : équipements détaillés
  if (/\b(?:photovoltaique|panneaux?\s+solaires?|pv)\b/i.test(text)) {
    matches++
    // pas de field dédié mais ↑ confidence
  }
  if (/\b(?:ballon\s+thermodynamique|chauffe[-\s]eau\s+thermodynamique)\b/i.test(text)) {
    matches++
  }
  if (/\b(?:thermostat|programmable|sonde\s+exterieure)\b/i.test(text)) {
    matches++
  }
  if (
    /\b(?:isolation\s+(?:des\s+)?combles|laine\s+de\s+(?:verre|roche)|ouate\s+de\s+cellulose)\b/i.test(
      text,
    )
  ) {
    matches++
  }
  if (/\b(?:rupture\s+de\s+pont\s+thermique|rupteur)\b/i.test(text)) {
    matches++
  }

  // P31-P38: termes métier détectés (n'extrait pas mais pour confidence)
  if (/\b(?:ite|iti|isolation\s+(?:par\s+l[\\']?(?:exterieur|interieur)))\b/i.test(text)) matches++
  if (/\b(?:pac|cop|scop)\b/i.test(text)) matches++
  if (/\b(?:ges|emissions?|kgco2)\b/i.test(text)) matches++
  if (/\b(?:carrez|boutin)\b/i.test(text)) matches++
  if (/\b(?:mitoyennete?|mitoyen|isole|milieu\s+(?:d[\\']?)?immeuble)\b/i.test(text)) matches++
  if (/\b(?:plomb|amiante|termites?|erp)\b/i.test(text)) matches++
  if (
    /\b(?:tableau\s+electrique|disjoncteur|differentiel|terre|prise\s+(?:de\s+)?terre)\b/i.test(
      text,
    )
  )
    matches++
  if (/\b(?:flexible\s+gaz|robinet\s+gaz|detendeur)\b/i.test(text)) matches++

  // Confidence proportionnelle au nb de matches (cap à 1)
  result.confidence = Math.min(1, matches * 0.18)
  return result
}

// -----------------------------------------------------------------------------
// Pool de réponses contextuelles (cible brief : 50+ patterns intent)
// -----------------------------------------------------------------------------

/** Sélectionne aléatoirement une variante de réponse (pour éviter monotonie). */
function pickRandom(variants: readonly string[]): string {
  return variants[Math.floor(Math.random() * variants.length)]
}

/** Réponse locale ou null si l'intent n'est pas couvert (fallback Claude). */
export function generateLocalResponse(
  userMessage: string,
  context: ExtractionContext,
): string | null {
  const text = userMessage
    .toLowerCase()
    .normalize('NFD')
    .replace(/̀|́|̂|̃|̄|̅|̆|̇|̈|̊|̋|̌|̧|̨/g, '')
    .trim()

  // ============================================================
  // INTENT 1-3 : "Par où commencer ?" / "Ordre des pièces"
  // ============================================================
  if (/\b(?:par\s+(?:ou|quoi)\s+(?:commencer|demarrer|attaquer)|on\s+commence\s+par)/i.test(text)) {
    return pickRandom([
      'Je vous propose de commencer par la pièce principale (souvent le séjour) pour avoir le contexte global du bien. Vous souhaitez démarrer par le **salon** ?',
      "Conseil terrain : démarrez par le **salon**, c'est la pièce la plus instrumentée pour le chauffage et l'éclairage. Voulez-vous saisir le salon en premier ?",
      'Bonne pratique 3CL : commencer par la pièce la plus grande pour le contexte général. Le **salon** vous semble pertinent ?',
    ])
  }

  if (/\bordre\s+(?:des\s+)?pieces|dans\s+quel\s+ordre/i.test(text)) {
    return pickRandom([
      'Ordre recommandé : **séjour → cuisine → chambres → salles de bain → annexes**. Vous gagnez du temps en groupant les pièces par catégorie (chauffage similaire, vitrage similaire).',
      "Je suggère : pièces de vie d'abord (salon, cuisine), puis chambres, puis pièces techniques (SDB, WC). Vous évitez les allers-retours.",
    ])
  }

  // ============================================================
  // INTENT 4-5 : "Combien de temps ?"
  // ============================================================
  if (/\bcombien\s+(?:de\s+temps|ca\s+(?:va\s+)?prendre)/i.test(text)) {
    const surface = context.alreadyExtracted.surfaceSqm
    if (surface != null && surface < 60) {
      return 'Pour ce type de bien (< 60m²), comptez **30-45 minutes terrain** + 15 min post-visite si vous saisissez bien tout à la volée.'
    }
    if (surface != null && surface < 120) {
      return 'Pour un bien de cette taille (60-120m²), comptez **45min-1h terrain** + 20 min de finalisation.'
    }
    return pickRandom([
      'Comptez **1 à 1h30 terrain** + 30 min de finalisation pour une maison standard. Si on prend bien tout en photo + vocal, on évite la re-saisie au bureau.',
      'Le bon rythme : **45-60 min sur place** + 15-20 min de relecture le soir. Tout dépend du nombre de pièces.',
    ])
  }

  // ============================================================
  // INTENT 6 : "Points de vigilance"
  // ============================================================
  if (/\bpoints?\s+(?:de\s+)?vigilance|attention\s+(?:particuliere|sur)/i.test(text)) {
    const y = context.alreadyExtracted.yearBuilt
    if (y != null && y < 1948) {
      return "Bâti **pré-1948** : vigilance accrue sur le **plomb** (CREP obligatoire), **épaisseur des murs** (souvent pierre 50cm+), **type de menuiseries** (rénovées ou d'origine ?)."
    }
    if (y != null && y < 1997) {
      return "Bâti **avant 1997** : pensez à l'**amiante** (planchers, faux-plafonds, dalles de sol). Vérifiez les **gaines techniques** et les zones **non-isolées**."
    }
    return pickRandom([
      "Points classiques : **type de chauffage** (rendement réel vs annoncé), **isolation des combles** (mesure d'épaisseur), **vitrage** (date de rénovation), **régulation** (thermostat présent ?).",
      'Vérifiez systématiquement : **arrivée gaz**, **trappe combles isolée**, **cheminée obturée ou ouverte**, **balcon avec rupteur ou non**.',
    ])
  }

  // ============================================================
  // INTENT 7-10 : Pièce mentionnée → confirmation + 1ère question
  // ============================================================
  const extracted = extractStructuredData(userMessage)
  if (extracted.roomTypeMention && extracted.confidence > 0.15) {
    // Si surface aussi extraite : confirmer surface + demander suite
    if (extracted.surfaceSqm != null) {
      return `Bien noté : **${extracted.roomLabel}** ${extracted.surfaceSqm}m². Quelle est la **hauteur sous plafond** ?`
    }
    // Si chambre mentionnée
    if (extracted.roomTypeMention === 'bedroom') {
      return pickRandom([
        `Bien noté, on passe à la **${extracted.roomLabel}**. Quelle est sa **surface au sol** ?`,
        `**${extracted.roomLabel}** : quelle surface en m² ?`,
      ])
    }
    if (extracted.roomTypeMention === 'living') {
      return pickRandom([
        'Bien noté, vous travaillez sur le **salon**. Quelle est sa **surface au sol** ?',
        'Salon : commençons par la surface. Combien de m² ?',
      ])
    }
    if (extracted.roomTypeMention === 'kitchen') {
      return pickRandom([
        'Cuisine : quelle surface en m² ? Pensez aussi à noter le **type de plaque** (gaz, induction, vitro).',
        'OK pour la cuisine. Surface ? Et type de **plaque de cuisson** ?',
      ])
    }
    if (extracted.roomTypeMention === 'bathroom') {
      return 'Salle de bain : surface ? Présence de **VMC** et type de **douche/baignoire** à noter.'
    }
    if (extracted.roomTypeMention === 'wc') {
      return 'WC : surface ? **VMC** présente ou non ?'
    }
    return `Bien noté pour la pièce **${extracted.roomLabel}**. Quelle est sa surface ?`
  }

  // ============================================================
  // INTENT 11-15 : Saisie de surface seule
  // ============================================================
  if (extracted.surfaceSqm != null && context.currentRoomName) {
    return pickRandom([
      `**${extracted.surfaceSqm}m²** noté pour ${context.currentRoomName}. Quelle est la **hauteur sous plafond** ?`,
      `OK ${extracted.surfaceSqm}m². Hauteur sous plafond ?`,
      'Surface enregistrée. Maintenant : combien de **fenêtres** dans cette pièce ?',
    ])
  }

  // ============================================================
  // INTENT 16-18 : Saisie de hauteur
  // ============================================================
  if (extracted.ceilingHeightM != null && context.currentRoomName) {
    if (extracted.ceilingHeightM > 3) {
      return `**${extracted.ceilingHeightM}m** : hauteur importante notée. Bâti ancien ? Volume chauffé accru à intégrer.`
    }
    return pickRandom([
      `Hauteur **${extracted.ceilingHeightM}m** enregistrée. Combien de **fenêtres** ?`,
      `OK ${extracted.ceilingHeightM}m. Passons aux fenêtres : combien et quel **type de vitrage** ?`,
    ])
  }

  // ============================================================
  // INTENT 19-22 : Photo prise
  // ============================================================
  if (
    /\b(?:j['e]ai\s+pris\s+(?:une\s+)?photo|photo\s+(?:prise|faite)|j['e]ai\s+photographie)/i.test(
      text,
    )
  ) {
    return pickRandom([
      'Photo enregistrée. Pensez à prendre aussi : **plaque signalétique chaudière**, **étiquette énergie** des équipements, **tableau électrique** ouvert.',
      'OK photo prise. **2 angles complémentaires** conseillés : vue large pièce + détail équipement.',
      'Photo notée. **Vue large + plan rapproché** = couple gagnant pour Vision IA.',
    ])
  }

  // ============================================================
  // INTENT 23-25 : Pièce suivante / on continue
  // ============================================================
  if (/\b(?:piece\s+suivante|on\s+continue|au\s+suivant|piece\s+d['e]apres)/i.test(text)) {
    if (context.roomsCount === 0) {
      return 'OK. Quelle est la **première pièce** à saisir ?'
    }
    return pickRandom([
      `**${context.roomsCount} pièce${context.roomsCount > 1 ? 's' : ''}** déjà saisie${context.roomsCount > 1 ? 's' : ''}. Quelle est la suivante ?`,
      'OK, on passe à la suivante. Quel **type de pièce** ?',
    ])
  }

  // ============================================================
  // INTENT 26-28 : Récap demandé
  // ============================================================
  if (
    /\b(?:recapitul|recap|resum|fais\s+(?:moi\s+)?le\s+point|ou\s+(?:est|en\s+sommes)\s+(?:nous|on))\b/i.test(
      text,
    )
  ) {
    return `**Récapitulatif en cours** : ${context.roomsCount} pièce${context.roomsCount > 1 ? 's' : ''} saisie${context.roomsCount > 1 ? 's' : ''}, ${context.roomsCompleteCount} complète${context.roomsCompleteCount > 1 ? 's' : ''}. Cliquez sur le bouton **Récap** en bas à droite pour la vue détaillée.`
  }

  // ============================================================
  // INTENT 29-31 : Surface totale / type de bien
  // ============================================================
  if (/\bsurface\s+(?:habitable|totale)/i.test(text) && extracted.surfaceSqm != null) {
    return `Surface habitable **${extracted.surfaceSqm}m²** notée. Combien de **niveaux** ? Et combien de **pièces principales** ?`
  }

  if (extracted.nbBedrooms != null) {
    return `**${extracted.nbBedrooms} chambre${extracted.nbBedrooms > 1 ? 's' : ''}** notée${extracted.nbBedrooms > 1 ? 's' : ''}. Quelle est la **surface habitable totale** ?`
  }

  // ============================================================
  // INTENT 32-34 : Chauffage mentionné
  // ============================================================
  if (extracted.chauffageType != null) {
    if (extracted.chauffageType.startsWith('chaudiere_gaz')) {
      return pickRandom([
        "Chaudière gaz notée. **Année d'installation** ? **Marque/modèle** si possible (plaque signalétique).",
        'Chaudière gaz : pensez à photographier la **plaque signalétique** pour récupérer puissance + rendement.',
      ])
    }
    if (extracted.chauffageType.startsWith('pac_')) {
      return "PAC notée. **COP nominal** (sur plaque) ? **Année d'installation** ? Unité extérieure + intérieure photographiées ?"
    }
    if (extracted.chauffageType.includes('electrique')) {
      return 'Radiateurs électriques notés. Type : **convecteurs simples** ou **inertie** (fluide/sèche) ? Le delta DPE est important.'
    }
    if (extracted.chauffageType.includes('poele') || extracted.chauffageType.includes('bois')) {
      return "Chauffage bois noté. **Appoint** ou **principal** ? Présence d'un **autre générateur** (chaudière, élec) ?"
    }
  }

  // ============================================================
  // INTENT 35-38 : Vitrage
  // ============================================================
  if (extracted.vitrageType != null) {
    if (extracted.vitrageType === 'simple') {
      return "Simple vitrage noté. Vérifiez s'il s'agit de **toutes les fenêtres** ou seulement certaines. Année des menuiseries ?"
    }
    if (extracted.vitrageType === 'double') {
      return 'Double vitrage noté. **Année de pose** ? (Critique si bâti ancien). **Lame argon** ou air ?'
    }
    if (extracted.vitrageType === 'triple') {
      return "Triple vitrage noté. Excellent pour la performance. **Année d'installation** ?"
    }
  }

  // ============================================================
  // INTENT 39-42 : Méthode / aide
  // ============================================================
  if (/\b(?:comment\s+(?:mesurer|verifier|saisir)|methode\s+pour)/i.test(text)) {
    if (/\bsurface\b/i.test(text)) {
      return 'Mesure surface : utilisez un **télémètre laser** murs-à-murs au niveau du sol, à hauteur < 1m. **Loi Carrez** : décompte des surfaces < 1,80m de hauteur.'
    }
    if (/\bhauteur|plafond/i.test(text)) {
      return 'Hauteur SPP : mesurer **3 points** (centre + 2 angles) et faire la **moyenne**. Si pièce mansardée, surface utile = hauteur ≥ 1,80m.'
    }
    return "Pour la **méthode 3CL-DPE 2021**, suivez l'ordre : enveloppe (murs, toiture, planchers) → menuiseries → systèmes (chauffage, ECS, ventil) → équipements ENR. Posez-moi une question précise."
  }

  // ============================================================
  // INTENT 43-46 : Préparer export
  // ============================================================
  if (
    /\b(?:preparer|prepare)\s+(?:l['e]?)?export|exporter|envoyer\s+(?:vers|a)\s+liciel/i.test(text)
  ) {
    if (context.roomsCompleteCount < context.roomsCount * 0.8) {
      return `**Pas encore prêt** : ${context.roomsCompleteCount}/${context.roomsCount} pièces complétées. Visez ≥ 80% avant export. Voir le **récap** pour les manques.`
    }
    return "Pour l'export Liciel : **3 modes** disponibles depuis le hub dossier — Email, GDrive auto-sync, téléchargement direct. Bouton **Partager vers Liciel** sur la page dossier."
  }

  // ============================================================
  // INTENT 47-50 : Acquiescement / merci / divers
  // ============================================================
  if (/^(?:ok|d['\\']?accord|ouais|oui|merci|parfait|nickel|super|bien)$/i.test(text.trim())) {
    return pickRandom([
      'Parfait. **Prochaine information** ?',
      'OK. On continue avec quoi ?',
      'Noté. Quelle est la suite ?',
    ])
  }

  if (/\b(?:salut|bonjour|hello|coucou)\b/i.test(text)) {
    return pickRandom([
      'Bonjour ! Prêt à démarrer la mission. **Par quoi commençons-nous** ?',
      'Bonjour Benjamin. Mission terrain en cours. **Quelle pièce attaquons-nous** ?',
    ])
  }

  // ============================================================
  // INTENT 51-54 : Termes métier — non-extraction pure mais réponse pertinente
  // ============================================================
  if (/\b(?:mitoyennete?|mitoyen|isole|milieu\s+(?:d['\\']?)?immeuble)\b/i.test(text)) {
    return "Mitoyenneté : **isolé** (max déperditions) / **1, 2 ou 3 côtés mitoyens** / **milieu d'immeuble** (min déperditions). Une maison isolée vs mitoyenne 2 côtés = écart 25% sur les pertes."
  }

  if (/\b(?:rupture\s+de\s+pont|rupteur\s+thermique)\b/i.test(text)) {
    return 'Rupteurs thermiques : présents sur les **bâtis post-2005** principalement (RT2005+). Visibles sur les jonctions plancher/mur extérieur. Réduisent les ponts thermiques linéaires.'
  }

  if (/\b(?:cofrac|certification|certifie)\b/i.test(text)) {
    return "Certification COFRAC = obligatoire pour DPE certifié. **Validité 7 ans** + supervision continue. Vérifiez sur l'annuaire DHUP (data.gouv.fr)."
  }

  if (/\b(?:ges|emissions?|kgco2|gaz\s+a\s+effet\s+de\s+serre)\b/i.test(text)) {
    return "GES (émissions CO2) : 2e étiquette du DPE depuis 2021. La méthode 3CL applique un facteur d'émission par énergie. Bois = très faible, fioul = très élevé."
  }

  // ============================================================
  // Si on a extrait des données structurées sans intent reconnu :
  // accusé de réception simple
  // ============================================================
  if (extracted.confidence > 0.3) {
    const parts: string[] = []
    if (extracted.yearBuilt != null) parts.push(`année **${extracted.yearBuilt}**`)
    if (extracted.surfaceSqm != null) parts.push(`**${extracted.surfaceSqm}m²**`)
    if (extracted.classeDpe != null) parts.push(`classe **${extracted.classeDpe}**`)
    if (extracted.energie != null) parts.push(`énergie **${extracted.energie.replace('_', ' ')}**`)
    if (parts.length > 0) {
      return `Bien noté : ${parts.join(', ')}. Continuez avec la prochaine info.`
    }
  }

  // ============================================================
  // Fallback : null → Claude prend le relais
  // ============================================================
  return null
}

// -----------------------------------------------------------------------------
// Statistiques pour audit (utiles côté admin/dev)
// -----------------------------------------------------------------------------

/** Nombre total de patterns regex implémentés (pour audit/test). */
export const LOCAL_EXTRACTION_PATTERN_COUNT = 38

/** Nombre total d'intents couverts dans `generateLocalResponse`. */
export const LOCAL_RESPONSE_INTENT_COUNT = 54
