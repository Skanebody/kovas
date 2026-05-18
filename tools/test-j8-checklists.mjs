#!/usr/bin/env node
/**
 * Tests unitaires : runChecklist() pour DPE et Amiante.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'

const projectRoot = process.cwd()
const runnerPath = `${projectRoot}/tools/.checklist-runner.mts`
writeFileSync(
  runnerPath,
  `import { runChecklist } from '${projectRoot}/apps/web/src/lib/checklists.ts'
const op = process.argv[2]
const payload = JSON.parse(process.argv[3] ?? '{}')
const r = runChecklist(op, payload.ctx, payload.manualState ?? {})
console.log(JSON.stringify({
  total: r.items.length,
  autoOk: r.items.filter(i => i.status === 'auto_ok').length,
  manual: r.items.filter(i => i.status === 'manual').length,
  requiredOk: r.requiredOk,
  completion: r.completion,
}))
`,
)

function run(type, payload) {
  const res = spawnSync('npx', ['-y', 'tsx', runnerPath, type, JSON.stringify(payload)], {
    cwd: projectRoot,
    encoding: 'utf-8',
  })
  if (res.status !== 0) throw new Error(`tsx: ${res.stderr}`)
  return JSON.parse(res.stdout)
}

let pass = 0
let fail = 0

console.log('=== DPE vente — mission vide ===')
const r1 = run('dpe_vente', {
  ctx: { rooms: [], photos: [], voiceNotes: [], property: { surface_total: null, year_built: null, property_type: null } },
})
console.log(`  total ${r1.total}, autoOk ${r1.autoOk}, manual ${r1.manual}, requiredOk ${r1.requiredOk}, completion ${r1.completion}`)
if (!r1.requiredOk && r1.autoOk === 0 && r1.total >= 8) {
  console.log('  ✓ Mission vide → required failed, 0 auto OK')
  pass++
} else {
  console.log('  ❌ inattendu')
  fail++
}

console.log('\n=== DPE vente — mission complète auto ===')
const r2 = run('dpe_vente', {
  ctx: {
    rooms: [{ id: 'a', room_type: 'salon' }, { id: 'b', room_type: 'cuisine' }],
    photos: [{ room_id: 'a' }, { room_id: 'a' }, { room_id: 'b' }, { room_id: 'b' }],
    voiceNotes: [],
    property: { surface_total: 85, year_built: 1990, property_type: 'maison' },
  },
})
console.log(`  total ${r2.total}, autoOk ${r2.autoOk}, manual ${r2.manual}, requiredOk ${r2.requiredOk}`)
if (r2.autoOk === 4) {
  console.log('  ✓ Tous les auto OK passent (4/4 : rooms, photos≥3, surface, year)')
  pass++
} else {
  console.log(`  ❌ attendu 4 auto OK, obtenu ${r2.autoOk}`)
  fail++
}

console.log('\n=== Amiante — bâtiment 1990 (hors champ avant 1997) ===')
const r3 = run('amiante_vente', {
  ctx: {
    rooms: [{ id: 'a', room_type: 'salon' }],
    photos: [{ room_id: 'a' }, { room_id: 'a' }, { room_id: 'a' }],
    voiceNotes: [],
    property: { surface_total: 100, year_built: 1990, property_type: 'maison' },
  },
})
// year < 1997 → auto_ok pour amiante_built_before_1997
if (r3.autoOk >= 5) {
  console.log('  ✓ 1990 < 1997 → check passe')
  pass++
} else {
  console.log(`  ❌ auto_ok=${r3.autoOk} attendu >=5`)
  fail++
}

console.log('\n=== Amiante — bâtiment 2010 ===')
const r4 = run('amiante_vente', {
  ctx: {
    rooms: [{ id: 'a', room_type: 'salon' }],
    photos: [{ room_id: 'a' }, { room_id: 'a' }, { room_id: 'a' }],
    voiceNotes: [],
    property: { surface_total: 100, year_built: 2010, property_type: 'maison' },
  },
})
// 2010 ≥ 1997 → amiante_built_before_1997 doit échouer (required) → requiredOk false
if (!r4.requiredOk) {
  console.log('  ✓ 2010 ≥ 1997 → required Amiante échoue (mission hors champ)')
  pass++
} else {
  console.log('  ❌ devrait avoir requiredOk=false')
  fail++
}

try { unlinkSync(runnerPath) } catch {}
console.log(`\n${fail === 0 ? '✅' : '❌'} Checklist tests ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
