#!/usr/bin/env node
/**
 * Setup du webhook Telegram pour le bot admin KOVAS.
 *
 * Usage :
 *   cd apps/web
 *   node scripts/telegram-setup-webhook.mjs [--url=<webhook-url>]
 *
 * Étapes :
 *   1. Lit TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET (depuis .env.local)
 *   2. URL par défaut : https://kovas.fr/api/telegram/webhook
 *      Override via --url=... (utile pour preview Vercel)
 *   3. POST setWebhook { url, secret_token, allowed_updates }
 *   4. POST getWebhookInfo pour confirmer
 *
 * Prérequis :
 *   - Le bot doit être créé via @BotFather (token reçu)
 *   - TELEGRAM_WEBHOOK_SECRET généré via : openssl rand -hex 32
 *   - L'URL doit être joignable en HTTPS (Vercel SSL ou tunnel ngrok dev)
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../..')
const WEB_ROOT = resolve(__dirname, '..')

// ============================================
// Charge .env.local (root + apps/web)
// ============================================
function loadEnv() {
  const candidates = [resolve(PROJECT_ROOT, '.env.local'), resolve(WEB_ROOT, '.env.local')]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const content = readFileSync(path, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  }
}

loadEnv()

const args = process.argv.slice(2)
const urlArg = args.find((a) => a.startsWith('--url='))?.slice(6)
const WEBHOOK_URL = urlArg ?? 'https://kovas.fr/api/telegram/webhook'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN absent (.env.local)')
  process.exit(1)
}
if (!SECRET) {
  console.error('TELEGRAM_WEBHOOK_SECRET absent (.env.local)')
  console.error('  Générer un secret : openssl rand -hex 32')
  process.exit(1)
}

const API = `https://api.telegram.org/bot${TOKEN}`

async function call(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) {
    throw new Error(`telegram ${method} failed: ${json.description}`)
  }
  return json.result
}

console.log(`→ Setting webhook URL: ${WEBHOOK_URL}`)
await call('setWebhook', {
  url: WEBHOOK_URL,
  secret_token: SECRET,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: false,
})
console.log('  OK')

console.log('→ Verifying via getWebhookInfo:')
const info = await call('getWebhookInfo', {})
console.log(JSON.stringify(info, null, 2))

if (info.url !== WEBHOOK_URL) {
  console.error(`Mismatch: got "${info.url}" vs expected "${WEBHOOK_URL}"`)
  process.exit(1)
}
if (info.last_error_message) {
  console.warn(`Last error from Telegram: ${info.last_error_message}`)
}

console.log('\nWebhook setup complete.')
console.log('Test : envoie /start au bot depuis ton Telegram personnel.')
