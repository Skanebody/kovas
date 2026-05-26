import { getCurrentUser } from '@/lib/auth/current-user'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const ANNEXES_BUCKET = 'mission-annexes'

interface AnnexeRow {
  id: string
  storage_path: string
}

/**
 * Télécharge la dernière annexe "Aides Rénovation" générée pour un dossier.
 * Réponse : binary stream (Content-Disposition attachment).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: dossierId } = await ctx.params

  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Vérifie membership : si pas de ligne dossier visible, 404.
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, reference')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .single()

  if (!dossier) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // La table dossier_export_annexes n'est pas (encore) dans les types DB générés.
  const { data: rawAnnex } = await supabase
    .from('dossier_export_annexes' as never)
    .select('id, storage_path')
    .eq('dossier_id', dossierId)
    .eq('annexe_type', 'aides_renovation')
    .order('generated_at', { ascending: false })
    .limit(1)

  const annexes = (rawAnnex ?? []) as unknown as AnnexeRow[]
  const annexe = annexes[0]
  if (!annexe) {
    return NextResponse.json({ error: 'annexe_not_generated' }, { status: 404 })
  }

  // Download via service_role (le bucket est privé).
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: blob, error } = await admin.storage
    .from(ANNEXES_BUCKET)
    .download(annexe.storage_path)

  if (error || !blob) {
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 502 })
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const filename = `KOVAS_aides_renovation_${dossier.reference}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
