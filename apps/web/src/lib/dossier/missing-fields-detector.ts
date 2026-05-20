/**
 * KOVAS — Détecteur de champs manquants par diagnostic (refonte page dossier).
 *
 * Authority : CLAUDE.md §3 + diagnostic-schemas.ts.
 *
 * Stratégie :
 *  - On parcourt le schéma d'un diagnostic (sections + subsections récursives)
 *  - On extrait tous les `field` avec `required: true`
 *  - On compare avec les `field_path` déjà collectés (dossier_field_values)
 *  - On retourne la liste des manquants
 *
 * Le type `MissingField` retourné s'aligne sur celui exposé par
 * `@/lib/mission/consolidator` (snake_case) tout en ajoutant `label` + `required`.
 */

import type { DiagnosticField, DiagnosticSchema, DiagnosticType } from '@/lib/mission/types'

export interface MissingField {
  diagnostic: DiagnosticType
  field_path: string
  label: string
  required: boolean
  expectedInRoom: string | null
}

/**
 * Aplatit récursivement les champs d'un schéma (sections + subsections).
 */
function flattenSchemaFields(schema: DiagnosticSchema): DiagnosticField[] {
  const out: DiagnosticField[] = []

  function walkSection(section: {
    fields: DiagnosticField[]
    subsections?: DiagnosticSchema['sections']
  }) {
    for (const f of section.fields) out.push(f)
    if (section.subsections) {
      for (const sub of section.subsections) walkSection(sub)
    }
  }

  for (const section of schema.sections) walkSection(section)
  return out
}

export function getAllSchemaFields(schema: DiagnosticSchema): DiagnosticField[] {
  return flattenSchemaFields(schema)
}

export function getRequiredSchemaFields(schema: DiagnosticSchema): DiagnosticField[] {
  return flattenSchemaFields(schema).filter((f) => f.required === true)
}

/**
 * Pour un schéma et une liste de field_path collectés, calcule les champs manquants.
 *
 * @param schema           - schéma du diagnostic (DPE, AMIANTE, ...)
 * @param collectedFields  - field_path déjà saisis (issus de dossier_field_values)
 * @returns la liste des champs requis non encore collectés
 */
export function detectMissingFields(
  schema: DiagnosticSchema,
  collectedFields: { field_path: string; value: unknown }[],
): MissingField[] {
  const collectedPaths = new Set(collectedFields.map((c) => c.field_path))
  const required = getRequiredSchemaFields(schema)

  const missing: MissingField[] = []
  for (const field of required) {
    if (collectedPaths.has(field.path)) continue
    missing.push({
      diagnostic: schema.diagnosticType,
      field_path: field.path,
      label: field.label,
      required: true,
      expectedInRoom: null,
    })
  }
  return missing
}
