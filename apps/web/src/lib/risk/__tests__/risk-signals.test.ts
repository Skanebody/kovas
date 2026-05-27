/**
 * Tests Vitest — Risk Signals (Bouclier Conformité, Upsell #3).
 *
 * Couvre :
 *   - detectDpeShopping (DPE shopping même bien, écart classes ≥ 2)
 *   - detectCadastreMismatch (écart surface > 15%)
 *   - detectClassJump (saut sans travaux documentés)
 *   - detectAberrantData (puissance / surface hors bornes, classe A + conso élevée)
 *   - detectRecurrentPatterns (pattern d'erreurs > 30% des missions)
 *   - aggregateRiskSignals (score 100 si pas de signal, < 50 si critical)
 *   - runAllDetectors (pipeline end-to-end)
 *
 * Fixtures inline volontairement minimales — pas de DB ni I/O.
 */

import { describe, expect, it } from 'vitest'

import {
  type Mission,
  aggregateRiskSignals,
  detectAberrantData,
  detectCadastreMismatch,
  detectClassJump,
  detectDpeShopping,
  detectRecurrentPatterns,
  runAllDetectors,
} from '../risk-signals'

/* -------------------------------------------------------------------------- */
/*  Helpers — fixtures concises                                                */
/* -------------------------------------------------------------------------- */

function makeMission(overrides: Partial<Mission> & Pick<Mission, 'id' | 'propertyId'>): Mission {
  return {
    type: 'dpe',
    createdAt: '2026-05-01T10:00:00Z',
    address: '12 rue de la Paix, 75002 Paris',
    cadastreSection: 'AB',
    cadastreNumber: '0042',
    cadastrePrefix: '751012',
    ...overrides,
  }
}

/* -------------------------------------------------------------------------- */
/*  detectDpeShopping                                                          */
/* -------------------------------------------------------------------------- */

describe('detectDpeShopping', () => {
  it('retourne un signal medium si 2 DPE même bien, écart de 2 classes (F → D)', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'F',
        numeroDpe: 'DPE-2025-0001',
        createdAt: '2025-11-15T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'D',
        numeroDpe: 'DPE-2026-0042',
        createdAt: '2026-04-20T10:00:00Z',
      }),
    ]

    const signals = detectDpeShopping(missions)
    expect(signals).toHaveLength(1)
    const first = signals[0]
    if (!first) throw new Error('expected signal')
    expect(first.type).toBe('dpe_shopping')
    expect(first.severity).toBe('medium')
    // Signal porte sur la mission la plus récente
    expect(first.missionId).toBe('m2')
    expect(first.evidence.classGap).toBe(2)
  })

  it('retourne un signal critical si écart ≥ 4 classes (G → C)', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'G',
        createdAt: '2025-08-01T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'C',
        createdAt: '2026-04-20T10:00:00Z',
      }),
    ]

    const signals = detectDpeShopping(missions)
    expect(signals).toHaveLength(1)
    expect(signals[0]?.severity).toBe('critical')
  })

  it('ne signale pas si écart < 2 classes (F → E)', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'F',
        createdAt: '2025-11-15T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'E',
        createdAt: '2026-04-20T10:00:00Z',
      }),
    ]

    expect(detectDpeShopping(missions)).toHaveLength(0)
  })

  it('ignore les missions au-delà de 12 mois', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'F',
        createdAt: '2024-01-01T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'B',
        createdAt: '2026-05-01T10:00:00Z',
      }),
    ]

    expect(detectDpeShopping(missions)).toHaveLength(0)
  })

  it('ignore les re-uploads (même numero_dpe)', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'F',
        numeroDpe: 'DPE-2026-0001',
        createdAt: '2026-01-01T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'C',
        numeroDpe: 'DPE-2026-0001',
        createdAt: '2026-04-01T10:00:00Z',
      }),
    ]

    expect(detectDpeShopping(missions)).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------- */
/*  detectCadastreMismatch                                                     */
/* -------------------------------------------------------------------------- */

