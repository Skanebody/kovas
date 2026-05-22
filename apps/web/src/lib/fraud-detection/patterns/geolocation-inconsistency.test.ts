import { describe, expect, it } from 'vitest'
import {
  detectCrossMissionTeleport,
  detectGeolocationInconsistency,
  haversineKm,
} from './geolocation-inconsistency'

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 48.8566, lng: 2.3522 })).toBe(0)
  })

  it('matches known Paris ↔ Lyon distance (~393 km)', () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 })
    expect(d).toBeGreaterThan(380)
    expect(d).toBeLessThan(410)
  })
})

describe('detectGeolocationInconsistency', () => {
  it('flags a property 600km from cabinet', () => {
    const signal = detectGeolocationInconsistency({
      propertyLat: 43.2965, // Marseille
      propertyLng: 5.3698,
      diagnosticianCabinetLat: 48.8566, // Paris
      diagnosticianCabinetLng: 2.3522,
      photoGeolocations: [],
    })
    expect(signal.flagged).toBe(true)
    expect(signal.severity).toBeGreaterThanOrEqual(0.7)
  })

  it('does not flag a 30km local property', () => {
    const signal = detectGeolocationInconsistency({
      propertyLat: 48.85,
      propertyLng: 2.65,
      diagnosticianCabinetLat: 48.8566,
      diagnosticianCabinetLng: 2.3522,
      photoGeolocations: [{ lat: 48.85, lng: 2.65, takenAt: new Date() }],
    })
    expect(signal.severity).toBeLessThan(0.3)
  })

  it('flags photos taken > 5km from property', () => {
    const signal = detectGeolocationInconsistency({
      propertyLat: 48.8566,
      propertyLng: 2.3522,
      diagnosticianCabinetLat: 48.8566,
      diagnosticianCabinetLng: 2.3522,
      photoGeolocations: [
        { lat: 48.95, lng: 2.55, takenAt: new Date() }, // ~20 km
        { lat: 48.95, lng: 2.55, takenAt: new Date() },
      ],
    })
    expect(signal.flagged).toBe(true)
  })
})

describe('detectCrossMissionTeleport', () => {
  it('flags teleportation between two close-in-time missions', () => {
    const signals = detectCrossMissionTeleport({
      missions: [
        {
          missionId: 'm1',
          propertyLat: 48.8566,
          propertyLng: 2.3522,
          arrivedAt: new Date('2026-05-22T10:00:00Z'),
        },
        {
          missionId: 'm2',
          propertyLat: 45.764,
          propertyLng: 4.8357, // Paris → Lyon
          arrivedAt: new Date('2026-05-22T10:30:00Z'), // 30min plus tard
        },
      ],
    })
    expect(signals.length).toBe(1)
    expect(signals[0]?.severity).toBeGreaterThan(0.8)
  })

  it('does not flag two nearby missions an hour apart', () => {
    const signals = detectCrossMissionTeleport({
      missions: [
        {
          missionId: 'm1',
          propertyLat: 48.8566,
          propertyLng: 2.3522,
          arrivedAt: new Date('2026-05-22T10:00:00Z'),
        },
        {
          missionId: 'm2',
          propertyLat: 48.87,
          propertyLng: 2.36,
          arrivedAt: new Date('2026-05-22T11:30:00Z'),
        },
      ],
    })
    expect(signals.length).toBe(0)
  })
})
