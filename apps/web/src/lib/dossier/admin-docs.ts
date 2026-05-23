/**
 * KOVAS — Documents administratifs génériques V1 (placeholders fonctionnels).
 *
 * Cinq documents PDF gérés côté hub dossier :
 *  - order      : Bon de commande
 *  - visit      : Attestation de visite
 *  - release    : Décharge propriétaire
 *  - bordereau  : Bordereau diagnostic
 *  - summary    : Récap mission
 *
 * V1 : génération d'un PDF minimal sobre (entête KOVAS + nom client + dossier
 * + corps placeholder). Le but est que les boutons FONCTIONNENT — le contenu
 * détaillé sera livré au sprint admin-docs V1.5.
 *
 * Le module fournit uniquement des **types et helpers purs** (server- ou
 * client-safe). La génération jsPDF a lieu côté client dans
 * `admin-docs-client.ts` afin d'éviter une route API supplémentaire.
 */

export type AdminDocKind =
  | 'order'
  | 'visit'
  | 'release'
  | 'bordereau'
  | 'summary'

export interface AdminDocMeta {
  readonly id: AdminDocKind
  readonly label: string
  /** Titre complet pour la page de titre du PDF généré */
  readonly fullTitle: string
  /** Slug utilisé dans le nom de fichier `KOVAS-{slug}-{ref}.pdf` */
  readonly slug: string
}

export const ADMIN_DOCS: Readonly<Record<AdminDocKind, AdminDocMeta>> = {
  order: {
    id: 'order',
    label: 'Bon de commande',
    fullTitle: 'Bon de commande',
    slug: 'BC',
  },
  visit: {
    id: 'visit',
    label: 'Attestation de visite',
    fullTitle: 'Attestation de visite sur site',
    slug: 'VISITE',
  },
  release: {
    id: 'release',
    label: 'Décharge propriétaire',
    fullTitle: 'Décharge de responsabilité propriétaire',
    slug: 'DECHARGE',
  },
  bordereau: {
    id: 'bordereau',
    label: 'Bordereau diagnostic',
    fullTitle: 'Bordereau de remise des diagnostics',
    slug: 'BORDEREAU',
  },
  summary: {
    id: 'summary',
    label: 'Récap mission',
    fullTitle: 'Récapitulatif de mission',
    slug: 'RECAP',
  },
} as const

export const ADMIN_DOCS_ORDER: readonly AdminDocKind[] = [
  'order',
  'visit',
  'release',
  'bordereau',
  'summary',
] as const

export interface AdminDocContext {
  dossierReference: string
  clientName: string | null
  clientAddress: string | null
  propertyAddress: string | null
}

/**
 * Compose un nom de fichier stable et lisible :
 *   KOVAS-{slug}-{reference}.pdf
 */
export function buildAdminDocFileName(
  kind: AdminDocKind,
  reference: string,
): string {
  const meta = ADMIN_DOCS[kind]
  const safeRef = reference.replace(/[^A-Za-z0-9_-]/g, '_')
  return `KOVAS-${meta.slug}-${safeRef}.pdf`
}

/**
 * Texte de corps par défaut (placeholder V1). Sobre, vouvoiement,
 * structure légale minimaliste. Le contenu détaillé sera livré au
 * sprint admin-docs V1.5 (clauses spécifiques par type).
 */
export function buildAdminDocBody(
  kind: AdminDocKind,
  ctx: AdminDocContext,
): readonly string[] {
  const client = ctx.clientName ?? '—'
  const property = ctx.propertyAddress ?? '—'
  const ref = ctx.dossierReference

  switch (kind) {
    case 'order':
      return [
        `Référence dossier : ${ref}`,
        `Client : ${client}`,
        `Bien concerné : ${property}`,
        '',
        'Le présent bon de commande formalise la mission de diagnostic',
        'immobilier confiée à votre diagnostiqueur certifié.',
        '',
        'Les prestations, montants et conditions tarifaires figurent au',
        'devis associé. La signature de ce bon vaut acceptation du devis',
        'et autorisation d\'intervention sur le bien désigné.',
      ]
    case 'visit':
      return [
        `Référence dossier : ${ref}`,
        `Client : ${client}`,
        `Bien visité : ${property}`,
        '',
        'Le diagnostiqueur certifié atteste s\'être présenté sur le bien',
        'désigné ci-dessus aux fins de réalisation des diagnostics',
        'immobiliers prévus à la mission.',
        '',
        'La visite s\'est déroulée dans des conditions permettant l\'accès',
        'à l\'ensemble des locaux et équipements nécessaires.',
      ]
    case 'release':
      return [
        `Référence dossier : ${ref}`,
        `Propriétaire : ${client}`,
        `Bien : ${property}`,
        '',
        'Le propriétaire désigné ci-dessus déclare avoir fourni au',
        'diagnostiqueur l\'ensemble des éléments en sa possession',
        'concernant le bien (titre de propriété, plans, factures',
        'énergétiques, anciens diagnostics, etc.).',
        '',
        'Il décharge le diagnostiqueur de toute responsabilité liée à',
        'des informations volontairement omises ou erronées.',
      ]
    case 'bordereau':
      return [
        `Référence dossier : ${ref}`,
        `Destinataire : ${client}`,
        `Bien concerné : ${property}`,
        '',
        'Le présent bordereau récapitule les diagnostics immobiliers',
        'remis au client à l\'issue de la mission.',
        '',
        'La liste exhaustive des diagnostics réalisés et la date de leur',
        'remise figurent dans le dossier KOVAS associé.',
      ]
    case 'summary':
      return [
        `Référence dossier : ${ref}`,
        `Client : ${client}`,
        `Bien : ${property}`,
        '',
        'Récapitulatif synthétique de la mission diagnostic.',
        '',
        'Vous retrouverez le détail (rapports, photos, notes vocales,',
        'historique) dans votre espace KOVAS sous la référence',
        `${ref}.`,
      ]
  }
}