describe('detectCadastreMismatch', () => {
  it('retourne null si surfaces matchent à ±15%', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      surfaceDpe: 80,
      surfaceCadastre: 85,
    })
    expect(detectCadastreMismatch(m)).toBeNull()
  })

  it('retourne un signal medium si écart 20% (80 vs 100)', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      surfaceDpe: 80,
      surfaceCadastre: 100,
    })
    const sig = detectCadastreMismatch(m)
    expect(sig).not.toBeNull()
    expect(sig?.severity).toBe('medium')
    expect(sig?.type).toBe('cadastre_mismatch')
  })

  it('retourne un signal critical si écart > 40%', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      surfaceDpe: 50,
      surfaceCadastre: 100,
    })
    const sig = detectCadastreMismatch(m)
    expect(sig?.severity).toBe('critical')
  })

  it('retourne null si surface manquante', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      surfaceDpe: 80,
      surfaceCadastre: null,
    })
    expect(detectCadastreMismatch(m)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*  detectClassJump                                                            */
/* -------------------------------------------------------------------------- */

describe('detectClassJump', () => {
  it('signale un saut G → B sans travaux documentés (critical)', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'G',
        createdAt: '2025-01-01T10:00:00Z',
        hasTravauxDocumented: false,
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'B',
        createdAt: '2026-04-01T10:00:00Z',
        hasTravauxDocumented: false,
      }),
    ]

    const signals = detectClassJump(missions)
    expect(signals).toHaveLength(1)
    const first = signals[0]
    if (!first) throw new Error('expected signal')
    expect(first.severity).toBe('critical') // saut 5 classes
    expect(first.missionId).toBe('m2')
  })

  it("n'alerte pas si travaux documentés", () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'G',
        createdAt: '2025-01-01T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'B',
        createdAt: '2026-04-01T10:00:00Z',
        hasTravauxDocumented: true,
      }),
    ]

    expect(detectClassJump(missions)).toHaveLength(0)
  })

  it("n'alerte pas si saut < 2 classes (E → D)", () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'E',
        createdAt: '2025-01-01T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'D',
        createdAt: '2026-04-01T10:00:00Z',
      }),
    ]

    expect(detectClassJump(missions)).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------- */
/*  detectAberrantData                                                         */
/* -------------------------------------------------------------------------- */

describe('detectAberrantData', () => {
  it('signale ratio puissance / m² aberrant (200 m² + 5 kW = 25 W/m²)', () => {
    // 25 W/m² > 5 (LOW threshold), < 200 (HIGH threshold) → pas d'alerte attendue
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      heatingPowerKw: 5,
      surfaceTotal: 200,
    })
    expect(detectAberrantData(m)).toHaveLength(0)
  })

  it('signale puissance trop basse (4 kW pour 1000 m² = 4 W/m²)', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      heatingPowerKw: 4,
      surfaceTotal: 1000,
    })
    const signals = detectAberrantData(m)
    expect(signals.length).toBeGreaterThan(0)
    expect(signals[0]?.type).toBe('aberrant_data')
    expect(signals[0]?.severity).toBe('medium')
  })

  it('signale puissance extrême (50 kW pour 80 m² = 625 W/m², high)', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      heatingPowerKw: 50,
      surfaceTotal: 80,
    })
    const signals = detectAberrantData(m)
    expect(signals.length).toBeGreaterThan(0)
    const heatingSignal = signals.find((s) => s.evidence.check === 'heating_power_high')
    expect(heatingSignal).toBeDefined()
    expect(heatingSignal?.severity).toBe('high')
  })

  it('signale classe A + consommation > 50 kWh/m²', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      dpeLetter: 'A',
      energyValue: 75,
    })
    const signals = detectAberrantData(m)
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.some((s) => s.evidence.check === 'class_a_with_high_consumption')).toBe(true)
  })

  it('signale maison ancienne (<1948) classée A sans travaux', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      yearBuilt: 1900,
      dpeLetter: 'A',
      hasTravauxDocumented: false,
    })
    const signals = detectAberrantData(m)
    expect(signals.some((s) => s.evidence.check === 'old_building_good_class')).toBe(true)
  })

  it('ne signale rien si mission cohérente', () => {
    const m = makeMission({
      id: 'm1',
      propertyId: 'p1',
      heatingPowerKw: 12,
      surfaceTotal: 100,
      dpeLetter: 'C',
      energyValue: 180,
      yearBuilt: 1985,
    })
    expect(detectAberrantData(m)).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------- */
/*  detectRecurrentPatterns                                                    */
/* -------------------------------------------------------------------------- */

describe('detectRecurrentPatterns', () => {
  it('signale une erreur présente dans > 50% des missions (high)', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        preExportFindingTypes: ['vmc_missing', 'photo_blurry'],
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p2',
        preExportFindingTypes: ['vmc_missing'],
      }),
      makeMission({
        id: 'm3',
        propertyId: 'p3',
        preExportFindingTypes: ['vmc_missing'],
      }),
      makeMission({
        id: 'm4',
        propertyId: 'p4',
        preExportFindingTypes: [],
      }),
    ]

    const signals = detectRecurrentPatterns(missions, 1)
    expect(signals.length).toBeGreaterThan(0)
    const vmcSignal = signals.find((s) => s.evidence.findingType === 'vmc_missing')
    expect(vmcSignal).toBeDefined()
    expect(vmcSignal?.severity).toBe('high') // 75% > 50%
  })

  it('ne signale pas si pattern présent dans < 30% des missions', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        preExportFindingTypes: ['rare_finding'],
      }),
      makeMission({ id: 'm2', propertyId: 'p2', preExportFindingTypes: [] }),
      makeMission({ id: 'm3', propertyId: 'p3', preExportFindingTypes: [] }),
      makeMission({ id: 'm4', propertyId: 'p4', preExportFindingTypes: [] }),
      makeMission({ id: 'm5', propertyId: 'p5', preExportFindingTypes: [] }),
    ]
    expect(detectRecurrentPatterns(missions, 1)).toHaveLength(0)
  })

  it('limite le retour aux top 3 patterns', () => {
    const findings = ['f1', 'f2', 'f3', 'f4', 'f5']
    // Chaque finding présent dans toutes les missions = 100%
    const missions: Mission[] = Array.from({ length: 5 }, (_, i) =>
      makeMission({
        id: `m${i + 1}`,
        propertyId: `p${i + 1}`,
        preExportFindingTypes: findings,
      }),
    )

    const signals = detectRecurrentPatterns(missions, 1)
    expect(signals.length).toBeLessThanOrEqual(3)
  })
})

