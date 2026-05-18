#!/usr/bin/env node
/**
 * Génère les 3 icônes PWA depuis un SVG inline.
 * - icon-192.png (192×192) — standard
 * - icon-512.png (512×512) — high-res
 * - icon-512-maskable.png (512×512) — avec safe zone 80% pour le mask Android
 *
 * Design sobre : carré noir, lettre K blanche centrée (cf. avatar-client.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('/Users/benjaminbel/Desktop/KOVAS/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp')

const ICONS_DIR = 'apps/web/public/icons'
mkdirSync(ICONS_DIR, { recursive: true })

function buildSvg(size, maskable) {
  // Safe zone : maskable doit garder le contenu dans 80% centré (safe area)
  const safe = maskable ? 0.8 : 1
  const fontSize = Math.floor(size * 0.55 * safe)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#0A0A0A"/>
  <text x="50%" y="50%" dy="0.36em" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="800" font-size="${fontSize}" fill="#FAFAFA" letter-spacing="-0.02em">K</text>
</svg>`
}

async function generate(size, name, maskable = false) {
  const svg = buildSvg(size, maskable)
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(`${ICONS_DIR}/${name}`)
  console.log(`  ✓ ${name} (${size}×${size}${maskable ? ', maskable' : ''})`)
}

console.log('Generating PWA icons:')
await generate(192, 'icon-192.png')
await generate(512, 'icon-512.png')
await generate(512, 'icon-512-maskable.png', true)
// Apple touch icon (180×180 recommended for iOS)
await generate(180, 'apple-touch-icon.png')
// Favicon variants
await generate(32, 'favicon-32.png')
await generate(16, 'favicon-16.png')
console.log('✓ Done')
