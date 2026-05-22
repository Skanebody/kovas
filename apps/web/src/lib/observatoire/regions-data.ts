/**
 * Référentiel 13 régions métropolitaines + Corse + prix médian par diagnostic.
 *
 * Données mockées V1 — réalistes mais non sourcées officiellement.
 * V2 : brancher Supabase RPC `observatoire_prices_by_region()` qui agrégera
 * les devis/factures réelles des diagnostiqueurs KOVAS (anonymisé,
 * tranches de 5 missions minimum par couple région × diagnostic).
 *
 * Sources informelles pour calibrage 2026 :
 * - Étude Que Choisir 2024 (prix DPE médian France ~140 €)
 * - Données ADEME : tarifs marché par région
 * - Tarifs constatés sur plateformes (HelloCasa, Allodiagnostic)
 */

export type DiagnosticType =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'

export interface DiagnosticInfo {
  /** Code court (clé de prix) */
  code: DiagnosticType
  /** Libellé court UI */
  label: string
  /** Libellé long descriptif */
  longLabel: string
}

export const DIAGNOSTICS: readonly DiagnosticInfo[] = [
  { code: 'dpe', label: 'DPE', longLabel: 'Diagnostic de performance énergétique' },
  { code: 'amiante', label: 'Amiante', longLabel: 'État amiante (DAPP / DTA)' },
  { code: 'plomb', label: 'Plomb', longLabel: 'Constat de risque d’exposition au plomb' },
  { code: 'gaz', label: 'Gaz', longLabel: 'État de l’installation intérieure de gaz' },
  { code: 'electricite', label: 'Électricité', longLabel: 'État de l’installation électrique' },
  { code: 'termites', label: 'Termites', longLabel: 'État relatif à la présence de termites' },
  { code: 'carrez', label: 'Carrez / Boutin', longLabel: 'Mesurage Loi Carrez ou Loi Boutin' },
  { code: 'erp', label: 'ERP', longLabel: 'État des risques et pollutions' },
] as const

export interface RegionInfo {
  /** Code INSEE région (2 chiffres) */
  code: string
  /** Nom officiel */
  name: string
  /** Code départements principaux pour résolution `/diagnostiqueurs/{dept}` */
  mainDepartments: readonly string[]
  /** Population (millions) pour pondération */
  population: number
  /** Prix médians par diagnostic (€ TTC) */
  prices: Readonly<Record<DiagnosticType, number>>
  /** Nombre de diagnostics réalisés sur 12 mois glissants (mocké réaliste) */
  diagnosticsCount: number
  /** Distribution classes énergétiques (somme = 100) */
  energyDistribution: Readonly<{
    a: number
    b: number
    c: number
    d: number
    e: number
    f: number
    g: number
  }>
}

/**
 * 13 régions métropolitaines (post-réforme 2016) + Corse séparée.
 * Données prix médians 2026 — Île-de-France et PACA en haut, ruralité au médian.
 */
