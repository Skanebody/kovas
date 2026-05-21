/**
 * KOVAS — Chargement consolidé d'une carte de visite.
 *
 * Centralise la lecture multi-tables (business_cards + organizations +
 * profiles) et construit le `VCardInput` final en appliquant les toggles
 * show_*. Utilisé à la fois :
 *   - côté authentifié (page d'édition + aperçu live + PDF imprimable)
 *   - côté public (page /c/<token> + .vcf téléchargeable)
 *
 * Pour la version publique on accepte un client service-role (bypass RLS) :
 * la sécurité repose alors sur le `public_token` (32 chars aléatoires).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BRANDING_BUCKET,
  BRANDING_SIGNED_URL_TTL_SECONDS,
  DEFAULT_BRAND_COLOR_HEX,
} from '@/lib/branding/get-organization-branding'
import { buildCertificationNote, type VCardInput } from './vcard'

export interface BusinessCardRow {
  organization_id: string
  user_id: string
  show_phone_mobile: boolean
  show_phone_fixed: boolean
  show_email: boolean
  show_address: boolean
  show_website: boolean
  show_certification: boolean
  show_siret: boolean
  show_logo: boolean
  custom_title: string | null
  custom_website: string | null
  custom_phone_fixed: string | null
  public_token: string
  view_count: number
  scan_count: number
  created_at: string
  updated_at: string
}

export interface BusinessCardContext {
  card: BusinessCardRow
  vcardInput: VCardInput
  /** Couleur principale cabinet (#RRGGBB). */
  brandColorHex: string
  /** URL signée 24h pour le logo (PNG/JPEG uniquement — exclut SVG car pas
   * supporté en PHOTO vCard). `null` si pas de logo OU SVG. */
  logoSignedUrl: string | null
  /** MIME du logo signé (image/png ou image/jpeg). */
  logoMime: 'image/png' | 'image/jpeg' | null
  /** Prénom/Nom pour le nom de fichier .vcf. */
  fullName: string
}

interface OrganizationRow {
  id: string
  name: string
  siret: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  certification_n: string | null
  logo_url: string | null
  logo_mime: string | null
  brand_color_hex: string | null
}

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  phone: string | null
}

/**
 * Charge la carte par `organization_id` (utilisé par la page d'édition).
 * Crée la ligne si elle n'existe pas (auto-init au premier accès).
 */
export async function loadBusinessCardByOrg(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<BusinessCardContext | null> {
  // Cast minimal : business_cards pas encore dans Database types regen.
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: BusinessCardRow | OrganizationRow | ProfileRow | null
            error: { message: string } | null
          }>
        }
      }
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: BusinessCardRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }

  const { data: existing } = await client
    .from('business_cards')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()

  let card = existing as BusinessCardRow | null

  if (!card) {
    const { data: created, error } = await client
      .from('business_cards')
      .insert({ organization_id: organizationId, user_id: userId })
      .select('*')
      .single()
    if (error || !created) return null
    card = created
  }

  return buildContext(supabase, card)
}

/**
 * Charge la carte par `public_token` (utilisé par /c/<token> sans auth).
 * À appeler avec un client service-role.
 */
export async function loadBusinessCardByToken(
  adminSupabase: SupabaseClient,
  publicToken: string,
): Promise<BusinessCardContext | null> {
  const client = adminSupabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: BusinessCardRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }

  const { data: card } = await client
    .from('business_cards')
    .select('*')
    .eq('public_token', publicToken)
    .maybeSingle()

  if (!card) return null
  return buildContext(adminSupabase, card)
}

async function buildContext(
  supabase: SupabaseClient,
  card: BusinessCardRow,
): Promise<BusinessCardContext | null> {
  // Lecture org + profile en parallèle.
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: OrganizationRow | ProfileRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }

  const [orgRes, profileRes] = await Promise.all([
    client
      .from('organizations')
      .select(
        'id, name, siret, address, city, postal_code, country, certification_n, logo_url, logo_mime, brand_color_hex',
      )
      .eq('id', card.organization_id)
      .maybeSingle() as Promise<{
      data: OrganizationRow | null
      error: { message: string } | null
    }>,
    client
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('id', card.user_id)
      .maybeSingle() as Promise<{
      data: ProfileRow | null
      error: { message: string } | null
    }>,
  ])

  const org = orgRes.data
  const profile = profileRes.data
  if (!org || !profile) return null

  // Split du nom en first/last (best effort sur full_name) :
  const fullName = profile.full_name?.trim() ?? profile.email
  const nameParts = fullName.split(/\s+/)
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ') || fullName

  // Logo signé (uniquement si PNG ou JPEG — vCard PHOTO ne supporte pas SVG).
  let logoSignedUrl: string | null = null
  let logoMime: 'image/png' | 'image/jpeg' | null = null
  if (org.logo_url && (org.logo_mime === 'image/png' || org.logo_mime === 'image/jpeg')) {
    const { data: signed } = await supabase.storage
      .from(BRANDING_BUCKET)
      .createSignedUrl(org.logo_url, BRANDING_SIGNED_URL_TTL_SECONDS)
    logoSignedUrl = signed?.signedUrl ?? null
    logoMime = org.logo_mime as 'image/png' | 'image/jpeg'
  }

  const brandColorHex =
    org.brand_color_hex && /^#[0-9A-Fa-f]{6}$/.test(org.brand_color_hex)
      ? org.brand_color_hex
      : DEFAULT_BRAND_COLOR_HEX

  // Application des toggles → construction du VCardInput final.
  const title = card.custom_title?.trim() || 'Diagnostiqueur immobilier certifié'

  const phoneMobile = card.show_phone_mobile && profile.phone ? profile.phone : undefined
  const phoneWork =
    card.show_phone_fixed && card.custom_phone_fixed
      ? card.custom_phone_fixed
      : undefined

  const emailWork = card.show_email && profile.email ? profile.email : undefined
  const website = card.show_website && card.custom_website ? card.custom_website : undefined

  const addressLine1 = card.show_address ? org.address ?? undefined : undefined
  const postalCode = card.show_address ? org.postal_code ?? undefined : undefined
  const city = card.show_address ? org.city ?? undefined : undefined
  const country = card.show_address ? org.country ?? 'France' : undefined

  const note = buildCertificationNote({
    certificationN: org.certification_n,
    siret: org.siret,
    showCertification: card.show_certification,
    showSiret: card.show_siret,
  })

  const vcardInput: VCardInput = {
    firstName,
    lastName,
    title,
    organization: org.name,
    emailWork,
    phoneMobile,
    phoneWork,
    website,
    addressLine1,
    postalCode,
    city,
    country,
    note,
    // logoBase64 et logoMime sont injectés au moment de la génération vCard
    // (lecture URL signée → fetch → base64). Pas ici pour rester économe.
  }

  return {
    card,
    vcardInput,
    brandColorHex,
    logoSignedUrl: card.show_logo ? logoSignedUrl : null,
    logoMime: card.show_logo ? logoMime : null,
    fullName,
  }
}

/**
 * Télécharge le logo via signed URL et retourne sa version base64 brute
 * (sans préfixe data:). Retourne `null` si fetch échoue ou si la taille
 * dépasse 50 Ko (limite pratique vCard PHOTO embedded).
 */
export async function fetchLogoBase64(signedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(signedUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 50 * 1024) return null
    return buf.toString('base64')
  } catch {
    return null
  }
}

/**
 * Slug nom de fichier .vcf : "prenom-nom.vcf" en kebab-case ASCII.
 */
export function vcfFilename(fullName: string): string {
  const slug = fullName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${slug || 'contact'}.vcf`
}
