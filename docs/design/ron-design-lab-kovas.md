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

## Implémentation (19.05.2026)

- Tokens crème + cobalt + jaune : `apps/web/src/app/globals.css`
- Polices **Outfit** + **Instrument Serif** : `apps/web/src/app/layout.tsx` (`defaultTheme="light"`)
- Cockpit KPI hero : `apps/web/src/app/app/dashboard/cockpit-hero.tsx` + `components/ui/kpi-hero.tsx`
- Dashboard hero : `apps/web/src/app/app/dashboard/page.tsx`

**Reste** : landing marketing `page.tsx` (noir → crème éditorial), compteur DPE jaune (F7).
