/**
 * KOVAS — POST /api/litigation/draft-response/:id
 *
 * Génère un brouillon de réponse au litige via Claude Haiku, sur la base
 * du `litigation_workflows` associé.
 *
 * Cite des références jurisprudentielles via une short-list locale (V1).
 *
 * Persistance : il N'EXISTE PAS de colonnes dédiées dans `litigation_workflows`.
 * Le résultat IA est stocké dans `metadata.draft` (merge non destructif) :
 *   metadata.draft = { response_md, cited_references, generated_at }
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Json } from '@kovas/database/types'
import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** Sous-ensemble des colonnes `litigation_workflows` lues ici. */
interface LitigationWorkflowRow {
  id: string
  organization_id: string
  litigation_kind: string
  notes: string | null
  metadata: { [key: string]: Json | undefined } | null
}

/** Libellés humains de la taxonomie UI (metadata.ui_litigation_type). */
const UI_TYPE_LABEL: Record<string, string> = {
  dpe_contestation: 'Contestation étiquette DPE',
  erreur_surface_carrez: 'Erreur surface Carrez/Boutin',
  oubli_diagnostic: 'Oubli de diagnostic',
  amiante_non_detecte: 'Amiante non détecté',
  plomb_non_detecte: 'Plomb non détecté',
  gaz_securite: 'Anomalie gaz / sécurité',
  electricite_securite: 'Anomalie électricité / sécurité',
  demande_remboursement: 'Demande de remboursement',
  autre: 'Autre',
}

/** Libellés humains de la taxonomie DB `litigation_kind`. */
const KIND_LABEL: Record<string, string> = {
  claim_client: 'Réclamation client',
  mediation: 'Médiation',
  rcp_insurer: 'Assurance RC Pro',
  judicial: 'Judiciaire',
  administrative: 'Administratif',
  other: 'Autre',
}

/** Résout un libellé de type lisible : type UI d'origine sinon kind DB. */
function litigationTypeLabel(row: LitigationWorkflowRow): string {
  const uiType =
    row.metadata && typeof row.metadata.ui_litigation_type === 'string'
      ? row.metadata.ui_litigation_type
      : null
  if (uiType && UI_TYPE_LABEL[uiType]) return UI_TYPE_LABEL[uiType]
  return KIND_LABEL[row.litigation_kind] ?? row.litigation_kind
}

/** Plainte du client : `notes` en priorité, sinon `metadata.client_complaint`. */
function clientComplaint(row: LitigationWorkflowRow): string {
  if (row.notes && row.notes.trim().length > 0) return row.notes
  if (row.metadata && typeof row.metadata.client_complaint === 'string') {
    return row.metadata.client_complaint
  }
  return '—'
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

  // 1. Charge le litige depuis litigation_workflows (scope org)
  const { data: litigationRaw, error } = await supabase
    .from('litigation_workflows')
    .select('id, organization_id, litigation_kind, notes, metadata')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error || !litigationRaw) {
    return NextResponse.json({ error: 'Litigation not found' }, { status: 404 })
  }

  const litigation = litigationRaw as LitigationWorkflowRow

  // 2. Appel Claude Haiku
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model = process.env.ANTHROPIC_MODEL_VOICE ?? 'claude-haiku-4-5'

  const userPrompt = [
    `Type de litige : ${litigationTypeLabel(litigation)}`,
    '',
    'Plainte client :',
    clientComplaint(litigation),
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

  // 3. Persiste le brouillon dans metadata.draft (merge non destructif)
  const generatedAt = new Date().toISOString()
  const existingMetadata = litigation.metadata ?? {}
  const { error: updateError } = await supabase
    .from('litigation_workflows')
    .update({
      metadata: {
        ...existingMetadata,
        draft: {
          response_md: draftMarkdown,
          cited_references: citedReferences,
          generated_at: generatedAt,
        },
      },
      updated_at: generatedAt,
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
    generatedAt,
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
