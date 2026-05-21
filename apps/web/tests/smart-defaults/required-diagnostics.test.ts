/**
 * Tests unitaires de la logique computeRequiredDiagnostics.
 *
 * Pas de framework de test installé (vitest sera ajouté ultérieurement, cf. CLAUDE.md §12).
 * Ce fichier est conçu pour être exécutable via `npx tsx apps/web/tests/smart-defaults/required-diagnostics.test.ts`
 * et lèvera une erreur en cas d'échec. Migrable en suite vitest sans modification.
 *
 * Placé hors de `apps/web/src/` pour qu'il ne soit pas inclus dans le build Next.
 */

import {
  computeRequiredDiagnostics,
  getRequiredDiagnosticTypes,
  type PropertyContext,
  type DiagnosticType,
} from '../../src/lib/smart-defaults/required-diagnostics'

type AssertionFailure = { name: string; expected: unknown; actual: unknown }

const failures: AssertionFailure[] = []

function assertSetEquals(name: string, actual: DiagnosticType[], expected: DiagnosticType[]) {
  const a = new Set(actual)
  const e = new Set(expected)
  if (a.size !== e.size || ![...a].every((x) => e.has(x))) {
    failures.push({ name, expected: [...e].sort(), actual: [...a].sort() })
  }
}

function assertIncludes(name: string, actual: DiagnosticType[], type: DiagnosticType) {
  if (!actual.includes(type)) {
    failures.push({ name, expected: `includes ${type}`, actual })
  }
}

function assertExcludes(name: string, actual: DiagnosticType[], type: DiagnosticType) {
  if (actual.includes(type)) {
    failures.push({ name, expected: `excludes ${type}`, actual })
  }
}

// Test 1 — vente maison ancienne (1900)
{
  const ctx: PropertyContext = { type: 'maison', situation: 'vente', yearBuilt: 1900 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertSetEquals(
    'vente maison 1900 → DPE + AMIANTE + PLOMB + ELEC + ERP',
    req,
    ['DPE', 'AMIANTE', 'PLOMB', 'ELEC', 'ERP'],
  )
}

// Test 2 — vente maison 1980 (entre cutoff plomb et amiante)
{
  const ctx: PropertyContext = { type: 'maison', situation: 'vente', yearBuilt: 1980 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertSetEquals(
    'vente maison 1980 → DPE + AMIANTE + ELEC + ERP',
    req,
    ['DPE', 'AMIANTE', 'ELEC', 'ERP'],
  )
}

// Test 3 — vente maison récente (2010)
{
  const ctx: PropertyContext = { type: 'maison', situation: 'vente', yearBuilt: 2010 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertSetEquals('vente maison 2010 → DPE + ELEC + ERP', req, ['DPE', 'ELEC', 'ERP'])
}

// Test 4 — vente appartement 1985
{
  const ctx: PropertyContext = { type: 'appartement', situation: 'vente', yearBuilt: 1985 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertSetEquals(
    'vente appartement 1985 → DPE + AMIANTE + ELEC + ERP + CARREZ',
    req,
    ['DPE', 'AMIANTE', 'ELEC', 'ERP', 'CARREZ'],
  )
}

// Test 5 — location appartement récent
{
  const ctx: PropertyContext = { type: 'appartement', situation: 'location', yearBuilt: 2015 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertSetEquals(
    'location appartement 2015 → DPE + ERP + BOUTIN',
    req,
    ['DPE', 'ERP', 'BOUTIN'],
  )
}

// Test 6 — location maison 1930 (plomb requis)
{
  const ctx: PropertyContext = { type: 'maison', situation: 'location', yearBuilt: 1930 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertSetEquals(
    'location maison 1930 → DPE + PLOMB + ERP',
    req,
    ['DPE', 'PLOMB', 'ERP'],
  )
  assertExcludes('location maison → pas de CARREZ', req, 'CARREZ')
}

// Test 7 — travaux maison ancienne (avant 1997)
{
  const ctx: PropertyContext = { type: 'maison', situation: 'travaux', yearBuilt: 1960 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertIncludes('travaux maison 1960 → AMIANTE avant travaux', req, 'AMIANTE')
  assertExcludes('travaux → pas de DPE obligatoire', req, 'DPE')
}

// Test 8 — yearBuilt null (inconnu)
{
  const ctx: PropertyContext = { type: 'maison', situation: 'vente', yearBuilt: null }
  const req = getRequiredDiagnosticTypes(ctx)
  // PLOMB et AMIANTE ne doivent pas être marqués required sans année
  assertExcludes('vente sans année → pas de PLOMB requis', req, 'PLOMB')
  assertExcludes('vente sans année → pas de AMIANTE requis', req, 'AMIANTE')
  assertIncludes('vente sans année → DPE requis', req, 'DPE')
}

// Test 9 — local commercial
{
  const ctx: PropertyContext = { type: 'local_commercial', situation: 'vente', yearBuilt: 1990 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertIncludes('local commercial 1990 → AMIANTE', req, 'AMIANTE')
  assertIncludes('local commercial → ERP', req, 'ERP')
}

// Test 10 — location appartement 1940 (plomb + boutin)
{
  const ctx: PropertyContext = { type: 'appartement', situation: 'location', yearBuilt: 1940 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertSetEquals(
    'location appartement 1940 → DPE + PLOMB + ERP + BOUTIN',
    req,
    ['DPE', 'PLOMB', 'ERP', 'BOUTIN'],
  )
}

// Test 11 — vente exactement 1949 (cutoff plomb, pas requis)
{
  const ctx: PropertyContext = { type: 'maison', situation: 'vente', yearBuilt: 1949 }
  const req = getRequiredDiagnosticTypes(ctx)
  assertExcludes('vente maison 1949 → pas de PLOMB (cutoff strict <)', req, 'PLOMB')
}

// Test 12 — toutes les suggestions remontent dans la liste complète
{
  const ctx: PropertyContext = { type: 'appartement', situation: 'vente', yearBuilt: 1990 }
  const all = computeRequiredDiagnostics(ctx)
  if (all.length < 8) {
    failures.push({
      name: 'appartement complète au moins 8 diagnostics (avec Carrez)',
      expected: '>= 8',
      actual: all.length,
    })
  }
}

// Reporting
if (failures.length > 0) {
  console.error('FAILURES:')
  for (const f of failures) {
    console.error(` - ${f.name}: expected=${JSON.stringify(f.expected)} actual=${JSON.stringify(f.actual)}`)
  }
  throw new Error(`${failures.length} test(s) failed`)
}

console.log(`required-diagnostics: 12 tests passed`)
