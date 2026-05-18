import { z } from 'zod'

export const PropertyTypeEnum = z.enum([
  'maison',
  'appartement',
  'immeuble',
  'local_commercial',
  'bureau',
  'autre',
])
export type PropertyType = z.infer<typeof PropertyTypeEnum>

export const PropertySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  banId: z.string().optional(), // API BAN identifier
  address: z.string().min(1),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  inseeCode: z.string().optional(),
  // PostGIS point (lat, lng) stored as { lat, lng } JSON
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  cadastreSection: z.string().optional(),
  cadastreNumber: z.string().optional(),
  cadastrePrefix: z.string().optional(),
  propertyType: PropertyTypeEnum.optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  surfaceCarrez: z.number().nonnegative().optional(), // m²
  surfaceBoutin: z.number().nonnegative().optional(), // m²
  surfaceTotal: z.number().nonnegative().optional(),
  floors: z.number().int().min(0).optional(),
  roomsCount: z.number().int().min(0).optional(),
  heatingType: z.string().optional(),
  energyClass: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional(),
  gesClass: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional(),
  notes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
})
export type Property = z.infer<typeof PropertySchema>
