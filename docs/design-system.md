# KOVAS Design System — Glassmorphism Premium Soft UI

> ⚠️ **DEPRECATED depuis 2026-05-19** — Ce document décrit la palette navy KOVAS + Manrope abandonnée.
> **Référence canonique actuelle** :
> - [CLAUDE.md §9](../CLAUDE.md) — tokens + règles strictes Ron Design Lab × Tectra (crème + cobalt + butter, Outfit + Instrument Serif italic)
> - [docs/design/ron-design-lab-kovas.md](design/ron-design-lab-kovas.md) — analyse + grille de décision pattern-par-pattern
> - [apps/web/src/app/globals.css](../apps/web/src/app/globals.css) — implémentation tokens HSL
> - [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts) — utilities Tailwind
>
> Le contenu ci-dessous est conservé en référence historique (palette navy `#0F1E3D` + Manrope) mais **ne reflète plus** le système actif.

## 1. Tokens CSS

Variables exposées dans `apps/web/src/app/globals.css` (root `:root` + `.dark`).

### Couleurs (HSL pour compat `hsl(var(--x) / alpha)`)

```css
:root {
  /* Surfaces */
  --bg-gradient-from: 220 24% 97%;       /* #F5F7FA */
  --bg-gradient-to: 220 17% 94%;         /* #EDF0F5 */
  --card: 0 0% 100%;                     /* blanc card (avec opacité 0.85 via bg-card/85) */
  --card-accent: 218 60% 15%;            /* #0F1E3D navy card pleine */
  --glass-border: 0 0% 100%;             /* rgba(255,255,255,0.4) via bordure utility */

  /* Navy KOVAS (primaire) */
  --primary: 218 60% 15%;                /* #0F1E3D */
  --primary-hover: 218 50% 21%;          /* #1A2F52 */
  --primary-foreground: 0 0% 100%;

  /* Texte */
  --foreground: 218 24% 11%;             /* #1F2937 body */
  --muted-foreground: 220 9% 46%;        /* #6B7280 secondaire */
  --subtle-foreground: 220 14% 65%;      /* #9CA3AF tertiaire */

  /* Borders */
  --border: 220 13% 91%;                 /* #E5E7EB */
  --border-glass: 218 60% 15% / 0.08;    /* navy 8% pour bordures glass */

  /* Accents (badges/status — JAMAIS surface large) */
  --accent-blue: 217 91% 60%;            /* #3B82F6 */
  --accent-red: 0 84% 60%;               /* #EF4444 */
  --accent-orange: 38 92% 50%;           /* #F59E0B */
  --accent-green: 158 64% 52%;           /* #10B981 */

  /* Ombres tokens (raw) */
  --shadow-glass: 0 4px 24px rgba(15, 30, 61, 0.04), 0 1px 2px rgba(15, 30, 61, 0.02);
  --shadow-glass-hover: 0 8px 32px rgba(15, 30, 61, 0.08), 0 2px 4px rgba(15, 30, 61, 0.04);
  --shadow-cta: 0 4px 16px rgba(15, 30, 61, 0.2);
  --shadow-cta-hover: 0 6px 24px rgba(15, 30, 61, 0.3);
  --shadow-badge-blue: 0 2px 8px rgba(59, 130, 246, 0.3);
  --shadow-badge-red: 0 2px 8px rgba(239, 68, 68, 0.3);

  /* Radius */
  --radius-card: 20px;
  --radius-card-inner: 16px;
  --radius-button: 12px;       /* boutons rectangulaires non-pill */
  --radius-pill: 100px;        /* CTA + tabs + badges ronds */
  --radius-input: 12px;
}

.dark {
  --bg-gradient-from: 220 50% 7%;        /* #0A0F1A */
  --bg-gradient-to: 220 40% 10%;
  --card: 0 0% 100% / 0.05;
  --card-accent: 220 30% 23%;            /* #1E2A47 */
  --foreground: 220 14% 96%;             /* #F9FAFB */
  --muted-foreground: 220 9% 65%;
  --border: 0 0% 100% / 0.08;
  --primary: 0 0% 100%;
  --primary-foreground: 218 60% 15%;
  --accent-blue: 213 94% 68%;            /* #60A5FA */
  --accent-red: 0 91% 71%;               /* #F87171 */
  --accent-orange: 43 96% 56%;           /* #FBBF24 */
  --accent-green: 158 64% 52%;           /* #34D399 */
}
```

### Typo

| Token | Tailwind class | Usage |
|---|---|---|
| `text-h1` | `text-4xl font-extrabold tracking-tight` | H1 page (36px) |
| `text-h2` | `text-2xl font-bold tracking-tight` | H2 section (24px) |
| `text-h3` | `text-lg font-semibold` | H3 (18px) |
| `text-h4` | `text-base font-semibold` | Card title (16px) |
| `text-body` | `text-sm` | Texte courant (14px) |
| `text-caption` | `text-xs font-medium` | Caption (12px) |
| `text-micro` | `text-[11px] font-semibold tracking-wider uppercase` | Badges (11px) |

