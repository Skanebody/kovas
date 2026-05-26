/**
 * Vitest — Test du geohash encoder utilisé par le cache Géorisques étendu.
 * Le reste de `georisques-cache.ts` (lecture/écriture Supabase) est testé en
 * intégration via les flows /risques + pré-export, pas en unitaire (mock
 * Supabase trop lourd vs valeur).
 */

import { describe, expect, it } from 'vitest'
import { encodeGeohash } from './georisques-cache'

describe('encodeGeohash', () => {
  it('encodes Paris (48.8566, 2.3522) à précision 7 → connu "u09tvw0"', () => {
    // Référence : geohash.org/?op=convert&lat=48.8566&lon=2.3522 = u09tvw0
    expect(encodeGeohash(48.8566, 2.3522, 7)).toBe('u09tvw0')
  })

  it('encodes Dieppe (49.92, 1.07) — même geohash pour deux points proches', () => {
    const a = encodeGeohash(49.92, 1.07, 7)
    const b = encodeGeohash(49.9201, 1.0701, 7)
    expect(a).toBe(b) // distance ~10m → même geohash 7
  })

  it('differs at precision 7 for points > 200m apart', () => {
    const a = encodeGeohash(49.92, 1.07, 7)
    const b = encodeGeohash(49.93, 1.08, 7) // ~1.1 km
    expect(a).not.toBe(b)
  })

  it('returns string of expected length', () => {
    expect(encodeGeohash(0, 0, 5)).toHaveLength(5)
    expect(encodeGeohash(0, 0, 7)).toHaveLength(7)
    expect(encodeGeohash(0, 0, 9)).toHaveLength(9)
  })

  it('default precision is 7', () => {
    expect(encodeGeohash(48.8566, 2.3522)).toHaveLength(7)
  })
})
