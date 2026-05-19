# Ron Design Lab → KOVAS — Synthèse design (19.05.2026)

> Analyse complète (HTML interactif) : voir `ron-design-lab-analyse-kovas.html` dans ce dossier.  
> Sources : rondesignlab.com, cases Tectra · Lumos · Tenancy.

## TL;DR

- **Ne pas** appliquer le registre *marketing* Ron (typo 120px, avatars inline, multi-pastels, emojis partout) dans l’**app métier** (8 h/jour, terrain + bureau).
- **Reprendre** le registre *produit* Ron : **light mode** dominant, **Outfit** + **Instrument Serif** en italique sur les mots-clés, **pills** full-rounded, **KPIs hero** en gros chiffres, ombres **douces** (pas de glow violet).
- **Écarter** : dark cinematic, `#7C6FFF`, glows colorés systématiques.

## Deux registres Ron

| | Site marketing Ron | Apps clients (Tectra, Lumos, Tenancy) |
|---|---|---|
| Densité | Très aérée | Plus dense, data + tables |
| Typo | 60–120px expressive | 32–48px hero, 14–16px corps |
| Inline dans titres | Oui (avatars) | Non |
| Couleurs | Multi-pastels | 1 accent chaud + sémantiques |
| Mode | Light | Light (dark optionnel) |

**KOVAS** : marketing `kovas.fr` → registre 1 ; **PWA / app** `/app/*` → registre 2.

## Patterns — verdict produit KOVAS

| Pattern | Verdict |
|---------|---------|
| Light + 1 accent chaud | **Keep** |
| Outfit + Instrument Serif italic (KPIs, titres) | **Keep** |
| Pill buttons (CTA, badges, statuts) | **Keep** |
| KPIs hero dramatisés (cockpit) | **Keep** |
| Ombres douces (y 8–24, blur 30–60, ~6–12% opacité) | **Keep** |
| Asymétrie + whitespace | **Adapt** (hero oui, listes/data plus grille) |
| Emojis micro-copy | **Adapt** (onboarding, empty states — pas facturation) |
| Multi-pastels | **Adapt** (marketing seulement) |
| Inline typo (avatars) | **Maybe** (welcome / email) |
| Dark cinematic + glows | **Drop** |
| Violet `#7C6FFF` marque | **Drop** |

## Écart avec KOVAS aujourd’hui (mai 2026)

- **Doc / tokens** (`docs/design-system.md`, `globals.css`) : navy `#0F1E3D`, glass, light + dark — **proche du registre produit**, pas du violet cinematic.
- **Landing** (`apps/web/src/app/page.tsx`) : fond **noir** marketing — à rapprocher du registre Ron *marketing* (crème + accent) si on suit cette analyse à la lettre.
- **Typo** : pas encore Outfit / Instrument Serif dans le repo.

## Décisions proposées (à valider)

1. **Accent** : **bleu calmant (confiance / métier) + jaune énergique (alertes, actions, compteur DPE)** — aligné Tectra ; orange réservé au marketing ou secondaire.
2. **Mode par défaut** : **light** dans l’app ; dark en préférence utilisateur (soirée bureau), pas cinematic par défaut.
3. **Premier écran design** : **cockpit matin** (tournée du jour) — définit la grammaire pour le reste.

## Implémentation Design System v2 (19.05.2026 — 3e itération)

### Historique des révisions

| Date | Version | Décision |
|---|---|---|
| 2026-05-18 | v0 | Navy KOVAS `#0F1E3D` + Manrope + glassmorphism monochrome |
| 2026-05-19 (J39) | v1 | Pivot Ron Design Lab × Tectra : cobalt `#2C3FA8` + Outfit + butter pastel `#FFE89C` |
| **2026-05-19 (v2)** | **v2 actif** | **Synthèse** : retour navy + Manrope + ambre `#D97706` chaud + 5 pastels catégoriels + JetBrains Mono + StatusPill + MissionCard |

### Référence canonique v2

- **Document visuel exhaustif** : [`docs/design/kovas-design-system-v2.html`](kovas-design-system-v2.html) — palette + composants + écrans exemples
- **CLAUDE.md §9** : règles canoniques + tokens + composants
- **Tokens CSS HSL** : [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css) (light + dark)
- **Tokens Tailwind** : [`apps/web/tailwind.config.ts`](../../apps/web/tailwind.config.ts)
- **Fonts** : [`apps/web/src/app/layout.tsx`](../../apps/web/src/app/layout.tsx) — Manrope + Instrument Serif + JetBrains Mono

### Composants UI v2

- [`Card`](../../apps/web/src/components/ui/card.tsx) — 4 variants : flat (défaut) / glass / accent / **warm (NEW)**
- [`Button`](../../apps/web/src/components/ui/button.tsx) — variant **warm (NEW v2, ambre saturé)** ajouté
- [`Badge`](../../apps/web/src/components/ui/badge.tsx) — 9 variants : default/outline/muted/blue/green/red/orange/yellow + **amber (NEW)**
- [`StatusPill`](../../apps/web/src/components/ui/status-pill.tsx) — **NEW v2** — dot animé pulse 2s (amber en cours)
- [`MissionCard`](../../apps/web/src/components/ui/mission-card.tsx) — **NEW v2** — heure mono + tags pastels + actions
- [`KpiHero`](../../apps/web/src/components/ui/kpi-hero.tsx) — signature Ron (Instrument Serif italic 60-72px)
- [`GainTrackerCard`](../../apps/web/src/app/app/dashboard/gain-tracker-card.tsx) — refonte v2 : card navy + glow ambre radial + chiffre Instrument Serif 80px

### Mapping pastels catégoriels

[`lib/mission-pastels.ts`](../../apps/web/src/lib/mission-pastels.ts) :
- DPE/ERP → butter (#FFF0C5)
- Électricité → lime (#E5F0D5)
- Amiante/Termites → peach (#FFE0D5)
- Plomb → lavender (#E8E0F5)
- Gaz/Carrez → sky (#DAE8F5)

**Reste** (chantiers à venir refonte 8 chantiers) :
- P1 — Dashboard hero refondu avec strates v2
- P2 — Drill-down `/app/gain` (GainTracker page détail)
- P4 — Onboarding day 1 expérience
- Landing `page.tsx` à rapprocher du registre marketing Ron
