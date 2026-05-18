import { z } from 'zod'

export const ClientTypeEnum = z.enum([
  'particulier',
  'agence',
  'notaire',
  'syndic',
  'entreprise',
  'collectivite',
])
export type ClientType = z.infer<typeof ClientTypeEnum>

export const ClientSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: ClientTypeEnum,
  displayName: z.string().min(1).max(200),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(), // E.164 format (cf. formats/phone.ts)
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('FR'),
  siret: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdBy: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
})
export type Client = z.infer<typeof ClientSchema>
