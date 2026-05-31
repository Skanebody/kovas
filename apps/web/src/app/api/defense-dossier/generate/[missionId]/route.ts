/**
 * KOVAS — Proxy de génération du PDF "Dossier de défense".
 *
 * POST /api/defense-dossier/generate/[missionId]
 *
 * Délègue à l'Edge Function `defense-dossier-generate` (Deno + pdf-lib).
 * L'Edge Function attend un Bearer = access_token utilisateur : elle résout
 * l'utilisateur (auth.getUser) puis vérifie l'appartenance à l'organisation
 * de la mission (assertMember). On relaie donc le token de session courant,
 * pattern aligné sur /api/litigation/create.
 *
 * Réponse Edge : { ok: true, pdf_url, defense_dossier_id, sha256, ... }
 * → on la remappe en { pdfUrl } attendu par DefenseGenerateButton.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

interface EdgeResponse {
  ok?: boolean
  pdf_url?: string | null
  defense_dossier_id?: string
  sha256?: string
  error?: string
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<NextResponse> {
  const { missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }

  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let edgeRes: Response
  try {
    edgeRes = await fetch(`${supabaseUrl}/functions/v1/defense-dossier-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ missionId }),
    })
  } catch {
    return NextResponse.json({ error: 'edge_unreachable' }, { status: 502 })
  }

  const edgeData = (await edgeRes.json().catch(() => ({}))) as EdgeResponse

  if (!edgeRes.ok || !edgeData.ok) {
    return NextResponse.json(
      { error: edgeData.error ?? 'generation_failed' },
      { status: edgeRes.status || 502 },
    )
  }

  return NextResponse.json({
    pdfUrl: edgeData.pdf_url ?? null,
    defenseDossierId: edgeData.defense_dossier_id ?? null,
    sha256: edgeData.sha256 ?? null,
  })
}
