/**
 * Vitest — Liciel ZIP V4 schema validation + cross-refs.
 */

import { describe, expect, it } from 'vitest'
import {
  type LicielMissionV4,
  LicielMissionV4Schema,
  validateMissionCrossRefs,
} from './zip-v4-schema'

function baseMission(overrides: Partial<LicielMissionV4> = {}): LicielMissionV4 {
  return {
    schema_version: '4.0',
    kovas_mission_id: '00000000-0000-4000-8000-000000000001',
    exported_at: '2026-05-25T12:00:00.000Z',
    diagnostician: {
      full_name: 'Benjamin Bel',
      company_name: 'Nexus 1993',
      siret: null,
      cofrac_number: null,
      rcpro_policy_number: null,
    },
    property: {
      type: 'maison',
      address: {
        full: '12 rue de la mer, 76200 Dieppe',
        street_number: '12',
        street_name: 'rue de la mer',
        postcode: '76200',
        city: 'Dieppe',
        insee_code: '76217',
        country: 'FR',
      },
      year_built: 1985,
      surface_total_m2: 95,
      cadastre_parcelle_id: null,
    },
    transaction_context: 'vente',
    contacts: [],
    rooms: [],
    photos: [],
    equipments: [],
    diagnostics: [
      {
        type: 'DPE',
        result_summary: 'Classe D',
        energy_class: 'D',
        ges_class: 'D',
        consumption_kwhep_m2_year: 220,
        emissions_kg_co2_m2_year: 35,
        reserves: [],
        observations: null,
        details: {},
      },
      {
        type: 'ERP',
        result_summary: 'Risque naturel modéré',
        energy_class: null,
        ges_class: null,
        consumption_kwhep_m2_year: null,
        emissions_kg_co2_m2_year: null,
        reserves: [],
        observations: null,
        details: {},
      },
    ],
    voice_notes: [],
    ...overrides,
  }
}

describe('LicielMissionV4Schema', () => {
  it('accepts a valid base mission', () => {
    const res = LicielMissionV4Schema.safeParse(baseMission())
    expect(res.success).toBe(true)
  })

  it('rejects schema_version != 4.0', () => {
    const res = LicielMissionV4Schema.safeParse({ ...baseMission(), schema_version: '3.5' })
    expect(res.success).toBe(false)
  })

  it('rejects invalid postcode format', () => {
    const m = baseMission()
    m.property.address.postcode = '7620' // 4 digits, invalid
    const res = LicielMissionV4Schema.safeParse(m)
    expect(res.success).toBe(false)
  })

  it('rejects invalid SIRET (not 14 digits)', () => {
    const m = baseMission()
    m.diagnostician.siret = '12345' // too short
    const res = LicielMissionV4Schema.safeParse(m)
    expect(res.success).toBe(false)
  })

  it('rejects mission with no diagnostics', () => {
    const m = baseMission({ diagnostics: [] })
    const res = LicielMissionV4Schema.safeParse(m)
    expect(res.success).toBe(false)
  })

  it('accepts insee_code 2A/2B (Corse)', () => {
    const m = baseMission()
    m.property.address.insee_code = '2A004'
    const res = LicielMissionV4Schema.safeParse(m)
    expect(res.success).toBe(true)
  })

  it('rejects equipment energy_class outside A-G', () => {
    const m = baseMission()
    m.equipments = [
      {
        type: 'chaudiere_gaz',
        brand: null,
        model: null,
        power_kw: null,
        // @ts-expect-error testing invalid enum value
        energy_class: 'H',
        year_install: null,
        serial_number: null,
        photo_refs: [],
      },
    ]
    const res = LicielMissionV4Schema.safeParse(m)
    expect(res.success).toBe(false)
  })
})

describe('validateMissionCrossRefs', () => {
  it('passes for a coherent vente mission with DPE + ERP', () => {
    const res = validateMissionCrossRefs(baseMission())
    expect(res.ok).toBe(true)
    expect(res.errors).toHaveLength(0)
  })

  it('flags vente without DPE', () => {
    const m = baseMission()
    m.diagnostics = [
      {
        type: 'ERP',
        result_summary: 'risque',
        energy_class: null,
        ges_class: null,
        consumption_kwhep_m2_year: null,
        emissions_kg_co2_m2_year: null,
        reserves: [],
        observations: null,
        details: {},
      },
    ]
    const res = validateMissionCrossRefs(m)
    expect(res.ok).toBe(false)
    expect(res.errors).toContain('vente requires DPE')
  })

  it('flags location without DPE', () => {
    const m = baseMission({
      transaction_context: 'location',
      diagnostics: [
        {
          type: 'ERP',
          result_summary: '',
          energy_class: null,
          ges_class: null,
          consumption_kwhep_m2_year: null,
          emissions_kg_co2_m2_year: null,
          reserves: [],
          observations: null,
          details: {},
        },
      ],
    })
    const res = validateMissionCrossRefs(m)
    expect(res.ok).toBe(false)
    expect(res.errors).toContain('location requires DPE')
  })

  it('flags photo referencing unknown room', () => {
    const m = baseMission()
    m.photos = [
      {
        file_ref: 'photos/abc.jpg',
        room_id: 'unknown-room',
        caption: null,
        exif_lat: null,
        exif_lng: null,
        exif_taken_at: null,
        width_px: null,
        height_px: null,
      },
    ]
    const res = validateMissionCrossRefs(m)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('unknown room_id'))).toBe(true)
  })

  it('flags equipment referencing unknown photo', () => {
    const m = baseMission()
    m.equipments = [
      {
        type: 'chaudiere_gaz',
        brand: null,
        model: null,
        power_kw: null,
        energy_class: null,
        year_install: null,
        serial_number: null,
        photo_refs: ['photos/missing.jpg'],
      },
    ]
    const res = validateMissionCrossRefs(m)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('unknown photo'))).toBe(true)
  })

  it('flags impossible surface_carrez > surface_brute', () => {
    const m = baseMission()
    m.rooms = [
      {
        room_id: 'r1',
        room_name: 'Salon',
        surface_brute_m2: 20,
        surface_carrez_m2: 25, // impossible
        surface_boutin_m2: null,
        hauteur_sous_plafond_m: null,
        is_annexe: false,
      },
    ]
    const res = validateMissionCrossRefs(m)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('surface_carrez > surface_brute'))).toBe(true)
  })

  it('accepts coherent room surfaces', () => {
    const m = baseMission()
    m.rooms = [
      {
        room_id: 'r1',
        room_name: 'Salon',
        surface_brute_m2: 25,
        surface_carrez_m2: 23,
        surface_boutin_m2: 23,
        hauteur_sous_plafond_m: 2.5,
        is_annexe: false,
      },
    ]
    const res = validateMissionCrossRefs(m)
    expect(res.ok).toBe(true)
  })
})
