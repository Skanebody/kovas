/**
 * Vitest — A1.3.6 Vision IA equipement (mocked Anthropic SDK).
 *
 * Couvre les chemins :
 *   - ANTHROPIC_API_KEY missing
 *   - Claude success + parse JSON valide
 *   - Claude success + JSON malformé
 *   - Claude error
 *   - confidence computation + needs_manual_validation flag
 *
 * Strategy : vi.mock('@anthropic-ai/sdk') pour intercepter client.messages.create.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @anthropic-ai/sdk avant import du module testé
const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

// Import après le mock
import { analyzeEquipmentPhoto } from './vision-equipment'

afterEach(() => {
  mockCreate.mockReset()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
  // Empêche le path enrichFromDatabase de toucher Supabase
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
})

function makeClaudeResponse(json: object) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(json),
      },
    ],
  }
}

describe('analyzeEquipmentPhoto', () => {
  it('returns error when API key missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const res = await analyzeEquipmentPhoto({ imageUrl: 'https://example.com/photo.jpg' })
    expect('error' in res).toBe(true)
    if ('error' in res) {
      expect(res.error).toMatch(/ANTHROPIC_API_KEY/)
    }
  })

  it('parses valid JSON from Claude and computes confidence', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse({
        equipment_type: { value: 'chaudiere_gaz', confidence: 0.95 },
        brand: { value: 'Saunier Duval', confidence: 0.9 },
        model: { value: 'Thelia Condens 25', confidence: 0.85 },
        power_kw: { value: 24, confidence: 0.8 },
        energy_class: { value: 'A', confidence: 0.75 },
        year_install: { value: 2018, confidence: 0.6 },
        serial_number: { value: 'SN12345', confidence: 0.7 },
        notes: '',
      }),
    )

    const res = await analyzeEquipmentPhoto({
      imageUrl: 'https://example.com/chaudiere.jpg',
    })

    expect('error' in res).toBe(false)
    if (!('error' in res)) {
      expect(res.equipment_type.value).toBe('chaudiere_gaz')
      expect(res.brand.value).toBe('Saunier Duval')
      expect(res.overall_confidence).toBeGreaterThan(0)
      expect(res.overall_confidence).toBeLessThanOrEqual(1)
      // Confidence haut (>= 0.7) → pas de validation manuelle
      expect(res.needs_manual_validation).toBe(false)
    }
  })

  it('flags needs_manual_validation when confidence < 0.7', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse({
        equipment_type: { value: 'autre', confidence: 0.4 },
        brand: { value: null, confidence: 0.3 },
        model: { value: null, confidence: 0.3 },
        power_kw: { value: null, confidence: 0.3 },
        energy_class: { value: null, confidence: 0.3 },
        year_install: { value: null, confidence: 0.3 },
        serial_number: { value: null, confidence: 0.3 },
        notes: 'photo floue',
      }),
    )

    const res = await analyzeEquipmentPhoto({ imageUrl: 'https://example.com/floue.jpg' })

    expect('error' in res).toBe(false)
    if (!('error' in res)) {
      expect(res.needs_manual_validation).toBe(true)
      expect(res.overall_confidence).toBeLessThan(0.7)
    }
  })

  it('strips markdown code fences from Claude response', async () => {
    // Claude renvoie parfois ```json ... ```
    const payload = JSON.stringify({
      equipment_type: { value: 'pompe_chaleur', confidence: 0.9 },
      brand: { value: 'Daikin', confidence: 0.95 },
      model: { value: 'Altherma 3', confidence: 0.85 },
      power_kw: { value: 8, confidence: 0.8 },
      energy_class: { value: null, confidence: 0.5 },
      year_install: { value: null, confidence: 0.5 },
      serial_number: { value: null, confidence: 0.5 },
      notes: '',
    })
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text' as const,
          text: `\`\`\`json\n${payload}\n\`\`\``,
        },
      ],
    })

    const res = await analyzeEquipmentPhoto({ imageUrl: 'https://example.com/pac.jpg' })
    expect('error' in res).toBe(false)
    if (!('error' in res)) {
      expect(res.equipment_type.value).toBe('pompe_chaleur')
      expect(res.brand.value).toBe('Daikin')
    }
  })

  it('returns error on invalid JSON from Claude', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text' as const, text: 'pas du JSON {{{ broken' }],
    })
    const res = await analyzeEquipmentPhoto({ imageUrl: 'https://example.com/test.jpg' })
    expect('error' in res).toBe(true)
    if ('error' in res) {
      expect(res.error).toMatch(/invalid JSON/i)
    }
  })

  it('returns error when Claude throws', async () => {
    mockCreate.mockRejectedValue(new Error('rate limit exceeded'))
    const res = await analyzeEquipmentPhoto({ imageUrl: 'https://example.com/test.jpg' })
    expect('error' in res).toBe(true)
    if ('error' in res) {
      expect(res.error).toMatch(/rate limit/i)
    }
  })

  it('returns error when Claude returns no text block', async () => {
    mockCreate.mockResolvedValue({ content: [] })
    const res = await analyzeEquipmentPhoto({ imageUrl: 'https://example.com/test.jpg' })
    expect('error' in res).toBe(true)
    if ('error' in res) {
      expect(res.error).toMatch(/no text response/i)
    }
  })
})
