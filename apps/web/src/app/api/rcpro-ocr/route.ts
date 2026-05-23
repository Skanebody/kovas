import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * OCR RC Pro via Claude Vision — proxie l'Edge Function `extract-rcpro-attestation`
 * (créée par VAL-3) qui appelle claude-sonnet-4-6 avec l'image/PDF en pièce jointe.
 *
 * Si l'Edge Function n'est pas encore branchée, renvoie un mock prévisible.
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('attestation')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier > 10 Mo' }, { status: 413 })
  }

  try {
    const admin = createAdminClient()
    const forwardForm = new FormData()
    forwardForm.append('attestation', file)
    const { data, error } = await admin.functions.invoke('extract-rcpro-attestation', {
      body: forwardForm,
    })
    if (!error && data && typeof data === 'object') {
      return NextResponse.json(data)
    }
  } catch (e) {
    console.warn('extract-rcpro-attestation invoke failed:', e)
  }

  // Mock fallback — utile en dev sans Claude key
  return NextResponse.json({
    insurer: 'MMA Assurances',
    policy_number: '1234567890',
    valid_until: nextYearISODate(),
    amount_per_claim: 500000,
    amount_per_year: 1000000,
    source: 'mock',
  })
}

function nextYearISODate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}
