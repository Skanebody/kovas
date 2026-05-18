# Task 1.3 PWA Setup — Démarrage dev immédiat (post-Modification 18 du 18/05)

> **⚠️ Mis à jour post-Modification 18** : MVP V1 = **10 features cœur** (pas 6). Croquis 2D Apple Pencil retiré V1 → V2. Ajout de 4 features (templates pièces, check-lists, upload doc propriétaire, validation cohérence) + bouton "Partager vers Liciel" 3 modes formalisé.
>
> Cf. [`/docs/modification-18-mvp-v1-extended.md`](../../../../docs/modification-18-mvp-v1-extended.md) pour le détail complet.

## Objective

**Démarrer le développement de KOVAS PWA AUJOURD'HUI** sans attendre la mise à jour complète des autres artefacts. Cette task remplace les anciennes Tasks 2.1 (EAS dev client) et apporte le scaffolding PWA initial nécessaire pour bosser sur les **10 features cœur V1**.

## Context

**Post-pivot PWA-only confirmé 18/05** (cf. [`docs/pwa-pivot-decision.md`](../../../docs/pwa-pivot-decision.md)). Le fondateur veut démarrer le dev immédiatement pour valider que le concept marche. Cette task est un **shortcut pragmatique** vers le code, avant que toutes les tasks Phase 2-5 soient re-sharded post-pivot.

## Dependencies

- Task 1.1 (monorepo pnpm) — voir [`task-1-1.md`](task-1-1.md)
- Task 1.2 (Supabase setup + auth) — voir [`task-1-2.md`](task-1-2.md)

## Blocked By

- Tasks 1.1 + 1.2 (monorepo + Supabase prêts)

## Implementation Plan — démarre dev immédiat

### Step 1 : Init Next.js 15 dans `apps/web/`

```bash
cd ~/Code/kovas-app/apps
pnpm dlx create-next-app@latest web \
  --typescript --tailwind --app --turbopack \
  --src-dir --import-alias "@/*" \
  --no-eslint
```

Options à choisir :
- TypeScript ✅
- Tailwind ✅
- App Router ✅
- Turbopack ✅
- `src/` directory ✅
- Import alias `@/*` ✅
- ESLint ❌ (Biome utilisé à la place)

### Step 2 : Installer dépendances PWA

```bash
cd apps/web

# PWA core
pnpm add @serwist/next serwist
pnpm add -D @serwist/sw

# UI & icons
pnpm add lucide-react @radix-ui/react-slot class-variance-authority clsx tailwind-merge
pnpm dlx shadcn@latest init  # config minimal

# State & data
pnpm add zustand @tanstack/react-query @tanstack/react-query-devtools

# Forms & validation
pnpm add zod react-hook-form @hookform/resolvers

# Animation & rendering (Konva pour annotations photos + futures croquis V2)
pnpm add framer-motion konva react-konva

# Offline DB
pnpm add dexie dexie-react-hooks

# Cloud storage OAuth (pour bouton "Partager vers Liciel" 3 modes — feature #8 MVP V1)
pnpm add @googleapis/drive googleapis  # Google Drive OAuth + upload

# Database client (depuis @kovas/database)
# Already linked via pnpm workspaces

# Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# i18n & theme
pnpm add next-intl next-themes

# Date & format
pnpm add date-fns libphonenumber-js
```

### Step 3 : PWA Manifest

`apps/web/public/manifest.json` :

```json
{
  "name": "KOVAS",
  "short_name": "KOVAS",
  "description": "App iPad diagnostic immobilier IA-first",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#0A0A0A",
  "background_color": "#F4F4F5",
  "lang": "fr-FR",
  "scope": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["business", "productivity"],
  "shortcuts": [
    { "name": "Nouvelle mission", "short_name": "Mission", "url": "/missions/new", "icons": [{ "src": "/icons/shortcut-mission.png", "sizes": "96x96" }] },
    { "name": "Mes clients", "short_name": "Clients", "url": "/clients", "icons": [{ "src": "/icons/shortcut-clients.png", "sizes": "96x96" }] }
  ]
}
```

### Step 4 : Service Worker (Serwist)

`apps/web/src/app/sw.ts` :

```typescript
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()
```

`apps/web/next.config.ts` :

```typescript
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
})

export default withSerwist({
  reactStrictMode: true,
  experimental: { typedRoutes: true },
})
```

### Step 5 : Layout root avec PWA meta

`apps/web/src/app/layout.tsx` :

```tsx
import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/components/query-provider'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

export const metadata: Metadata = {
  title: 'KOVAS — Diagnostic immobilier IA',
  description: "L'app iPad qui transforme 3h de DPE en 30 minutes",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KOVAS',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F4F5' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={manrope.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Step 6 : Onboarding "Add to Home Screen" (CRITIQUE — bretelle 1 PWA pivot)

`apps/web/src/components/add-to-home-screen.tsx` :

```tsx
'use client'

