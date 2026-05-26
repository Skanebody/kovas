'use server'

/**
 * KOVAS — Server action `verifyClientSiretAction` pour la vérification SIRET
 * d'un client professionnel via l'API publique Recherche Entreprises (data.gouv).
 *
 * Appelée depuis `client-form-fields.tsx` quand l'utilisateur quitte le champ
 * SIRET (14 chiffres saisis). Si trouvé + actif, on suggère le `companyName`
 * remonté par SIRENE (`nom_complet`) — l'utilisateur reste maître et peut
 * accepter ou écraser.
 *
 * Différence avec le signup diagnostiqueur : ici, on n'exige PAS un NAF
 * diagnostic (l'agence, le notaire, le syndic ont des NAF différents). On
 * retourne simplement la fiche entreprise pour aider la saisie.
 *
 * Source : api.gouv.fr/recherche-entreprises (open data, Etalab 2.0).
 *
 * Authority : docs/data-gouv-opportunities.md (Top 5 #3, valeur 9/10).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyDiagnosticActivityCached } from '@/lib/data-gouv/recherche-entreprises'
import { z } from 'zod'

const siretSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{14}$/, 'SIRET = 14 chiffres'))

export type ClientSiretLookupResult =
  | {
      ok: true
      found: boolean
      isActive: boolean
      companyName: string | null
      nafCode: string | null
      nafLabel: string | null
      legalForm: string | null
    }
  | { ok: false; error: string }

/**
 * Vérifie un SIRET pour pré-remplir / valider un client professionnel.
 *
 * - `ok=false` si validation Zod ou panne réseau persistante
 * - `ok=true, found=false` si SIRET inconnu au registre SIRENE
 * - `ok=true, found=true, isActive=false` si établissement fermé
 * - `ok=true, found=true, isActive=true` cas nominal
 */
export async function verifyClientSiretAction(siret: string): Promise<ClientSiretLookupResult> {
  // Auth requise — éviter d'exposer l'endpoint sans authentification.
  const { supabase } = await getCurrentUser()

  const parsed = siretSchema.safeParse(siret)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'SIRET invalide' }
  }

  try {
    const result = await verifyDiagnosticActivityCached(supabase, parsed.data)

    if (result.error === 'network' || result.error === 'rate_limit') {
      return { ok: false, error: 'Vérification SIRENE momentanément indisponible' }
    }

    return {
      ok: true,
      found: result.found,
      isActive: result.isActive,
      companyName: result.companyName,
      nafCode: result.nafCode,
      nafLabel: result.nafLabel,
      legalForm: result.legalForm,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur vérification SIRENE',
    }
  }
}
