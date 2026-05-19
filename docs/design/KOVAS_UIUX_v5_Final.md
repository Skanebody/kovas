# KOVAS — UI/UX V1 + V1.5 (positionnement final v5)

> **Document de référence canonique** — supersède toutes les versions précédentes (v2 HTML, v3 PDF, v4 wireframes).
>
> **Positionnement esthétique** : famille "productivité B2B sobre" (Synthex, Quora). **Pas fintech glass**.
> **Inspiration référence** : Synthex Experience Platform.
>
> **Authority** : ce document v5 fait foi sur tokens + sidebar + cards solides + accent chartreuse. CLAUDE.md §9 reste autorité sur règles produit globales.

---

## Repositionnement esthétique acté (final)

| Famille | Statut | Usage |
|---|---|---|
| **Productivité B2B sobre** (Synthex, Quora) | ✅ Famille principale | App produit complète |
| **Fintech "liquid glass"** (Payrix, Drippi, Ron fintech) | 🟡 Marketing only | kovas.fr landing, hero shots |
| Dark mode cinematic violet | ❌ Abandonné | — |
| Sidebar 240px label-visible (v4) | ❌ Abandonné v5 | Retour à 80px icon-only |

**Justification** : le glass poussé tue la lisibilité en prod et ne passe pas WCAG. Cards solides = meilleure perf, accessibilité, stabilité. Sidebar 80px = pattern Synthex, plus moderne, plus d'espace pour le contenu.

## Tokens canoniques (cf. globals.css)

```css
:root {
  /* Backgrounds */
  --bg-surface: #F5F7F4;       /* sage pâle — fond principal */
  --bg-surface-alt: #EEF2F0;
  --bg-card: #FFFFFF;

  /* Sidebar 80px sombre */
  --sidebar-bg: #0F1419;
  --sidebar-text: rgba(255,255,255,0.65);
  --sidebar-text-active: #FFFFFF;
  --sidebar-hover: rgba(255,255,255,0.06);

  /* Texte */
  --text-primary: #163144;     /* navy KOVAS conservé */
  --text-secondary: #5A6B78;
  --text-muted: #9BA8B2;

  /* ACCENT UNIQUE (signature v5) */
  --accent: #D4F542;           /* chartreuse */
  --accent-soft: #F4FAD9;
  --accent-deep: #A3C920;

  /* Bordures */
  --border: rgba(22,49,68,0.08);
  --border-strong: rgba(22,49,68,0.14);

  /* Ombres ultra-subtiles */
  --shadow-card: 0 1px 3px rgba(22,49,68,0.04);
  --shadow-card-hover: 0 4px 12px rgba(22,49,68,0.06);

  /* Statuts (5 figés inchangés v4) */
  --status-amber: #F59E0B;
  --status-blue: #3B82F6;
  --status-green: #10B981;
  --status-coral: #EF4444;
  --status-muted: #94A3B8;

  /* Diagnostic chips 8 types (inchangés v4) */
  /* DPE blue · AMIANTE orange · PLOMB coral · GAZ lime · ÉLEC violet
   * TERMITES cream · CARREZ indigo · ERP pink */

  /* Drama contextuel (3 usages uniquement) */
  --drama-bg: #0F2436;         /* navy plein */
  --drama-text: rgba(255,255,255,0.96);
  --drama-cyan-glow: #5FA5CB;

  /* Typo (inchangée v4) */
  --font-body: 'Urbanist', sans-serif;
  --font-display: 'Instrument Serif', serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Radius */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
  --r-xl: 24px; --r-2xl: 32px; --r-full: 999px;
}
```

**Hiérarchie typographique v5** :
- H1 page : Instrument Serif italic 48-56px
- KPI hero : Instrument Serif italic 64-72px **light weight**
- Section title : Urbanist 16px 700
- Body : Urbanist 14px 400
- Labels : Urbanist 12px 600 (**pas uppercase**)
- Mono : JetBrains Mono 13px 500

## Sitemap V1 (octobre 2026)

```
KOVAS
├── 🏠 Aujourd'hui              Dashboard du jour
├── 📁 Dossiers                  Liste filtrable
│   ├── [id]                     Détail + workflow 6 étapes
│   ├── Nouveau                  Wizard création
│   └── [id] mode mission        Drawer Drama navy
├── 📅 Planning                  Vue SEMAINE uniquement V1
├── 👥 Clients                   Liste recherchable
│   ├── [id]                     Vue simple (tabs V1.5)
│   └── Nouveau
├── 🏢 Biens                     Liste + recherche
│   └── [id]                     Caractéristiques + dossiers
├── 📈 Performance               KPI mois + GainTracker (bar chart pilules)
└── ⚙️ Compte                    4 sections V1
    ├── Profil
    ├── Entreprise
    ├── Abonnement
    └── Préférences
```

