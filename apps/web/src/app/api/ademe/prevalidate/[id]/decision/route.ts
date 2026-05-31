/**
 * KOVAS — PATCH /api/ademe/prevalidate/[id]/decision
 *
 * Enregistre la décision du diagnostiqueur sur une pré-validation ADEME, prise
 * depuis l'écran de résultat (`PrevalidationResult.tsx`) :
 *   - published   → "Publier le DPE"          (verdict vert)
 *   - reworked    → "Retravailler le DPE"      (verdict jaune)
 *   - overridden  → "Publier quand même"       (verdict jaune, passage en force)
 *   - cancelled   → "Annuler la publication"   (verdict rouge)
 *
 * Persistance : la table `ademe_prevalidations` n'a pas de colonne d'enum dédiée
 * à la décision ; on s'appuie donc sur les colonnes existantes de la décision
 * diagnostiqueur (`acknowledged`, `acknowledged_at`, `acknowledged_by`) et on
 * stocke le libellé de la décision dans `override_reason` (champ texte libre).
 *
 * Auth : `getCurrentUser()` (throw si invité). Scope organisation explicite via
 * `.eq('organization_id', orgId)` en plus de la RLS `is_member_of`.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type PrevalidationDecision = 'published' | 'reworked' | 'cancelled' | 'overridden'

const VALID_DECISIONS: readonly PrevalidationDecision[] = [
  'published',
  'reworked',
  'cancelled',
  'overridden',
]

/** Libellé métier stocké dans `override_reason` (audit décision diagnostiqueur). */
const DECISION_REASON: Record<PrevalidationDecision, string> = {
  published: 'Décision : DPE publié',
  reworked: 'Décision : DPE à retravailler',
  cancelled: 'Décision : publication annulée',
  overridden: 'Décision : publié malgré les avertissements',
}

interface DecisionBody {
  decision?: unknown
}

function isValidDecision(value: unknown): value is PrevalidationDecision {
  return typeof value === 'string' && VALID_DECISIONS.includes(value as PrevalidationDecision)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: DecisionBody
  try {
    body = (await request.json()) as DecisionBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!isValidDecision(body.decision)) {
    return NextResponse.json({ error: 'invalid_decision' }, { status: 400 })
  }
  const decision = body.decision

  try {
    const { orgId, user, supabase } = await getCurrentUser()

    const { data, error } = await supabase
      .from('ademe_prevalidations')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
        override_reason: DECISION_REASON[decision],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select('id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
