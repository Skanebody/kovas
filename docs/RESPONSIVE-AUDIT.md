# KOVAS — Audit Responsive (Lot H)

Date : 2026-05-22

## Patterns appliqués

- **Mobile-first** : classes Tailwind sans préfixe = mobile, `sm:` / `md:` / `lg:` = overrides progressifs
- **Touch targets** : minimum `h-12` (48px) sur mobile, dégradé à `h-10` (40px) desktop via `h-12 md:h-10`
- **Grilles** : `grid-cols-1 sm:grid-cols-2` au lieu de `grid-cols-2` brut
- **Gaps** : `gap-2 sm:gap-3` au lieu de `gap-3` figé
- **Typography hero** : `text-3xl sm:text-5xl` au lieu de `text-5xl` figé
- **Container fluide** : `mx-auto w-full max-w-7xl px-4 md:px-8` partout
- **Tables** : déjà toutes wrappées dans `overflow-x-auto` (vérifié devis, défense, analytics)
- **Bottom sheets / drawers** : composant `ResponsiveSheet` partagé (mergé Lot G) — bottom-sheet mobile, drawer 480px desktop

## Fichiers corrigés (Lot H direct sur main, 7 fichiers)

| Fichier | Problème | Fix |
|---|---|---|
| `dashboard/dashboard/page.tsx` | `space-y-10` figé + `text-[32px]` H1 sans variant | `space-y-6 md:space-y-10` + `text-[24px] md:text-[32px]` |
| `dashboard/dashboard/cette-semaine-section.tsx` | KPI grid 2 colonnes écrasés sur mobile | `grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3` |
| `dashboard/leads/lead-focal-card.tsx` | Boutons "Envoyer devis" / "Plus tard" en grid-cols-2 sur 360px | `grid-cols-1 sm:grid-cols-2` |
| `dashboard/dossiers/new/step-1-property-client.tsx` | Formulaire année/surface en 2 cols écrasées | `grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3` |
| `dashboard/dossiers/[id]/mission/consolidation-summary-modal.tsx` | Stats hero 3 cards en mode `grid-cols-3` sur mobile | `grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3` |
| `dashboard/dossiers/[id]/mission/voice-recorder-modal.tsx` | Compteur audio `text-5xl` déborde viewport iPhone SE | `text-3xl sm:text-5xl` |
| `dashboard/account/settings-search.tsx` | Input recherche `h-10` sous le seuil Apple HIG 44px | `h-12 md:h-10` |

## Pages déjà responsive (pas de touche nécessaire)

Vérifiées et conformes mobile-first :
- `dashboard/calendar/calendar-week-view.tsx` — `overflow-x-auto` + `min-w-[840px]` (scroll horizontal accepté)
- `dashboard/devis/[id]/page.tsx` — table dans `overflow-x-auto -mx-2 px-2`
- `dashboard/dossiers/[id]/defense/page.tsx` — table dans `overflow-x-auto`
- `dashboard/analytics/benchmark-comparison.tsx` — table dans `overflow-x-auto`
- Pages `v5simp/*` (PropertyIdentitySection, ClientIdentitySection, PropertyGallerieSection, PropertyContexteLocalSheet) — déjà mobile-first par design
- `app/page.tsx` (landing), `app/pricing/page.tsx` — refonte récente déjà responsive

## Composants partagés responsive (déjà mergés)

Disponibles dans toute l'app (Lot G principalement) :
- `ResponsiveSheet` — bottom-sheet mobile (vaul) / drawer 480px desktop
- `Toast` provider — toasts fixed bottom 320px max
- `CommandK` — palette Cmd+K (raccourci optionnel via `enableShortcut`)
- `SavedIndicator` — `useAutoSave` 3s debounce
- `useHaptic` — `navigator.vibrate(10)` no-op si non supporté
- `SkeletonLoader` — bandes navy 5% stripe animées
- `LinearProgress` — barre 1px navy top-fixed
- `KpiHero` — Instrument Serif italic clamp(60-120px)
- `StatusPill` — 5 variants (blue/amber/green/coral/muted) avec pulse-soft
- `DiagnosticChip` — 8 types pastels (DPE/AMIANTE/PLOMB/GAZ/ELEC/TERMITES/CARREZ/ERP)

## Layout principal (dashboard/layout.tsx)

- **Sidebar 80px** desktop (`hidden md:flex w-20`) ↔ **bottom nav 64px** mobile (`flex md:hidden h-16`)
- **Container main** : `flex-1 px-4 md:px-8 py-4 pb-24 md:pb-8 w-full max-w-7xl mx-auto min-w-0`
- **Header app** sticky avec `glass-opaque rounded-pill`, hidden tabs sous `md:` qui réapparaissent au mobile via le mini-logo + AppNavTabs

## Checklist future (pour les nouvelles pages KOVAS)

- [ ] Container `max-w-7xl mx-auto px-4 md:px-8`
- [ ] Boutons primary : `h-12 md:h-10` minimum
- [ ] Inputs : `h-12 md:h-10` minimum
- [ ] Grids : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` (jamais figé)
- [ ] Gaps : `gap-2 sm:gap-3` ou `gap-3 md:gap-4`
- [ ] Typography H1 : `text-2xl md:text-3xl lg:text-4xl`
- [ ] Typography KPI hero : utility `kpi-hero` ou `text-3xl sm:text-5xl md:text-7xl`
- [ ] Tableaux : wrap dans `overflow-x-auto` OU prévoir version cards `flex md:hidden flex-col`
- [ ] Modales/actions : utiliser `ResponsiveSheet`, jamais `Dialog` central pour actions secondaires
- [ ] Pas d'interactions hover-only (tap accessible sur mobile)
- [ ] Tester sur Pixel 5 (393px) + iPad 768px + desktop 1280px minimum via Playwright

## Tests

Suites E2E responsive disponibles (Lot Q-TESTS) :
- `tests/e2e/responsive-mobile.spec.ts` — Pixel 5 viewport
- `tests/e2e/responsive-tablet.spec.ts` — iPad Pro 11 viewport
- Projects Playwright : `chromium`, `webkit`, `firefox`, `Pixel 5`, `iPhone 13`, `iPad Pro 11`, `a11y`
