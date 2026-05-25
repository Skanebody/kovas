/**
 * KOVAS — Glossaire du jargon diagnostic immobilier français (Lot B67).
 *
 * Source unique de vérité utilisée par `<GlossaryTerm term="..." />` (server)
 * et `<InfoTooltip term="..." />` (client) pour afficher des définitions
 * sobres et professionnelles sur les pages publiques.
 *
 * Règles éditoriales (avatar SOBRE PROFESSIONNEL, vouvoiement neutre) :
 *   - Définitions courtes (max 30 mots).
 *   - Vocabulaire métier précis, pas de jargon supplémentaire.
 *   - Aucune emoji, aucune ponctuation expressive.
 *   - Sources officielles UNIQUEMENT : Légifrance, ADEME, INSEE, Anah,
 *     Géorisques, service-public.fr, INRS, Code de la Santé Publique,
 *     economie.gouv.fr, France Rénov', cofrac.fr.
 *
 * Conventions de clé : `term` normalisé en minuscules, sans accent, sans
 * caractère spécial. Lookup via {@link getGlossaryEntry} qui normalise la
 * recherche (compat majuscules/minuscules, accents, apostrophes typo).
 */

export interface GlossarySource {
  /** Label court (≤ 30 caractères) affiché en pied de popover. */
  readonly label: string
  /** URL absolue HTTPS vers la source officielle. */
  readonly url: string
}

export interface GlossaryEntry {
  /** Libellé affiché en tooltip header (ex. "DPE — Diagnostic de Performance Énergétique"). */
  readonly title: string
  /** Définition concise (≤ 30 mots, sobre, vouvoiement neutre). */
  readonly definition: string
  /** Source officielle vérifiable (optionnel mais recommandé). */
  readonly source?: GlossarySource
}

/**
 * Glossaire indexé par clé normalisée (minuscules ASCII).
 *
 * Tout ajout doit pointer vers une source officielle (Légifrance, ADEME,
 * INSEE…) et respecter la règle des 30 mots maximum.
 */