## 2. Composants

### Button

| Variant | Style |
|---|---|
| `default` | Navy fill pillule + ombre CTA + hover lift -1px |
| `outline` | Bordure navy 10% + bg blanc 80% + hover navy 100% |
| `ghost` | Pas de fond + hover bg navy 4% |
| `destructive` | Rouge fill + ombre rouge |
| `icon` | Cercle 40px, bg blanc 80%, bordure navy 8% |

CTA toujours en pillule (`rounded-full`), padding `12px 32px`, font-weight 600.

### Card

```tsx
// Card glass standard (défaut)
<Card />
// = bg-card/85 backdrop-blur-xl border border-glass-border rounded-[20px] shadow-glass

// Card mise en avant (CTA visuel fort)
<Card variant="accent" />
// = bg-primary text-primary-foreground rounded-[16px] shadow-cta
```

### Badge

| Variant | Couleur fond | Texte |
|---|---|---|
| `blue` | `#3B82F6` 15% | navy + ombre légère bleue |
| `red` | `#EF4444` 15% | rouge profond |
| `orange` | `#F59E0B` 15% | orange profond |
| `green` | `#10B981` 15% | vert profond |
| `muted` | gris 10% | gris foncé |
| `default` | navy 90% | blanc |

### Tabs (pillules navigation)

- Container : `bg-card/60 backdrop-blur-md rounded-full p-1 flex gap-1`
- Tab actif : `bg-primary text-primary-foreground rounded-full px-6 py-2 font-semibold text-sm`
- Tab inactif : `text-muted-foreground hover:text-foreground rounded-full px-6 py-2 font-medium text-sm`

### IconButton circulaire

```tsx
<IconButton aria-label="...">
  <Plus className="size-4" />
</IconButton>
// = size-10 rounded-full bg-card/80 border border-glass-border hover:shadow-glass
```

### Donut statistique (V1.5)

Recharts, structure :
- `innerRadius: 50, outerRadius: 60` (donut épais)
- `cornerRadius: 10` (segments arrondis)
- `paddingAngle: 2`
- Centre : valeur en `text-3xl font-bold` + label `text-xs text-muted-foreground`

Couleurs segments : `#3B82F6` (bleu) / `#10B981` (vert) / `#EF6B5C` (corail).

## 3. Patterns layout

### App shell

```
┌────────────────────────────────────────────────────────────┐
│ Header sticky bg-card/70 backdrop-blur-xl border-b         │
│ [Logo]  Tabs pillules    🔍 🔔 👤                          │
├──┬─────────────────────────────────────────────────────────┤
│  │                                                          │
│ S│  <main> avec bg-gradient page                            │
│ B│                                                          │
└──┴─────────────────────────────────────────────────────────┘
```

- Sidebar verticale 64px (desktop) ou bottom-nav (mobile)
- Padding main : `p-6 md:p-8`
- Max-width : `max-w-6xl mx-auto`

### Background page

Sur `<body>` ou `<main>` :
```css
background: linear-gradient(135deg, hsl(var(--bg-gradient-from)) 0%, hsl(var(--bg-gradient-to)) 100%);
min-height: 100dvh;
```

### Animations

| Élément | Durée | Easing |
|---|---|---|
| Hover (card lift, button) | 0.2s | ease |
| Apparition card | 0.3s | ease |
| Modal/popover | 0.25s | cubic-bezier(0.4, 0, 0.2, 1) |
| Skeleton loaders | 1.5s | pulse infinite |

**Interdits** : parallax, particules, confettis, effets 3D, animations gaming.

## 4. Application pages

| Page | Pattern |
|---|---|
| Landing (kovas.fr) | Hero gradient navy + cards glass features |
| Login / signup | Card centrée glass, max-w-md, fond gradient |
| Dashboard | Grille blocs cards glass, 1/2/3 cols responsive |
| Mission/dossier détail | Card pleine page + WorkflowStepper linéaire |
| Listing (clients/biens/dossiers) | Table sobre + filtres pillules + recherche |
| Paramètres | Sections empilées |
| Mode tournée (V1.5) | Plein écran, gros boutons, simplifié |

## 5. Hors-scope

- **Workflow Bézier 4 colonnes connectées** : rejeté V1 (overkill). On garde `WorkflowStepper` linéaire jusqu'à preuve du contraire en V2.
- **Drag-and-drop blocs dashboard** : V2 (`user_dashboard_preferences`).
- **Donuts** : V1.5 (Recharts pas dans deps actuels).
- **Avatars équipe** : Phase 2 Cabinet uniquement.
- **Composants `Kovas*` parallèles à shadcn** : on ne crée PAS de doublons. On étend `Button` / `Card` / `Badge` existants.
