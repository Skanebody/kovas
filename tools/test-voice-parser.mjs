#!/usr/bin/env node
/**
 * Tests unitaires du parser voice custom JS.
 * Vérifie l'extraction des données structurées depuis transcripts terrain réalistes.
 *
 * Note : exécute le parser TS via une copie locale du fonctionnement attendu.
 * Le vrai parser est dans apps/web/src/lib/voice-parser.ts.
 */

const cases = [
  {
    name: 'Salon DPE standard',
    transcript: "Salon de 35 mètres carrés, construit en 1975, chaudière Saunier Duval à condensation, double vitrage, isolation par l'intérieur en laine de verre, VMC simple flux hygroréglable.",
    expect: {
      surface_m2: 35,
      year_built: 1975,
      equipment_kinds: ['chaudiere', 'isolation', 'ventilation', 'fenetre'],
      brand_chaudiere: 'saunier duval',
      confidence_min: 0.7,
    },
  },
  {
    name: 'Cuisine simple',
    transcript: "Cuisine de 12,5 m². Chauffe-eau électrique de 200 litres. Tableau électrique vétuste.",
    expect: {
      surface_m2: 12.5,
      equipment_kinds: ['chauffe_eau', 'tableau_elec'],
      confidence_min: 0.5,
    },
  },
  {
    name: 'Maison ancienne avec PAC',
    transcript: "Maison construite en 1958, surface 85m2, hauteur sous plafond de 2,4m. Pompe à chaleur Daikin air-eau installée en 2020. Classe énergétique D.",
    expect: {
      surface_m2: 85,
      year_built: 1958,
      ceiling_height_m: 2.4,
      equipment_kinds: ['pac'],
      brand_pac: 'daikin',
      energy_class: 'D',
      confidence_min: 0.7,
    },
  },
  {
    name: 'Note vide',
    transcript: '',
    expect: { confidence_min: 0, confidence_max: 0 },
  },
  {
    name: 'Observation à risque',
    transcript: "Plafond avec infiltration visible côté nord. Risque d'humidité à surveiller.",
    expect: { observations_min: 1 },
  },
]

// Charge le parser TS via tsx en sous-process — solution simple
import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'

const projectRoot = process.cwd()
const runnerPath = `${projectRoot}/tools/.parser-runner.mts`
const runner = `import { parseVoiceTranscript } from '${projectRoot}/apps/web/src/lib/voice-parser.ts'
const transcript = process.argv[2] ?? ''
const result = parseVoiceTranscript(transcript)
console.log(JSON.stringify(result))
`
writeFileSync(runnerPath, runner)

function runParser(transcript) {
  const res = spawnSync('npx', ['-y', 'tsx', runnerPath, transcript], {
    cwd: projectRoot,
    encoding: 'utf-8',
  })
  if (res.status !== 0) throw new Error(`tsx failed: ${res.stderr}`)
  return JSON.parse(res.stdout)
}

let pass = 0
let fail = 0

for (const c of cases) {
  const result = runParser(c.transcript)
  let caseOk = true
  const errs = []

  if (c.expect.surface_m2 !== undefined && result.surface_m2 !== c.expect.surface_m2) {
    errs.push(`surface_m2 ${result.surface_m2} ≠ ${c.expect.surface_m2}`)
    caseOk = false
  }
  if (c.expect.year_built !== undefined && result.year_built !== c.expect.year_built) {
    errs.push(`year_built ${result.year_built} ≠ ${c.expect.year_built}`)
    caseOk = false
  }
  if (c.expect.ceiling_height_m !== undefined && Math.abs((result.ceiling_height_m ?? 0) - c.expect.ceiling_height_m) > 0.01) {
    errs.push(`ceiling ${result.ceiling_height_m} ≠ ${c.expect.ceiling_height_m}`)
    caseOk = false
  }
  if (c.expect.equipment_kinds) {
    for (const k of c.expect.equipment_kinds) {
      if (!result.equipment.some((e) => e.kind === k)) {
        errs.push(`missing equipment ${k}`)
        caseOk = false
      }
    }
  }
  if (c.expect.brand_chaudiere) {
    const ch = result.equipment.find((e) => e.kind === 'chaudiere')
    if (!ch?.brand || ch.brand.toLowerCase() !== c.expect.brand_chaudiere) {
      errs.push(`brand_chaudiere ${ch?.brand} ≠ ${c.expect.brand_chaudiere}`)
      caseOk = false
    }
  }
  if (c.expect.brand_pac) {
    const p = result.equipment.find((e) => e.kind === 'pac')
    if (!p?.brand || p.brand.toLowerCase() !== c.expect.brand_pac) {
      errs.push(`brand_pac ${p?.brand} ≠ ${c.expect.brand_pac}`)
      caseOk = false
    }
  }
  if (c.expect.confidence_min !== undefined && result.confidence < c.expect.confidence_min) {
    errs.push(`confidence ${result.confidence} < ${c.expect.confidence_min}`)
    caseOk = false
  }
  if (c.expect.confidence_max !== undefined && result.confidence > c.expect.confidence_max) {
    errs.push(`confidence ${result.confidence} > ${c.expect.confidence_max}`)
    caseOk = false
  }
  if (c.expect.observations_min !== undefined && result.observations.length < c.expect.observations_min) {
    errs.push(`observations count ${result.observations.length} < ${c.expect.observations_min}`)
    caseOk = false
  }

  if (caseOk) {
    pass++
    console.log(`  ✓ ${c.name} (conf=${result.confidence.toFixed(2)})`)
  } else {
    fail++
    console.log(`  ❌ ${c.name}`)
    for (const e of errs) console.log(`     - ${e}`)
  }
}

try { unlinkSync(runnerPath) } catch {}
console.log(`\n${fail === 0 ? '✅' : '❌'} Voice parser ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
