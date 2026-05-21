# Audit UI/UX — Pages utilisateur principales

Date : 2026-05-20 · périmètre : `/app/dashboard`, `/app/dossiers/*`, `/app/calendar`, `/app/clients/*`, `/app/properties/*`, `/app/outils/*`, `/app/relances`.

Audit lecture seule. Aucun fichier de code modifié. Référentiel : `docs/design/KOVAS_UIUX_v5_Final.md` (DS v5 — sage `#F5F7F4`, dark `#0F1419`, chartreuse `#D4F542`).

---

## Synthèse — Top 10 issues par priorité

- **[P0] /app/dossiers/new** — Formulaire RDV 1 175 lignes dans un seul écran (4-5 sections empilées + estimateur durée + sélecteur slot + warnings conflit). Pour l'avatar « ex-cadre méfiant », c'est un mur d'inputs en pleine prise d'appel. Promet 90 s, demandera >3 minutes en pratique.
- **[P0] /app/dossiers (liste)** — Aucune recherche, aucun filtre statut ni date, aucune pagination (LIMIT 100 dur). Au-delà de 30 dossiers le diagnostiqueur scrolle aveuglément. Règle 5 s cassée pour « retrouver un dossier ».
- **[P0] /app/calendar** — Vue semaine uniquement, pas de vue jour ni mois, durée hardcodée à 90 min (ligne 42), pas de drag-drop ni d'événement « cliqué = ouvre detail sheet » sur mobile. Avatar perd contexte sur jours surchargés.
- **[P1] DS v5 — token legacy `accent-orange`** présent dans 8 fichiers (`today-kpi-grid.tsx` L308, `regulatory-notifications-mini.tsx` L20, `ademe-cockpit-mini.tsx` L303, `usage-quotas-widget.tsx` L145, `alerts-and-actions.tsx` L20, `diagnostic-status-pills.tsx`, `mission/capture-screen.tsx`, `text-note-modal.tsx`). Le DS v5 a banni l'ambre/orange — seul chartreuse autorisé.
- **[P1] DS v5 — token legacy `cream-deep`** présent dans **24 occurrences** dans les pages dossier (galerie photo, share-button, workflow-stepper, view-toggle, voice-notes, owner-documents, photo-button, room-picker, post-photo-action-bar, mission-toolbar, dossier-form, capture-screen). Background sage devrait être `#F5F7F4` (var `--sage`).
- **[P1] /app/dossiers/[id]** — `PhotosAccordion` reçoit `photos={[]}` et `rooms={[]}` codé en dur (page.tsx L240-242). L'accordéon affiche donc « 0 photos » même si la mission en contient. Trompeur.
- **[P1] /app/properties/[id]** + **/app/clients/[id]** — Boutons « Modifier » et « Exporter » utilisent `variant="glass"` (legacy DS v4) au lieu du couple `accent`/`default` du v5. Incohérent avec `/app/dossiers` qui utilise `variant="accent"`.
- **[P1] DS v5 — token legacy `text-amber` / `bg-amber`** dans `dossiers/[id]/mission/consolidation-summary-modal.tsx` (4 occurrences) et `live-capture.tsx` (5 occurrences). À mapper sur le sémantique v5 (vraisemblablement `accent-red`/orange-ish ou neutre `ink-mute`).
- **[P1] /app/outils** — Aucune indication que les 5 outils existent réellement vs. mocks. Pas de breadcrumb pour revenir au hub depuis chaque sous-outil. Avatar peut se sentir dans un cul-de-sac.
- **[P2] Header app** — `bg-navy shadow-accent` sur le logo mobile (layout.tsx L37). `bg-navy` est legacy DS v4 ; v5 demande `bg-[#0F1419]`. Shadow décoratif à retirer.

---

## Détail par page

### /app/dashboard

**Conformité DS v5 : 7/10**

OK : SectionHeader mono uppercase 11px tracking 0.18em conforme. TodayKpiGrid en pattern terminal (4 cols, bordures internes, pas de gap). Instrument Serif italic sur les valeurs KPI (L277). Mono `JetBrains` sur labels et deltas. Pas de gradient principal.

