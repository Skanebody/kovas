/**
 * KOVAS — Schéma JSON intermédiaire pour le format ZIP Liciel V4.
 *
 * Structure pivot indépendante du format Access (.mdb) Liciel. KOVAS génère
 * et consomme ce JSON ; la conversion bidirectionnelle JSON ↔ MDB Jackcess
 * est déléguée à un microservice Java/Kotlin séparé (Railway, planifié).
 *
 * Avantages :
 *   - Tests unitaires possibles sans JVM
 *   - Stabilité du contrat KOVAS ↔ microservice (versionné via `schema_version`)
 *   - Validation type-safe Zod côté Next.js avant envoi
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.7 — Import Liciel ZIP V4.
 *             .claude/orchestration-kovas-app/research/liciel-format.md
 */

import { z } from 'zod'

/* ────────────────────────────────────────────────────────────────────────── */
/* Common enums                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export const DiagnosticType = z.enum([
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELECTRICITE',
  'TERMITES',
  'CARREZ',
  'BOUTIN',
  'ERP',
])
export type DiagnosticType = z.infer<typeof DiagnosticType>

export const PropertyType = z.enum(['maison', 'appartement', 'local_commercial', 'autre'])
export type PropertyType = z.infer<typeof PropertyType>

export const TransactionContext = z.enum(['vente', 'location'])
export type TransactionContext = z.infer<typeof TransactionContext>

/* ────────────────────────────────────────────────────────────────────────── */
/* Sub-schemas                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const AddressSchema = z.object({
  full: z.string().min(1),
  street_number: z.string().nullable(),
  street_name: z.string().nullable(),
  postcode: z.string().regex(/^\d{5}$/),
  city: z.string().min(1),
  insee_code: z
    .string()
    .regex(/^[0-9A-B]{5}$/i)
    .nullable(),
  country: z.literal('FR').default('FR'),
})
export type Address = z.infer<typeof AddressSchema>

export const ContactSchema = z.object({
  role: z.enum(['vendeur', 'acquereur', 'bailleur', 'locataire', 'mandataire']),
  civilite: z.enum(['M', 'Mme', 'autre']).nullable(),
  first_name: z.string().nullable(),
  last_name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
})
export type Contact = z.infer<typeof ContactSchema>

export const RoomMeasurementSchema = z.object({
  room_id: z.string(),
  room_name: z.string(),
  surface_brute_m2: z.number().nonnegative().nullable(),
  surface_carrez_m2: z.number().nonnegative().nullable(),
  surface_boutin_m2: z.number().nonnegative().nullable(),
  hauteur_sous_plafond_m: z.number().nonnegative().nullable(),
  is_annexe: z.boolean().default(false),
})
export type RoomMeasurement = z.infer<typeof RoomMeasurementSchema>

export const PhotoRefSchema = z.object({
  /** Référence vers le fichier dans le ZIP (path relatif) */
  file_ref: z.string(),
  room_id: z.string().nullable(),
  caption: z.string().nullable(),
  exif_lat: z.number().nullable(),
  exif_lng: z.number().nullable(),
  exif_taken_at: z.string().nullable(),
  width_px: z.number().int().positive().nullable(),
  height_px: z.number().int().positive().nullable(),
})
export type PhotoRef = z.infer<typeof PhotoRefSchema>

export const EquipmentSchema = z.object({
  type: z.enum([
    'chaudiere_gaz',
    'chaudiere_fioul',
    'pompe_chaleur',
    'ballon_eau_chaude',
    'climatiseur',
    'radiateur_elec',
    'poele_bois',
    'vmc',
    'autre',
  ]),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  power_kw: z.number().nullable(),
  energy_class: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).nullable(),
  year_install: z.number().int().min(1900).max(2100).nullable(),
  serial_number: z.string().nullable(),
  photo_refs: z.array(z.string()).default([]),
})
export type Equipment = z.infer<typeof EquipmentSchema>

export const DiagnosticResultSchema = z.object({
  type: DiagnosticType,
  /** Résultat principal (ex: classe DPE, présence amiante) */
  result_summary: z.string(),
  /** Pour DPE : classes A-G */
  energy_class: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).nullable(),
  ges_class: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).nullable(),
  consumption_kwhep_m2_year: z.number().nullable(),
  emissions_kg_co2_m2_year: z.number().nullable(),
  /** Réserves + observations */
  reserves: z.array(z.string()).default([]),
  observations: z.string().nullable(),
  /** Détails diagnostic-spécifiques (jsonb) */
  details: z.record(z.unknown()).default({}),
})
export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>