import { useEffect, useState } from 'react'

export function AddToHomeScreen() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true

    setIsIos(ios)
    setIsStandalone(standalone)

    // Show modal if iOS and not yet installed
    if (ios && !standalone) {
      const dismissed = localStorage.getItem('a2hs-dismissed-count') || '0'
      if (parseInt(dismissed, 10) < 2) {
        setShow(true)
      }
    }

    // Track in PostHog (à implémenter au Step 8)
    if (typeof window !== 'undefined' && (window as any).posthog) {
      ;(window as any).posthog.capture('pwa.display_mode', {
        is_ios: ios,
        is_standalone: standalone,
      })
    }
  }, [])

  if (!show || isStandalone) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Ajoute KOVAS à ton écran d'accueil</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pour utiliser KOVAS comme une vraie app et garder tes données en sécurité,
            ajoute-le à ton écran d'accueil en 3 clics.
          </p>
          <ol className="space-y-2 text-sm">
            <li>1. Appuie sur le bouton Partager <span className="font-mono">⎙</span> en bas</li>
            <li>2. Choisis "Sur l'écran d'accueil"</li>
            <li>3. Appuie sur Ajouter</li>
          </ol>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                const c = parseInt(localStorage.getItem('a2hs-dismissed-count') || '0', 10) + 1
                localStorage.setItem('a2hs-dismissed-count', String(c))
                setShow(false)
              }}
              className="flex-1 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
            >
              Plus tard
            </button>
            <button
              onClick={() => {
                localStorage.setItem('a2hs-dismissed-count', '999')
                setShow(false)
              }}
              className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              Compris
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Ajouter dans `apps/web/src/app/(dashboard)/layout.tsx` (post-auth layout) :

```tsx
import { AddToHomeScreen } from '@/components/add-to-home-screen'

export default function DashboardLayout({ children }) {
  return (
    <>
      {children}
      <AddToHomeScreen />
    </>
  )
}
```

### Step 7 : IndexedDB via Dexie pour offline storage

`apps/web/src/lib/db/offline-db.ts` :

```typescript
import Dexie, { type Table } from 'dexie'

// Types mirrors @kovas/database (subset des tables Supabase)
export interface OfflineMission {
  id: string
  organizationId: string
  reference: string
  type: string
  status: string
  scheduledAt?: Date
  data: Record<string, unknown>
  syncStatus: 'pending' | 'synced' | 'conflict'
  updatedAt: Date
}

export interface OfflinePhoto {
  id: string
  missionId: string
  blob: Blob
  exifData?: Record<string, unknown>
  syncStatus: 'pending' | 'synced'
  capturedAt: Date
}

export interface OfflineVoiceNote {
  id: string
  missionId: string
  blob: Blob
  durationSeconds: number
  syncStatus: 'pending' | 'transcribed' | 'synced'
  capturedAt: Date
}

export interface OutboxEntry {
  id?: number
  operation: 'insert' | 'update' | 'delete'
  table: string
  rowId: string
  payload: Record<string, unknown>
  retries: number
  createdAt: Date
}

class KovasOfflineDB extends Dexie {
  missions!: Table<OfflineMission>
  photos!: Table<OfflinePhoto>
  voiceNotes!: Table<OfflineVoiceNote>
  outbox!: Table<OutboxEntry>

  constructor() {
    super('kovas-offline')
    this.version(1).stores({
      missions: 'id, organizationId, syncStatus, updatedAt',
      photos: 'id, missionId, syncStatus, capturedAt',
      voiceNotes: 'id, missionId, syncStatus, capturedAt',
      outbox: '++id, table, rowId, createdAt',
    })
  }
}

export const offlineDb = new KovasOfflineDB()
```

### Step 8 : PostHog integration (tracking PWA mode + persistence)

`apps/web/src/lib/posthog.ts` :

```typescript
import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // manual via App Router events
    autocapture: false,
  })
}

export { posthog }
```

Events à capturer dès J4 :
- `pwa.display_mode` : standalone vs browser (à chaque session)
- `pwa.installed` : si user accepte "Add to Home Screen"
- `pwa.dismissed_a2hs` : si user refuse
- `voice.transcribe.completed` (Task 2.3)
- `vision.user_correction_rate` (V2)
- `ai.{operation}.cost_eur` (cf. CLAUDE.md §7bis)

### Step 9 : Service Worker — background sync periodic (bretelle 2)

Dans `apps/web/src/app/sw.ts` étendu :

