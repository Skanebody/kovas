#!/usr/bin/env node
/**
 * Tests unitaires : runCoherenceChecks() règles métier.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'

const projectRoot = process.cwd()
const runnerPath = `${projectRoot}/tools/.coherence-runner.mts`
writeFileSync(
  runnerPath,
  `import { runCoherenceChecks } from '${projectRoot}/apps/web/src/lib/coherence-validation.ts'
const ctx = JSON.parse(process.argv[2])
const warnings = runCoherenceChecks(ctx)
console.log(JSON.stringify({ count: warnings.length, ids: warnings.map(w => w.id), severities: warnings.map(w => w.severity) }))
`,
)

function run(ctx) {
  const res = spawnSync('npx', ['-y', 'tsx', runnerPath, JSON.stringify(ctx)], {
    cwd: projectRoot,
    encoding: 'utf-8',
  })
  if (res.status !== 0) throw new Error(`tsx: ${res.stderr}`)
  return JSON.parse(res.stdout)
}

let pass = 0
let fail = 0

function check(name, actualResult, expectedIds) {
  const got = actualResult.ids.sort().join(',')
  const want = expectedIds.sort().join(',')
  if (got === want) {
    console.log(`  ✓ ${name} : ${actualResult.count} warnings ${actualResult.ids.join(', ')}`)
    pass++
  } else {
    console.log(`  ❌ ${name}`)
    console.log(`     attendu: ${want}`)
    console.log(`     obtenu:  ${got}`)
    fail++
  }
}

console.log('=== Règles cohérence ===')

// 1. Maison 1850 + classe A → warning old_house_high_class
check(
  'Maison 1850 + classe A',
  run({ property: { surface_total: 100, year_built: 1850, property_type: 'maison', energy_class: 'A' }, voiceNotes: [] }),
  ['old_house_high_class'],
)

// 2. Maison 2018 + classe G → error recent_low_class
check(
  'Maison 2018 + classe G',
  run({ property: { surface_total: 100, year_built: 2018, property_type: 'maison', energy_class: 'G' }, voiceNotes: [] }),
  ['recent_low_class'],
)

// 3. Surface 5m² → warning surface_too_low
check(
  'Surface trop faible',
  run({ property: { surface_total: 5, year_built: 1990, property_type: 'appartement' }, voiceNotes: [] }),
  ['surface_too_low'],
)

// 4. Surface 1500m² maison → warning surface_too_high
check(
  'Surface trop élevée maison',
  run({ property: { surface_total: 1500, year_built: 1990, property_type: 'maison' }, voiceNotes: [] }),
  ['surface_too_high'],
)

// 5. Année 2050 → error year_future
check(
  'Année dans le futur',
  run({ property: { surface_total: 100, year_built: 2050, property_type: 'maison' }, voiceNotes: [] }),
  ['year_future'],
)

// 6. Sans chauffage mentionné avec 2+ voice notes → info no_heating_detected
check(
  'Pas de chauffage mentionné',
  run({
    property: { surface_total: 100, year_built: 1990, property_type: 'maison' },
    voiceNotes: [
      { surface_m2: 30, equipment: [] },
      { surface_m2: 20, equipment: [] },
    ],
  }),
  ['no_heating_detected'],
)

// 7. Surface DB vs voice surfaces incohérentes
check(
  'Surface DB vs voice mismatch',
  run({
    property: { surface_total: 100, year_built: 1990, property_type: 'maison' },
    voiceNotes: [
      { surface_m2: 200, equipment: [{ kind: 'chaudiere' }] }, // 200 vs 100 → ratio 2
    ],
  }),
  ['surface_db_voice_mismatch'],
)

// 8. Mission propre → aucun warning
check(
  'Mission cohérente',
  run({
    property: { surface_total: 85, year_built: 1990, property_type: 'maison' },
    voiceNotes: [
      { surface_m2: 30, equipment: [{ kind: 'chaudiere' }] },
      { surface_m2: 25, equipment: [] },
    ],
  }),
  [],
)

try { unlinkSync(runnerPath) } catch {}
console.log(`\n${fail === 0 ? '✅' : '❌'} Coherence ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