KO :
- `today-kpi-grid.tsx` L308 — `'text-accent-orange'` pour status amber : token legacy. Remplacer par chartreuse ou ink-mute.
- `alerts-and-actions.tsx` L20 — `warning: 'text-accent-orange'`. Idem.
- `regulatory-notifications-mini.tsx` L20 — `high: 'bg-accent-orange'`. Idem.
- `ademe-cockpit-mini.tsx` L303 — `'bg-accent-orange'`. Idem.
- `usage-quotas-widget.tsx` L145 — `'bg-accent-orange'`. Idem.
- `diagnostics-breakdown.tsx` L32 — `bg-cream-deep` fallback. Mapper sur `bg-sage` ou `bg-[#F5F7F4]`.
- `gain-tracker-card.tsx` L50 — `radial-gradient` glow ambre. Le DS v5 exclut formellement les gradients hors fond page. À reclasser sur fond plein ou bordure 1px.

**Frictions UX :**
- OK : CTA scan document toujours visible top-right (L67-69).
- OK : Urgent banner conditional null si rien.
- OK : Greeting + date claire en haut.
- 🔶 Section 08 « Activité récente » sans pagination ni filtre — bon comme contexte secondaire mais le « Tout voir » L177 mène à `/app/dossiers` (cohérent).
- 🔶 La 4e KPI « Risque ADEME » affiche `—` + label « Pack Découverte requis » quand gated. L'avatar peut interpréter comme bug. Une formule plus explicite (« non inclus dans votre plan ») limiterait.
- ⚠ Section 06 « Priorités » multi-sources P1/P2/P3 : pas vu d'exemple concret dans le component PrioritiesAlerts — vérifier que les empty states existent.

**Recos :**
- Search & replace `accent-orange` → décision palette (probablement `accent-red` pour critique, `ink-mute` pour neutre, ou créer `--accent-warn` chartreuse-orangé v5).
- Retirer glow ambre `gain-tracker-card.tsx` L50.
- Renommer KPI gated « Risque ADEME » → « Non inclus dans votre plan ».

---

### /app/dossiers (liste)

**Conformité DS v5 : 8/10**

OK : `AppPageHeader` avec accent serif italic. `AppListTable` pattern sobre. Badges sémantiques `green/blue/red/muted`. `DiagChip` pour les types diagnostic. Empty state propre avec CTA accent chartreuse.

KO :
- L31 — `DOSSIER_STATUS_VARIANT.on_site = 'orange'`, `back_office = 'orange'` : variant `orange` du Badge passe par `accent-orange` legacy. À mapper sur sémantique v5.

**Frictions UX (P0) :**
- ⚠ Aucune **recherche** (par adresse, client, référence). Sur 50+ dossiers l'avatar est bloqué.
- ⚠ Aucun **filtre statut** ni date. Vu que les statuts existent (7 valeurs), c'est une lacune flagrante pour un outil métier B2B.
- ⚠ **LIMIT 100** dur (L51) sans pagination ni « charger plus » : à 100+ dossiers les anciens disparaissent silencieusement (anti-pattern P0).
- 🔶 Cliquer la référence ouvre le détail mais le reste de la ligne n'est pas cliquable — l'avatar tape souvent à côté.
- 🔶 Le label de l'en-tête est `Vos dossiers` + description « regroupant les diagnostics par visite et par bien » — c'est bon mais on pourrait offrir un tri (par date scheduled, par CA).

**Cohérence inter-pages :**
- CTA primaire `variant="accent"` ✓ (cohérent avec /clients, /properties).
- AppListTable identique sur dossiers/clients/properties ✓.

**Recos P0 :** ajouter input search + filter chips statuts + pagination (cursor `created_at`).

---

### /app/dossiers/new

**Conformité DS v5 : 6/10**

OK : Eyebrow mono, accent serif italic, FormField patterns OK, sticky bottom bar avec CTA accent chartreuse cohérente.

