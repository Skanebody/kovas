import { safeLog } from '@/lib/security/safe-logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFakeSiretAllowed, validateSiret } from '@/lib/validation/siret'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  siret: z.string().length(14, 'SIRET 14 chiffres requis'),
})

/**
 * Lookup SIRENE INSEE — proxie l'Edge Function `verify-sirene` (VAL-3).
 *
 * Si l'Edge Function n'est pas encore déployée, retourne un mock prévisible
 * basé sur le SIRET pour permettre les démos / tests E2E.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ siret: searchParams.get('siret') })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const siret = parsed.data.siret

  if (!isFakeSiretAllowed()) {
    const check = validateSiret(siret)
    if (!check.valid) {
      return NextResponse.json(
        { error: 'SIRET invalide (somme de contrôle Luhn KO)' },
        { status: 400 },
      )
    }
  }

  // 1) Tentative via Edge Function verify-sirene
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.functions.invoke('verify-sirene', {
      body: { siret },
    })
    if (!error && data) {
      return NextResponse.json(data)
    }
  } catch (e) {
    safeLog.warn('verify-sirene invoke failed, using mock:', e)
  }

  // 2) Fallback mock — utile en dev / preview deploy
  return NextResponse.json({
    company_name: `Cabinet de diagnostic ${siret.slice(0, 3)}`,
    legal_form: 'EURL',
    ape_code: '7120B',
    director_name: 'Jean Dupont',
    source: 'mock',
  })
}
