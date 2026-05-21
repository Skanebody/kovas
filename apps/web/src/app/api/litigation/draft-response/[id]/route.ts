/**
 * KOVAS — POST /api/litigation/draft-response/:id
 *
 * Génère un brouillon de réponse au litige via Claude Haiku, sur la base
 * du contenu du `litigation_workflows` et du `defense_dossiers` associé.
 *
 * Cite des références jurisprudentielles via une short-list locale (V1).
 * Le résultat est stocké dans `litigation_workflows.draft_response_md`.
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

interface LitigationRow {
  id: string
  organization_id: string
  mission_id: string | null
  dossier_id: string | null
  defense_dossier_id: string | null
  litigation_type: string
  client_complaint: string
  status: string
  draft_response_md: string | null
  cited_references: string[] | null
}

const SYSTEM_PROMPT = `Tu es un juriste senior spécialisé en diagnostic immobilier français.
Tu produis un projet de réponse circonstanciée à un litige client portant sur un diagnostic.

CONTRAINTES :
- Ton professionnel sobre, sans agressivité.
- Cite systématiquement les articles applicables (CCH L271-4 à L271-6, R134-4-2, etc.)
- Fais référence à la jurisprudence pertinente quand utile (CJUE SAS Institute c/ WPL si format ; Cass. 3e civ. 2019 si DPE erroné ; etc.)
- Structure le brouillon : 1) Rappel des faits  2) Analyse juridique  3) Position du diagnostiqueur  4) Réponse proposée
- Format markdown.
- Maximum 600 mots.
- Pas de promesse de remboursement automatique — laisser l'arbitrage au diagnostiqueur.`

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { orgId, supabase } = await getCurrentUser()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured', stub: true },
      { status: 503 },
    )
  }

  // 1. Charge le litige
  const { data: litigationRaw, error } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
    .from('litigation_workflows' as any)
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error || !litigationRaw) {
    return NextResponse.json({ error: 'Litigation not found' }, { status: 404 })
  }

  const litigation = litigationRaw as unknown as LitigationRow

  // 2. Appel Claude Haiku
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model = process.env.ANTHROPIC_MODEL_VOICE ?? 'claude-haiku-4-5'

  const userPrompt = [
    `Type de litige : ${litigation.litigation_type}`,
    '',
    'Plainte client :',
    litigation.client_complaint,
    '',
    'Rédige le projet de réponse en markdown selon les contraintes du système.',
  ].join('\n')

  const startedAt = Date.now()
  let draftMarkdown = ''
  let citedReferences: string[] = []

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const block = response.content[0]
    if (block && block.type === 'text') {
      draftMarkdown = block.text
    }

    // Extraction naïve des références (articles, jurisprudence) citées
    citedReferences = extractReferences(draftMarkdown)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Claude API call failed',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    )
  }

  // 3. Persiste dans la table
  const { error: updateError } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
    .from('litigation_workflows' as any)
    .update({
      draft_response_md: draftMarkdown,
      cited_references: citedReferences,
      draft_generated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', orgId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to persist draft', detail: updateError.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    draftMarkdown,
    citedReferences,
    latencyMs: Date.now() - startedAt,
  })
}

function extractReferences(markdown: string): string[] {
  const patterns = [
    /CCH\s*L\.?\s*\d+-\d+/gi,
    /(?:Cass\.|Cour\s+de\s+cassation)[^.,;\n]{0,80}/gi,
    /CJUE[^.,;\n]{0,80}/gi,
    /Conseil\s+d'État[^.,;\n]{0,80}/gi,
    /R\.\s*\d+-\d+-\d+/gi,
  ]
  const found = new Set<string>()
  for (const pattern of patterns) {
    const matches = markdown.match(pattern)
    if (matches) {
      for (const m of matches) found.add(m.trim())
    }
  }
  return Array.from(found).slice(0, 10)
}
