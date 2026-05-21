/**
 * KOVAS — Helper de lecture branding cabinet (logo + couleur principale).
 *
 * Utilisé par tous les générateurs de PDF (devis, factures, rapports diagnostic
 * en marque blanche cabinet) ainsi que par la page d'aperçu in-app.
 *
 * Source de vérité :
 *   - `organizations.logo_url`        (chemin Storage, jamais data-URL)
 *   - `organizations.logo_mime`       (image/png | image/svg+xml | image/jpeg)
 *   - `organizations.brand_color_hex` (#RRGGBB, default `#0F1419`)
 *
 * Le logo est servi via signed URL 24h (assez pour générer un PDF batch + le
 * télécharger). Si aucune donnée n'est trouvée (org introuvable, logo non
 * uploadé), on retourne des defaults sobres pour ne jamais casser un export.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const BRANDING_BUCKET = 'org-branding'
export const BRANDING_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60 // 24h
export const DEFAULT_BRAND_COLOR_HEX = '#0F1419'

export interface OrganizationBranding {
  /** URL signée 24h pour télécharger le logo. `null` si pas de logo. */
  logoSignedUrl: string | null
  /** Mime type validé. `null` si pas de logo. */
  logoMime: string | null
  /** Couleur hex `#RRGGBB` — toujours définie (default `#0F1419`). */
  brandColorHex: string
}

/**
 * Type-safe minimal row pour éviter de dépendre des Database types regénérés.
 * Cf. migration `20260527100000_organization_branding.sql`.
 */
interface OrganizationBrandingRow {
  logo_url: string | null
  logo_mime: string | null
  brand_color_hex: string | null
}

/**
 * Récupère le branding d'une organisation. Tolérant aux erreurs : retourne
 * toujours un objet valide (defaults sobres si lecture échoue).
 */
export async function getOrganizationBranding(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrganizationBranding> {
  // Cast minimal — les colonnes branding ne sont pas encore dans Database types
  // (regen requise après application de la migration 20260527100000).
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: OrganizationBrandingRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }

  const { data, error } = await client
    .from('organizations')
    .select('logo_url, logo_mime, brand_color_hex')
    .eq('id', orgId)
    .maybeSingle()

  if (error || !data) {
    return {
      logoSignedUrl: null,
      logoMime: null,
      brandColorHex: DEFAULT_BRAND_COLOR_HEX,
    }
  }

  const brandColorHex =
    data.brand_color_hex && /^#[0-9A-Fa-f]{6}$/.test(data.brand_color_hex)
      ? data.brand_color_hex
      : DEFAULT_BRAND_COLOR_HEX

  let logoSignedUrl: string | null = null
  if (data.logo_url) {
    const { data: signed } = await supabase.storage
      .from(BRANDING_BUCKET)
      .createSignedUrl(data.logo_url, BRANDING_SIGNED_URL_TTL_SECONDS)
    logoSignedUrl = signed?.signedUrl ?? null
  }

  return {
    logoSignedUrl,
    logoMime: data.logo_mime ?? null,
    brandColorHex,
  }
}

/**
 * Détermine l'extension Storage à partir du mime type whitelist branding.
 * Aligne avec la convention `<org_id>/logo.<ext>` (mono-fichier par org).
 */
export function brandingMimeToExt(mime: string): 'png' | 'svg' | 'jpg' {
  if (mime === 'image/svg+xml') return 'svg'
  if (mime === 'image/jpeg') return 'jpg'
  return 'png'
}

/**
 * Liste des mimes acceptés (cohérent avec migration CHECK constraint +
 * `allowed_mime_types` du bucket).
 */
export const BRANDING_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/svg+xml',
  'image/jpeg',
] as const

export type BrandingMime = (typeof BRANDING_ALLOWED_MIME_TYPES)[number]

/** Taille max logo (2 MiB, alignée bucket file_size_limit). */
export const BRANDING_MAX_BYTES = 2 * 1024 * 1024
