/**
 * POST /api/rgpd/request — endpoint user-facing pour déposer une demande RGPD.
 *
 * Body : { type: 'export' | 'erasure' }
 *
 * Authentification requise (Supabase auth cookie). L'INSERT passe par RLS
 * (policy "dsar_insert_self") : un user ne peut insérer que ses propres
 * demandes (user_id = auth.uid()).
 *
 * La deadline est calculée automatiquement par le trigger DB
 * (requested_at + 30 jours) — pas besoin de la passer dans le payload.
 *
 * Idempotence : si une demande du même type est déjà pending/processing pour
 * ce user, on retourne 409 plutôt que de créer un doublon (anti-spam).
 */

import type { DsarType } from '@/lib/admin/dsar'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface Body {
  type?: string
}

interface DsarInsertReturn {
  id: string
  deadline: string
}

interface ExistingDsarRow {
  id: string
  status: string
}

const ALLOWED_TYPES: DsarType[] = ['export', 'erasure']

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const type = (body.type ?? '') as DsarType
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type doit être ${ALLOWED_TYPES.join(' | ')}` },
      { status: 400 },
    )
  }

  // Récupérer org primaire du user (facultatif côté demande, utile pour
  // l'admin qui voit quelle org est concernée).
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id')
    .eq('id', user.id)
    .maybeSingle<{ default_org_id: string | null }>()

  const organizationId = profile?.default_org_id ?? null

  // Idempotence : check existing pending/processing du même type
  // Cast typé : dsar_requests pas dans @kovas/database/types.
  const existingRes = (await supabase
    .from('dsar_requests')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('type', type)
    .in('status', ['pending', 'processing'])
    .maybeSingle()) as unknown as {
    data: ExistingDsarRow | null
    error: { message: string } | null
  }

  if (existingRes.data) {
    return NextResponse.json(
      {
        error: 'Une demande du même type est déjà en cours de traitement',
        existing_id: existingRes.data.id,
        existing_status: existingRes.data.status,
      },
      { status: 409 },
    )
  }

  // INSERT via RLS user-scoped (policy dsar_insert_self).
  const insertPayload = {
    user_id: user.id,
    organization_id: organizationId,
    type,
    status: 'pending' as const,
    // requested_at + deadline auto via trigger DB
  }

  const insertRes = (await (
    supabase.from('dsar_requests') as unknown as {
      insert: (v: typeof insertPayload) => {
        select: (cols: string) => {
          maybeSingle: () => Promise<{
            data: DsarInsertReturn | null
            error: { message: string } | null
          }>
        }
      }
    }
  )
    .insert(insertPayload)
    .select('id, deadline')
    .maybeSingle()) as {
    data: DsarInsertReturn | null
    error: { message: string } | null
  }

  if (insertRes.error || !insertRes.data) {
    return NextResponse.json(
      { error: insertRes.error?.message ?? 'Insertion impossible' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    id: insertRes.data.id,
    deadline: insertRes.data.deadline,
    legal_max_days: 30,
  })
}
