/**
 * Vitest — GC2 mission flow state machine (pure-fn).
 */

import { describe, expect, it } from 'vitest'
import {
  type MissionSummary,
  type TransitionPreconditions,
  checkTransitionPreconditions,
  isTransitionAllowed,
  isVersionMismatch,
  nextPossibleTransitions,
  phaseLabel,
  progressPercent,
  selectMissionById,
} from './state-machine'

function noFlags(): TransitionPreconditions {
  return {
    has_at_least_one_photo: false,
    has_surface_declared: false,
    has_at_least_one_room_completed: false,
    conformity_score_computed: false,
    no_unresolved_critical_anomalies: false,
  }
}

function allFlags(): TransitionPreconditions {
  return {
    has_at_least_one_photo: true,
    has_surface_declared: true,
    has_at_least_one_room_completed: true,
    conformity_score_computed: true,
    no_unresolved_critical_anomalies: true,
  }
}

describe('isTransitionAllowed', () => {
  it('allows the forward linear path', () => {
    expect(isTransitionAllowed('preparation', 'capture_terrain')).toBe(true)
    expect(isTransitionAllowed('capture_terrain', 'verification')).toBe(true)
    expect(isTransitionAllowed('verification', 'pre_export')).toBe(true)
    expect(isTransitionAllowed('pre_export', 'sent')).toBe(true)
  })

  it('allows backward corrections (verification → capture, pre_export → verif)', () => {
    expect(isTransitionAllowed('verification', 'capture_terrain')).toBe(true)
    expect(isTransitionAllowed('pre_export', 'verification')).toBe(true)
    expect(isTransitionAllowed('pre_export', 'capture_terrain')).toBe(true)
  })

  it('rejects skipping phases (e.g. preparation → verification)', () => {
    expect(isTransitionAllowed('preparation', 'verification')).toBe(false)
    expect(isTransitionAllowed('preparation', 'pre_export')).toBe(false)
    expect(isTransitionAllowed('preparation', 'sent')).toBe(false)
  })

  it('rejects transitions away from terminal state sent', () => {
    expect(isTransitionAllowed('sent', 'preparation')).toBe(false)
    expect(isTransitionAllowed('sent', 'capture_terrain')).toBe(false)
    expect(isTransitionAllowed('sent', 'verification')).toBe(false)
  })

  it('allows self-transition (step change within same phase)', () => {
    expect(isTransitionAllowed('capture_terrain', 'capture_terrain')).toBe(true)
  })
})

describe('nextPossibleTransitions', () => {
  it('returns exactly 1 transition from preparation', () => {
    const next = nextPossibleTransitions('preparation')
    expect(next).toHaveLength(1)
    expect(next[0]?.to).toBe('capture_terrain')
  })

  it('returns multiple transitions from pre_export (forward + 2 backwards)', () => {
    const next = nextPossibleTransitions('pre_export')
    expect(next.length).toBeGreaterThanOrEqual(3)
    const targets = next.map((t) => t.to)
    expect(targets).toContain('sent')
    expect(targets).toContain('verification')
    expect(targets).toContain('capture_terrain')
  })

  it('returns empty for terminal state sent', () => {
    expect(nextPossibleTransitions('sent')).toHaveLength(0)
  })
})

describe('checkTransitionPreconditions', () => {
  it('refuses capture → verification without photo', () => {
    const res = checkTransitionPreconditions('capture_terrain', 'verification', noFlags())
    expect(res.satisfied).toBe(false)
    expect(res.missing.find((m) => m.code === 'NO_PHOTO')).toBeDefined()
  })

  it('refuses capture → verification without completed room', () => {
    const res = checkTransitionPreconditions('capture_terrain', 'verification', {
      ...noFlags(),
      has_at_least_one_photo: true,
    })
    expect(res.satisfied).toBe(false)
    expect(res.missing.find((m) => m.code === 'NO_ROOM_COMPLETED')).toBeDefined()
  })

  it('accepts capture → verification when photo + room present', () => {
    const res = checkTransitionPreconditions('capture_terrain', 'verification', {
      ...noFlags(),
      has_at_least_one_photo: true,
      has_at_least_one_room_completed: true,
    })
    expect(res.satisfied).toBe(true)
    expect(res.missing).toHaveLength(0)
  })

  it('refuses pre_export → sent without conformity_score', () => {
    const res = checkTransitionPreconditions('pre_export', 'sent', {
      ...allFlags(),
      conformity_score_computed: false,
    })
    expect(res.satisfied).toBe(false)
    expect(res.missing.find((m) => m.code === 'SCORE_NOT_COMPUTED')).toBeDefined()
  })

  it('refuses pre_export → sent when critical anomalies remain', () => {
    const res = checkTransitionPreconditions('pre_export', 'sent', {
      ...allFlags(),
      no_unresolved_critical_anomalies: false,
    })
    expect(res.satisfied).toBe(false)
    expect(res.missing.find((m) => m.code === 'CRITICAL_ANOMALIES')).toBeDefined()
  })

  it('accepts all checks satisfied → sent', () => {
    const res = checkTransitionPreconditions('pre_export', 'sent', allFlags())
    expect(res.satisfied).toBe(true)
  })

  it('returns satisfied for backward transitions (no preconditions)', () => {
    const res = checkTransitionPreconditions('verification', 'capture_terrain', noFlags())
    expect(res.satisfied).toBe(true)
  })
})