export const REGIONS: readonly RegionInfo[] = [
  {
    code: '11',
    name: 'Île-de-France',
    mainDepartments: ['75', '77', '78', '91', '92', '93', '94', '95'],
    population: 12.4,
    prices: {
      dpe: 175,
      amiante: 145,
      plomb: 115,
      gaz: 110,
      electricite: 115,
      termites: 95,
      carrez: 90,
      erp: 35,
    },
    diagnosticsCount: 412_000,
    energyDistribution: { a: 2, b: 6, c: 18, d: 32, e: 24, f: 12, g: 6 },
  },
  {
    code: '93',
    name: 'Provence-Alpes-Côte d’Azur',
    mainDepartments: ['04', '05', '06', '13', '83', '84'],
    population: 5.1,
    prices: {
      dpe: 165,
      amiante: 135,
      plomb: 105,
      gaz: 100,
      electricite: 105,
      termites: 95,
      carrez: 85,
      erp: 35,
    },
    diagnosticsCount: 218_000,
    energyDistribution: { a: 3, b: 9, c: 22, d: 30, e: 21, f: 10, g: 5 },
  },
  {
    code: '84',
    name: 'Auvergne-Rhône-Alpes',
    mainDepartments: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
    population: 8.0,
    prices: {
      dpe: 155,
      amiante: 125,
      plomb: 95,
      gaz: 95,
      electricite: 100,
      termites: 85,
      carrez: 80,
      erp: 30,
    },
    diagnosticsCount: 305_000,
    energyDistribution: { a: 2, b: 7, c: 19, d: 31, e: 23, f: 12, g: 6 },
  },
  {
    code: '76',
    name: 'Occitanie',
    mainDepartments: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
    population: 5.9,
    prices: {
      dpe: 145,
      amiante: 120,
      plomb: 90,
      gaz: 90,
      electricite: 95,
      termites: 90,
      carrez: 75,
      erp: 30,
    },
    diagnosticsCount: 234_000,
    energyDistribution: { a: 3, b: 9, c: 22, d: 30, e: 20, f: 11, g: 5 },
  },
  {
    code: '75',
    name: 'Nouvelle-Aquitaine',
    mainDepartments: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
    population: 6.0,
    prices: {
      dpe: 140,
      amiante: 115,
      plomb: 90,
      gaz: 85,
      electricite: 90,
      termites: 95,
      carrez: 75,
      erp: 30,
    },
    diagnosticsCount: 245_000,
    energyDistribution: { a: 2, b: 8, c: 20, d: 30, e: 22, f: 12, g: 6 },
  },
  {
    code: '52',
    name: 'Pays de la Loire',
    mainDepartments: ['44', '49', '53', '72', '85'],
    population: 3.8,
    prices: {
      dpe: 140,
      amiante: 115,
      plomb: 85,
      gaz: 85,
      electricite: 90,
      termites: 80,
      carrez: 75,
      erp: 30,
    },
    diagnosticsCount: 158_000,
    energyDistribution: { a: 2, b: 7, c: 20, d: 32, e: 22, f: 12, g: 5 },
  },
  {
    code: '32',
    name: 'Hauts-de-France',
    mainDepartments: ['02', '59', '60', '62', '80'],
    population: 6.0,
    prices: {
      dpe: 135,
      amiante: 110,
      plomb: 90,
      gaz: 80,
      electricite: 90,
      termites: 75,
      carrez: 70,
      erp: 30,
    },
    diagnosticsCount: 215_000,
    energyDistribution: { a: 1, b: 5, c: 17, d: 30, e: 25, f: 15, g: 7 },
  },
  {
    code: '44',
    name: 'Grand Est',
    mainDepartments: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
    population: 5.5,
    prices: {
      dpe: 135,
      amiante: 110,
      plomb: 90,
      gaz: 85,
      electricite: 90,
      termites: 70,
      carrez: 70,
      erp: 30,
    },
    diagnosticsCount: 198_000,
    energyDistribution: { a: 1, b: 5, c: 17, d: 30, e: 25, f: 15, g: 7 },
  },
  {
    code: '53',
    name: 'Bretagne',
    mainDepartments: ['22', '29', '35', '56'],
    population: 3.4,
    prices: {
      dpe: 135,
      amiante: 115,
      plomb: 85,
      gaz: 80,
      electricite: 85,
      termites: 75,
      carrez: 70,
      erp: 30,
    },
    diagnosticsCount: 142_000,
    energyDistribution: { a: 2, b: 7, c: 19, d: 31, e: 23, f: 12, g: 6 },
  },
  {
    code: '28',
    name: 'Normandie',
    mainDepartments: ['14', '27', '50', '61', '76'],
    population: 3.3,
    prices: {
      dpe: 130,
      amiante: 110,
      plomb: 85,
      gaz: 80,
      electricite: 85,
      termites: 70,
      carrez: 70,
      erp: 30,
    },
    diagnosticsCount: 135_000,
    energyDistribution: { a: 1, b: 5, c: 17, d: 30, e: 24, f: 16, g: 7 },
  },
  {
    code: '27',
    name: 'Bourgogne-Franche-Comté',
    mainDepartments: ['21', '25', '39', '58', '70', '71', '89', '90'],
    population: 2.8,
    prices: {
      dpe: 130,
      amiante: 105,
      plomb: 85,
      gaz: 80,
      electricite: 85,
      termites: 70,
      carrez: 65,
      erp: 30,
    },
    diagnosticsCount: 112_000,
    energyDistribution: { a: 1, b: 5, c: 17, d: 30, e: 25, f: 15, g: 7 },
  },
  {
    code: '24',
    name: 'Centre-Val de Loire',
    mainDepartments: ['18', '28', '36', '37', '41', '45'],
    population: 2.6,
    prices: {
      dpe: 130,
      amiante: 105,
      plomb: 85,
      gaz: 80,
      electricite: 85,
      termites: 75,
      carrez: 65,
      erp: 30,
    },
    diagnosticsCount: 104_000,
    energyDistribution: { a: 1, b: 5, c: 18, d: 31, e: 24, f: 14, g: 7 },
  },
  {
    code: '94',
    name: 'Corse',
    mainDepartments: ['2A', '2B'],
    population: 0.35,
    prices: {
      dpe: 170,
      amiante: 140,
      plomb: 110,
      gaz: 105,
      electricite: 110,
      termites: 100,
      carrez: 85,
      erp: 40,
    },
    diagnosticsCount: 18_000,
    energyDistribution: { a: 3, b: 9, c: 21, d: 29, e: 22, f: 11, g: 5 },
  },
] as const

/** Calcule le prix médian France pondéré par population. */
export function getMedianPriceFrance(diag: DiagnosticType): number {
  const totalPop = REGIONS.reduce((sum, r) => sum + r.population, 0)
  const weighted = REGIONS.reduce((sum, r) => sum + r.prices[diag] * r.population, 0)
  return Math.round(weighted / totalPop)
}

/** Calcule le total des diagnostics 12 mois (France entière). */
export function getTotalDiagnosticsFrance(): number {
  return REGIONS.reduce((sum, r) => sum + r.diagnosticsCount, 0)
}

/** Renvoie la part nationale de logements classés F ou G (passoires énergétiques). */
export function getFGRateFrance(): number {
  const totalPop = REGIONS.reduce((sum, r) => sum + r.population, 0)
  const weighted = REGIONS.reduce((sum, r) => {
    const fg = r.energyDistribution.f + r.energyDistribution.g
    return sum + fg * r.population
  }, 0)
  return Math.round((weighted / totalPop) * 10) / 10
}
