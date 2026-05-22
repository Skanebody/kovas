import { describe, expect, it } from 'vitest'
import { detectClassAnomaly, estimateExpectedClass } from './class-anomaly'

describe('estimateExpectedClass', () => {
  it('estimates a recent well-insulated house as A-C', () => {
    const { expectedClass } = estimateExpectedClass({
      declaredClass: 'A',
      yearBuilt: 2020,
      surfaceM2: 100,
      heatingType: 'heat_pump',
      insulationLevel: 'verygood',
    })
    expect(['A', 'B', 'C']).toContain(expectedClass)
  })

  it('estimates a 1850 mansion with fuel as E-G', () => {
    const { expectedClass } = estimateExpectedClass({
      declaredClass: 'E',
      yearBuilt: 1850,
      surfaceM2: 200,
      heatingType: 'fioul',
      insulationLevel: 'medium',
    })
    expect(['E', 'F', 'G']).toContain(expectedClass)
  })
})

describe('detectClassAnomaly', () => {
  it('flags a 1850 house with fioul declared A as fraud (severity ≥ 0.7)', () => {
    const signal = detectClassAnomaly({
      declaredClass: 'A',
      yearBuilt: 1850,
      surfaceM2: 200,
      heatingType: 'fioul',
      insulationLevel: 'medium',
    })
    expect(signal.flagged).toBe(true)
    expect(signal.severity).toBeGreaterThan(0.7)
    expect(signal.pattern).toBe('class_anomaly')
  })

  it('does not flag a recent PAC house declared B', () => {
    const signal = detectClassAnomaly({
      declaredClass: 'B',
      yearBuilt: 2020,
      surfaceM2: 100,
      heatingType: 'heat_pump',
      insulationLevel: 'good',
    })
    expect(signal.flagged).toBe(false)
    expect(signal.severity).toBeLessThan(0.5)
  })

  it('treats sous-classement as less severe than surclassement', () => {
    const undeclared = detectClassAnomaly({
      declaredClass: 'F',
      yearBuilt: 2020,
      surfaceM2: 80,
      heatingType: 'heat_pump',
      insulationLevel: 'verygood',
    })
    const surclasse = detectClassAnomaly({
      declaredClass: 'A',
      yearBuilt: 1900,
      surfaceM2: 80,
      heatingType: 'fioul',
      insulationLevel: 'bad',
    })
    expect(surclasse.severity).toBeGreaterThan(undeclared.severity)
  })
})
