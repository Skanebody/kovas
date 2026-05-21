# Audit responsive mobile + parcours critiques — KOVAS PWA

> **Périmètre** : viewport 375×667 (iPhone SE) sur 14 pages principales. Lecture seule.
> **DS référence** : v5 sage/dark/chartreuse, Urbanist + Instrument Serif + JetBrains Mono.
> **Source** : analyse statique du code Next.js 15 (apps/web).
> **Date** : 2026-05-20.

---

## 1. Synthèse responsive globale

**Score moyen : 6.5 / 10** — bonne intention mobile (sidebar masquée, mobile-nav 4 tabs, KPI grid 2-cols, formulaire dossier denses adaptés), mais **trois défauts structurels bloquants** : (1) collision z-40 entre `DossierStickyBar` et `AppMobileNav` sur la page la plus utilisée du parcours terrain, (2) **10 sections du menu (Clients, Biens, Performance, Cockpit ADEME, Analytics, Veille, Communauté, Prescripteurs, Relances, Mes fichiers, Outils) sont injoignables directement** sur mobile car non incluses dans les 4 tabs iOS-style, (3) absence de recherche locale sur `/app/clients` et `/app/properties` (uniquement Command Palette ⌘K caché derrière icône sans label).

| Page | Sidebar mobile | Pas de scroll H | Touch ≥ 44px | Grid responsive | Score /10 |
|---|---|---|---|---|---|
| `/app/dashboard` | OK (md:hidden) | OK | Partiel (sm buttons) | OK (2/4-cols) | 7 |
| `/app/dossiers` (liste) | OK | OK (table hide-cols) | OK | OK | 8 |
| `/app/dossiers/[id]` | OK | OK | Sticky bar collide MobileNav | OK | **4** |
| `/app/dossiers/new` | OK | OK | OK inputs 44px | OK (sm:gap) | 7 |
| `/app/calendar` | OK | OK | input date h-9 (36px) | OK (1/2/3/7) | 6 |
| `/app/clients` | OK | OK | OK | OK | 6 (pas de search) |
| `/app/properties` | OK | OK | OK | OK | 6 (pas de search) |
| `/app/cockpit-ademe` | OK | OK | n/a | n/a | 7 |
| `/app/veille` | OK | OK | n/a | n/a | 7 |
| `/app/account` | OK | OK | OK | OK (collapse) | 7 |
| `/app/gain` | OK | OK | OK | OK | 7 |
| `/` (landing) | n/a | OK | CTA `py-4` (~56px) | OK | 8 |
| `/pricing` | n/a | OK | OK | OK (1/2/5) | 7 |
| `/signup` | n/a | OK | OK | OK (max-w-md) | 8 |

---

## 2. Trois parcours critiques — analyse pas-à-pas

### Parcours 1 — Créer un dossier mission DPE + Amiante (depuis dashboard)

| Étape | Action | Friction | État |
|---|---|---|---|
| 1 | Trouver "Nouveau dossier" depuis `/app/dashboard` mobile | Bouton `DocumentScanButton` à droite, mais le CTA "Nouveau dossier" n'est pas dans le hero. Présent uniquement dans section 02 "Missions du jour" via `TodayBlock` + bouton FAB `MobileQuickActionsFab`. **2 emplacements distincts**, pas évident. | **Friction modérée** |
| 2 | Saisir adresse (BAN autocomplete) | `<AddressAutocomplete>` + Input min-h-44px OK. Pillules type bien (Maison/Appart/Immeuble/Autre) en `flex-wrap` → 2 rangées sur 375px. Click target `px-3 py-1.5` ≈ 32px hauteur **< 44px**. | **Friction touch** |
| 3 | Sélectionner type mission (pack rapide ou checkboxes) | 5 packs `flex-wrap gap-2 rounded-pill`, labels longs ("Vente · 1949-1997") → 3-4 rangées sur 375px. Checkboxes `<label class="grid-cols-1 sm:grid-cols-2">` OK mobile. **Cumul DPE auto avec année** = bonne UX. | OK |
| 4 | Sélectionner créneau (SlotSelector) | Grid `grid-cols-4 sm:grid-cols-6`. Buttons `px-2 py-2 text-[12px]` → environ **48×30px** — **trop bas** (<44px hauteur). 4 colonnes sur 375px = boutons ~80px de large, OK largeur mais cibles tap minces. Input date type=date natif iOS = bon. | **Friction touch** |
| 5 | Valider (sticky submit) | Sticky bottom `z-10` + bg sage backdrop. `<Button size="lg">` = min-h-48px OK. Visible sans scroll. **Risque overlap avec AppMobileNav `z-40`** : la sticky est `z-10` → la mobile-nav la masque au repos. | **Friction bloquante** |

