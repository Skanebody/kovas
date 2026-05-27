import {
  getSiretValidationMessage,
  isFakeSiretAllowed,
  validateSiret,
} from '@/lib/validation/siret'
import { z } from 'zod'

export const CLIENT_TYPES = [
  'particulier',
  'agence',
  'notaire',
  'syndic',
  'entreprise',
  'collectivite',
] as const

export type ClientType = (typeof CLIENT_TYPES)[number]

const B2B_TYPES: ClientType[] = ['agence', 'notaire', 'syndic', 'entreprise', 'collectivite']

export function isBusinessClientType(type: string): type is Exclude<ClientType, 'particulier'> {
  return (B2B_TYPES as string[]).includes(type)
}

export const clientFormSchema = z
  .object({
    type: z.enum(CLIENT_TYPES),
    displayName: z.string().min(2, 'Nom affiché requis (2 caractères min.)').max(120),
    firstName: z.string().max(80).optional().or(z.literal('')),
    lastName: z.string().max(80).optional().or(z.literal('')),
    companyName: z.string().max(120).optional().or(z.literal('')),
    email: z.string().email('Email invalide').or(z.literal('')).optional(),
    phone: z.string().max(30).optional().or(z.literal('')),
    address: z.string().max(255).optional().or(z.literal('')),
    postalCode: z.string().max(12).optional().or(z.literal('')),
    city: z.string().max(100).optional().or(z.literal('')),
    apartmentDetail: z.string().max(120).optional().or(z.literal('')),
    buildingLetter: z.string().max(10).optional().or(z.literal('')),
    floorNumber: z.coerce.number().int().min(-5).max(60).optional(),
    addressComplement: z.string().max(200).optional().or(z.literal('')),
    siret: z.string().max(20).optional().or(z.literal('')),
    notes: z.string().max(2000).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim() ?? ''
    const phone = data.phone?.trim() ?? ''
    if (!email && !phone) {
      const msg = 'Renseignez au moins un email ou un numéro de téléphone.'
      ctx.addIssue({ code: 'custom', message: msg, path: ['email'] })
      ctx.addIssue({ code: 'custom', message: msg, path: ['phone'] })
    }

    const cleanedSiret = (data.siret ?? '').replace(/\s/g, '')
    if (cleanedSiret && !isFakeSiretAllowed()) {
      const siretCheck = validateSiret(cleanedSiret)
      if (!siretCheck.valid) {
        ctx.addIssue({
          code: 'custom',
          message: getSiretValidationMessage(siretCheck.reason),
          path: ['siret'],
        })
      }
    }

    if (isBusinessClientType(data.type) && !data.companyName?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Raison sociale requise pour ce type de client.',
        path: ['companyName'],
      })
    }
  })

export type ClientFormValues = z.infer<typeof clientFormSchema>

export function parseClientFormData(formData: FormData): ClientFormValues {
  const floorRaw = formData.get('floorNumber')
  return {
    type: formData.get('type') as ClientType,
    displayName: String(formData.get('displayName') ?? ''),
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    companyName: String(formData.get('companyName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    address: String(formData.get('address') ?? ''),
    postalCode: String(formData.get('postalCode') || formData.get('address_postcode') || ''),
    city: String(formData.get('city') || formData.get('address_city') || ''),
    apartmentDetail: String(formData.get('apartmentDetail') ?? ''),
    buildingLetter: String(formData.get('buildingLetter') ?? ''),
    floorNumber: floorRaw === '' || floorRaw === null ? undefined : Number(floorRaw),
    addressComplement: String(formData.get('addressComplement') ?? ''),
    siret: String(formData.get('siret') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }
}

export function clientFormValuesToRow(data: ClientFormValues) {
  const cleanedSiret = (data.siret ?? '').replace(/\s/g, '')
  const business = isBusinessClientType(data.type)
  const hasAddressLine = Boolean(data.address?.trim())

  return {
    type: data.type,
    display_name: data.displayName,
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    company_name: data.companyName || null,
    email: data.email || null,
    phone: data.phone || null,
    address: hasAddressLine ? data.address : null,
    postal_code: data.postalCode || null,
    city: data.city || null,
    apartment_detail: data.apartmentDetail || null,
    building_letter: data.buildingLetter || null,
    floor_number: data.floorNumber ?? null,
    address_complement: data.addressComplement || null,
    siret: business && cleanedSiret ? cleanedSiret : null,
    notes: data.notes || null,
  }
}
