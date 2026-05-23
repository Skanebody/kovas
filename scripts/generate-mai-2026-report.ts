#!/usr/bin/env tsx
/**
 * scripts/generate-mai-2026-report.ts
 *
 * Génère statiquement le PDF du rapport mensuel Observatoire KOVAS pour
 * l'édition Mai 2026, en attendant que le cron `kovas-observatoire-monthly`
 * tourne pour la première fois le 1er juin 2026.
 *
 * Le PDF est écrit dans `apps/web/public/observatoire-reports/mai-2026.pdf`,
 * accessible publiquement à `/observatoire-reports/mai-2026.pdf` côté Next.js.
 *
 * Réutilise directement `generateObservatoireReportPdf` (lib partagée jsPDF)
 * + un set de stats hardcodées calibrées Mai 2026 (cohérent avec
 * regions-data.ts existant).
 *
 * Lancement : `pnpm tsx scripts/generate-mai-2026-report.ts`
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateObservatoireReportPdf } from '../apps/web/src/lib/observatoire/pdf-generator.ts'
import { REGIONS } from '../apps/web/src/lib/observatoire/regions-data.ts'
import type {
  ObservatoireStats,
  TopCity,
} from '../apps/web/src/lib/observatoire/stats-aggregator.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const OUTPUT_RELATIVE = '../apps/web/public/observatoire-reports/mai-2026.pdf'

const stats: ObservatoireStats = {
  fGRate: 17.4,
  dpeMedianPrice: 165,
  medianDelivery: 12,
  lastUpdated: '2026-05-31T22:00:00.000Z',
  lastUpdatedLabel: 'Mai 2026',
  totalDiagnosticsYear: REGIONS.reduce((sum, r) => sum + r.diagnosticsCount, 0),
}

const topCities: readonly TopCity[] = [
  {
    rank: 1,
    name: 'Grenoble',
    department: '38',
    slug: 'grenoble',
    score: 92,
    renovRatio: 18.4,
    fgYoy: -3.8,
    primeRenov: 14.2,
  },
  {
    rank: 2,
    name: 'Nantes',
    department: '44',
    slug: 'nantes',
    score: 88,
    renovRatio: 16.9,
    fgYoy: -3.2,
    primeRenov: 12.8,
  },
  {
    rank: 3,
    name: 'Strasbourg',
    department: '67',
    slug: 'strasbourg',
    score: 86,
    renovRatio: 16.1,
    fgYoy: -3.5,
    primeRenov: 13.4,
  },
  {
    rank: 4,
    name: 'Rennes',
    department: '35',
    slug: 'rennes',
    score: 84,
    renovRatio: 15.7,
    fgYoy: -2.9,
    primeRenov: 11.9,
  },
  {
    rank: 5,
    name: 'Lyon',
    department: '69',
    slug: 'lyon',
    score: 82,
    renovRatio: 15.2,
    fgYoy: -2.6,
    primeRenov: 11.3,
  },
  {
    rank: 6,
    name: 'Bordeaux',
    department: '33',
    slug: 'bordeaux',
    score: 80,
    renovRatio: 14.8,
    fgYoy: -2.4,
    primeRenov: 10.9,
  },
  {
    rank: 7,
    name: 'Lille',
    department: '59',
    slug: 'lille',
    score: 78,
    renovRatio: 14.3,
    fgYoy: -2.8,
    primeRenov: 12.6,
  },
  {
    rank: 8,
    name: 'Angers',
    department: '49',
    slug: 'angers',
    score: 77,
    renovRatio: 14.0,
    fgYoy: -2.5,
    primeRenov: 11.4,
  },
  {
    rank: 9,
    name: 'Montpellier',
    department: '34',
    slug: 'montpellier',
    score: 75,
    renovRatio: 13.7,
    fgYoy: -2.1,
    primeRenov: 10.5,
  },
  {
    rank: 10,
    name: 'Toulouse',
    department: '31',
    slug: 'toulouse',
    score: 74,
    renovRatio: 13.4,
    fgYoy: -2.0,
    primeRenov: 10.2,
  },
]

async function main(): Promise<void> {
  const outputPath = resolve(__dirname, OUTPUT_RELATIVE)
  await mkdir(dirname(outputPath), { recursive: true })

  const pdfBytes = generateObservatoireReportPdf({ stats, topCities })
  await writeFile(outputPath, pdfBytes)

  // biome-ignore lint/suspicious/noConsole: script CLI
  console.log(
    `Rapport observatoire Mai 2026 généré : ${outputPath} (${pdfBytes.byteLength} octets, ~${Math.round(
      pdfBytes.byteLength / 1024,
    )} Ko)`,
  )
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: script CLI
  console.error('Échec génération PDF Mai 2026 :', err)
  process.exit(1)
})
