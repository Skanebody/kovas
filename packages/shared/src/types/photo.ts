import { z } from 'zod'

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  missionId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  storagePath: z.string(),
  thumbPath: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().default('image/webp'), // PWA pivot : WebP par défaut
  takenAt: z.date().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  caption: z.string().optional(),
  aiTags: z.array(z.string()).default([]), // V2 Vision IA tags
  aiCostEur: z.number().default(0),
  uploadedBy: z.string().uuid().optional(),
  syncStatus: z.enum(['pending', 'syncing', 'synced']).default('pending'),
  createdAt: z.date(),
})
export type Photo = z.infer<typeof PhotoSchema>

// Annotations basiques Konva (feature MVP V1 #2)
export const PhotoAnnotationKindEnum = z.enum(['circle', 'arrow', 'text', 'rectangle'])
export type PhotoAnnotationKind = z.infer<typeof PhotoAnnotationKindEnum>

export const PhotoAnnotationSchema = z.object({
  kind: PhotoAnnotationKindEnum,
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  text: z.string().optional(),
  color: z.string().default('#C46969'), // Rouge doux pill KOVAS
  strokeWidth: z.number().default(2),
})
export type PhotoAnnotation = z.infer<typeof PhotoAnnotationSchema>