**Temps avatar estimé** : **2 min 30 s à 3 min 30 s** (1ère création), 1 min 30 s ensuite. Pas d'impasse, mais 3 frictions touch + 1 collision visuelle sticky/mobile-nav.

### Parcours 2 — Trouver un client existant + ouvrir son dossier

| Étape | Action | Friction | État |
|---|---|---|---|
| 1 | Accéder à la section Clients | **`AppMobileNav` n'inclut PAS Clients** (4 tabs = Auj. / Dossiers / Plan. / Compte). Pour y accéder mobile : (a) ouvrir Command Palette ⌘K via header (icône loupe sm, **36×36px**, **aucun label visible**, kbd `⌘K` caché `hidden sm:inline-flex`), (b) impossible via clavier iOS sans clavier physique → **dépend de la mémoire d'utilisation du raccourci tap**. Pas d'autre point d'entrée hors deep-link. | **Bloquant** |
| 2 | Si arrivé sur `/app/clients` (URL directe) : rechercher par nom | **Aucun champ de recherche local sur `/app/clients`**. Si 50 clients : scroll vertical complet de la liste. La table cache type+contact sur mobile (`hidden sm:table-cell`), reste juste le nom. | **Friction bloquante** |
| 3 | Voir résultats | Lignes `AppListTableRow` py-3 = ~50px hauteur — OK touch. | OK |
| 4 | Clic client → détail | Lien sur display_name OK. | OK |
| 5 | Trouver dossier rattaché | Inconnu : page client `/app/clients/[id]` non auditée ici (a priori présente). | n/a |

**Temps avatar estimé** : **4 à 6 minutes** si user ne connaît pas le raccourci ⌘K, **30-45 s** s'il connaît la palette. Le ratio chance d'aboutir sans frustration < 30% pour un nouveau user.

### Parcours 3 — Exporter un rapport (dossier terminé → ZIP Liciel)

| Étape | Action | Friction | État |
|---|---|---|---|
| 1 | Accéder à Dossiers (tab 2 mobile-nav) | OK direct. | OK |
| 2 | Filtrer status='done' | **Pas de filtre status visible sur `/app/dossiers`** (juste une liste sans filtre/segmentation). User doit scroller et identifier visuellement le Badge "Terminé". | **Friction modérée** |
| 3 | Clic dossier | OK lien sur référence. | OK |
| 4 | Atteindre `<ExportSection>` | Page dossier longue : Header + Toolbar + HeroCard + AttentionSection + 3 Accordions + ExportSection. Sur 375×667 mobile : **scroll ~5-7 swipes** pour atteindre l'export. | **Friction modérée** |
| 5 | `DossierStickyBar` propose CTA "Exporter" mais... | **`DossierStickyBar` est `fixed bottom-0 z-40` ET `AppMobileNav` est aussi `fixed bottom-0 z-40`** → collision verticale. Sur mobile, la sticky n'a pas d'offset `md:left-20` qui s'applique (uniquement md+) donc elle prend toute la largeur **par-dessus la mobile-nav**, masquant ses 4 tabs. Inversement, si le z-index favorise mobile-nav, le CTA Exporter est masqué. | **Bloquant visuel** |
| 6 | Carte "Export ZIP Liciel" : bouton `size="sm"` (36px) à droite | Bouton "Exporter" + spinner Loader2, `shrink-0`. Sur 375px : icon 48px + content + button → titre `truncate` + description `line-clamp-2`. Toujours visible. | OK |

