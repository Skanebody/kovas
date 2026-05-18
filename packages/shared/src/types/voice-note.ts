import { z } from 'zod'

export const VoiceNoteStatusEnum = z.enum([
  'pending',
  'uploading',
  'transcribing',
  'structuring',
  'transcribed',
  'failed',
])
export type VoiceNoteStatus = z.infer<typeof VoiceNoteStatusEnum>

export const VoiceProviderEnum = z.enum(['openai_whisper', 'deepgram_nova3', 'ios_speech'])
export type VoiceProvider = z.infer<typeof VoiceProviderEnum>

export const VoiceNoteSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  recordedBy: z.string().uuid().optional(),
  storagePath: z.string(),
  durationSeconds: z.number().int().nonnegative().optional(),
  language: z.string().default('fr'),
  provider: VoiceProviderEnum.optional(),
  transcriptRaw: z.string().optional(),
  // Structured fields (output Claude Haiku hybride post-Modification 18)
  transcriptStructured: z.record(z.unknown()).optional(),
  parserUsed: z.enum(['custom_js', 'claude_haiku', 'hybrid']).optional(),
  aiCostEur: z.number().default(0),
  aiConfidence: z.number().min(0).max(1).optional(),
  status: VoiceNoteStatusEnum.default('pending'),
  createdAt: z.date(),
  transcribedAt: z.date().optional(),
})
export type VoiceNote = z.infer<typeof VoiceNoteSchema>
