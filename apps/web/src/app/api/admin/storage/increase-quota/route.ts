/**
 * POST /api/admin/storage/increase-quota
 *
 * Body : { organization_id: string, additional_bytes: number }
 *
 * Ajoute `additional_bytes` au quota de stockage d'une organisation, log
 * l'action dans admin_audit_log via withAuditWrapper.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface Body {
  organization_id?: string
  additional_bytes?: number
}

const MAX_ADD = 500 * 1024 * 1024 * 1024 // 500 Go cap

interface OrgQuotaRow {
  id: string
  name: string
  storage_quota_bytes: number | null
}

export async function POST(request: Request) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const orgId = (body.organization_id ?? '').trim()
  const addBytes = Number(body.additional_bytes)

  if (!orgId) {
    return NextResponse.json({ error: 'organization_id requis' }, { status: 400 })
  }
  if (!Number.isFinite(addBytes) || addBytes <= 0) {
    return NextResponse.json({ error: 'additional_bytes invalide' }, { status: 400 })
  }
  if (addBytes > MAX_ADD) {
    return NextResponse.json(
      { error: `additional_bytes > ${MAX_ADD} octets (cap 500 Go)` },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Cast typé local : storage_quota_bytes ajouté par la migration 20260524100000.
  const orgRes = (await supabase
    .from('organizations')
    .select('id, name, storage_quota_bytes')
    .eq('id', orgId)
    .maybeSingle()) as unknown as {
    data: OrgQuotaRow | null
    error: { message: string } | null
  }

  const org = orgRes.data
  if (!org) {
    return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })
  }

  const previousQuota = org.storage_quota_bytes ?? 0
  const newQuota = previousQuota + addBytes

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'storage_quota_increased',
      targetType: 'organization',
      targetId: org.id,
      targetLabel: org.name,
      payload: { additional_bytes: addBytes, new_quota_bytes: newQuota },
      previousState: { storage_quota_bytes: previousQuota },
      newState: { storage_quota_bytes: newQuota },
    },
    async () => {
      const update = { storage_quota_bytes: newQuota }
      const { error } = await (
        supabase.from('organizations') as unknown as {
          update: (v: typeof update) => {
            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
          }
        }
      )
        .update(update)
        .eq('id', org.id)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath('/admin/storage')

  return NextResponse.json({ ok: true, new_quota_bytes: newQuota })
}
