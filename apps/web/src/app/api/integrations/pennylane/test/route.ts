/**
 * POST /api/integrations/pennylane/test
 *
 * Body : { apiToken: string }
 * Teste la validité d'un token Pennylane sans le persister.
 * Utilisé par le formulaire Compte → Intégrations → Pennylane.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { PennylaneClient, PennylaneError } from '@/lib/pennylane'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  apiToken: z.string().min(10, 'Token trop court').max(500, 'Token trop long'),
})

export async function POST(request: Request) {
  await getCurrentUser() // exige une session

  const json: unknown = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Payload invalide' },
      { status: 400 },
    )
  }

  const client = new PennylaneClient({ apiToken: parsed.data.apiToken, timeoutMs: 10_000 })

  try {
    await client.ping()
    return NextResponse.json({ ok: true, message: 'Connexion réussie.' })
  } catch (err) {
    const message = err instanceof PennylaneError ? err.message : 'Erreur réseau inconnue'
    const status = err instanceof PennylaneError ? err.status : 500
    return NextResponse.json({ ok: false, message, status }, { status: 200 })
  }
}
