/**
 * GET /api/pricing/templates
 *
 * Retourne les 3 templates pré-remplis (économique / médian / premium).
 * Données statiques — pas d'auth requise (public-friendly), mais on protège
 * via getCurrentUser pour conserver la cohérence + télémétrie future.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { ALL_TEMPLATES } from '@/lib/pricing/pricing-templates'
import { NextResponse } from 'next/server'

export async function GET() {
  await getCurrentUser()
  return NextResponse.json(
    { templates: ALL_TEMPLATES },
    { headers: { 'Cache-Control': 'private, max-age=3600' } },
  )
}
