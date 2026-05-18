import { z } from 'zod'

// NOTE: Croquis 2D Apple Pencil = V2 (post-Modification 18). Types préparés pour annotations photos Konva V1.

export const SketchSourceEnum = z.enum(['photo_annotation', 'pencil_v2', 'lidar_v3'])
export type SketchSource = z.infer<typeof SketchSourceEnum>

export const StrokeSchema = z.object({
  points: z.array(z.tuple([z.number(), z.number(), z.number()])), // [x, y, pressure]
  color: z.string().default('#0A0A0A'),
  width: z.number().positive().default(2),
})

export const SymbolKindEnum = z.enum(['porte', 'fenetre', 'prise', 'radiateur', 'chaudiere'])
export type SymbolKind = z.infer<typeof SymbolKindEnum>

export const SketchGeometrySchema = z.object({
  strokes: z.array(StrokeSchema).default([]),
  symbols: z
    .array(
      z.object({
        kind: SymbolKindEnum,
        x: z.number(),
        y: z.number(),
        rotation: z.number().default(0),
      }),
    )
    .default([]),
})
export type SketchGeometry = z.infer<typeof SketchGeometrySchema>

export const SketchSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  source: SketchSourceEnum,
  geometry: SketchGeometrySchema,
  previewPath: z.string().optional(),
  surfaceCarrezM2: z.number().nonnegative().optional(),
  surfaceBoutinM2: z.number().nonnegative().optional(),
  reviewed: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type Sketch = z.infer<typeof SketchSchema>