/* ────────────────────────────────────────────────────────────────────────── */
/* Mission root schema                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export const LicielMissionV4Schema = z.object({
  schema_version: z.literal('4.0'),
  /** UUID KOVAS de la mission, pour traçabilité bidirectionnelle */
  kovas_mission_id: z.string().uuid(),
  exported_at: z.string(),
  diagnostician: z.object({
    full_name: z.string(),
    company_name: z.string().nullable(),
    siret: z
      .string()
      .regex(/^\d{14}$/)
      .nullable(),
    cofrac_number: z.string().nullable(),
    rcpro_policy_number: z.string().nullable(),
  }),
  property: z.object({
    type: PropertyType,
    address: AddressSchema,
    year_built: z.number().int().min(1700).max(2100).nullable(),
    surface_total_m2: z.number().nonnegative().nullable(),
    cadastre_parcelle_id: z.string().nullable(),
  }),
  transaction_context: TransactionContext,
  contacts: z.array(ContactSchema).default([]),
  rooms: z.array(RoomMeasurementSchema).default([]),
  photos: z.array(PhotoRefSchema).default([]),
  equipments: z.array(EquipmentSchema).default([]),
  diagnostics: z.array(DiagnosticResultSchema).min(1),
  /** Notes vocales transcrites (par pièce ou globales) */
  voice_notes: z
    .array(
      z.object({
        room_id: z.string().nullable(),
        transcript: z.string(),
        confidence: z.number().min(0).max(1).nullable(),
        recorded_at: z.string(),
      }),
    )
    .default([]),
  /** Audit KOVAS (algorithmes appliqués) */
  kovas_audit: z
    .object({
      conformity_score: z.number().int().min(0).max(100).nullable(),
      anomalies: z.array(z.string()).default([]),
      validated_by_diagnostician: z.boolean(),
      validated_at: z.string().nullable(),
    })
    .optional(),
})

export type LicielMissionV4 = z.infer<typeof LicielMissionV4Schema>

/* ────────────────────────────────────────────────────────────────────────── */
/* ZIP envelope                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Structure du ZIP exporté.
 *
 *   mission.json          — payload validé par LicielMissionV4Schema
 *   photos/{uuid}.jpg     — photos (référencées dans photos[].file_ref)
 *   attachments/*.pdf     — anciens DPE, factures, attestations
 *   liciel/                — répertoire pour import direct dans Liciel (MDB
 *                            généré par le microservice Java)
 */
export interface LicielZipEnvelope {
  mission: LicielMissionV4
  /** Fichiers binaires : key = path relatif dans le ZIP, value = Buffer */
  files: ReadonlyMap<string, Buffer>
}

/**
 * Vérifie la cohérence d'une mission V4 avant sérialisation.
 * Lance les checks complémentaires impossibles à exprimer en Zod simple
 * (références croisées photo→room, etc.).
 */
export function validateMissionCrossRefs(mission: LicielMissionV4): {
  ok: boolean
  errors: ReadonlyArray<string>
} {
  const errors: string[] = []

  const roomIds = new Set(mission.rooms.map((r) => r.room_id))
  for (const photo of mission.photos) {
    if (photo.room_id && !roomIds.has(photo.room_id)) {
      errors.push(`photo ${photo.file_ref} references unknown room_id ${photo.room_id}`)
    }
  }

  for (const measurement of mission.rooms) {
    if (
      measurement.surface_carrez_m2 != null &&
      measurement.surface_brute_m2 != null &&
      measurement.surface_carrez_m2 > measurement.surface_brute_m2
    ) {
      errors.push(`room ${measurement.room_id}: surface_carrez > surface_brute (impossible)`)
    }
  }

  for (const equip of mission.equipments) {
    for (const ref of equip.photo_refs) {
      if (!mission.photos.some((p) => p.file_ref === ref)) {
        errors.push(`equipment ${equip.type} references unknown photo ${ref}`)
      }
    }
  }

  // Au moins 1 diagnostic doit matcher le contexte (vente requiert DPE+ERP+CARREZ; location DPE+ERP)
  const diagTypes = new Set(mission.diagnostics.map((d) => d.type))
  if (mission.transaction_context === 'vente') {
    if (!diagTypes.has('DPE')) errors.push('vente requires DPE')
    if (!diagTypes.has('ERP')) errors.push('vente requires ERP')
  } else if (mission.transaction_context === 'location') {
    if (!diagTypes.has('DPE')) errors.push('location requires DPE')
  }

  return { ok: errors.length === 0, errors }
}
