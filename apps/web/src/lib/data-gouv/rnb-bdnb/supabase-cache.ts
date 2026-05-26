/**
 * Implémentation Supabase de `BdnbCacheStore` — table `public.rnb_cache`.
 *
 * Lecture publique (RLS open), écriture via service_role uniquement (l'API
 * publique RNB/BDNB est open data → toute la cache est partageable).
 *
 * À utiliser exclusivement côté server (cookies/env service role).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import type { BdnbCacheStore } from './bdnb-client'
import type { RnbCacheRow } from './rnb-client'
import type { BdnbEnrichment, RnbBuilding } from './types'

interface RawRow {
  rnb_id: string
  raw_data: RnbBuilding
  bdnb_enrichment: BdnbEnrichment | null
  fetched_at: string
  bdnb_fetched_at: string | null
}

/**
 * Crée le store cache RNB/BDNB depuis un client Supabase service_role.
 *
 * Le store réutilise un client passé en argument plutôt que de l'instancier
 * lui-même, pour rester testable (on peut passer un mock Supabase) et pour
 * permettre de partager le client avec d'autres caches.
 */
export function createSupabaseRnbCache(client: SupabaseClient): BdnbCacheStore {
  return {
    async getByRnbId(rnbId: string): Promise<RnbCacheRow | null> {
      const { data, error } = await client
        .from('rnb_cache')
        .select('rnb_id, raw_data, bdnb_enrichment, fetched_at, bdnb_fetched_at')
        .eq('rnb_id', rnbId)
        .maybeSingle<RawRow>()

      if (error || !data) return null
      return mapRow(data)
    },

    async getByPoint(lng: number, lat: number, radiusMeters: number): Promise<RnbCacheRow | null> {
      // ST_DWithin via RPC : on s'appuie sur l'index GIST déclaré dans la migration.
      // PostgREST n'expose pas directement ST_DWithin → on passe par une RPC dédiée.
      // En l'absence de RPC, on retourne null : la couche client retombe sur l'appel API.
      // (La RPC peut être ajoutée plus tard via une migration séparée si on observe
      //  des taux de cache miss anormaux. Pour V1 le lookup par RNB ID couvre 99 % des cas
      //  une fois le bâtiment connu via la BAN.)
      void lng
      void lat
      void radiusMeters
      return null
    },

    async upsert(row): Promise<void> {
      const { error } = await client.from('rnb_cache').upsert(
        {
          rnb_id: row.rnb_id,
          // PostGIS accepte EWKT string sur insert ; l'API REST PostgREST traite la valeur.
          point: `SRID=4326;POINT(${row.lng} ${row.lat})`,
          raw_data: row.raw_data,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'rnb_id' },
      )
      if (error) {
        throw new Error(`rnb_cache upsert failed: ${error.message}`)
      }
    },

    async setBdnbEnrichment(rnbId: string, enrichment: BdnbEnrichment): Promise<void> {
      const { error } = await client
        .from('rnb_cache')
        .update({
          bdnb_enrichment: enrichment,
          bdnb_fetched_at: new Date().toISOString(),
        })
        .eq('rnb_id', rnbId)
      if (error) {
        throw new Error(`rnb_cache bdnb update failed: ${error.message}`)
      }
    },
  }
}

/**
 * Helper : crée un store cache à partir des variables d'environnement
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * À n'utiliser que côté server. Préférer `createSupabaseRnbCache(client)` quand
 * un client Supabase est déjà disponible.
 */
export function createSupabaseRnbCacheFromEnv(): BdnbCacheStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return createSupabaseRnbCache(admin)
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function mapRow(row: RawRow): RnbCacheRow {
  return {
    rnb_id: row.rnb_id,
    raw_data: row.raw_data,
    bdnb_enrichment: row.bdnb_enrichment,
    fetched_at: row.fetched_at,
    bdnb_fetched_at: row.bdnb_fetched_at,
  }
}
