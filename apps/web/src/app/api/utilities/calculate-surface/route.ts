/**
 * KOVAS — POST /api/utilities/calculate-surface
 *
 * Calcule la surface de chaque pièce + total. Le calcul est aussi exécuté
 * côté client (live), cette route reste utile pour audit usage + validation
 * côté serveur des nombres rentrés.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type PieceEntry,
  type PieceFormType,
  calculateSurface,
  calculateTotal,
} from '@/lib/utilities/surface-calculator'
import { trackUtilityUsage } from '@/lib/utilities/usage-tracker'

export const runtime = 'nodejs'

interface ErrorBody {
  error: string
}

interface SurfaceResponse {
  total: number
  perPiece: { id: string; name: string; surface: number }[]
}

const ALLOWED_FORMS: readonly PieceFormType[] = [
  'rectangle',
  'l_shape',
  't_shape',
  'trapeze',
  'triangle',
  'cercle',
  'demi_cercle',
]

function parsePieces(body: unknown): PieceEntry[] | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object'
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.pieces)) return 'pieces: array required'

  const out: PieceEntry[] = []
  for (const [i, raw] of b.pieces.entries()) {
    if (!raw || typeof raw !== 'object') return `pieces[${i}] must be an object`
    const p = raw as Record<string, unknown>
    if (typeof p.id !== 'string' || p.id.length === 0) return `pieces[${i}].id required`
    if (typeof p.name !== 'string') return `pieces[${i}].name required`
    if (typeof p.formType !== 'string' || !ALLOWED_FORMS.includes(p.formType as PieceFormType)) {
      return `pieces[${i}].formType must be one of ${ALLOWED_FORMS.join('|')}`
    }
    if (!Array.isArray(p.values) || !p.values.every((v) => typeof v === 'number')) {
      return `pieces[${i}].values must be an array of numbers`
    }
    const formType = p.formType as PieceFormType
    const values = p.values as number[]
    const surface = calculateSurface({ formType, values })
    out.push({
      id: p.id,
      name: p.name,
      formType,
      dimensions: { formType, values },
      surface,
      notes: typeof p.notes === 'string' ? p.notes : undefined,
    })
  }
  return out
}

export async function POST(request: Request): Promise<NextResponse<SurfaceResponse | ErrorBody>> {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const pieces = parsePieces(bodyJson)
  if (typeof pieces === 'string') {
    return NextResponse.json({ error: pieces }, { status: 400 })
  }

  const response: SurfaceResponse = {
    total: calculateTotal(pieces),
    perPiece: pieces.map((p) => ({ id: p.id, name: p.name, surface: p.surface })),
  }

  trackUtilityUsage({
    supabase: user.supabase,
    userId: user.user.id,
    organizationId: user.orgId,
    utility: 'surface_calculator',
    context: { pieceCount: pieces.length, total: response.total },
  })

  return NextResponse.json(response)
}