## V1.5 ajouts (3-6 mois post-launch)

- Page client tabs (Dossiers/Historique/Notes)
- Planning vues jour + mois + drag-drop
- **Mode mission offline complet (CRITIQUE)**
- 6 diagnostics progressifs (S3-S7 : +Carrez/Boutin/ERP → +Plomb → +Gaz → +Élec → +Termites)
- Certifications COFRAC UI + compteur DPE 1000 + alertes
- Photo profil + signature scannée
- Toggle annuel/mensuel + suggestion upgrade
- Personnalisation rapports + suivi téléchargement
- Notifications matrice (Resend + Push PWA)
- Apparence (densité, daltonien)
- RGPD enrichi

## Exclusions confirmées (jamais ou très loin)

- ❌ Facturation client (devis, factures, avoirs) — délégué Gestiondiag/Pennylane
- ❌ Messages clients — email/SMS natifs suffisent
- ❌ Multi-utilisateurs V1 — Cabinet tier Phase 2 M10+
- ❌ Marketing / lead gen / site vitrine — domaine kovas.fr séparé
- ❌ Recherche full-text rapports
- ❌ Sync calendrier externe — OAuth complexe, ICS export suffit V1
- ❌ Audit énergétique / DTG / marketplace MAR-RGE — CLAUDE.md §2 supprimés

## Navigation

### Desktop / Tablet ≥ 768px

**Sidebar sombre étroite 80px icon-only** (pattern Synthex) :
- `width: 80px`, `background: #0F1419`
- Icônes 24px stroke 1.75, blanc 60% opacity, 100% sur active
- Active state : barre chartreuse 3px à gauche
- Tooltip au hover (label complet)

### Mobile < 768px

Bottom tab bar 64px iOS-style :
- 5 tabs : Aujourd'hui · Dossiers · [+] FAB · Planning · Compte
- FAB central 56px chartreuse, ouvre bottom sheet "Nouveau"

## Cards — solid par défaut

```css
.card {
  background: var(--bg-card);   /* #FFFFFF */
  border: 1px solid var(--border);
  border-radius: var(--r-xl);   /* 24px */
  padding: var(--s-6);
  box-shadow: var(--shadow-card);
}
```

**Pas de glass dans l'app produit.** Glass = uniquement landing kovas.fr.

## Patterns signature à coder (V1.5 priorité)

### Bar chart pilules verticales arrondies

Le pattern le plus distinctif (Synthex image 1) :
- Chaque barre = pilule verticale (`border-radius = width/2`)
- Point optionnel au sommet en accent chartreuse
- Labels axe sous chaque barre, petits et discrets
- Tooltip flottant au hover

Usages : évolution missions, GainTracker, volume par diagnostic.

### Process flow Bézier (workflow signature)

Pattern Synthex image 12 pour le workflow 6 étapes :
- 2 colonnes × 3 lignes
- Connexions courbées (SVG path `Q` ou `C`)
- Couleurs : bleu plein (terminé→terminé), bleu pointillé (→en cours), coral pointillé (à risque), gris pointillé (à venir)

## Pill buttons — 5 variants v5

| Variant | Background | Color | Usage |
|---|---|---|---|
| **Primary navy** | `#163144` | white | Action principale (1/écran) |
| **Accent chartreuse** | `#D4F542` | `#163144` | CTA fort (max 1/écran) |
| **Outline** | transparent + border | text-primary | Secondaires |
| **Ghost** | transparent | text-secondary | Tertiaires |
| **Danger** | `#EF4444` | white | Suppression |

Tous : `border-radius: 999px`, `padding: 12px 20px`, `font-size: 13px`, `font-weight: 600`.

## Drama mode (3 contextes UNIQUEMENT)

- **Dashboard soir** (après 14h) : navy `#0F2436` + KPI blanc géant + glow cyan
- **Mode mission drawer** : navy plein + texte blanc + accent cyan
- **Marketing kovas.fr** : gradient cyan liquide + glass autorisé

Le reste de l'app reste en **Clear permanent** sage pâle.

## Pièges à éviter (gravés v5)

1. ❌ Glass partout en prod → cards solides
2. ❌ Couleurs accent multiples → UN seul (chartreuse)
3. ❌ Border-radius excessif sur micro-éléments
4. ❌ Backgrounds liquides en prod → marketing only
5. ❌ Bar charts sans labels → toujours garder axes discrets
6. ❌ Sidebar sombre + fond très clair pur → utiliser sage pâle pour cohérence

---

*Document version 2.0 — KOVAS UI/UX final v5*
*Productivité B2B sobre + grammaire Synthex/Quora — 2026-05-19*