```typescript
// Periodic sync (every 5 days) — fallback if user actif
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'kovas-sync-5days') {
    event.waitUntil(syncOfflineQueue())
  }
})

async function syncOfflineQueue() {
  // Read outbox from IndexedDB (Dexie)
  // Send mutations to Supabase via REST
  // Update lastActiveAt via Edge Function
}
```

Cron Edge Function pour bretelle 3 (email reconnexion J+5) :

`supabase/functions/cron-pwa-reconnect-reminder/index.ts` :

```typescript
// pg_cron daily : SELECT users WHERE last_active_at < now() - interval '5 days'
// Send Resend email via template avec magic link login
```

### Step 10 : Configuration env

`.env.local` (NEVER commit) :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

### Step 11 : Test sur iPad Pro physique

Critical step :

1. `pnpm -F @kovas/web dev` (Next.js dev server localhost:3000)
2. ngrok ou Cloudflare Tunnel pour accès HTTPS depuis iPad Pro
3. Ouvrir Safari iPad → URL ngrok HTTPS
4. Tester :
   - Display correct iPad portrait + landscape
   - PointerEvents avec Apple Pencil (test simple en console.log `event.pressure`, `event.pointerType`)
   - Service Worker installation (Safari Settings → Avancé → Inspector)
   - "Add to Home Screen" workflow complet
   - Reload après A2HS : data IndexedDB persiste indéfiniment ✅

## Files to Create

- `apps/web/` complet (via create-next-app)
- `apps/web/public/manifest.json`
- `apps/web/public/icons/` (192, 512, maskable, shortcuts)
- `apps/web/src/app/sw.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/add-to-home-screen.tsx`
- `apps/web/src/components/theme-provider.tsx`
- `apps/web/src/components/query-provider.tsx`
- `apps/web/src/lib/db/offline-db.ts`
- `apps/web/src/lib/posthog.ts`
- `apps/web/src/lib/supabase/client.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/next.config.ts`
- `apps/web/biome.json` (hérite root)
- `supabase/functions/cron-pwa-reconnect-reminder/index.ts` (bretelle 3)

## Files to Modify

- `pnpm-workspace.yaml` (apps/web déjà inclus)
- `.env.example` (ajout NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_POSTHOG_KEY)

## Acceptance Criteria

- [ ] `pnpm -F @kovas/web dev` lance Next.js sur localhost:3000
- [ ] `pnpm -F @kovas/web build` réussit
- [ ] PWA manifest validé (Chrome DevTools Lighthouse PWA score > 90)
- [ ] Service Worker enregistré + installable ("Add to Home Screen" disponible)
- [ ] Test iPad Pro physique : PointerEvents OK avec Apple Pencil (pressure détectée)
- [ ] IndexedDB Dexie créé : table `missions`, `photos`, `voice_notes`, `outbox` visibles dans DevTools
- [ ] Onboarding "Add to Home Screen" affiché sur iOS détecté
- [ ] PostHog event `pwa.display_mode` capturé

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `pnpm -F @kovas/web typecheck` passe
- [ ] `pnpm -F @kovas/web build` réussit
- [ ] `pnpm -F @kovas/web lint` passe (Biome)

### Browser Testing (Claude_in_Chrome MCP)

- Navigate `http://localhost:3000`
- Inspect : manifest.json loadé, sw.js enregistré
- Lighthouse audit PWA → score > 90
- Test "Add to Home Screen" sur Chrome desktop (simulation iOS)

### iPad Physical Testing

- Open Safari → ngrok HTTPS URL
- Check : PointerEvents pressure with Apple Pencil
- Test "Add to Home Screen" → ouverture app standalone → data persistente

## Skills to Read

- `kovas-design-system` (préparation tokens NativeWind → Tailwind)
- `kovas-supabase-rls` (intégration auth)

## Research Files to Read

- `docs/pwa-pivot-decision.md` (lecture intégrale obligatoire)

## Git

- Branch : `feature/1-3-pwa-setup-initial`
- Commit message prefix : `Task 1.3:`
- PR target : `main`

## Notes anti-pattern

- ⛔ Ne PAS oublier `apple-mobile-web-app-capable` meta tags (sinon iPad ouvre dans Safari normal)
- ⛔ Ne PAS oublier `viewport-fit: cover` (sinon notch iPhone mal géré)
- ⛔ Ne PAS skipper l'onboarding "Add to Home Screen" iOS (sinon perte data après 7j inactivité)
- ⛔ Ne PAS commit `.env.local` (uniquement `.env.example`)
- ⛔ Ne PAS oublier Periodic Background Sync 5j (bretelle 2 PWA pivot)
- ⛔ Ne PAS coder pour browser only — toujours tester iPad Pro physique au moins 1x/sprint