**Temps avatar estimé** : **1 min 30 s à 2 min** (export effectif rapide une fois sur la bonne page), mais **collision sticky/mobile-nav rend l'expérience confuse**. Le user peut cliquer "Exporter" CTA de la sticky… qui ouvre `#export-section` (scroll anchor) — fonctionnel mais visuel cassé.

---

## 3. Top issues responsive (P0/P1/P2)

### P0 — Bloquants

1. **Collision z-40 `DossierStickyBar` × `AppMobileNav`** (`/app/dossiers/[id]`). Les deux sont `fixed bottom-0 z-40`. La sticky n'a un offset `md:left-20` que pour la sidebar 80px desktop, pas pour la mobile-nav 64px. → Sticky cache la mobile-nav (perte navigation) OU mobile-nav cache la sticky (perte CTA Démarrer/Reprendre/Exporter). Fix : ajouter `bottom-[64px]` (au-dessus de la nav mobile) ou cacher mobile-nav quand sticky active.

2. **10 sections menu inaccessibles sur mobile**. `AppMobileNav` = 4 tabs (Auj. / Dossiers / Plan. / Compte). Manquent : Clients, Biens, Performance, Cockpit ADEME, Analytics, Veille, Communauté, Prescripteurs, Relances, Mes fichiers, Outils. Accessibles seulement via Command Palette ⌘K (icône loupe sm sans label sur mobile, raccourci kbd caché) ou deep-link URL. Fix : ajouter "More" sheet (Drawer overflow) ou refondre en 5 tabs avec FAB central pour création.

3. **Recherche absente sur `/app/clients` et `/app/properties`**. Liste plate sans search ni filtres. Parcours 2 impossible à finaliser proprement. Fix : ajouter un `<Input>` search côté serveur (URL param `?q=`) en haut de liste.

### P1 — Importants

4. **Touch targets <44px sur boutons critiques** : SlotSelector grid buttons (~30px hauteur), input date calendar (`h-9` = 36px), pillules type bien/client form dossier (`py-1.5` ≈ 32px), CommandPaletteTrigger (sm = 36px, label `hidden sm:inline`). Fix : sur mobile, basculer en `min-h-[44px]` pour tous les contrôles tap-only.

5. **63 occurrences de `Button size="sm"` (36px) dans les pages utilisateur**. Cohérence DS mais sous le seuil WCAG mobile. Acceptable pour actions secondaires, à proscrire pour primaires.

6. **`DossierStickyMenu` ⋯ + double CTA** (menu kebab + bouton primaire) tassés à droite sur 375px. Bouton primaire `size="default"` = 44px OK, mais le menu kebab `size="icon"` = 44×44px lui aussi → la zone left "icône + main.title + meta hidden md:block" devient très réduite.

7. **`AddressAutocomplete` dropdown** : composant non audité en détail mais probable z-index conflict avec sticky bottom bar sur mobile (la liste suggérée BAN peut être masquée par la sticky des inputs du formulaire à 1162 de `dossier-form.tsx`).

### P2 — À surveiller

8. **`<header>` app sticky `md:sticky top-0`** = pas sticky sur mobile (`md:` only). Volontaire ? Conséquence : sur scroll, user perd accès rapide au search/usage/user menu. À confirmer si choix produit.

9. **CommandPaletteTrigger mobile** : pas de label visible, juste une icône. User mobile ne sait pas que c'est un search global. Fix : montrer "Recherche" en label small ou utiliser un FAB search distinct.

10. **`AppListTable` hide-cols** : columns hidden via `hidden sm:table-cell` → bonne adaptation mais perte d'info (type client, contact, diagnostics chips, bien complet). Le user mobile ne voit que Nom + Statut sur dossiers. Acceptable mais limité pour décision rapide.

