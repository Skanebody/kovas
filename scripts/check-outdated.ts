#!/usr/bin/env tsx
/**
 * scripts/check-outdated.ts — détection des dépendances majeures en retard.
 *
 * Exécute `pnpm outdated --format json` à la racine, parse le résultat, et
 * pour chaque package dont la `latest` est en version majeure supérieure à
 * la `current`, ouvre une issue GitHub via `gh issue create` (si `GITHUB_TOKEN`
 * et `gh` sont disponibles). À défaut, écrit le rapport dans
 * `reports/outdated-dependencies.json` et liste les bumps proposés en stdout.
 *
 * Exit 0 sauf erreur d'exécution (la présence de majors en retard n'est PAS
 * bloquante — c'est de la veille proactive).
 */

import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const OUTPUT_PATH = resolve(process.cwd(), 'reports/outdated-dependencies.json')

interface PnpmOutdatedEntry {
  current?: string
  latest?: string
  wanted?: string
  dependencyType?: string
}

interface BumpProposal {
  name: string
  current: string
  latest: string
  workspace?: string
  type: string
}

interface OutdatedReport {
  generatedAt: string
  proposalCount: number
  proposals: Array<BumpProposal>
  issuesCreated: Array<{ name: string; issueUrl: string }>
  errors: Array<string>
}

function parseMajor(version: string): number {
  const cleaned = version.replace(/^[\^~>=<]+/, '')
  const first = cleaned.split('.')[0]
  return Number.parseInt(first ?? '0', 10)
}

async function runPnpmOutdated(): Promise<Record<string, PnpmOutdatedEntry>> {
  try {
    const { stdout } = await execFileAsync('pnpm', ['outdated', '--format', 'json', '-r'], {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
    })
    if (!stdout.trim()) {
      return {}
    }
    return JSON.parse(stdout) as Record<string, PnpmOutdatedEntry>
  } catch (err) {
    // pnpm outdated exit 1 quand il y a des outdated — stdout reste valide.
    const e = err as { stdout?: string; message: string }
    if (e.stdout?.trim().startsWith('{')) {
      return JSON.parse(e.stdout) as Record<string, PnpmOutdatedEntry>
    }
    throw new Error(`pnpm outdated a échoué : ${e.message}`)
  }
}

async function createGithubIssue(proposal: BumpProposal): Promise<string | null> {
  const title = `chore(deps): bump ${proposal.name} ${proposal.current} → ${proposal.latest} (major)`
  const body = [
    `Dépendance \`${proposal.name}\` détectée en retard d'une version majeure.`,
    '',
    `- Version actuelle : \`${proposal.current}\``,
    `- Dernière publiée : \`${proposal.latest}\``,
    `- Type : ${proposal.type}`,
    proposal.workspace ? `- Workspace : \`${proposal.workspace}\`` : '',
    '',
    'Étapes suggérées :',
    `1. Lire le CHANGELOG de ${proposal.name} entre ces deux versions.`,
    `2. Mettre à jour le package (\`pnpm up ${proposal.name}@latest\`).`,
    '3. Lancer typecheck + tests + lighthouse local.',
    '4. PR de bump isolée (pas dans un PR feature).',
    '',
    '> Issue ouverte automatiquement par `scripts/check-outdated.ts`.',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const { stdout } = await execFileAsync('gh', [
      'issue',
      'create',
      '--title',
      title,
      '--body',
      body,
      '--label',
      'dependencies,maintenance',
    ])
    return stdout.trim()
  } catch (err) {
    console.warn(
      `[check-outdated] impossible de créer l'issue ${proposal.name} (gh CLI absent ou non authentifié) : ${(err as Error).message}`,
    )
    return null
  }
}

async function main(): Promise<void> {
  console.log('[check-outdated] analyse des dépendances obsolètes…')
  const report: OutdatedReport = {
    generatedAt: new Date().toISOString(),
    proposalCount: 0,
    proposals: [],
    issuesCreated: [],
    errors: [],
  }

  let outdated: Record<string, PnpmOutdatedEntry> = {}
  try {
    outdated = await runPnpmOutdated()
  } catch (err) {
    report.errors.push((err as Error).message)
  }

  for (const [name, entry] of Object.entries(outdated)) {
    if (!entry.current || !entry.latest) continue
    const currentMajor = parseMajor(entry.current)
    const latestMajor = parseMajor(entry.latest)
    if (latestMajor > currentMajor) {
      report.proposals.push({
        name,
        current: entry.current,
        latest: entry.latest,
        type: entry.dependencyType ?? 'unknown',
      })
    }
  }

  report.proposalCount = report.proposals.length

  if (report.proposals.length > 0 && process.env.GITHUB_TOKEN) {
    console.log(`[check-outdated] ${report.proposals.length} major bump(s) — ouverture d'issues…`)
    for (const p of report.proposals) {
      const url = await createGithubIssue(p)
      if (url) report.issuesCreated.push({ name: p.name, issueUrl: url })
    }
  } else if (report.proposals.length > 0) {
    console.log(
      `[check-outdated] ${report.proposals.length} major bump(s) détecté(s) — GITHUB_TOKEN absent, pas de création d'issue.`,
    )
    for (const p of report.proposals) {
      console.log(`  · ${p.name} ${p.current} → ${p.latest}`)
    }
  } else {
    console.log('[check-outdated] aucune dépendance major en retard.')
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log(`[check-outdated] rapport : ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('[check-outdated] échec :', err)
  process.exit(1)
})
