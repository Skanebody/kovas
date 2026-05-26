/**
 * /api/observatoire/generate-monthly-pdf — endpoint POST appelé par
 * l'Edge Function `observatoire-monthly-report` pour générer le PDF mensuel
 * et le stocker dans Supabase Storage (bucket `observatoire-reports` public).
 *
 * Auth : Bearer token partagé (env `OBSERVATOIRE_PDF_TOKEN`).
 * Body : { reportId: string, periodLabel: string }
 * Response : { url: string, sizeBytes: number }
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { generateObservatoireReportPdf } from '@/lib/observatoire/pdf-generator'
import { getObservatoireStats, getTopCities } from '@/lib/observatoire/stats-aggregator'
import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET_NAME = 'observatoire-reports'

interface GeneratePdfBody {
  reportId: string
  periodLabel: string
}

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.OBSERVATOIRE_PDF_TOKEN
  if (!token) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${token}`
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: GeneratePdfBody
  try {
    body = (await req.json()) as GeneratePdfBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.reportId || !body.periodLabel) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  try {
    const [stats, topCitiesResult] = await Promise.all([getObservatoireStats(), getTopCities()])

    const pdfBytes = generateObservatoireReportPdf({
      stats,
      topCities: topCitiesResult.cities,
    })
    const slug = body.periodLabel.toLowerCase().replace(/\s+/g, '-')
    const filename = `rapport-${slug}.pdf`

    // Upload vers Supabase Storage (bucket public)
    const supabase = createAdminClient()
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('observatoire pdf upload error:', uploadErr.message)
      return NextResponse.json({ error: `upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filename)

    return NextResponse.json({
      url: publicData.publicUrl,
      sizeBytes: pdfBytes.byteLength,
    })
  } catch (err) {
    console.error('observatoire generate-monthly-pdf error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