KO :
- L615, L782, L923 — 3 × `hover:bg-cream-deep/40` (legacy).
- L1162 — `bg-sage/95 backdrop-blur-sm ... shadow-glass` : `shadow-glass` est OK (variante autorisée), mais le `backdrop-blur` glassy sur fond sage produit un effet « fintech » qui contredit l'objectif productivité sobre. À tester en mode dark notamment.
- L46 — eyebrow `📞 PRISE DE RDV · 90 SECONDES CHRONO` contient un emoji. Le CLAUDE.md §21bis exclut explicitement les emojis hors onboarding/empty states. Ici on est en page de création — à retirer.

**Frictions UX (P0 graves) :**
- ⚠⚠⚠ **Le formulaire est trop long pour 90s**. Inventaire des sections obligatoires : 1) adresse + type bien + année + surface + compléments étage, 2) client (4 pillules + 3-6 champs selon type), 3) pack 1-clic (5 boutons), 4) sélection diagnostics 11 cases groupées, 5) caractéristiques granulaires pour estimer durée (granular type + ownership + 3 checkboxes), 6) date RDV, 7) sélecteur slot, 8) notes. Plus warnings conflits, alternatives, clustering, quota DPE. **C'est un wizard déguisé en formulaire monolithique**. L'avatar 50 ans en RDV téléphonique abandonne.
- 🔶 Mode `quick` vs `existing` toggle texte simple (L577) — visuellement faible, l'utilisateur peut ne pas comprendre qu'il peut basculer.
- 🔶 Le `granular` type de bien (L1020 « Type de bien (granular) ») est dupliqué : on a déjà demandé `propertyType` (Maison/Appartement/Immeuble/Autre) plus haut. Redondance source d'erreur de saisie.
- 🔶 La case « Sous-sol », « Combles aménagées » est posée _au téléphone_ alors que le diagnostiqueur n'a pas encore vu le bien — l'avatar n'a pas l'info.
- 🔶 Erreur formulaire : `state?.error` (L1157) rendu en bas, peut être hors viewport si l'écran scrollé en haut. Pas d'auto-scroll vers l'erreur.
- 🔶 `Loader2` spin pendant submit OK, mais le bouton n'est pas désactivé visuellement avec couleur — il garde le chartreuse plein.

**Issues techniques :**
- L1162-1171 — sticky bar correct, mais sur mobile la bar mobile nav 5 tabs (`AppMobileNav` 56px+safearea) chevauche probablement la sticky form bar. À vérifier.
- L587-744 — composant client lourd (1175 lignes total) : impact perf SSR/hydratation. Split en sous-composants par section.

**Recos P0 :**
- Splitter en wizard 3 étapes : (1) Adresse & bien · (2) Client & pack · (3) Date & confirmation. Le wizard avec progress 1/3 rassure l'avatar méfiant.
- Retirer la section « Caractéristiques pour estimation durée » du flux téléphone : la durée pré-estimée par défaut (90 min appartement standard) suffit, l'ajustement granular se fait après création depuis le dossier.
- Retirer emoji eyebrow L46.

---

### /app/dossiers/[id] (détail)

**Conformité DS v5 : 7/10**

OK : Architecture refondue (resolveDossierState 3 états). Hero compact, accordions conditionnels. Pattern propre. DossierHeader serif italic. ExportSection en bas. Sticky bar fixed bottom.

KO :
- `photo-gallery.tsx` L107, L119, L128 — `bg-cream-deep` + `bg-gradient-to-t from-black/70` (gradient explicitement interdit DS v5).
- `share-button.tsx` L157 — `bg-cream-deep`.
- `workflow-stepper.tsx` L109, L139 — `bg-cream-deep`.
- `view-toggle.tsx` L41, L54 — `bg-cream-deep`.
- `voice-notes-list.tsx` L105 — `bg-cream-deep/60`.
- `owner-documents-list.tsx` L282 — `bg-cream-deep/60`.
- `dossier-more-menu.tsx` L86 — `bg-cream-deep`.
- `mission-card-collapsible.tsx` L25 — `bg-accent-orange`.
- `mission-checklist.tsx` L84 — `bg-cream-deep`.
- `client-upload-link.tsx` L47, L61 — `bg-cream-deep/60`.
- `loading.tsx` L6, L10 — `bg-cream-deep/80` sur skeleton.
- `diagnostic-status-pills.tsx` L38-41 — 4 × `accent-orange`.
- `defense/page.tsx`, `litigation/page.tsx` — `bg-cream-deep/60`.

