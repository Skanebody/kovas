import type { Database } from '@kovas/database/types'
/**
 * KOVAS — Helpers communs aux exporters dossier (Partition D).
 *
 * Centralise :
 *   - création d'un admin Supabase client (service_role)
 *   - récupération des IDs missions appartenant à un dossier (multi-mission)
 *   - récupération du contexte client/property pour file naming
 */
import { createClient as createAdminClient } from '@supabase/supabase-js'

export function getAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export interface DossierExportContext {
  dossier: {
    id: string
    reference: string
    organization_id: string
    has_amiante: boolean
  }
  missionIds: string[]
  client: { display_name: string | null; email: string | null } | null
  property: {
    address: string | null
    city: string | null
    apartment_detail: string | null
    building_letter: string | null
  } | null
}

/**
 * Charge les données minimum nécessaires pour piloter les exporters.
 * Vérifie l'appartenance multi-tenant via organization_id.
 */
/**
 * Shape locale du retour `dossiers` + joins `clients` + `properties`.
 * Les types DB générés ne couvrent pas les selects avec joins multiples.
 */
interface DossierJoinedRow {
  id: string
  reference: string
  organization_id: string
  client_id: string | null
  property_id: string
  clients:
    | { display_name: string | null; email: string | null }
    | { display_name: string | null; email: string | null }[]
    | null
  properties:
    | {
        address: string | null
        city: string | null
        apartment_detail: string | null
        building_letter: string | null
      }
    | {
        address: string | null
        city: string | null
        apartment_detail: string | null
        building_letter: string | null
      }[]
    | null
}

export async function loadDossierContext(
  dossierId: string,
  orgId: string,
): Promise<DossierExportContext> {
  const admin = getAdminClient()

  const { data: dossierRaw, error } = await admin
    .from('dossiers')
    .select(
      'id, reference, organization_id, client_id, property_id, ' +
        'clients(display_name, email), ' +
        'properties(address, city, apartment_detail, building_letter)',
    )
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .single()

  if (error || !dossierRaw) {
    throw new Error(`Dossier ${dossierId} introuvable ou accès refusé`)
  }
  const dossier = dossierRaw as unknown as DossierJoinedRow

  // Missions du dossier
  const { data: missions } = await admin
    .from('missions')
    .select('id, type')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)

  const missionIds = (missions ?? []).map((m) => m.id)
  const hasAmiante = (missions ?? []).some((m) => m.type.startsWith('amiante_'))

  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients
  const property = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties

  return {
    dossier: {
      id: dossier.id,
      reference: dossier.reference,
      organization_id: dossier.organization_id,
      has_amiante: hasAmiante,
    },
    missionIds,
    client: client
      ? { display_name: client.display_name ?? null, email: client.email ?? null }
      : null,
    property: property
      ? {
          address: property.address ?? null,
          city: property.city ?? null,
          apartment_detail: property.apartment_detail ?? null,
          building_letter: property.building_letter ?? null,
        }
      : null,
  }
}

/**
 * Cast helper pour table `dossier_exports` pas encore présente dans les types
 * Database générés (cf. migration 20260521150000_dossier_refonte.sql).
 *
 * Une fois `pnpm db:gen-types` ré-exécuté, ce helper pourra disparaître.
 */
export interface DossierExportInsert {
  organization_id: string
  dossier_id: string
  destination: 'liciel_zip' | 'pdf_reports' | 'client_email' | 'archive' | 'raw_json_csv'
  was_complete: boolean
  missing_fields_count: number
  missing_fields_snapshot?: unknown
  recipient?: string | null
  storage_path?: string | null
  download_token?: string | null
  expires_at?: string | null
  created_by?: string | null
}

/**
 * Insère un row dans `dossier_exports`. Defensive : log + return false si la
 * table n'existe pas encore (cas où l'agent A n'a pas appliqué la migration).
 */
export async function recordDossierExport(
  payload: DossierExportInsert,
): Promise<{ ok: boolean; id: string | null }> {
  const admin = getAdminClient()
  // Cast `as never` : la table existe en DB mais les types générés ne la connaissent
  // pas encore — on passe par un cast contrôlé plutôt qu'un `any` global.
  // Le payload est typé via `DossierExportInsert` côté appelant — on caste juste
  // pour contourner la signature `never[]` du chaîné `from('...' as never)`.
  const table = admin.from('dossier_exports' as never) as unknown as {
    insert: (p: DossierExportInsert) => {
      select: (s: string) => {
        single: () => Promise<{
          data: { id: string } | null
          error: { message: string; code?: string } | null
        }>
      }
    }
  }
  const { data, error } = await table.insert(payload).select('id').single()

  if (error) {
    console.warn('[dossier-export:record]', error.message)
    return { ok: false, id: null }
  }
  return { ok: true, id: data?.id ?? null }
}