export const GLOSSARY: Readonly<Record<string, GlossaryEntry>> = Object.freeze({
  dpe: {
    title: 'DPE — Diagnostic de Performance Énergétique',
    definition:
      'Document obligatoire qui évalue la consommation énergétique et les émissions de gaz à effet de serre d’un logement, classé de A (économe) à G (énergivore).',
    source: {
      label: 'Légifrance · L126-26',
      url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043811449',
    },
  },
  cofrac: {
    title: 'COFRAC — Comité français d’accréditation',
    definition:
      'Organisme national unique qui accrédite les organismes de certification des diagnostiqueurs immobiliers. L’accréditation COFRAC est obligatoire depuis 2007.',
    source: {
      label: 'cofrac.fr',
      url: 'https://www.cofrac.fr/',
    },
  },
  carrez: {
    title: 'Loi Carrez',
    definition:
      'Calcul de la surface privative d’un lot en copropriété. Sont comptées les pièces closes et couvertes d’une hauteur sous plafond supérieure à 1,80 mètre.',
    source: {
      label: 'Légifrance · Loi 96-1107',
      url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000563196/',
    },
  },
  boutin: {
    title: 'Loi Boutin',
    definition:
      'Surface habitable d’un logement loué vide. Exclut les balcons, terrasses, caves, garages et toute pièce de moins de 1,80 mètre sous plafond.',
    source: {
      label: 'Légifrance · Loi 2009-323',
      url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000020438861/',
    },
  },
  erp: {
    title: 'ERP — État des Risques et Pollutions',
    definition:
      'Document informant l’acquéreur ou locataire des risques naturels, miniers, technologiques et de pollution des sols affectant le bien immobilier.',
    source: {
      label: 'Géorisques · service public',
      url: 'https://www.georisques.gouv.fr/',
    },
  },
  'mention-audit': {
    title: 'Mention audit énergétique',
    definition:
      'Habilitation spécifique imposée aux diagnostiqueurs depuis l’arrêté du 5 septembre 2023 pour réaliser les audits énergétiques réglementaires des passoires thermiques.',
    source: {
      label: 'Légifrance · arrêté 2023',
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000048080720',
    },
  },
  '3cl-2021': {
    title: '3CL-2021 — Calcul Conventionnel des Consommations',
    definition:
      'Méthode officielle de calcul du DPE en vigueur depuis juillet 2021. Standardise les données conventionnelles climat, équipements et bâti.',
    source: {
      label: 'ADEME · méthode 3CL',
      url: 'https://www.ecologie.gouv.fr/diagnostic-performance-energetique-dpe',
    },
  },
  rge: {
    title: 'RGE — Reconnu Garant de l’Environnement',
    definition:
      'Qualification délivrée aux artisans et entreprises du bâtiment qui réalisent des travaux de rénovation énergétique éligibles aux aides publiques.',
    source: {
      label: 'France Rénov’',
      url: 'https://france-renov.gouv.fr/annuaire-rge',
    },
  },
  agc: {
    title: 'AGC — Amiante Avant Travaux ou Démolition',
    definition:
      'Repérage amiante obligatoire avant tous travaux ou démolition susceptibles d’altérer des matériaux amiantés, distinct du DTA pré-existant.',
    source: {
      label: 'INRS · amiante',
      url: 'https://www.inrs.fr/risques/amiante/reglementation.html',
    },
  },
  dta: {
    title: 'DTA — Dossier Technique Amiante',
    definition:
      'Dossier obligatoire pour tout immeuble bâti dont le permis de construire est antérieur au 1er juillet 1997. Recense la présence de matériaux amiantés.',
    source: {
      label: 'Code de la Santé Publique · R1334-29-5',
      url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000022430767',
    },
  },
  crep: {
    title: 'CREP — Constat de Risque d’Exposition au Plomb',
    definition:
      'Diagnostic obligatoire à la vente ou location des logements construits avant 1949. Recherche la présence de plomb dans les peintures.',
    source: {
      label: 'service-public.fr',
      url: 'https://www.service-public.fr/particuliers/vosdroits/F2613',
    },
  },
  ges: {
    title: 'GES — Gaz à Effet de Serre',
    definition:
      'Émissions de CO₂ équivalent d’un logement exprimées en kg/m²/an. Étiquette GES affichée à côté de la classe énergétique du DPE.',
    source: {
      label: 'ADEME',
      url: 'https://www.ademe.fr/',
    },
  },
  maprimerenov: {
    title: 'MaPrimeRénov’',
    definition:
      'Aide financière de l’État pour la rénovation énergétique des logements, versée par l’Anah aux propriétaires occupants, bailleurs et copropriétés.',
    source: {
      label: 'Anah · MaPrimeRénov’',
      url: 'https://www.maprimerenov.gouv.fr/',
    },
  },
  esris: {
    title: 'ESRIS — État des Servitudes Risques et Information sur les Sols',
    definition:
      'Ancienne dénomination de l’ERP avant juillet 2018. Couvrait déjà les risques naturels et technologiques pour vente et location.',
    source: {
      label: 'Géorisques',
      url: 'https://www.georisques.gouv.fr/',
    },
  },
  pprt: {
    title: 'PPRT — Plan de Prévention des Risques Technologiques',
    definition:
      'Document réglementaire qui délimite les zones exposées aux risques industriels majeurs autour des sites Seveso seuil haut.',
    source: {
      label: 'Légifrance',
      url: 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006074220/LEGISCTA000006176510/',
    },
  },
  'passoire-thermique': {
    title: 'Passoire thermique',
    definition:
      'Logement classé F ou G au DPE. La location des passoires est progressivement interdite depuis 2023 (G en 2025, F en 2028, E en 2034).',
    source: {
      label: 'Légifrance · décret 2022-510',
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000045581446',
    },
  },
  'audit-energetique': {
    title: 'Audit énergétique réglementaire',
    definition:
      'Obligatoire depuis avril 2023 à la vente des logements F ou G en monopropriété. Propose deux scénarios de travaux pour atteindre la classe B ou C.',
    source: {
      label: 'Légifrance · loi Climat',
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043956924',
    },
  },
  'factur-x': {
    title: 'Factur-X',
    definition:
      'Norme franco-allemande de facture électronique mixte PDF/XML. Standard retenu pour la facturation électronique obligatoire entre entreprises en France.',
    source: {
      label: 'economie.gouv.fr',
      url: 'https://www.economie.gouv.fr/cedef/facturation-electronique-entreprises',
    },
  },
  liciel: {
    title: 'Liciel',
    definition:
      'Logiciel historique de diagnostic immobilier édité par Liciel Environnement, leader du marché français avec environ 40 à 52 % de part de marché.',
  },
  obbc: {
    title: 'OBBC',
    definition:
      'Logiciel de diagnostic immobilier français, alternative à Liciel. Couvre les diagnostics DPE, amiante, plomb, gaz, électricité et termites.',
  },
  oris: {
    title: 'ORIS',
    definition:
      'Logiciel de diagnostic immobilier français, positionné sur le segment des cabinets de taille moyenne. Concurrent direct de Liciel et OBBC.',
  },
})

/**
 * Normalise une clé pour la recherche dans le glossaire.
 *
 * Permet d'écrire `<GlossaryTerm term="DPE" />` ou `<GlossaryTerm term="dpe" />`
 * ou `<GlossaryTerm term="Passoire thermique" />` indifféremment.
 */
function normalizeKey(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip combining marks (é → e, etc.)
    .replace(/[’'`]/g, '') // strip typographic apostrophes (’ ' `)
    .replace(/\s+/g, '-') // spaces → hyphens
}

/**
 * Récupère une entrée du glossaire par sa clé normalisée.
 * Retourne `null` si introuvable (le composant peut alors fallback gracieux).
 */
export function getGlossaryEntry(term: string): GlossaryEntry | null {
  const key = normalizeKey(term)
  return GLOSSARY[key] ?? null
}

/** Liste des clés disponibles (debug/tests). */
export const GLOSSARY_KEYS: ReadonlyArray<string> = Object.keys(GLOSSARY)
