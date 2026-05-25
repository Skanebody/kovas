/**
 * Vitest — adaptateur IO fiche publique avec Supabase mocké (B42).
 *
 * Couvre tous les scénarios d'IO du wrapper RPC :
 *   - Cas nominal (data structurée, médiane numerique)
 *   - Coerce string (Postgres numeric serialisé en string)
 *   - Erreur RPC (migration absente, RLS, transient)
 *   - Exception thrown par le client (réseau, abort)
 *   - sample_size 0 (lead sans réponse)
 *   - Conservation des autres signaux (verified, updated)
 */

import { describe, expect, it, vi } from 'vitest'
import { fetchAvailabilitySignals } from './diag-availability-fetch'

const NOW = new Date('2026-05-25T00:00:00Z')

function mockSupabase(rpcResult: {
  data: unknown
  error: unknown
}): { rpc: ReturnType<typeof vi.fn> } {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  }
}

describe('fetchAvailabilitySignals', () => {
  it('returns full signals when RPC returns numeric median (cas nominal)', async () => {
    const supabase = mockSupabase({
      data: [{ median_minutes: 45, sample_size: 12 }],
      error: null,
    })
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: {
        last_verified_at: '2026-05-10T00:00:00Z',
        updated_at: '2026-05-22T00:00:00Z',
      },
      supabase,
      now: NOW,
    })
    expect(supabase.rpc).toHaveBeenCalledWith('get_diagnostician_response_metrics', {
      p_diagnostician_id: 'diag-uuid-123',
    })
    expect(result.responseSentence).toBe('Répond généralement sous 1 heure')
    expect(result.responseBucket).toBe('fast')
    expect(result.verifiedSentence).toBe('Profil vérifié le 10 mai 2026')
    expect(result.updatedSentence).toBe('Profil mis à jour le 22 mai 2026')
    expect(result.signalsCount).toBe(3)
  })

  it('coerces Postgres numeric string median (driver-dependent)', async () => {
    const supabase = mockSupabase({
      data: [{ median_minutes: '180.5', sample_size: 5 }],
      error: null,
    })
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: { last_verified_at: null, updated_at: '2026-05-22T00:00:00Z' },
      supabase,
      now: NOW,
    })
    expect(result.responseSentence).toBe('Répond généralement sous 4 heures')
    expect(result.responseBucket).toBe('fast')
  })

  it('omits response signal when RPC returns error (migration absente, RLS, etc.)', async () => {
    const supabase = mockSupabase({
      data: null,
      error: { message: 'function get_diagnostician_response_metrics does not exist' },
    })
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: {
        last_verified_at: '2026-05-10T00:00:00Z',
        updated_at: '2026-05-22T00:00:00Z',
      },
      supabase,
      now: NOW,
    })
    expect(result.responseSentence).toBeNull()
    // Les autres signaux sont quand même rendus
    expect(result.verifiedSentence).toBe('Profil vérifié le 10 mai 2026')
    expect(result.updatedSentence).toBe('Profil mis à jour le 22 mai 2026')
    expect(result.signalsCount).toBe(2)
  })

  it('handles thrown exception gracefully (network abort, etc.)', async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: { last_verified_at: null, updated_at: '2026-05-22T00:00:00Z' },
      supabase,
      now: NOW,
    })
    expect(result.responseSentence).toBeNull()
    expect(result.signalsCount).toBe(1)
  })

  it('omits response signal when sample_size below threshold (< 3)', async () => {
    const supabase = mockSupabase({
      data: [{ median_minutes: 30, sample_size: 2 }],
      error: null,
    })
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: { last_verified_at: null, updated_at: null },
      supabase,
      now: NOW,
    })
    expect(result.responseSentence).toBeNull()
    expect(result.signalsCount).toBe(0)
  })

  it('omits response signal when RPC returns median NULL (sample 0)', async () => {
    const supabase = mockSupabase({
      data: [{ median_minutes: null, sample_size: 0 }],
      error: null,
    })
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: { last_verified_at: '2026-05-10T00:00:00Z', updated_at: null },
      supabase,
      now: NOW,
    })
    expect(result.responseSentence).toBeNull()
    expect(result.verifiedSentence).toBe('Profil vérifié le 10 mai 2026')
    expect(result.signalsCount).toBe(1)
  })

  it('handles empty data array (RPC returned nothing)', async () => {
    const supabase = mockSupabase({ data: [], error: null })
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: { last_verified_at: null, updated_at: null },
      supabase,
      now: NOW,
    })
    expect(result.responseSentence).toBeNull()
    expect(result.signalsCount).toBe(0)
  })

  it('handles non-array data (defensive against API change)', async () => {
    const supabase = mockSupabase({ data: { foo: 'bar' }, error: null })
    const result = await fetchAvailabilitySignals({
      diagnosticianId: 'diag-uuid-123',
      diagRow: { last_verified_at: null, updated_at: '2026-05-22T00:00:00Z' },
      supabase,
      now: NOW,
    })
    expect(result.responseSentence).toBeNull()
    expect(result.signalsCount).toBe(1)
  })
})
