import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { extractDocument, normalizeDocKind } from '@/lib/document-extractor'

/**
 * Lance l'extraction IA Claude Vision sur un document propriétaire.
 * Auth + permission via getCurrentUser → RLS sur l'org.
 * Stocke le résultat dans owner_documents.extracted_data + tracking ai_usage.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params

  let user: Awaited<ReturnType<typeof getCurrentUser>>['user']
  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    user = u.user
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured', stub: true }, { status: 503 })
  }

  // Récupère le document + verify org
  const { data: doc, error: docErr } = await supabase
    .from('owner_documents')
    .select('id, storage_path, mime_type, doc_kind, dossier_id, organization_id, extraction_status')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 })
  }
  if (doc.extraction_status === 'processing') {
    return NextResponse.json({ error: 'extraction déjà en cours' }, { status: 409 })
  }
  if (!doc.mime_type) {
    return NextResponse.json({ error: 'mime_type manquant' }, { status: 400 })
  }

  // Marque processing pour éviter double-trigger
  await supabase
    .from('owner_documents')
    .update({ extraction_status: 'processing' })
    .eq('id', documentId)
    .eq('organization_id', orgId)

  try {
    // Download du Storage via service_role
    const { data: blob, error: dlErr } = await supabase.storage
      .from('owner-uploads')
      .download(doc.storage_path)

    if (dlErr || !blob) throw new Error(`Storage download : ${dlErr?.message ?? 'no blob'}`)

    const fileBytes = Buffer.from(await blob.arrayBuffer())
    const docKind = normalizeDocKind(doc.doc_kind)

    const result = await extractDocument(fileBytes, doc.mime_type, docKind)

    // Persist extraction result
    await supabase
      .from('owner_documents')
      .update({
        extracted_data: result.data as never,
        extraction_status: 'extracted',
        extracted_at: new Date().toISOString(),
        extraction_cost_eur: result.costEur,
        extraction_error: null,
      })
      .eq('id', documentId)
      .eq('organization_id', orgId)

    // Track usage
    await supabase.from('ai_usage').insert({
      organization_id: orgId,
      user_id: user.id,
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL_VISION ?? 'claude-sonnet-4-6',
      operation: 'extract_owner_document',
      input_tokens: 0,
      output_tokens: 0,
      cost_eur: result.costEur,
      latency_ms: result.latencyMs,
    })

    return NextResponse.json({
      ok: true,
      extracted: result.data,
      costEur: result.costEur,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'extraction failed'
    await supabase
      .from('owner_documents')
      .update({
        extraction_status: 'failed',
        extraction_error: message,
      })
      .eq('id', documentId)
      .eq('organization_id', orgId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
