#!/usr/bin/env tsx
/**
 * KOVAS — Script de provisioning Stripe (21 produits Tugan v3.0)
 *
 * Lance manuellement par Benjamin quand il est prêt à provisionner Stripe :
 *
 *   # Vérification sans création (recommandé en 1er run)
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-stripe-products.ts --mode=dry-run
 *
 *   # Création réelle (idempotent — skip si product déjà existant)
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-stripe-products.ts --mode=create-products
 *
 * Idempotence : on recherche d'abord via `metadata.code` puis `lookup_key`.
 * Si un product avec le même `metadata.code` existe, on log "skipped" sans
 * modifier. Pour forcer un re-provisioning, supprimer manuellement dans Stripe
 * Dashboard puis relancer.
 *
 * Variables d'environnement requises :
 *   - STRIPE_SECRET_KEY  : clé secrète Stripe (sk_test_... ou sk_live_...)
 *
 * Lecture depuis `.env.local` à la racine du monorepo (symlink Next.js
 * standard, cf. FAQ UPSTASH-SETUP.md §9).
 *
 * Conventions :
 *   - 1 product = 1 price (pas de multi-prices par product en V1 Tugan).
 *   - `lookup_key` Stripe = `kovas_<code>` pour récupération via `prices.list`.
 *   - `metadata.code` = code interne (clé d'idempotence côté script).
 *   - Plans monthly/annual = subscription `recurring.interval` month/year.
 *   - One-time = pas de `recurring` (price simple).
 *
 * Récap final :
 *   Created: X · Skipped (already exists): Y · Errors: Z
 */

import process from 'node:process'
import Stripe from 'stripe'
import {
  type StripeProductConfig,
  TUGAN_STRIPE_PRODUCTS,
  formatPriceEur,
} from '../src/lib/billing/tugan-stripe-products'

// ════════════════════════════════════════════════════════════════
// Parsing CLI
// ════════════════════════════════════════════════════════════════

type RunMode = 'dry-run' | 'create-products'

interface CliArgs {
  readonly mode: RunMode
}

function parseArgs(argv: readonly string[]): CliArgs {
  const modeArg = argv.find((arg) => arg.startsWith('--mode='))
  if (!modeArg) {
    console.error('Usage: seed-stripe-products.ts --mode=<dry-run|create-products>')
    process.exit(2)
  }
  const mode = modeArg.replace('--mode=', '')
  if (mode !== 'dry-run' && mode !== 'create-products') {
    console.error(`Mode invalide : "${mode}". Valeurs autorisées : dry-run, create-products`)
    process.exit(2)
  }
  return { mode }
}

// ════════════════════════════════════════════════════════════════
// Helpers Stripe
// ════════════════════════════════════════════════════════════════

/**
 * Récupère un product Stripe existant par `metadata.code`, ou null si absent.
 *
 * On utilise `stripe.products.search` (filtre full-text sur metadata) plutôt
 * que `products.list` qui ne supporte pas le filtrage par metadata directement.
 */
async function findExistingProduct(stripe: Stripe, code: string): Promise<Stripe.Product | null> {
  const result = await stripe.products.search({
    query: `metadata['code']:'${code}' AND active:'true'`,
    limit: 1,
  })
  return result.data[0] ?? null
}

/**
 * Crée un product + price Stripe pour une config Tugan.
 *
 * - Product : `metadata.code` = code interne (idempotency key).
 * - Price : `lookup_key` = `kovas_<code>` + `unit_amount` = priceCents.
 * - Subscription : ajoute `recurring.interval` month/year.
 * - One-time : pas de recurring (price simple sans abo).
 */
async function createProductWithPrice(
  stripe: Stripe,
  config: StripeProductConfig,
): Promise<{ product: Stripe.Product; price: Stripe.Price }> {
  const product = await stripe.products.create({
    name: config.stripeProductName,
    description: config.description,
    metadata: {
      code: config.code,
      category: config.category,
      tugan_version: 'v3.0',
      ...(config.requiredTierAtLeast ? { required_tier_at_least: config.requiredTierAtLeast } : {}),
    },
  })

  const priceParams: Stripe.PriceCreateParams = {
    product: product.id,
    unit_amount: config.priceCents,
    currency: config.currency,
    lookup_key: config.stripePriceLookupKey,
    metadata: {
      code: config.code,
      trial_days: String(config.trialDays),
    },
  }

  if (config.billingMode === 'monthly_subscription') {
    priceParams.recurring = { interval: 'month' }
  } else if (config.billingMode === 'annual_subscription') {
    priceParams.recurring = { interval: 'year' }
  }
  // one_time → pas de `recurring`.

  const price = await stripe.prices.create(priceParams)
  return { product, price }
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════

interface RunStats {
  created: number
  skipped: number
  errors: number
}

async function runSeed(stripe: Stripe, mode: RunMode): Promise<RunStats> {
  const stats: RunStats = { created: 0, skipped: 0, errors: 0 }

  console.log(`\n=== KOVAS Stripe seed — mode: ${mode} ===\n`)
  console.log(`${TUGAN_STRIPE_PRODUCTS.length} produits à traiter\n`)

  for (const config of TUGAN_STRIPE_PRODUCTS) {
    const label = `${config.code.padEnd(35)} ${formatPriceEur(config.priceCents).padStart(12)} · ${config.billingMode}`

    try {
      const existing = await findExistingProduct(stripe, config.code)
      if (existing) {
        console.log(`  [SKIP]    ${label}  (déjà existant : ${existing.id})`)
        stats.skipped += 1
        continue
      }

      if (mode === 'dry-run') {
        console.log(`  [DRY-RUN] ${label}  (serait créé)`)
        stats.created += 1
        continue
      }

      const { product, price } = await createProductWithPrice(stripe, config)
      console.log(`  [CREATED] ${label}  → ${product.id} · ${price.id}`)
      stats.created += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  [ERROR]   ${label}  → ${message}`)
      stats.errors += 1
    }
  }

  return stats
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey || secretKey.length < 10) {
    console.error('STRIPE_SECRET_KEY manquant ou invalide dans process.env.')
    console.error('Ajoute-le dans .env.local à la racine du monorepo.')
    process.exit(1)
  }

  if (args.mode === 'create-products' && !secretKey.startsWith('sk_test_')) {
    console.warn('ATTENTION : tu utilises une clé qui ne commence pas par sk_test_.')
    console.warn('Si tu es en PRODUCTION, vérifie que c’est bien ce que tu veux.')
    console.warn('Pause 3 secondes — Ctrl+C pour annuler.\n')
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  const stripe = new Stripe(secretKey, {
    // Pas de pin `apiVersion` ici — on laisse le SDK 22.x utiliser la version
    // par défaut qu'il connaît. Pinner la version requiert un cast vers un type
    // privé du SDK qui change entre versions. La création de products/prices
    // est stable sur toutes les API versions Stripe modernes.
    typescript: true,
    appInfo: {
      name: 'KOVAS seed-stripe-products',
      version: '1.0.0',
    },
  })

  const stats = await runSeed(stripe, args.mode)

  console.log('\n=== Récap ===')
  console.log(
    `Created: ${stats.created} · Skipped (already exists): ${stats.skipped} · Errors: ${stats.errors}`,
  )

  if (stats.errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
