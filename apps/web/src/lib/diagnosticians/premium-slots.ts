/**
 * Slots premium par ville (Phase 2 — V1.5).
 * Cf. docs/phase2-premium-city-slots.md.
 *
 * Activation prévue M9-M12 (annuaire mature). En V1, table existe mais
 * `enabled=false` partout. Les helpers retournent toujours `[]` jusqu'à
 * activation explicite par l'admin.
 *
 * Inspiration Google Ads serruriers : top 3 slots TOP par ville =
 * 80% des clics. Modèle 89€/mo HT par slot.
 */

import { asUntyped, type SupabaseUntyped } from './supabase-untyped'

export interface PremiumSlot {
  id: string
  citySlug: string
  departmentCode: string
  maxSlots: number
  currentSlotPriceEurMonthly: number
  enabled: boolean
}

export interface PremiumBooking {
  id: string
  diagnosticianId: string
  slotId: string
  position: 1 | 2 | 3
  activeFrom: string
  activeUntil: string | null
  monthlyPricePaidEur: number
}

/**
 * Liste les bookings premium actifs pour une ville donnée.
 * Retourne [] en V1 (slots inactifs).
 */
export async function getActivePremiumBookingsForCity(
  supabase: SupabaseUntyped | unknown,
  citySlug: string,
  departmentCode: string,
): Promise<PremiumBooking[]> {
  const sb = asUntyped(supabase)
  // En V1, on lit la table mais le filtre `enabled=true` ramène []
  const { data } = await sb
    .from('diagnostician_premium_bookings')
    .select(
      'id, diagnostician_id, slot_id, position, active_from, active_until, monthly_price_paid_eur, ' +
        'city_premium_slots!inner(city_slug, department_code, enabled)',
    )
    .eq('city_premium_slots.city_slug', citySlug)
    .eq('city_premium_slots.department_code', departmentCode)
    .eq('city_premium_slots.enabled', true)
    .or('active_until.is.null,active_until.gt.now()')
    .order('position', { ascending: true })

  if (!data || data.length === 0) return []

  type Row = {
    id: string
    diagnostician_id: string
    slot_id: string
    position: number
    active_from: string
    active_until: string | null
    monthly_price_paid_eur: number
  }

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    diagnosticianId: row.diagnostician_id,
    slotId: row.slot_id,
    position: row.position as 1 | 2 | 3,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
    monthlyPricePaidEur: row.monthly_price_paid_eur,
  }))
}

/**
 * Vérifie si les slots premium sont activés pour une ville donnée.
 * Retourne false en V1 partout.
 */
export async function isPremiumSlotsEnabled(
  supabase: SupabaseUntyped | unknown,
  citySlug: string,
  departmentCode: string,
): Promise<boolean> {
  const sb = asUntyped(supabase)
  const { data } = await sb
    .from('city_premium_slots')
    .select('enabled')
    .eq('city_slug', citySlug)
    .eq('department_code', departmentCode)
    .maybeSingle<{ enabled: boolean }>()

  return data?.enabled === true
}

/**
 * Liste les IDs de diag premium pour une ville (utilisé pour tri annuaire).
 * Retourne Set vide en V1.
 */
export async function getPremiumDiagnosticianIdsForCity(
  supabase: SupabaseUntyped | unknown,
  citySlug: string,
  departmentCode: string,
): Promise<Set<string>> {
  const bookings = await getActivePremiumBookingsForCity(
    asUntyped(supabase),
    citySlug,
    departmentCode,
  )
  return new Set(bookings.map((b) => b.diagnosticianId))
}
