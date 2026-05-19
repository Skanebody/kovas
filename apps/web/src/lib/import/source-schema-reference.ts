/**
 * Référence de mapping des en-têtes de colonnes des logiciels diag → schéma KOVAS.
 *
 * Sources : observations terrain sur exports réels Liciel + tickets bêta-testeurs.
 * Étoffé à mesure qu'on récupère plus de fixtures par logiciel.
 *
 * Cf. CLAUDE.md §13 — pas de désassemblage, on se base UNIQUEMENT sur les
 * exports utilisateur (art. 20 RGPD + jurisprudence CJUE SAS Institute c/ WPL).
 *
 * Format : la clé est une version *normalisée* (lowercase + sans accent + sans
 * espaces ni ponctuation) de l'en-tête source, la valeur est le nom de champ
 * KOVAS (cf. `ParsedClient`, `ParsedProperty`, etc.).
 *
 * V1 : seuls les mappings Liciel sont implémentés. Pour AnalysImmo / OBBC /
 * ORIS / Autre, le pipeline tombe sur le fallback Claude Haiku — efficace
 * en attendant les fixtures terrain (Sprint 15+).
 */

import type {
  ParsedClient,
  ParsedCopropriete,
  ParsedLot,
  ParsedProperty,
  SourceLogiciel,
} from './types'

/**
 * Normalise une en-tête : lowercase, retire accents, ponctuation, espaces.
 *  - "Nom du client"          → "nomduclient"
 *  - "Téléphone (mobile)"     → "telephonemobile"
 *  - "Adresse — Ligne 1"      → "adresseligne1"
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // retire accents (Unicode property)
    .replace(/[^a-z0-9]/g, '') // retire ponctuation + espaces
    .trim()
}

// ============================================================================
// Mapping headers Liciel → champs Parsed*
// ============================================================================
// TODO LICIEL : valider sur exports réels et compléter (champs telephone mobile,
// type de client, notes, etc.). Les variantes courantes sont déjà couvertes.

export const LICIEL_CSV_HEADERS = {
  client: {
    // Identifiants & nom
    licielid: 'source_id',
    id: 'source_id',
    idclient: 'source_id',
    type: 'type',
    typeclient: 'type',
    categorie: 'type',
    nom: 'nom',
    nomclient: 'nom',
    name: 'nom',
    lastname: 'nom',
    prenom: 'prenom',
    firstname: 'prenom',
    nomdefamille: 'nom',
    raisonsociale: 'raison_sociale',
    societe: 'raison_sociale',
    companyname: 'raison_sociale',
    // Identité légale
    siret: 'siret',
    numerosiret: 'siret',
    // Contact
    email: 'email',
    mail: 'email',
    courriel: 'email',
    telephone: 'telephone',
    tel: 'telephone',
    telfixe: 'telephone',
    phone: 'telephone',
    telephonemobile: 'telephone_mobile',
    telmobile: 'telephone_mobile',
    mobile: 'telephone_mobile',
    portable: 'telephone_mobile',
    // Adresse
    adresse: 'adresse_ligne1',
    adresseligne1: 'adresse_ligne1',
    adresse1: 'adresse_ligne1',
    address: 'adresse_ligne1',
    adresseligne2: 'adresse_ligne2',
    adresse2: 'adresse_ligne2',
    complementadresse: 'adresse_ligne2',
    codepostal: 'code_postal',
    cp: 'code_postal',
    postalcode: 'code_postal',
    zip: 'code_postal',
    ville: 'ville',
    city: 'ville',
    commune: 'ville',
    // Notes
    notes: 'notes',
    note: 'notes',
    commentaires: 'notes',
    remarques: 'notes',
  } satisfies Record<string, keyof ParsedClient>,

  property: {
    licielid: 'source_id',
    id: 'source_id',
    idbien: 'source_id',
    typebien: 'type_bien',
    typedebien: 'type_bien',
    type: 'type_bien',
    propertytype: 'type_bien',
    nature: 'type_bien',
    adresse: 'adresse_ligne1',
    adresseligne1: 'adresse_ligne1',
    adresse1: 'adresse_ligne1',
    adresseligne2: 'adresse_ligne2',
    adresse2: 'adresse_ligne2',
    complement: 'adresse_ligne2',
    codepostal: 'code_postal',
    cp: 'code_postal',
    ville: 'ville',
    surfacelo: 'surface_loi_carrez',
    surfacecarrez: 'surface_loi_carrez',
    surfaceloicarrez: 'surface_loi_carrez',
    surfaceloicarre: 'surface_loi_carrez',
    surfaceloicarrezm: 'surface_loi_carrez',
    surfacehabitable: 'surface_habitable',
    surface: 'surface_habitable',
    m2: 'surface_habitable',
    surfaceutile: 'surface_utile',
    nombrepieces: 'nombre_pieces',
    pieces: 'nombre_pieces',
    nbpieces: 'nombre_pieces',
    rooms: 'nombre_pieces',
    nombreniveaux: 'nombre_niveaux',
    niveaux: 'nombre_niveaux',
    etages: 'nombre_niveaux',
    anneeconstruction: 'annee_construction',
    annee: 'annee_construction',
    yearbuilt: 'annee_construction',
    proprietaireid: 'source_client_proprietaire_id',
    idproprietaire: 'source_client_proprietaire_id',
    proprietaire: 'source_client_proprietaire_id',
    coproprieteid: 'source_copropriete_id',
    idcopro: 'source_copropriete_id',
    copropriete: 'source_copropriete_id',
    lotid: 'source_lot_id',
    idlot: 'source_lot_id',
  } satisfies Record<string, keyof ParsedProperty>,

  copropriete: {
    licielid: 'source_id',
    id: 'source_id',
    idcopro: 'source_id',
    nom: 'nom_copro',
    nomcopro: 'nom_copro',
    nomcopropriete: 'nom_copro',
    denomination: 'nom_copro',
    rnic: 'numero_immatriculation',
    numerornic: 'numero_immatriculation',
    immatriculation: 'numero_immatriculation',
    numeroimmatriculation: 'numero_immatriculation',
    adresse: 'adresse_ligne1',
    adresseligne1: 'adresse_ligne1',
    codepostal: 'code_postal',
    cp: 'code_postal',
    ville: 'ville',
    nombrelots: 'nombre_lots',
    nblots: 'nombre_lots',
    lots: 'nombre_lots',
    anneeconstruction: 'annee_construction',
    annee: 'annee_construction',
    syndicid: 'source_syndic_id',
    idsyndic: 'source_syndic_id',
    syndic: 'source_syndic_id',
  } satisfies Record<string, keyof ParsedCopropriete>,

  lot: {
    licielid: 'source_id',
    id: 'source_id',
    idlot: 'source_id',
    numerolot: 'numero_lot',
    numero: 'numero_lot',
    lotnumber: 'numero_lot',
    etage: 'etage',
    floor: 'etage',
    numeroporte: 'numero_porte',
    porte: 'numero_porte',
    description: 'description',
    descriptif: 'description',
    coproprieteid: 'source_copropriete_id',
    idcopro: 'source_copropriete_id',
    propertyid: 'source_property_id',
    idbien: 'source_property_id',
    bienid: 'source_property_id',
  } satisfies Record<string, keyof ParsedLot>,
} as const

export type EntityKind = 'client' | 'property' | 'copropriete' | 'lot'

/**
 * Maps de headers par logiciel source. V1 : seul Liciel est rempli.
 * AnalysImmo / OBBC / ORIS / Autre sont des maps vides → fallback Claude Haiku.
 */
