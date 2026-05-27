/**
 * POST /api/telegram/webhook
 *
 * Endpoint webhook appelé par les serveurs Telegram quand un update arrive
 * (message ou callback_query) sur le bot KOVAS.
 *
 * Sécurité :
 *   - Header `X-Telegram-Bot-Api-Secret-Token` doit valoir TELEGRAM_WEBHOOK_SECRET
 *     (configuré via setWebhook). Sinon 401.
 *   - L'authentification fine (chat_id ∈ admin_users) est ensuite faite dans
 *     `handleTelegramWebhook()`.
 *
 * Performance :
 *   - Telegram timeout HTTP est ~30s mais on doit répondre vite (idéalement
 *     < 5s) sinon retries. On lance le traitement en background et on répond
 *     immédiatement 200 OK. Vercel keeps the function warm jusqu'à la fin de
 *     la promesse (NOTE: sur Edge runtime, ce pattern serait plus complexe —
 *     on reste Node default).
 *
 * GET : healthcheck simple (utilisé par scripts/cron pour vérifier le déploiement).
 */

import type { TelegramUpdate } from '@/lib/telegram/types'
import { handleTelegramWebhook } from '@/lib/telegram/webhook-handler'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Schema minimal pour valider la structure attendue d'un update Telegram.
// `passthrough()` autorise les champs supplémentaires (forward-compat avec
// les nouvelles features Telegram non encore modélisées côté KOVAS).
const TelegramUpdateSchema = z
  .object({
    update_id: z.number(),
    message: z
      .object({
        message_id: z.number(),
        from: z
          .object({
            id: z.number(),
            is_bot: z.boolean(),
            first_name: z.string().max(200).optional(),
            username: z.string().max(200).optional(),
          })
          .passthrough()
          .optional(),
        chat: z
          .object({
            id: z.number(),
            type: z.string().max(50),
          })
          .passthrough(),
        date: z.number(),
        text: z.string().max(4096).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Vérif secret token (anti spoof)
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected || expected.length === 0) {
    console.error('[api/telegram/webhook] TELEGRAM_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-telegram-bot-api-secret-token')
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse + valide body via Zod (anti-payload-malformé + anti-DoS via champs surdimensionnés)
  let update: TelegramUpdate
  try {
    const raw = await req.json()
    const parsed = TelegramUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn('[api/telegram/webhook] invalid payload', parsed.error.issues.slice(0, 3))
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    update = parsed.data as unknown as TelegramUpdate
  } catch (e) {
    console.error('[api/telegram/webhook] invalid JSON', e)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 3. Process en background — répond 200 OK immédiatement à Telegram pour
  // ne pas bloquer leur retry loop.
  // NOTE : sur Vercel, await la promesse pour qu'elle s'exécute avant que
  // la fonction soit recyclée. On fait un await direct (la latence reste
  // sous les 5s pour les commandes V1, on n'utilise pas waitUntil).
  try {
    await handleTelegramWebhook(update)
  } catch (e) {
    console.error('[api/telegram/webhook] handler crashed', e)
    // On répond OK quand même (Telegram retry sinon → boucle infinie sur bug)
  }

  return NextResponse.json({ ok: true })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
