/**
 * Liste de référence des villes ciblées pour l'acquisition SEO local.
 *
 * Source pour /trouver-un-diagnostiqueur/[slug] (pages de recherche par ville) et
 * pour sitemap-villes.xml. Quand la table `cities` Supabase sera créée
 * (sprint SEO M3-M4), ce fichier servira de seed et le sitemap basculera
 * sur la DB.
 *
 * 30 villes choisies : top métropoles FR (volume diagnostic > 10k/an) +
 * villes côtières/touristiques (saisonnalité location) + DOM-TOM (zone amiante
 * fort historique). Cf. docs/SEO.md pour la méthodologie.
 */

export interface CitySeed {
  readonly slug: string
  readonly name: string
  readonly postalCode: string
  readonly region: string
  readonly population: number
}

export const SEO_CITIES: ReadonlyArray<CitySeed> = [
  // Métropoles
  {
    slug: 'paris',
    name: 'Paris',
    postalCode: '75000',
    region: 'Île-de-France',
    population: 2102650,
  },
  {
    slug: 'marseille',
    name: 'Marseille',
    postalCode: '13000',
    region: "Provence-Alpes-Côte d'Azur",
    population: 873076,
  },
  {
    slug: 'lyon',
    name: 'Lyon',
    postalCode: '69000',
    region: 'Auvergne-Rhône-Alpes',
    population: 522969,
  },
  {
    slug: 'toulouse',
    name: 'Toulouse',
    postalCode: '31000',
    region: 'Occitanie',
    population: 493465,
  },
  {
    slug: 'nice',
    name: 'Nice',
    postalCode: '06000',
    region: "Provence-Alpes-Côte d'Azur",
    population: 342669,
  },
  {
    slug: 'nantes',
    name: 'Nantes',
    postalCode: '44000',
    region: 'Pays de la Loire',
    population: 320732,
  },
  {
    slug: 'montpellier',
    name: 'Montpellier',
    postalCode: '34000',
    region: 'Occitanie',
    population: 299096,
  },
  {
    slug: 'strasbourg',
    name: 'Strasbourg',
    postalCode: '67000',
    region: 'Grand Est',
    population: 287228,
  },
  {
    slug: 'bordeaux',
    name: 'Bordeaux',
    postalCode: '33000',
    region: 'Nouvelle-Aquitaine',
    population: 260958,
  },
  {
    slug: 'lille',
    name: 'Lille',
    postalCode: '59000',
    region: 'Hauts-de-France',
    population: 234475,
  },
  { slug: 'rennes', name: 'Rennes', postalCode: '35000', region: 'Bretagne', population: 220488 },
  { slug: 'reims', name: 'Reims', postalCode: '51100', region: 'Grand Est', population: 182211 },
  {
    slug: 'saint-etienne',
    name: 'Saint-Étienne',
    postalCode: '42000',
    region: 'Auvergne-Rhône-Alpes',
    population: 173089,
  },
  {
    slug: 'toulon',
    name: 'Toulon',
    postalCode: '83000',
    region: "Provence-Alpes-Côte d'Azur",
    population: 171953,
  },
  {
    slug: 'le-havre',
    name: 'Le Havre',
    postalCode: '76600',
    region: 'Normandie',
    population: 165057,
  },
  {
    slug: 'grenoble',
    name: 'Grenoble',
    postalCode: '38000',
    region: 'Auvergne-Rhône-Alpes',
    population: 158704,
  },
  {
    slug: 'dijon',
    name: 'Dijon',
    postalCode: '21000',
    region: 'Bourgogne-Franche-Comté',
    population: 156920,
  },
  {
    slug: 'angers',
    name: 'Angers',
    postalCode: '49000',
    region: 'Pays de la Loire',
    population: 154508,
  },
  { slug: 'nimes', name: 'Nîmes', postalCode: '30000', region: 'Occitanie', population: 148104 },
  {
    slug: 'villeurbanne',
    name: 'Villeurbanne',
    postalCode: '69100',
    region: 'Auvergne-Rhône-Alpes',
    population: 147712,
  },
  {
    slug: 'clermont-ferrand',
    name: 'Clermont-Ferrand',
    postalCode: '63000',
    region: 'Auvergne-Rhône-Alpes',
    population: 146734,
  },
  {
    slug: 'aix-en-provence',
    name: 'Aix-en-Provence',
    postalCode: '13100',
    region: "Provence-Alpes-Côte d'Azur",
    population: 143006,
  },
  { slug: 'brest', name: 'Brest', postalCode: '29200', region: 'Bretagne', population: 139926 },
  {
    slug: 'le-mans',
    name: 'Le Mans',
    postalCode: '72000',
    region: 'Pays de la Loire',
    population: 142946,
  },
  {
    slug: 'tours',
    name: 'Tours',
    postalCode: '37000',
    region: 'Centre-Val de Loire',
    population: 137087,
  },
  {
    slug: 'amiens',
    name: 'Amiens',
    postalCode: '80000',
    region: 'Hauts-de-France',
    population: 134057,
  },
  {
    slug: 'limoges',
    name: 'Limoges',
    postalCode: '87000',
    region: 'Nouvelle-Aquitaine',
    population: 130876,
  },
  // Villes secondaires stratégiques (côtières, dieppe pour l'avatar Benjamin)
  { slug: 'dieppe', name: 'Dieppe', postalCode: '76200', region: 'Normandie', population: 28333 },
  { slug: 'rouen', name: 'Rouen', postalCode: '76000', region: 'Normandie', population: 116149 },
  { slug: 'caen', name: 'Caen', postalCode: '14000', region: 'Normandie', population: 106538 },
]
