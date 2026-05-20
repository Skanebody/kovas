#!/usr/bin/env node
/**
 * Setup 2FA pour un admin KOVAS (V1 — pas d'UI dédiée).
 *
 * Usage :
 *   cd apps/web
 *   node scripts/admin-setup-2fa.mjs <email>
 *
 * Étapes :
 *   1. Récupère le user_id depuis auth.users via email
 *   2. Vérifie qu'il est admin actif (admin_users)
 *   3. Génère un secret TOTP base32 (160 bits)
 *   4. Chiffre avec ADMIN_2FA_ENCRYPTION_KEY (AES-256-GCM)
 *   5. UPSERT dans admin_2fa_secrets avec enabled=true, enabled_at=now()
 *   6. Affiche l'URL otpauth:// (à scanner via QR depuis un générateur en ligne
 *      ou copier-coller dans l'app Authenticator)
 *
 * Prérequis :
 *   - .env.local chargé (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *     ADMIN_2FA_ENCRYPTION_KEY)
 *   - L'utilisateur doit être préalablement inséré dans admin_users :
 *     INSERT INTO admin_users (user_id, role, notes)
 *     VALUES ('<UUID>', 'super_admin', 'Founder');
 */

import { createCipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Mini-loader .env.local (pour éviter une dépendance dotenv)
function loadEnvFile(path) {
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(resolve(__dirname, '../.env.local'))
loadEnvFile(resolve(__dirname, '../../../.env.local'))

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/admin-setup-2fa.mjs <email>')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ENCRYPTION_KEY_HEX = process.env.ADMIN_2FA_ENCRYPTION_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.')
  process.exit(1)
}
if (!ENCRYPTION_KEY_HEX) {
  console.error('ADMIN_2FA_ENCRYPTION_KEY manquante.')
  console.error(
    "Générer : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  )
  process.exit(1)
}
const encryptionKey = Buffer.from(ENCRYPTION_KEY_HEX, 'hex')
if (encryptionKey.length !== 32) {
  console.error(`ADMIN_2FA_ENCRYPTION_KEY invalide (${encryptionKey.length} bytes, attendu 32).`)
  process.exit(1)
}

// ============================================
// TOTP base32 helpers (mêmes fonctions que lib/admin/totp.ts)
// ============================================
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return output
}

function encryptSecret(plaintext) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authtag = cipher.getAuthTag()
  return Buffer.concat([nonce, ciphertext, authtag]).toString('base64')
}

// ============================================
// Workflow
// ============================================

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// 1. Recherche du user_id via auth.admin.listUsers (paginate au besoin)
let userId = null
let page = 1
while (!userId) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.error('Erreur listUsers :', error.message)
    process.exit(1)
  }
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (match) {
    userId = match.id
    break
  }
  if (data.users.length < 200) break
  page += 1
}
if (!userId) {
  console.error(`Aucun user auth trouvé pour ${email}. Signup d'abord via /signup.`)
  process.exit(1)
}

// 2. Vérifie admin_users actif
const { data: admin } = await supabase
  .from('admin_users')
  .select('role, is_active')
  .eq('user_id', userId)
  .maybeSingle()

if (!admin) {
  console.error(`User ${email} (${userId}) absent de admin_users.`)
  console.error('Exécuter :')
  console.error(
    `  INSERT INTO admin_users (user_id, role, notes) VALUES ('${userId}', 'super_admin', 'Founder');`,
  )
  process.exit(1)
}
if (!admin.is_active) {
  console.error(`User ${email} présent mais inactif dans admin_users.`)
  process.exit(1)
}

// 3. Génère secret
const secretBytes = randomBytes(20)
const secret = base32Encode(secretBytes)
const encrypted = encryptSecret(secret)

// 4. UPSERT secret
const { error: upsertError } = await supabase.from('admin_2fa_secrets').upsert({
  user_id: userId,
  secret_encrypted: encrypted,
  enabled: true,
  enabled_at: new Date().toISOString(),
})

if (upsertError) {
  console.error('Erreur UPSERT admin_2fa_secrets :', upsertError.message)
  process.exit(1)
}

const issuer = 'KOVAS Admin'
const params = new URLSearchParams({
  secret,
  issuer,
  algorithm: 'SHA1',
  digits: '6',
  period: '30',
})
const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params.toString()}`

// CLI tool — console.log volontaire pour communiquer secret/URL à l'opérateur.
console.log('')
console.log('═══════════════════════════════════════════════════════')
console.log(`✅ 2FA configuré pour ${email}`)
console.log('═══════════════════════════════════════════════════════')
console.log('')
console.log('Secret base32 (à entrer manuellement si pas de QR) :')
console.log(`  ${secret}`)
console.log('')
console.log('URL otpauth (à coller dans un générateur de QR en ligne,')
console.log('ex: https://stefansundin.github.io/qrgen/, ou dans 1Password) :')
console.log('')
console.log(`  ${otpauthUrl}`)
console.log('')
console.log('Étapes :')
console.log('  1. Scannez le QR avec Google Authenticator / Authy / 1Password')
console.log('  2. Allez sur https://<votre-domaine>/admin')
console.log('  3. Vous serez redirigé vers /admin/verify-2fa')
console.log('  4. Saisissez le code à 6 chiffres')
console.log('')
