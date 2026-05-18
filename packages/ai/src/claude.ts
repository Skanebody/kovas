import Anthropic from '@anthropic-ai/sdk'

/**
 * Wrapper Anthropic Claude API.
 * Modèles configurés via env vars :
 * - ANTHROPIC_MODEL_VOICE (default: claude-haiku-4-5)
 * - ANTHROPIC_MODEL_VISION (default: claude-sonnet-4-6, V2)
 * - ANTHROPIC_MODEL_CHAT (default: claude-haiku-4-5)
 *
 * Cf. /docs/ai-autonomy-strategy.md pour la stratégie 36 mois.
 */

export function createAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing')
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

export const CLAUDE_MODELS = {
  voice: process.env.ANTHROPIC_MODEL_VOICE ?? 'claude-haiku-4-5',
  vision: process.env.ANTHROPIC_MODEL_VISION ?? 'claude-sonnet-4-6',
  chat: process.env.ANTHROPIC_MODEL_CHAT ?? 'claude-haiku-4-5',
} as const

export const TOKEN_BUDGETS = {
  voiceStructure: { recommended: 300, hardCeiling: 500 },
  visionEquipment: { recommended: 500, hardCeiling: 1000 },
  postDpeReco: { recommended: 3000, hardCeiling: 5000 },
  chatTurn: { recommended: 600, hardCeiling: 1500 },
} as const
