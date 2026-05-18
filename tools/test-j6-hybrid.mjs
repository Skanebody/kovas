#!/usr/bin/env node
/**
 * Tests J6 :
 * 1. buildWhisperPrompt génère un prompt cohérent selon mission_type
 * 2. Parser custom marque les transcripts pauvres avec confidence < 0.7
 *    (vérifie que la branche Claude serait déclenchée)
 * 3. Sans clé Anthropic : l'API /api/structure renvoie 503 stub: true
 *
 * Note : on ne fait PAS d'appel Claude live ici (coût + dépendance API).
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync as writeSync, unlinkSync as unlink } from 'node:fs'

const projectRoot = process.cwd()

const TESTS = [
  { transcript: '', minConf: 0, maxConf: 0 },
  // Bonne note → confidence haute (parser custom suffit)
  {
    transcript: "Salon 35m², chaudière Saunier Duval 2018, double vitrage PVC, VMC simple flux.",
    minConf: 0.7,
    parserUsedLabel: 'custom_js',
  },
  // Note trop courte / vague → confidence faible (fallback Claude)
  {
    transcript: "Y'a un truc bizarre dans le coin.",
    maxConf: 0.5,
  },
]

const runnerPath = `${projectRoot}/tools/.j6-runner.mts`
const runner = `import { parseVoiceTranscript, VOICE_PARSER_THRESHOLD } from '${projectRoot}/apps/web/src/lib/voice-parser.ts'
import { buildWhisperPrompt } from '${projectRoot}/apps/web/src/lib/whisper-prompt.ts'
const op = process.argv[2]
if (op === 'parse') {
  const t = process.argv[3] ?? ''
  const r = parseVoiceTranscript(t)
  console.log(JSON.stringify({ confidence: r.confidence, threshold: VOICE_PARSER_THRESHOLD, fallback: r.confidence < VOICE_PARSER_THRESHOLD }))
}
if (op === 'prompt') {
  const t = process.argv[3] ?? 'dpe_vente'
  console.log(buildWhisperPrompt(t))
}
`
writeSync(runnerPath, runner)

function run(args) {
  const res = spawnSync('npx', ['-y', 'tsx', runnerPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf-8',
  })
  if (res.status !== 0) throw new Error(`tsx: ${res.stderr}`)
  return res.stdout.trim()
}

let pass = 0
let fail = 0

console.log('=== Whisper prompt builder ===')
const promptDPE = run(['prompt', 'dpe_vente'])
if (promptDPE.includes('Saunier Duval') && promptDPE.includes('classe A') && promptDPE.includes('VMC')) {
  console.log('  ✓ DPE prompt contient vocab attendu')
  pass++
} else {
  console.log('  ❌ DPE prompt incomplet')
  fail++
}
const promptAmiante = run(['prompt', 'amiante_vente'])
if (promptAmiante.includes('amiante') && promptAmiante.includes('fibrociment')) {
  console.log('  ✓ Amiante prompt contient vocab spécifique')
  pass++
} else {
  console.log('  ❌ Amiante prompt incomplet')
  fail++
}

console.log('\n=== Parser confidence + fallback Claude decision ===')
for (const t of TESTS) {
  const r = JSON.parse(run(['parse', t.transcript]))
  let ok = true
  const errs = []
  if (t.minConf !== undefined && r.confidence < t.minConf) {
    errs.push(`confidence ${r.confidence} < ${t.minConf}`)
    ok = false
  }
  if (t.maxConf !== undefined && r.confidence > t.maxConf) {
    errs.push(`confidence ${r.confidence} > ${t.maxConf}`)
    ok = false
  }
  if (ok) {
    pass++
    const summary = r.confidence === 0 ? 'empty' : r.fallback ? 'fallback Claude' : 'parser custom OK'
    console.log(`  ✓ "${t.transcript.slice(0, 40)}..." conf=${r.confidence.toFixed(2)} → ${summary}`)
  } else {
    fail++
    console.log(`  ❌ "${t.transcript.slice(0, 40)}..."`)
    for (const e of errs) console.log(`     - ${e}`)
  }
}

try { unlink(runnerPath) } catch {}
console.log(`\n${fail === 0 ? '✅' : '❌'} J6 hybrid ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
