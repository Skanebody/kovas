import { getCurrentUser } from '@/lib/auth/current-user'
import { analyzeScan } from '@/lib/diagnostic-validity/claude-vision-analyzer'
import {
  type DiagnosticType,
  type Usage,
  calculateExpiration,
} from '@/lib/diagnostic-validity/expiration-calculator'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/diagnostics/upload-scan
 *
 * FormData :
 *   - file : PDF ou image (max 20 Mo)
 *   - usage (optionnel) : 'vente' | 'location' (défaut 'vente')
 *
 * Flux :
 *   1. Authentification + org via getCurrentUser
 *   2. Upload Storage (bucket diagnostic-scans, chemin <org>/<scanId>.<ext>)
 *   3. Insert ligne diagnostic_scans (status pending)
 *   4. Analyse Claude Vision → mise à jour avec champs détectés + status analyzed
 *   5. Retour JSON avec données extraites + suggestion client/bien
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

function normalizeUsage(raw: string | null): Usage {
  if (raw === 'location') return 'location'
  if (raw === 'vente') return 'vente'
  return 'vente'
}

interface MatchSuggestion {
  client_id: string | null
  property_id: string | null
  reason: string | null
}

function normalizeText(s: string | null): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Recherche basique d'un client et d'un bien existants à partir de
 * l'adresse + nom propriétaire extraits.
 * Heuristique simple : matching token-based (à raffiner V1.5).
 */
async function suggestMatch(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase'],
  orgId: string,
  adresse: string | null,
  proprietaire: string | null,
): Promise<MatchSuggestion> {
  let property_id: string | null = null
  let client_id: string | null = null
  let reason: string | null = null

  if (adresse) {
    const addrTokens = normalizeText(adresse)
      .split(' ')
      .filter((t) => t.length > 2)
    if (addrTokens.length > 0) {
      const { data: props } = await supabase
        .from('properties')
        .select('id, client_id, address, city, postal_code')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .limit(100)

      if (props) {
        let bestScore = 0
        let bestId: string | null = null
        let bestClient: string | null = null
        for (const p of props) {
          const candidate = normalizeText(
            [p.address, p.postal_code, p.city].filter(Boolean).join(' '),
          )
          const score = addrTokens.reduce((acc, t) => acc + (candidate.includes(t) ? 1 : 0), 0)
          if (score > bestScore) {
            bestScore = score
            bestId = p.id
            bestClient = p.client_id
          }
        }
        // Seuil minimal : au moins 3 tokens matchent
        if (bestScore >= 3) {
          property_id = bestId
          client_id = bestClient
          reason = `Adresse correspondante (${bestScore} jetons)`
        }
      }
    }
  }

  if (!client_id && proprietaire) {
    const nameTokens = normalizeText(proprietaire)
      .split(' ')
      .filter((t) => t.length > 2)
    if (nameTokens.length > 0) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, display_name, first_name, last_name, company_name')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .limit(100)

      if (clients) {
        let bestScore = 0
        let bestId: string | null = null
        for (const c of clients) {
          const candidate = normalizeText(
            [c.display_name, c.first_name, c.last_name, c.company_name].filter(Boolean).join(' '),
          )
          const score = nameTokens.reduce((acc, t) => acc + (candidate.includes(t) ? 1 : 0), 0)
          if (score > bestScore) {
            bestScore = score
            bestId = c.id
          }
        }
        if (bestScore >= 2) {
          client_id = bestId
          reason = reason ? `${reason} + nom propriétaire` : 'Nom propriétaire correspondant'
        }
      }
    }
  }

  return { client_id, property_id, reason }
}

export async function POST(request: Request) {
  let userId: string
  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const usage = normalizeUsage(formData.get('usage') as string | null)

  if (!file) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 413 })
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: 'Type de fichier non autorisé (PDF, JPEG, PNG, WebP, HEIC)' },
      { status: 415 },
    )
  }

  // Service-role pour Storage (bucket privé, écriture serveur uniquement)
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Upload Storage
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5)
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const storagePath = `${orgId}/${filename}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage
    .from('diagnostic-scans')
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) {
    return NextResponse.json({ error: `Upload Storage : ${uploadError.message}` }, { status: 500 })
  }

  // 2. Insert ligne diagnostic_scans
  const { data: scan, error: insertError } = await supabase
    .from('diagnostic_scans')
    .insert({
      organization_id: orgId,
      file_storage_path: storagePath,
      original_name: file.name.slice(0, 200),
      size_bytes: file.size,
      mime_type: file.type,
      usage_context: usage,
      status: 'analyzing',
      uploaded_by: userId,
    })
    .select('id')
    .single()

  if (insertError || !scan) {
    await admin.storage.from('diagnostic-scans').remove([storagePath])
    return NextResponse.json(
      { error: insertError?.message ?? 'Insertion échouée' },
      { status: 500 },
    )
  }

  const scanId = scan.id

  // 3. Analyse Claude Vision (si configurée)
  if (!process.env.ANTHROPIC_API_KEY) {
    await supabase
      .from('diagnostic_scans')
      .update({ status: 'pending' })
      .eq('id', scanId)
      .eq('organization_id', orgId)
    return NextResponse.json(
      {
        ok: true,
        scanId,
        stub: true,
        warning: 'ANTHROPIC_API_KEY non configurée — analyse IA désactivée',
      },
      { status: 200 },
    )
  }

  try {
    const result = await analyzeScan(buffer, file.type)
    const { data } = result

    // 4. Calcul expiration côté serveur (logique déterministe)
    let date_expiration: string | null = null
    if (data.diagnostic_type && data.date_emission) {
      const exp = calculateExpiration({
        type: data.diagnostic_type as DiagnosticType,
        dateEmission: data.date_emission,
        usage,
        resultPositive: data.result_positive ?? undefined,
      })
      date_expiration = exp.dateExpiration
    }

    // 5. Suggestion client / bien
    const match = await suggestMatch(supabase, orgId, data.adresse, data.proprietaire)

    await supabase
      .from('diagnostic_scans')
      .update({
        diagnostic_type: data.diagnostic_type,
        date_emission: data.date_emission,
        date_expiration,
        adresse: data.adresse,
        proprietaire: data.proprietaire,
        ademe_number: data.ademe_number,
        energy_class: data.energy_class,
        result_positive: data.result_positive,
        extracted_data: data as never,
        ai_confidence: data.confidence,
        ai_cost_eur: result.costEur,
        ai_latency_ms: result.latencyMs,
        client_id: match.client_id,
        property_id: match.property_id,
        status: 'analyzed',
      })
      .eq('id', scanId)
      .eq('organization_id', orgId)

    // Track usage IA
    await supabase.from('ai_usage').insert({
      organization_id: orgId,
      user_id: userId,
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL_VISION ?? 'claude-sonnet-4-6',
      operation: 'scan_diagnostic_validity',
      input_tokens: 0,
      output_tokens: 0,
      cost_eur: result.costEur,
      latency_ms: result.latencyMs,
    })

    return NextResponse.json({
      ok: true,
      scanId,
      analysis: {
        ...data,
        date_expiration,
      },
      suggestion: match,
      costEur: result.costEur,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analyse IA échouée'
    await supabase
      .from('diagnostic_scans')
      .update({ status: 'failed', extracted_data: { error: message } as never })
      .eq('id', scanId)
      .eq('organization_id', orgId)
    return NextResponse.json({ error: message, scanId }, { status: 500 })
  }
}
