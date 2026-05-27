import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/launch-offer/status
 *
 * Retourne l'état de l'offre de lancement KOVAS :
 *   - 30 places à -30% pendant 12 mois sur engagement annuel
 *
 * Source : vue Supabase `launch_offer_status` (créée par migration côté backend
 * dans la même vague). Si la vue n'existe pas encore (déploiement en cours),
 * fallback gracieux à 30 places disponibles.
 *
 * Cache Next.js : 30 secondes (suffisant, peu de churn attendu côté backoffice).
 */
export const revalidate = 30
export const dynamic = 'force-dynamic'

export interface LaunchOfferStatus {
  positionsTaken: number
  positionsRemaining: number
  isAvailable: boolean
  totalSlots: number
}

const TOTAL_SLOTS = 30

export async function GET(): Promise<NextResponse<LaunchOfferStatus>> {
  try {
    const supabase = await createClient()

    // Note: launch_offer_status est une vue SQL. On essaie de la lire ;
    // si elle n'existe pas (404 / 42P01), on retombe sur la valeur par défaut.
    // Cast : la vue n'est pas encore dans le type `Database` généré (migration
    // backend en cours dans une autre vague).
    const fromUntyped = supabase.from as unknown as (table: string) => {
      select: (cols: string) => {
        maybeSingle: () => Promise<{
          data: { positions_taken?: number | null; positions_remaining?: number | null } | null
          error: { message: string } | null
        }>
      }
    }

    const { data, error } = await fromUntyped('launch_offer_status')
      .select('positions_taken, positions_remaining')
      .maybeSingle()

    if (error !== null || data === null) {
      return NextResponse.json({
        positionsTaken: 0,
        positionsRemaining: TOTAL_SLOTS,
        isAvailable: true,
        totalSlots: TOTAL_SLOTS,
      })
    }

    const positionsTaken = Number(data.positions_taken ?? 0)
    const positionsRemaining = Number(
      data.positions_remaining ?? Math.max(0, TOTAL_SLOTS - positionsTaken),
    )

    return NextResponse.json({
      positionsTaken,
      positionsRemaining,
      isAvailable: positionsRemaining > 0,
      totalSlots: TOTAL_SLOTS,
    })
  } catch {
    // Fallback : vue absente ou souci de connexion → on ne casse jamais le rendu.
    return NextResponse.json({
      positionsTaken: 0,
      positionsRemaining: TOTAL_SLOTS,
      isAvailable: true,
      totalSlots: TOTAL_SLOTS,
    })
  }
}