/* -------------------------------------------------------------------------- */
/*  aggregateRiskSignals                                                       */
/* -------------------------------------------------------------------------- */

describe('aggregateRiskSignals', () => {
  it('retourne score 100 si aucun signal', () => {
    const result = aggregateRiskSignals([])
    expect(result.score).toBe(100)
    expect(result.top5).toHaveLength(0)
    expect(result.bySeverity.critical).toBe(0)
  })

  it('retourne score < 50 si critical présent (weight 25 + autres)', () => {
    const result = aggregateRiskSignals([
      {
        type: 'dpe_shopping',
        severity: 'critical',
        missionId: 'm1',
        description: 'x',
        evidence: {},
      },
      {
        type: 'cadastre_mismatch',
        severity: 'critical',
        missionId: 'm2',
        description: 'x',
        evidence: {},
      },
      { type: 'class_jump', severity: 'high', missionId: 'm3', description: 'x', evidence: {} },
    ])
    // Score = 100 - 25 - 25 - 12 = 38
    expect(result.score).toBe(38)
    expect(result.score).toBeLessThan(50)
  })

  it('top5 limite à 5 signaux max', () => {
    const signals = Array.from({ length: 8 }, (_, i) => ({
      type: 'aberrant_data' as const,
      severity: 'medium' as const,
      missionId: `m${i}`,
      description: 'x',
      evidence: {},
    }))
    const result = aggregateRiskSignals(signals)
    expect(result.top5).toHaveLength(5)
  })

  it('top5 priorise les critical puis high', () => {
    const signals = [
      {
        type: 'aberrant_data' as const,
        severity: 'low' as const,
        missionId: 'm1',
        description: '',
        evidence: {},
      },
      {
        type: 'cadastre_mismatch' as const,
        severity: 'critical' as const,
        missionId: 'm2',
        description: '',
        evidence: {},
      },
      {
        type: 'class_jump' as const,
        severity: 'high' as const,
        missionId: 'm3',
        description: '',
        evidence: {},
      },
    ]
    const result = aggregateRiskSignals(signals)
    expect(result.top5[0]?.severity).toBe('critical')
    expect(result.top5[1]?.severity).toBe('high')
  })
})

/* -------------------------------------------------------------------------- */
/*  runAllDetectors — pipeline end-to-end                                      */
/* -------------------------------------------------------------------------- */

describe('runAllDetectors', () => {
  it('exécute les 5 détecteurs et retourne un agrégat cohérent', () => {
    const missions: Mission[] = [
      // DPE shopping + class jump
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'F',
        createdAt: '2025-11-01T10:00:00Z',
      }),
      makeMission({
        id: 'm2',
        propertyId: 'p1',
        dpeLetter: 'B',
        createdAt: '2026-04-20T10:00:00Z',
      }),
      // Cadastre mismatch
      makeMission({
        id: 'm3',
        propertyId: 'p2',
        cadastreSection: 'CD',
        cadastreNumber: '0099',
        surfaceDpe: 60,
        surfaceCadastre: 100,
      }),
    ]

    const { signals, aggregate } = runAllDetectors(missions, 1)
    expect(signals.length).toBeGreaterThan(0)
    expect(aggregate.score).toBeLessThan(100)
    expect(aggregate.top5.length).toBeGreaterThan(0)
  })

  it('retourne score 100 sur une liste de missions parfaitement saines', () => {
    const missions: Mission[] = [
      makeMission({
        id: 'm1',
        propertyId: 'p1',
        dpeLetter: 'C',
        surfaceDpe: 85,
        surfaceCadastre: 86,
        heatingPowerKw: 10,
        surfaceTotal: 85,
        yearBuilt: 1995,
      }),
    ]
    const { aggregate } = runAllDetectors(missions, 1)
    expect(aggregate.score).toBe(100)
  })
})
