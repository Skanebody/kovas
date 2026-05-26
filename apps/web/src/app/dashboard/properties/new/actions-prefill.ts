'use server'

/**
 * KOVAS — Server action `lookupBuildingAction` pour le pré-remplissage
 * automatique des champs propriété depuis le Référentiel National des
 * Bâtiments (RNB) + Base de Données Nationale des Bâtiments (BDNB, CSTB).
 *
 * Appelée depuis `property-form.tsx` au moment où l'utilisateur sélectionne
 * une adresse dans l'autocomplete BAN. Si RNB trouve un bâtiment et que la
 * confiance ≥ 0.8, on pré-remplit `year_built`, `surface_total`,
 * `property_type` (l'utilisateur reste maître et peut écraser).
 *
 * Source : open data officiel État (Etalab 2.0 + ODbL). AUCUNE mention IA
 * dans la copie utilisateur — c'est officiel, pas algorithmique.
 *
 * Authority : docs/data-gouv-opportunities.md (Top 5 #1, valeur 10/10).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type BanAddressInput,
  type PrefillResult,
  getBuildingPrefill,
} from '@/lib/data-gouv/rnb-bdnb'
import { z } from 'zod'

const banAddressSchema = z.object({
  longitude: z.number().finite().min(-180).max(180),
  latitude: z.number().finite().min(-90).max(90),
  label: z.string().trim().min(1).max(300).optional(),
  insee: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'INSEE must be 5 digits')
    .optional(),
})

type LookupBuildingResult =
  | { ok: true; prefill: PrefillResult | null }
  | { ok: false; error: string }

/**
 * Lookup d'un bâtiment via RNB + BDNB depuis une adresse BAN.
 *
 * Retourne `{ ok: true, prefill: null }` si aucun bâtiment trouvé (cas
 * fréquent en zone rurale ou neuf < 1 an) — le formulaire fonctionne
 * normalement en saisie manuelle.
 *
 * Retourne `{ ok: false, error }` uniquement en cas de validation Zod
 * ou de panne réseau réelle (l'orchestrateur `getBuildingPrefill` fait
 * sa propre dégradation gracieuse avec `null` côté success).
 */
export async function lookupBuildingAction(
  banAddress: BanAddressInput,
): Promise<LookupBuildingResult> {
  // Auth requise — l'API publique RNB est ouverte mais on ne veut pas
  // exposer un endpoint server action sans authentification.
  await getCurrentUser()

  const parsed = banAddressSchema.safeParse(banAddress)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Adresse invalide' }
  }

  try {
    const prefill = await getBuildingPrefill(parsed.data)
    return { ok: true, prefill }
  } catch (err) {
    // L'orchestrateur ne devrait jamais throw (il return null en cas de
    // panne réseau), mais on garde un filet pour les exceptions inattendues.
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Lookup RNB indisponible',
    }
  }
}
