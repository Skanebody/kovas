/**
 * KOVAS — Module Cockpit ADEME — Évaluateur de règles de cohérence.
 *
 * Lit le format JSONB `rule_logic` stocké dans `ademe_coherence_rules` :
 *
 *   {
 *     "operator": "AND" | "OR",
 *     "conditions": [
 *       { "field": "type_chauffage", "op": "eq", "value": "PAC air/air" },
 *       { "field": "type_climatisation", "op": "is_null" }
 *     ]
 *   }
 *
 * Le résultat `true` signifie que la condition est **satisfaite** (ce qui,
 * pour une règle ADEME, traduit une **violation détectée** — ex : "PAC air/air
 * déclarée mais aucune climatisation" est suspect car la PAC = clim).
 *
 * Opérateurs supportés :
 *   - eq, neq (==, ≠) — strict equality (toString fallback côté string)
 *   - gt, gte, lt, lte — numérique uniquement
 *   - is_null, is_not_null — présence
 *   - in — `value` doit être un array
 *   - matches — regex (string), insensible à la casse
 *   - between — `value` doit être [min, max] (inclus)
 *
 * Aucune dépendance externe — utilisable en Edge runtime (Deno) et Node.
 */

// ============================================================
// Types
// ============================================================

export type RuleOperator = 'AND' | 'OR'

export type RuleConditionOp =
  | 'eq'
  | 'neq'
  | 'ne' // alias de neq, le catalogue migration mentionne "ne"
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_null'
  | 'is_not_null'
  | 'in'
  | 'matches'
  | 'between'

export interface RuleCondition {
  field: string
  op: RuleConditionOp
  /** Valeur de comparaison (type variable selon op). Optionnelle pour is_null/is_not_null. */
  value?: unknown
}

export interface RuleLogic {
  operator: RuleOperator
  conditions: RuleCondition[]
}

export interface CoherenceRule {
  id: string
  rule_code: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'error' | 'blocking'
  rule_logic: RuleLogic
  suggested_fix: string | null
  diagnostic_types: string[]
  enabled: boolean
}

// ============================================================
// Évaluation
// ============================================================

/**
 * Évalue une règle complète. Retourne `true` si la règle est satisfaite
 * (= violation détectée). Si `rule_logic` est invalide, retourne `false`
 * (fail-safe : on ne génère pas de faux positifs sur règles malformées).
 */
export function evaluateRule(logic: RuleLogic, data: Record<string, unknown>): boolean {
  if (!logic || !Array.isArray(logic.conditions) || logic.conditions.length === 0) {
    return false
  }
  const op = logic.operator === 'OR' ? 'OR' : 'AND'

  if (op === 'AND') {
    return logic.conditions.every((c) => evaluateCondition(c, data))
  }
  return logic.conditions.some((c) => evaluateCondition(c, data))
}

function evaluateCondition(cond: RuleCondition, data: Record<string, unknown>): boolean {
  if (!cond || typeof cond.field !== 'string') return false
  const fieldValue = getField(data, cond.field)

  switch (cond.op) {
    case 'is_null':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'is_not_null':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    case 'eq':
      return softEqual(fieldValue, cond.value)
    case 'neq':
    case 'ne':
      return !softEqual(fieldValue, cond.value)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toNumber(fieldValue)
      const b = toNumber(cond.value)
      if (a === null || b === null) return false
      if (cond.op === 'gt') return a > b
      if (cond.op === 'gte') return a >= b
      if (cond.op === 'lt') return a < b
      return a <= b
    }
    case 'in':
      if (!Array.isArray(cond.value)) return false
      return cond.value.some((v) => softEqual(fieldValue, v))
    case 'matches': {
      if (typeof cond.value !== 'string' || typeof fieldValue !== 'string') return false
      try {
        const re = new RegExp(cond.value, 'i')
        return re.test(fieldValue)
      } catch {
        return false
      }
    }
    case 'between': {
      if (!Array.isArray(cond.value) || cond.value.length !== 2) return false
      const v = toNumber(fieldValue)
      const lo = toNumber(cond.value[0])
      const hi = toNumber(cond.value[1])
      if (v === null || lo === null || hi === null) return false
      return v >= lo && v <= hi
    }
    default:
      return false
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Lit un champ avec support du dot-notation (ex: `metadata.surface`).
 * Insensible à la casse pour le 1er niveau (les champs ADEME sont en
 * PascalCase, ceux du form prévalidation en camelCase — on tolère).
 */
function getField(data: Record<string, unknown>, fieldPath: string): unknown {
  if (!data) return undefined
  const parts = fieldPath.split('.')
  let current: unknown = data
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    const rec = current as Record<string, unknown>
    if (part in rec) {
      current = rec[part]
      continue
    }
    // Lookup case-insensitive
    const lower = part.toLowerCase()
    let found = false
    for (const k of Object.keys(rec)) {
      if (k.toLowerCase() === lower) {
        current = rec[k]
        found = true
        break
      }
    }
    if (!found) return undefined
  }
  return current
}

function softEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  if (typeof a === 'number' && typeof b === 'string') return String(a) === b
  if (typeof a === 'string' && typeof b === 'number') return a === String(b)
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
  }
  return false
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}