describe('selectMissionById (Lot B92 — multi-mission)', () => {
  const missions: ReadonlyArray<MissionSummary> = [
    { id: 'mission-1', type: 'dpe_vente' },
    { id: 'mission-2', type: 'amiante_vente' },
    { id: 'mission-3', type: 'plomb_crep' },
  ]

  it('returns the first mission when id is null', () => {
    expect(selectMissionById(missions, null)).toEqual(missions[0])
  })

  it('returns the first mission when id is undefined', () => {
    expect(selectMissionById(missions, undefined)).toEqual(missions[0])
  })

  it('returns the first mission when id is empty string', () => {
    expect(selectMissionById(missions, '')).toEqual(missions[0])
  })

  it('returns the matching mission when id is valid', () => {
    expect(selectMissionById(missions, 'mission-2')).toEqual(missions[1])
    expect(selectMissionById(missions, 'mission-3')).toEqual(missions[2])
  })

  it('falls back to the first mission when id is not found', () => {
    expect(selectMissionById(missions, 'unknown-id')).toEqual(missions[0])
  })

  it('returns null on empty list', () => {
    expect(selectMissionById([], null)).toBeNull()
    expect(selectMissionById([], 'any-id')).toBeNull()
  })

  it('returns the only mission when list has 1 entry', () => {
    const single: ReadonlyArray<MissionSummary> = [{ id: 'solo', type: 'dpe_vente' }]
    expect(selectMissionById(single, null)).toEqual(single[0])
    expect(selectMissionById(single, 'solo')).toEqual(single[0])
    expect(selectMissionById(single, 'other')).toEqual(single[0])
  })
})

describe('isVersionMismatch (Lot B92 — optimistic concurrency)', () => {
  it('returns false for null/undefined results', () => {
    expect(isVersionMismatch(null)).toBe(false)
    expect(isVersionMismatch(undefined)).toBe(false)
  })

  it('returns false for successful transitions', () => {
    expect(isVersionMismatch({ success: true })).toBe(false)
    expect(isVersionMismatch({ success: true, code: 'version_mismatch' })).toBe(false)
  })

  it('detects version_mismatch via the code field', () => {
    expect(isVersionMismatch({ success: false, code: 'version_mismatch' })).toBe(true)
  })

  it('detects version_mismatch via legacy error string fallback', () => {
    expect(
      isVersionMismatch({ success: false, error: 'Conflict: version_mismatch detected' }),
    ).toBe(true)
  })

  it('returns false for other error codes', () => {
    expect(isVersionMismatch({ success: false, code: 'forbidden' })).toBe(false)
    expect(isVersionMismatch({ success: false, code: 'terminal_state' })).toBe(false)
    expect(isVersionMismatch({ success: false, error: 'Mission introuvable.' })).toBe(false)
  })
})

describe('phaseLabel + progressPercent', () => {
  it('returns French labels', () => {
    expect(phaseLabel('preparation')).toBe('Préparation')
    expect(phaseLabel('capture_terrain')).toBe('Capture terrain')
    expect(phaseLabel('verification')).toBe('Vérification')
    expect(phaseLabel('pre_export')).toBe('Pré-export')
    expect(phaseLabel('sent')).toBe('Envoyé')
  })

  it('returns progress 0% at preparation', () => {
    expect(progressPercent('preparation')).toBe(0)
  })

  it('returns progress 100% at sent', () => {
    expect(progressPercent('sent')).toBe(100)
  })

  it('returns progress between 0 and 100 for mid phases', () => {
    expect(progressPercent('capture_terrain')).toBeGreaterThan(0)
    expect(progressPercent('verification')).toBeGreaterThan(progressPercent('capture_terrain'))
    expect(progressPercent('pre_export')).toBeGreaterThan(progressPercent('verification'))
    expect(progressPercent('pre_export')).toBeLessThan(100)
  })
})