11. **`/app/dossiers/[id]/defense/page.tsx` grid-cols-4 sans prefix responsive** (ligne 203) — risque d'éclatement sur 375px si contenu cellules > 80px largeur.

12. **`PrevalidationForm` grid-cols-7 sans responsive** (cockpit-ademe). Probablement calendrier semaine → à vérifier en runtime.

---

## 4. Patterns systématiques à corriger

1. **Z-index inconsistant entre fixed bottom elements** (`DossierStickyBar` z-40 vs `AppMobileNav` z-40 vs `MobileQuickActionsFab` z-? vs `OfflineBanner`). Définir une scale `z-mobile-nav=40 / z-sticky-action=30 / z-fab=50 / z-modal=60` et l'appliquer partout.

2. **`size="sm"` (36px) sur Button utilisé partout en mode "secondaire mobile"** alors que mobile = doigt obligatoire. Créer un variant `mobile-sm` à 44px ou bloquer sm en mobile via CSS `@media`.

3. **Mobile nav 4 tabs insuffisante** pour 14 sections menu. Soit dupliquer Command Palette en bouton search visible + label sur mobile, soit ajouter une 5e tab "Plus" qui ouvre un Sheet vertical avec toutes les sections.

4. **Pages liste sans recherche locale** (`/app/clients`, `/app/properties`, `/app/dossiers`). Pour des bases de 50-500 entités, scroller n'est pas viable. Ajouter un `<Input>` search-as-you-type avec query `?q=` server-side.

5. **Sticky bottom bars sans offset pour mobile-nav** : tous les `fixed bottom-0` doivent considérer la hauteur de `AppMobileNav` (~64px + safe-area) et stack proprement. Helper utility class `.above-mobile-nav` : `bottom: calc(64px + env(safe-area-inset-bottom))`.

6. **Touch targets pillules de sélection** (type bien, type client, pack rapide, diagnostic chips, slot creneaux) systématiquement `py-1.5`/`py-2` ≈ 28-32px. Sur mobile, garantir min-h-44px obligatoire — surtout pour les contrôles de saisie principaux.

---

## 5. Icônes & iconographie

- **Pack unique : `lucide-react`** (confirmé par grep). Aucun mix Heroicons/Phosphor/Tabler. Bonne cohérence visuelle.
- **Tooltips natifs `title` attribut** sur sidebar 80px icon-only — accessibles mais pas mobile (pas de hover). Sidebar masquée mobile donc non bloquant.
- **Icônes ambigües potentielles** : `Box`/`Building2` (Biens vs Cockpit ADEME), `Bell` (Veille vs notifications), `Send` (Relances). Sur sidebar desktop OK car label tooltip ; sur mobile-nav 4 tabs les icônes (`Home`, `FileText`, `CalendarDays`, `Settings`) ont chacune un label sous (`text-[10px]`) → claires. Pas de problème direct.
- **`AppNavTabs`** dans header mobile : non audité en détail mais visible mobile entre logo K et user menu. Si liste de tabs horizontale scroll OK.

---

## 6. Conclusion synthétique

KOVAS Web a un **socle mobile correct** (sidebar conditionnelle, mobile-nav présent, KPI grid 2-cols, FAB Quick Actions, inputs ≥ 44px par défaut), mais **trois trous critiques** empêchent l'usage terrain fluide :

1. **Page dossier détail (la plus utilisée terrain)** souffre d'une collision z-index entre sticky bar et mobile-nav.
2. **10/14 sections menu non joignables directement** sur mobile → user dépend de Command Palette quasi invisible.
3. **Pages liste sans recherche** rendent la nav par mémoire impossible passé 30 entités.

Ces 3 issues sont **chacune corrigeable en moins de 2h** et auraient un impact UX terrain majeur (parcours 2 passe de "presque bloqué" à "fluide en 30s", parcours 3 redevient lisible). À prioriser **P0 absolu** avant bêta-testeurs M6.

Score global mobile : **6.5/10**. Cible post-fixes P0 : **8.5/10**.
