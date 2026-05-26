#!/usr/bin/env node
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = 'jlizdkffwjdiokvmhcwg'

async function execSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL HTTP ${res.status}: ${text.slice(0, 500)}`)
  return JSON.parse(text || '[]')
}

// 9 régions FR manquantes (11, 76, 84, 93 déjà en DB)
const REGIONS = [
  { code: '75', dpePrice: 150, fgRate: 18, diag: 245000, delivery: 12, dist: { a: 2, b: 8, c: 20, d: 30, e: 22, f: 12, g: 6 } },
  { code: '52', dpePrice: 140, fgRate: 17, diag: 158000, delivery: 11, dist: { a: 2, b: 7, c: 20, d: 32, e: 22, f: 12, g: 5 } },
  { code: '32', dpePrice: 135, fgRate: 22, diag: 178000, delivery: 13, dist: { a: 1, b: 5, c: 16, d: 30, e: 26, f: 16, g: 6 } },
  { code: '44', dpePrice: 138, fgRate: 21, diag: 172000, delivery: 13, dist: { a: 1, b: 5, c: 17, d: 31, e: 25, f: 15, g: 6 } },
  { code: '53', dpePrice: 145, fgRate: 18, diag: 142000, delivery: 12, dist: { a: 2, b: 7, c: 19, d: 31, e: 23, f: 13, g: 5 } },
  { code: '28', dpePrice: 142, fgRate: 20, diag: 128000, delivery: 13, dist: { a: 1, b: 6, c: 18, d: 30, e: 24, f: 14, g: 7 } },
  { code: '27', dpePrice: 136, fgRate: 20, diag: 98000, delivery: 13, dist: { a: 1, b: 6, c: 18, d: 31, e: 24, f: 14, g: 6 } },
  { code: '24', dpePrice: 140, fgRate: 19, diag: 89000, delivery: 12, dist: { a: 2, b: 7, c: 19, d: 31, e: 23, f: 13, g: 5 } },
  { code: '94', dpePrice: 160, fgRate: 14, diag: 18000, delivery: 14, dist: { a: 4, b: 11, c: 24, d: 29, e: 19, f: 9, g: 4 } },
]

const MONTHS = [
  { year: 2026, month: 5, factor: 1.000 },
  { year: 2026, month: 4, factor: 0.9853 },
  { year: 2026, month: 3, factor: 0.9706 },
  { year: 2026, month: 2, factor: 0.9559 },
  { year: 2026, month: 1, factor: 0.9412 },
  { year: 2025, month: 12, factor: 0.9265 },
]

const now = new Date().toISOString()
const rows = []
for (const r of REGIONS) {
  for (const m of MONTHS) {
    const price = (r.dpePrice * m.factor).toFixed(2)
    const diag = Math.round(r.diag * m.factor / 12)
    const distJson = JSON.stringify(r.dist)
    rows.push(`(gen_random_uuid(), ${m.year}, ${m.month}, '${r.code}', ${price}, '${distJson}'::jsonb, '[]'::jsonb, 0, ${diag}, ${r.fgRate}, ${r.delivery}, 'Seed 9 régions FR manquantes', '${now}', '${now}')`)
  }
}

console.log(`Generated ${rows.length} rows`)

const sql = `INSERT INTO observatoire_live_stats (id, period_year, period_month, region_code, median_price_eur, dpe_distribution, top_transition_cities, transactions_count, diagnostics_count, fg_rate_pct, median_delivery_days, source_notes, generated_at, created_at) VALUES ${rows.join(',\n')}`
await execSql(sql)
console.log('✓ Insert OK')

const after = await execSql(`SELECT count(*) AS total, count(DISTINCT region_code) AS distinct_regions FROM observatoire_live_stats`)
console.log('Final:', after[0])