**Frictions UX :**
- ⚠ **page.tsx L240-242** : `PhotosAccordion photos={[]} rooms={[]} defaultExpanded={false}` — c'est codé en dur. L'accordéon affichera toujours « 0 photos ». L'avatar pense que ses photos terrain ne sont pas sauvegardées (P1 critique).
- 🔶 `preparation-items.documents-received: done: false` codé en dur (L158, commentaire `TODO V1.5`). Toujours rouge même si docs reçus.
- 🔶 État `to-start` affiche `DossierAttentionSection` + `PreparationChecklist` + bandeau scan doc — risque de répétition visuelle (preparationItems dans les deux).
- OK : sticky bar avec menu ⋯ + CTA primaire cohérent.

**Recos :**
- Brancher PhotosAccordion sur les vraies données (P0).
- Brancher documents-received sur owner_documents table.

---

### /app/dossiers/[id]/mission (capture)

**Conformité DS v5 : 6/10**

KO :
- `capture-screen.tsx` L251, L529 — `bg-cream-deep/30 /40`.
- L530 — `border-accent-orange/60`.
- L548, L574, L591, L618 — `shadow-sm backdrop-blur-sm` répétés. Trop de glassy.
- L590 — `bg-accent-orange text-paper` (puce de notif).
- L632 — `bg-chartreuse text-ink shadow-sm` ✓ (chartreuse OK).
- `consolidation-summary-modal.tsx` L98, L160, L214, L220 — 6 × `text-amber` / `bg-amber/10` / `border-amber/30`. Token `amber` n'existe pas en v5.
- `live-capture.tsx` L401, L494, L499, L512, L519, L524 — 6 × `amber`.
- `text-note-modal.tsx` L200 — `text-accent-orange`.
- `mission-focus-drawer.tsx` L164 — `shadow-lg` legacy.
- `voice-recorder-modal.tsx` L317, `text-note-modal.tsx` L134 — `shadow-xl` modaux : OK pour modal mais surdimensionné, préférer ombre v5 1px.

**Frictions UX :**
- 🔶 Mode mission = écran modale full-page bien — OK pour l'avatar (focus). Pattern conforme au Drama mode v5.
- 🔶 La toolbar mission + room-picker + cta « pièce suivante » + cta « consolider » + carrousel photos + bouton géant : densité OK pour usage terrain tactile.
- ⚠ Touch target `h-5 w-5` (20×20px) sur badges en L590, L618, L632 — sous le minimum 44×44px iOS. À auditer si interactif ou purement décoratif. Si décoratif (badges status) OK.

**Recos :**
- Mapper tokens `amber` → DS v5 (chartreuse pour positif, `accent-red` pour danger, `ink-mute` pour neutre).

---

### /app/calendar

**Conformité DS v5 : 7/10**

OK : AppPageHeader. CalendarWeekView correct. Pas de gradient ni glow.

KO :
- `calendar-week-view.tsx` L196, L268, L277 — `bg-cream-deep/40`.
- L40-48 — STATUS_VARIANT utilise `'orange'` pour on_site/back_office (cf. legacy).
- L187, L197 — `shadow-sm` sobre, OK mais à vérifier cohérence.

