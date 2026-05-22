#!/usr/bin/env tsx
/**
 * scripts/analyze-bundle.ts — analyse de la taille des chunks Next.
 *
 * Lance `next build` sur @kovas/web, puis parcourt `apps/web/.next` à la
 * recherche des stats produites par Webpack/Turbopack (`build-manifest.json`,
 * `app-build-manifest.json`) + parcourt récursivement `.next/static/chunks/`
 * pour mesurer les fichiers `.js` les plus lourds.
 *
 * Sortie :
 *  - `reports/bundle-top10.json` : top 10 plus gros chunks (bytes + gzip estim).
 *  - stdout : tableau lisible.
 *
 * Notes :
 *  - Si `next-bundle-analyzer` (HTML interactif) est installé, ce script ne
 *    le remplace pas — il fournit juste une métrique CI-friendly.
 *  - Le `next build` n'est pas relancé si `SKIP_BUILD=1` est défini.
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { gzipSync } from 'node:zlib'

const execFileAsync = promisify(execFile)

interface ChunkStat {
  path: string
  bytes: number
  gzippedBytes: number
}

interface BundleReport {
  generatedAt: string
  webAppPath: string
  totalChunks: number
  totalBytes: number
  totalGzippedBytes: number
  top10: Array<ChunkStat>
}

const WEB_APP_ROOT = resolve(process.cwd(), 'apps/web')
const NEXT_DIR = join(WEB_APP_ROOT, '.next')
const CHUNKS_DIR = join(NEXT_DIR, 'static', 'chunks')
const OUTPUT_PATH = resolve(process.cwd(), 'reports/bundle-top10.json')

async function runBuild(): Promise<void> {
  if (process.env.SKIP_BUILD === '1') {
    console.log('[analyze-bundle] SKIP_BUILD=1 — build sauté.')
    return
  }
  console.log('[analyze-bundle] next build…')
  await execFileAsync('pnpm', ['--filter', '@kovas/web', 'build'], {
    cwd: process.cwd(),
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  })
}

async function walkDir(dir: string, out: Array<string>): Promise<void> {
  let entries: Array<import('node:fs').Dirent> = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkDir(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full)
    }
  }
}

async function measureChunks(): Promise<Array<ChunkStat>> {
  const files: Array<string> = []
  await walkDir(CHUNKS_DIR, files)

  const stats: Array<ChunkStat> = []
  for (const f of files) {
    const s = await stat(f)
    const content = await readFile(f)
    const gz = gzipSync(content).length
    stats.push({
      path: relative(WEB_APP_ROOT, f),
      bytes: s.size,
      gzippedBytes: gz,
    })
  }
  return stats.sort((a, b) => b.bytes - a.bytes)
}

async function main(): Promise<void> {
  await runBuild()

  console.log('[analyze-bundle] mesure des chunks .js…')
  const chunks = await measureChunks()
  if (chunks.length === 0) {
    console.error('[analyze-bundle] aucun chunk trouvé — `next build` probablement non exécuté.')
    process.exit(1)
  }

  const totalBytes = chunks.reduce((acc, c) => acc + c.bytes, 0)
  const totalGzipped = chunks.reduce((acc, c) => acc + c.gzippedBytes, 0)

  const top10 = chunks.slice(0, 10)
  const report: BundleReport = {
    generatedAt: new Date().toISOString(),
    webAppPath: WEB_APP_ROOT,
    totalChunks: chunks.length,
    totalBytes,
    totalGzippedBytes: totalGzipped,
    top10,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8')

  console.log('[analyze-bundle] top 10 plus gros chunks :')
  for (const c of top10) {
    const kb = (c.bytes / 1024).toFixed(1)
    const gz = (c.gzippedBytes / 1024).toFixed(1)
    console.log(`  · ${kb} KB (gz ${gz} KB) — ${c.path}`)
  }
  console.log(
    `[analyze-bundle] total ${chunks.length} chunks · ${(totalBytes / 1024).toFixed(0)} KB · gz ${(totalGzipped / 1024).toFixed(0)} KB`,
  )
  console.log(`[analyze-bundle] rapport : ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('[analyze-bundle] échec :', err)
  process.exit(1)
})