export type HeadersMap = {
  client: Record<string, keyof ParsedClient>
  property: Record<string, keyof ParsedProperty>
  copropriete: Record<string, keyof ParsedCopropriete>
  lot: Record<string, keyof ParsedLot>
}

const EMPTY_HEADERS: HeadersMap = {
  client: {},
  property: {},
  copropriete: {},
  lot: {},
}

export const SOURCE_CSV_HEADERS: Record<SourceLogiciel, HeadersMap> = {
  liciel: LICIEL_CSV_HEADERS,
  // TODO ANALYSIMMO : compléter avec fixtures terrain (Sprint 15+)
  analysimmo: EMPTY_HEADERS,
  // TODO OBBC : compléter avec fixtures terrain (Sprint 15+)
  obbc: EMPTY_HEADERS,
  // TODO ORIS : compléter avec fixtures terrain (Sprint 15+)
  oris: EMPTY_HEADERS,
  // Toujours vide — fallback Claude Haiku 100 %
  autre: EMPTY_HEADERS,
}

/**
 * Tente d'identifier le type d'entité que contient un CSV à partir de
 * ses headers normalisés. Score par catégorie = nombre de headers qui
 * mappent vers cette entité. Renvoie le meilleur score (≥ 2 minimum
 * pour éviter les faux positifs sur "id" seul).
 *
 * Si `headersMap` est vide pour toutes les entités (cas Autre/AnalysImmo/
 * OBBC/ORIS V1), renvoie `kind: null` → le caller bascule sur Claude Haiku.
 */
export function detectEntityKind(
  normalizedHeaders: string[],
  headersMap: HeadersMap = LICIEL_CSV_HEADERS,
): {
  kind: EntityKind | null
  score: number
  allScores: Record<EntityKind, number>
} {
  const allScores: Record<EntityKind, number> = {
    client: 0,
    property: 0,
    copropriete: 0,
    lot: 0,
  }

  for (const header of normalizedHeaders) {
    if (header in headersMap.client) allScores.client += 1
    if (header in headersMap.property) allScores.property += 1
    if (header in headersMap.copropriete) allScores.copropriete += 1
    if (header in headersMap.lot) allScores.lot += 1
  }

  // Discriminants forts (présence quasi exclusive à un type)
  const hasClientDiscriminant = normalizedHeaders.some((h) =>
    ['email', 'siret', 'prenom', 'raisonsociale', 'firstname'].includes(h),
  )
  const hasPropertyDiscriminant = normalizedHeaders.some((h) =>
    ['surfacehabitable', 'surfacecarrez', 'surfaceloicarrez', 'nombrepieces', 'typebien'].includes(
      h,
    ),
  )
  const hasCoproDiscriminant = normalizedHeaders.some((h) =>
    ['rnic', 'numerornic', 'immatriculation', 'numeroimmatriculation'].includes(h),
  )
  const hasLotDiscriminant = normalizedHeaders.some((h) =>
    ['numerolot', 'lotnumber', 'tantiemes'].includes(h),
  )

  if (hasClientDiscriminant) allScores.client += 5
  if (hasPropertyDiscriminant) allScores.property += 5
  if (hasCoproDiscriminant) allScores.copropriete += 5
  if (hasLotDiscriminant) allScores.lot += 5

  let bestKind: EntityKind | null = null
  let bestScore = 0
  for (const [kind, score] of Object.entries(allScores) as [EntityKind, number][]) {
    if (score > bestScore) {
      bestScore = score
      bestKind = kind
    }
  }

  // Seuil minimum : 2 headers matchés pour éviter une décision sur un seul "id"
  if (bestScore < 2) {
    return { kind: null, score: bestScore, allScores }
  }

  return { kind: bestKind, score: bestScore, allScores }
}