**Frictions UX (P0) :**
- ⚠ **Vue semaine uniquement**. Pas de vue jour ni mois. Pour un diagnostiqueur qui planifie 2-3 semaines à l'avance, manque criant.
- ⚠ `page.tsx` L42 — `durationMinutes: 90, // V1 hard-codé`. Toutes les visites s'affichent comme 90 min, même si la durée réelle estimée diffère. Visualisation calendaire faussée.
- 🔶 `MAX_EVENTS_PER_DAY_COLLAPSED = 3` (L95) : au-delà l'utilisateur clique « voir tout », un overlay/expand. À tester sur jours surchargés.
- 🔶 Pas de drag-drop pour replanifier — friction si conflit détecté.
- 🔶 Cliquer un événement ouvre `EventDetailSheet` (panneau latéral). OK.
- 🔶 Bouton « Tableau de bord » avec ArrowLeft (L57) en haut : pattern de retour cohérent.

**Recos P0 :**
- Brancher `duration_minutes` réel depuis dossiers ou estimateur (champ déjà calculé au `/new`).
- Ajouter toggle Vue Jour / Semaine / Mois (au moins jour pour mobile).

---

### /app/clients (liste)

**Conformité DS v5 : 9/10**

OK : Pattern AppListTable, EmptyState, CTA accent. Pas de tokens legacy détectés. Cohérent avec /dossiers et /properties.

KO mineurs :
- Aucun mono / serif italic sur la page — c'est volontaire vu que liste mais on perd un peu de signature KOVAS.

**Frictions UX :**
- ⚠ **Aucune recherche, aucun filtre par type** (particulier/agence/notaire/syndic/entreprise/collectivité). Avec 100+ clients, l'avatar scrolle.
- ⚠ **Pas de pagination**. Pas de LIMIT explicite — au-delà de 1000 enregistrements Supabase coupe à 1000 silencieusement.
- 🔶 Colonne contact affiche email OU téléphone (`c.email ?? c.phone`) — l'avatar ne sait pas si « 06 12... » est tél ou email. Préférer 2 icônes côte à côte ou les 2 lignes.

**Recos P1 :** ajouter search + filter chips type client.

---

### /app/clients/[id]

**Conformité DS v5 : 7/10**

OK : Card variant="opaque", padding default, structure claire.

KO :
- L93 — Badge « Fidèle » utilise `bg-accent-warm-soft text-accent-warm`. `accent-warm` est ambre Ron Lab v4, **proscrit en v5**.
- L98, L108, L202 — `variant="glass"` boutons Modifier/Exporter/Ajouter logement. Legacy v4.

**Frictions UX :**
- OK : adresse cabinet, coordonnées, logements détenus avec lien direct → /properties/[id], notes, danger zone.
- 🔶 Le bouton « Exporter tout (.zip) » accède directement à `/api/clients/[id]/export.zip` sans modal de confirmation ni feedback. Si l'export prend 10s+, l'avatar pense que ça ne fonctionne pas.
- 🔶 Badge « Fidèle » seuil `missionsCount >= 5` codé en dur, pas de tooltip explicatif.

**Recos :**
- Remplacer `variant="glass"` → `variant="default"` ou `variant="outline"` v5.
- Repenser badge Fidèle en mono uppercase chartreuse-soft.

---

### /app/properties (liste)

**Conformité DS v5 : 9/10**

OK : Identique à /clients en structure. Pattern conforme.

Frictions :
- Mêmes que /clients : pas de search, pas de filter par type bien (maison/appart/immeuble), pas de pagination.

---

### /app/properties/[id]

**Conformité DS v5 : 7/10**

OK : Card variant="opaque", AppPageHeader bien câblé, CTA Nouveau dossier en accent chartreuse cohérent.

KO :
- L88, L92 — `variant="glass"` sur bouton « Modifier ». Legacy v4.
- OwnerTransfer composant client à auditer séparément.

**Frictions UX :**
- OK : nouveau dossier pré-rempli avec `propertyId` query param.
- OK : transfert propriétaire avec liste clients dispo.
- 🔶 Pas de section « Historique des diagnostics réalisés sur ce bien » — pourtant info ultra-utile pour l'avatar (vérifier validité ancien DPE etc.). Critique pour la promesse « historique diagnostic mutualisé ».
- 🔶 « Caractéristiques » avec 6 fields dont 4 vides → grille avec beaucoup de `—`. Possible cleanup conditionnel.

