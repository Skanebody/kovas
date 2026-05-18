// Stub : services partagés (BAN, IGN, Géorisques, INSEE Sirene)
// Implémentations détaillées dans apps/web/src/lib/services/

// Re-exports pour usage cross-package
export type BANSuggestion = {
  label: string
  housenumber?: string
  street?: string
  postcode: string
  city: string
  inseeCode: string
  context: string
  score: number
  banId: string
  location: { lat: number; lng: number }
}

export type CadastreInfo = {
  parcelId: string
  section: string
  number: string
  prefix?: string
  surfaceM2: number
  yearBuilt?: number
}

export type GeorisquesERP = {
  sismique: 1 | 2 | 3 | 4 | 5
  radon: 1 | 2 | 3
  inondation: boolean
  mouvementsTerrain: boolean
  argile: 'faible' | 'moyen' | 'fort'
  cavites: boolean
  termites: boolean
  natech: boolean
  pollution: boolean
  bruit: boolean
}

export type INSEESireneCompany = {
  siren: string
  siret: string
  legalName: string
  ape: string
  address: string
  city: string
  postalCode: string
  isActive: boolean
}