**Recos P1 :** ajouter section « Dossiers sur ce bien » (avec liste ref + statut + date).

---

### /app/outils

**Conformité DS v5 : 8/10**

OK : Grid 2 cols utilities, Card variant="opaque", CardTitle/CardDescription, icônes lucide cohérentes. Hover translate-y-px subtle. Pas de gradient.

KO mineurs :
- L67 — `bg-navy/5 text-navy` : navy ne fait pas partie de la palette v5 simplifiée (sage/dark/chartreuse/white). Le DS v5 a banni le navy 5 niveaux. À remplacer par `bg-[#0F1419]/5 text-[#0F1419]`.

**Frictions UX :**
- OK : 5 cards descriptives, action évidente.
- 🔶 Aucun breadcrumb dans les sous-outils pour revenir au hub. Vérifier dans chaque sous-page (`diagnostics-obligatoires`, `verification-validite`, `calculatrice-surface`, `modeles-client`, `checklist-depart`).
- 🔶 Le hub indique « 5 gadgets pour gagner du temps » mais la page de chaque outil reprend l'AppPageHeader avec retour `/app/outils` ? À auditer.

**Recos P2 :**
- Ajouter `<Button variant="ghost" asChild><Link href="/app/outils"><ArrowLeft/>Tous les outils</Link></Button>` en tête de chaque sous-page outil.

---

### /app/relances

**Conformité DS v5 : 7/10**

OK : Header serif italic 3xl/4xl + description grise mute. Pattern conforme.

KO :
- 0 mono / 0 mockup terminal data-dense pattern : la page utilise un pattern hub/tabs (`FollowUpSequencesManager`), différent du dashboard. Cohérence inter-pages perfectible.
- `FollowUpSequencesManager.tsx` à auditer en profondeur. Utilise `KpiHero` (cohérent v5), Skeleton, EmptyState, Card. Card sans variant explicite L24 (`import { Card } ... <Card`) — vérifier que le défaut est opaque.

**Frictions UX :**
- 🔶 5 tabs (Devis / Factures / Post-DPE / Prescripteurs / Avis) — sans badge count sur chaque tab, l'avatar ne sait pas où sont les urgences.
- 🔶 Actions pause/resume/cancel sur chaque séquence : pas vérifié si elles ont confirmation modal pour « cancel » (action destructive irreversible).

**Recos :**
- Ajouter count par tab.
- Confirmation modal sur cancel séquence.

---

## Cohérence inter-pages

| Aspect | État | Détail |
|---|---|---|
| Header app (sidebar 80px + nav tabs glass-opaque pill) | OK | Layout `/app/layout.tsx` propre. |
| Sidebar 80px icon-only conforme | OK | `app-sidebar.tsx` v5 spec, fond `#0F1419`, barre active chartreuse 3px à gauche. |
| AppMobileNav 5 tabs (Auj. / Dossiers / Plan. / Compte + FAB) | OK | 4 tabs nav + FAB chartreuse central via `MobileQuickActionsFab`. |
| AppPageHeader pattern (title + accent serif italic + description) | OK | Utilisé sur 7/7 pages auditées. |
| CTA primaire `variant="accent"` chartreuse | OK | 31 occurrences, cohérent. |
| Boutons secondaires `variant="glass"` | **KO** | 34 occurrences — legacy v4. Doit migrer vers `outline` ou `default` v5. |
| Cards `variant="opaque"` | OK | 58 occurrences, cohérent (sauf `Card variant="flat"` 13 occurrences à vérifier). |
| Iconographie lucide-react | OK | Pas de mix avec autres packs. |
| Token `accent-orange` / `cream-deep` / `amber` / `navy-soft` | **KO** | 60+ occurrences cumulées de tokens legacy v3/v4. Doit faire l'objet d'un sweep search/replace. |
| Animations `animate-fade-in` | OK | Utilisé sur 6/7 pages. |

---

## Responsive mobile (< 768px)

**Sidebar 80px masquée ✓** (`hidden md:flex`).

**Mobile nav 5 tabs ✓** fond `#0F1419`, safe-area-inset-bottom géré.

**Header mobile :** logo K monogramme `bg-navy` (legacy) + nav tabs glass-opaque. OK mais `bg-navy shadow-accent` à migrer vers `#0F1419`.

**Touch targets :** sidebar buttons size-12 (48px) ✓. Mobile tabs py-2.5 + size-5 icon = ~44px ✓. CTA primaires `size-lg` ≥48px ✓.

**Grids débordement :** aucun `min-w-[]` détecté dans les pages app sauf onboarding (hors scope). RAS.

**Modals lisibles :** `text-note-modal`, `voice-recorder-modal`, `consolidation-summary-modal` utilisent `shadow-xl` — à vérifier en viewport mobile que la modal occupe bien la largeur disponible et que le scroll interne fonctionne. Pas d'évidence de bug.

**Formulaires :**
- `/app/dossiers/new` : 1175 lignes, scroll vertical conséquent. La sticky bar bottom (L1162) chevauche probablement la mobile nav 5 tabs (56px+safe-area). À tester (P1).
- `/app/dossiers/[id]` : `DossierStickyBar` fixed bottom — même risque de chevauchement avec mobile nav.

---

## Patterns systématiques à corriger en priorité

### 1. Sweep tokens legacy DS v4 → DS v5

Affecte 60+ fichiers répartis sur **toutes les pages auditées**. Liste exhaustive :

| Token legacy | Occurrences détectées | Cible v5 |
|---|---|---|
| `bg-cream-deep` (et variantes /30 /40 /60 /80) | 24 | `bg-sage` (sage `#F5F7F4` est déjà le background) ou `bg-paper` selon contexte. |
| `text-accent-orange` / `bg-accent-orange` | 12 | Décision palette à prendre : `chartreuse` pour positif, `accent-red` pour danger, `ink-mute` pour neutre, ou nouveau `--accent-warn` v5. |
| `text-amber` / `bg-amber` / `border-amber` | 11 | Idem. |
| `variant="glass"` Button | 34 | `variant="outline"` ou `variant="default"` v5. |
| `bg-navy` (logo header mobile, fragments) | 3 | `bg-[#0F1419]` ou token `--ink` |
| `shadow-lg` / `shadow-xl` (hors modaux strictement nécessaires) | 8 | `shadow-glass-sm` ou 1px border v5 |
| `bg-gradient-to-t` / `radial-gradient` | 2 | À retirer (DS v5 interdit gradients hors fond page). |
| `accent-warm` / `accent-warm-soft` | 1 (badge Fidèle) | Remplacer par chartreuse-soft. |

### 2. Pages liste sans recherche/filtre/pagination

`/app/dossiers`, `/app/clients`, `/app/properties` partagent la même lacune P0 : aucun input search, aucun filter chip, pagination implicite (LIMIT 100 ou 1000 silencieux). C'est le pattern « table B2B sans search » qui condamne l'app dès le 30e enregistrement. Doit être traité comme un seul chantier (composant `<AppListToolbar>` partagé).

### 3. Données mockées en production

- `/app/dossiers/[id]/page.tsx` L240-242 — `PhotosAccordion photos={[]} rooms={[]}` codé en dur.
- `/app/dossiers/[id]/page.tsx` L158 — `documents-received: done: false` codé en dur.
- `/app/calendar/page.tsx` L42 — `durationMinutes: 90` hardcodé.

Ces 3 ancres laissent l'utilisateur croire qu'aucune donnée n'existe. Crève la confiance de l'avatar méfiant immédiatement.

### 4. Formulaire `/app/dossiers/new` trop long

À splitter en wizard 3 étapes pour tenir la promesse « 90 secondes chrono ». État actuel : ~1175 lignes, 8 sections, 30+ champs visibles d'un coup.
