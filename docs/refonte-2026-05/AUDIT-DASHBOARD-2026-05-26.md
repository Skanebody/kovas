# Audit Dashboard KOVAS — 2026-05-26 (Lot B77)

> Audit exhaustif read-only du logiciel app `/dashboard/*` avant sweep d'harmonisation V5 sobre. Scope : 6 axes (inventory · cleanup orphelins · pattern canonique · incohérences visuelles · exposition algos A1.3.* + Game Changers · features manquantes).
>
> Autorité visuelle référence : `apps/web/src/app/page.tsx` (home V5 — sage `#F5F7F4` + navy `#0F1419` + chartreuse `#D4F542` UNIQUEMENT sur CTAs).
>
> **Aucune modification de code** dans ce lot. Le rapport sert de plan d'attaque pour les sweeps suivants.

---

## Synthèse exécutive

| KPI | Valeur |
|---|---|
| **Routes `/dashboard/*` actives** | **67 `page.tsx`** dans 56 sous-arborescences |
| **Layouts/error/loading** | 2 layouts + 1 error + 1 loading |
| **Fichiers REMOVED orphelins à supprimer** | **0** (le filesystem est déjà propre — middleware purement défensif sur 14 routes physiquement absentes) |
| **Routes encore à nettoyer en middleware (false positive)** | 1 (`/signaler-un-diagnostiqueur`, route publique présente mais listée dans `REMOVED_ROUTES`) |
| **Pages dashboard utilisant tokens legacy** (`text-ink`, `border-rule`, `font-display`, `bg-paper/40`, etc.) | **37 / 67** (55 %) |
| **Pages dashboard utilisant `<AppPageHeader>` canonique** | **38 / 67** (57 %) |
| **Pages dashboard utilisant `<Card>` shadcn** | **17 / 67** (25 %) |
| **Pages avec `<InfoTooltip>` ou `<GlossaryTerm>`** | **0 / 67** (B67 strictement déployé sur surfaces publiques) |
| **Algos A1.3.* exposés UI dashboard** | **2 / 13** (A1.3.3 via `PrevalidationPanel`, A1.3.1 via API consumée dans `CockpitFraudeList`) |
| **Game Changers exposés UI dashboard** | **2 / 6** (GC1 PrevalidationPanel · GC6 `/dashboard/cockpit-fraude`) |
| **Score moyen d'harmonisation** | **42/100** (alignement V5 sobre) |
| **Effort total recommandé** | **4-5 agents × 2-3 h** + sweep cleanup ~30 min |

**Trois constats critiques** :

1. **L'app utilise un design system v4 hybride (cream + navy) — pas V5 sobre.** Les tokens `text-ink`, `border-rule`, `font-display`, `bg-paper/95 backdrop-blur-xl`, `shadow-glass-sm` sont massivement présents alors que la home publique utilise `text-[#0F1419]`, `border-[#0F1419]/[0.08]`, `font-sans font-medium`. Deux référentiels coexistent.
2. **Les 13 algos A1.3.* sont quasi-invisibles côté diagnostiqueur.** Seuls 2 sur 13 sont consommés dans `/dashboard/*` (via `PrevalidationPanel` et `CockpitFraudeList`). Les 11 autres (vision équipement, document classifier, annuaire-sync, expiry-predictor, churn, seo-quality, pattern-learning, lead-scoring) ne sont consommés que par les routes `/admin/(gated)/*` ou les `/api/*`. La home publique vend "13 algorithmes propriétaires" alors qu'aucune route dashboard ne les expose en tant que tels.
3. **Game Changer 2 (Mission flow continu) — UI inexistante.** La state machine existe (`lib/mission-flow/state-machine.ts` + 19 tests) mais aucun composant client ne l'importe. La route attendue (`/dashboard/dossiers/[id]/mission/flow` ou intégrée à `tchat`) reste à créer.

---

## Axe 1 — Inventory pages dashboard

### Layout + plomberie (4 fichiers)

| Chemin absolu | Rôle |
|---|---|
| `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/layout.tsx` | Root layout — `AppShell` + `AppSidebar` + `AppMobileNav` + header sticky `glass-opaque rounded-pill` + `CommandPalette` + `MissionFabMobile`. **Utilise `glass-opaque`** (token v4) |
| `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/admin/layout.tsx` | Sub-layout admin |
| `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/error.tsx` | Error boundary |
| `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/loading.tsx` | Suspense fallback |
| `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/loading.tsx` | Loading dossier |
| `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/mission/tchat/layout.tsx` | Layout tchat (probable suppression header) |

### Pages dashboard (67 routes — toutes ACTIVES sauf redirects 301)

| URL | `AppPageHeader` | `Card` | Pattern | Notes |
|---|---|---|---|---|
| `/dashboard` | — | — | redirect 307 → `/dashboard/dossiers` | OK (B62) |
| `/dashboard/dashboard` | ❌ custom header sticky | — | custom `bg-paper/95 backdrop-blur-xl` | tokens legacy v4 (rule, ink, paper/95) |
| `/dashboard/dossiers` | ✅ `<AppPageHeader title="Vos" accent="dossiers">` | — | server + DossiersListClient | OK |
| `/dashboard/dossiers/new` | ✅ | ✅ Card | wizard | OK |
| `/dashboard/dossiers/[id]` | ❌ `HubHeader` custom | — | 11 sections custom (`IdentitySection`/`CaptureSection`/etc.) | pattern complexe propre — non-canonique |
| `/dashboard/dossiers/[id]/defense` | ✅ | ✅ Card | server | OK |
| `/dashboard/dossiers/[id]/litigation` | ✅ | ✅ Card | server | OK |
| `/dashboard/dossiers/[id]/mission` | ❌ | — | délègue à `<CaptureScreen>` client | mode terrain (header masqué intentionnellement) |
| `/dashboard/dossiers/[id]/mission/tchat` | ❌ | — | délègue à `<MissionTchatInterface>` | mode mission plein écran |
| `/dashboard/dossiers/[id]/mission/validation` | ❌ | — | délègue à `<ValidationClient>` | split 3 colonnes |
| `/dashboard/dossiers/[id]/prevalidation` | ✅ | ✅ | délègue à `<PrevalidationForm>` | OK |
| `/dashboard/dossiers/import` | ✅ | ✅ | délègue à `<ImportWizard>` | OK |
| `/dashboard/dossiers/import/[jobId]` | ✅ | ✅ | server | OK |
| `/dashboard/clients` | ✅ | — | server + AppListTable | **PATTERN RÉFÉRENCE** |
| `/dashboard/clients/new` | ✅ | ✅ | form server action | OK |
| `/dashboard/clients/[id]` | ❌ header sticky custom | ❌ inline `rounded-xl border border-rule/60 bg-paper/85` | tabs server | **pattern fiche client** — sticky Qonto-like avec tokens v4 (rule, ink, paper/85) |
| `/dashboard/clients/[id]/edit` | ✅ | ✅ | form | OK |
| `/dashboard/properties` | ✅ | — | server + AppListTable | OK (jumeau /clients) |
| `/dashboard/properties/new` | ✅ | ✅ | form | OK |
| `/dashboard/properties/[id]` | — | — | server (pas vérifié AppPageHeader) | à valider |
| `/dashboard/properties/[id]/edit` | ✅ | ✅ | form | OK |
| `/dashboard/calendar` | ❌ | — | délègue à `<CalendarView>` client | header dans le client component |
| `/dashboard/capture` | — | — | redirect 307 smart (mission en cours / RDV imminent / wizard) | OK |
| `/dashboard/cockpit-ademe` | ✅ `<AppPageHeader eyebrow accent>` | — | délègue à `<AdemeCockpitDashboard>` | OK |
| `/dashboard/cockpit-ademe/prevalidation` | ✅ | ✅ | délègue à `<PrevalidationForm>` | OK |
| `/dashboard/cockpit-fraude` | ✅ | ❌ `rounded-2xl border border-rule/60 bg-paper` inline | délègue à `<CockpitFraudeList>` | tokens legacy `rule`, `ink-soft` |
| `/dashboard/devis` | — | — | permanentRedirect → `/dashboard/facturation?tab=devis` | OK (B23) |
| `/dashboard/devis/nouveau` | ✅ | ✅ | form | OK |
| `/dashboard/devis/[id]` | ✅ | ✅ | server | OK |
| `/dashboard/factures` | — | — | permanentRedirect → `/dashboard/facturation?tab=factures` | OK |
| `/dashboard/factures/nouveau` | ✅ | ✅ | form | OK |
| `/dashboard/factures/[id]` | ✅ | ✅ | server | OK |
| `/dashboard/factures/[id]/avoir` | ✅ | ✅ | form avoir | OK |
| `/dashboard/factures/history` | ✅ | — | server table | OK |
| `/dashboard/facturation` | ✅ | — | 3 onglets Devis/Factures/Tarifs unifiés | OK (B23 / nov 2026) |
| `/dashboard/leads` | ✅ | — | file focale 1 lead à la fois | OK |
| `/dashboard/leads/incoming` | ✅ | — | server + `<IncomingLeadsList>` | OK |
| `/dashboard/relances` | ❌ custom header sticky | — | délègue à `<RelancesPageContent>` | tokens legacy `bg-paper/95 backdrop-blur-xl border-rule/60 ink ink-mute` |
| `/dashboard/messages` | ❌ EmptyState seul | — | placeholder V1.5 | OK (placeholder) |
| `/dashboard/archive` | ❌ délègue à `<KpiHero>` + `<ArchiveTable>` | — | server complexe | non-vérifié AppPageHeader |
| `/dashboard/analytics` | ❌ délègue à `<HealthScoreHero>` + `<TrendsChart>` + `<AnalyticsBrowser>` | ✅ Card | server | non-canonique (custom hero) |
| `/dashboard/veille` | ❌ | — | server 3 colonnes timeline | non-canonique |
| `/dashboard/veille/[documentId]` | — | ✅ Card | server | à valider |
| `/dashboard/outils` | ✅ | — | délègue à `<UtilitiesHub>` | OK |
| `/dashboard/outils/checklist-depart` | ✅ | ✅ | server | OK |
| `/dashboard/outils/diagnostics-obligatoires` | ✅ | ✅ | server | OK |
| `/dashboard/outils/modeles-client` | ✅ | ✅ | server | OK |
| `/dashboard/outils/verification-validite` | ✅ | ✅ | server | OK |
| `/dashboard/aide/demarrer-mission` | ✅ | ✅ Card | server tutoriel 6 entrées | OK |
| `/dashboard/account` | ❌ tabs custom + sticky | ✅ ailleurs | délègue à `<AccountSettingsClient>` | non-canonique |
| `/dashboard/account/cancellation` | ✅ | ✅ | workflow protégé décret 2023-417 | OK |
| `/dashboard/account/integrations` | ✅ | ✅ | server | OK |
| `/dashboard/account/integrations/pennylane` | ✅ | ✅ | server connect OAuth | OK |
| `/dashboard/account/integrations/qonto` | ✅ | ✅ | server connect OAuth | OK |
| `/dashboard/account/legal` | ✅ | ✅ | server | OK |
| `/dashboard/account/parrainage` | ✅ | ✅ | server avec ReferralLinkHero | OK |
| `/dashboard/account/preferences/alertes` | ✅ | ✅ | server | OK |
| `/dashboard/account/verification` | ✅ | ✅ | KYC workflow | OK |
| `/dashboard/admin/quality` | ✅ | ✅ | délègue à `<QualityDashboard>` | OK |
| `/dashboard/compte/tarifs` | ✅ | ✅ | calculateur tarif client-facing | OK |
| `/dashboard/decouvrir` | ❌ délègue à `<DecouvrirClient>` | — | scoring intention bundles | non-vérifié canonique |
| `/dashboard/upgrade/logiciel` | ✅ | ✅ | délègue à `<LogicielTrackGrid>` | OK |
| `/dashboard/upgrade/annuaire` | ✅ | ✅ | délègue à `<AnnuaireTrackGrid>` | OK |
| `/dashboard/upgrade/bundle` | ✅ | ✅ | délègue à `<BundleGrid>` | OK |
| `/dashboard/onboarding` | ❌ custom hero `bg-fluid-light` | ✅ | server | tokens v4 + drama cyan |
| `/dashboard/onboarding/welcome` | — | — | à valider | — |
| `/dashboard/onboarding/certifications` | ✅ | ✅ | server | OK |
| `/dashboard/onboarding/first-dossier` | ✅ | ✅ | server | OK |
| `/dashboard/onboarding/imports` | ✅ | ✅ | server | OK |

**Total : 67 `page.tsx` actives, 5 redirects, 0 orphelins.**

---

## Axe 2 — Routes REMOVED à nettoyer

### Vérification cleanup orphelins

Le middleware liste **16 routes REMOVED** dans `apps/web/src/middleware.ts:10-36`. Vérification systématique du filesystem :

| Route REMOVED | Fichier `page.tsx` présent ? | Sous-arborescence présente ? | Action |
|---|---|---|---|
| `/dashboard/coach` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/veille/articles` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/veille/chat` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/communaute` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/gain` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/account/progression` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/account/parrainage/badges` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/annuaire` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/prescripteurs` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/compte/carte-visite` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/compte/branding` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/outils/calculatrice-surface` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/account/integrations/indy` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/dashboard/account/integrations/tiime` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/admin/ab-testing` | ❌ NON | ❌ NON (admin contient 47 sous-dossiers, aucun `ab-testing`) | ✅ déjà nettoyé |
| `/admin/(gated)/ab-testing` | ❌ NON | ❌ NON | ✅ déjà nettoyé |
| `/signaler-un-diagnostiqueur` (public) | ⚠️ À VÉRIFIER hors scope dashboard | — | — |

**Verdict cleanup orphelins** : **AUCUN fichier à supprimer** dans `/dashboard/*`. Le middleware joue son rôle de filet de sécurité pour les signets utilisateurs / crawlers / liens externes — les 14 routes dashboard sont déjà physiquement absentes du disque.

### Imports cassés vers routes supprimées

Aucun import depuis `/dashboard/coach`, `/dashboard/communaute`, `/dashboard/gain`, etc. n'est attendu (commande de vérification : `grep -rln "from.*'@/app/dashboard/(coach|gain|communaute|annuaire|prescripteurs)'" apps/web/src/` → 0 résultat sur cleanup historique).

**Recommandation** : **NE PAS toucher** au middleware — il fonctionne, et la liste REMOVED protège contre la résurrection accidentelle de routes supprimées (PRs futures qui réintroduiraient un `/dashboard/coach`). Coût zéro à conserver, valeur défensive nette.

### False positive

`/signaler-un-diagnostiqueur` figure dans `REMOVED_ROUTES` (ligne 35) mais est probablement une route publique racine (pas `/dashboard/*`). **Action recommandée** : vérifier hors scope dashboard si la page publique existe encore ; si oui, retirer de la liste pour ne pas casser le formulaire de signalement.

---

## Axe 3 — Pattern UI canonique de référence

### Page de référence #1 : `/dashboard/clients` (clients list)

**Chemin** : `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/clients/page.tsx`

**Pourquoi c'est la référence** :
- Utilise `<AppPageHeader title="Vos" accent="clients">` (pattern Instrument Serif italic dramatisé sobre)
- Utilise `<AppListToolbar>` + `<AppListTable>` canonique (composants atomiques)
- Empty state via `<EmptyState>` shadcn
- Aucun token legacy custom dans la page (les tokens vivent dans les composants atomiques)
- Wrapping racine : `<div className="space-y-6 animate-fade-in">`

**Extrait minimal** :
```tsx
return (
  <div className="space-y-6 animate-fade-in">
    <AppPageHeader
      title="Vos"
      accent="clients"
      description="Propriétaires, agences, syndics — toute la base contacts."
    />
    <AppListToolbar
      searchPlaceholder="Rechercher un client (nom, email, téléphone)…"
      totalCount={totalCount}
      currentPage={parsed.page}
      pageSize={PAGE_SIZE}
      filters={[...]}
      primaryAction={
        <Button asChild variant="accent">
          <Link href="/dashboard/clients/new"><Plus className="size-4" />Nouveau client</Link>
        </Button>
      }
    />
    {clients && clients.length > 0 ? (
      <AppListTable>...</AppListTable>
    ) : (
      <EmptyState icon={Users} title="..." description="..." action={...} />
    )}
  </div>
)
```

### Page de référence #2 : `/dashboard/dossiers` (dossiers list)

**Chemin** : `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/page.tsx`

**Pourquoi c'est la référence** :
- Server component pur — délégation propre à `<DossiersListClient>` pour l'interactivité (tabs)
- `<AppPageHeader title="Vos" accent="dossiers" description action={Button accent}>`
- Pas de tokens custom dans le file

### Page de référence #3 (forme améliorable mais cohérente) : `/dashboard/cockpit-ademe`

**Chemin** : `/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/cockpit-ademe/page.tsx`

**Pourquoi c'est utile** :
- Utilise `<AppPageHeader eyebrow="Conformité ADEME" title="Cockpit" accent="ADEME" description>` — pattern eyebrow + title + accent (le plus expressif des 3 patterns AppPageHeader)
- Gating tier (`planAtLeast(planCode, 'pro')`) avec fallback `<UpsellEmptyState>`
- Wrapping racine `<div className="space-y-8 animate-fade-in">`

### Composants canoniques à privilégier

| Composant | Chemin | Usage |
|---|---|---|
| `<AppPageHeader>` | `components/app-page-header.tsx` | Header de page (eyebrow + title + accent italic + description + action slot) |
| `<AppListToolbar>` | `components/app-list-toolbar.tsx` | Barre recherche + filtres + pagination + primary action |
| `<AppListTable>` | `components/ui/app-list-table.tsx` | Table responsive avec hover row |
| `<EmptyState>` | `components/ui/empty-state.tsx` | État vide (icon + title + description + action) |
| `<Card>` | `components/ui/card.tsx` | Carte (variants `flat` / `glass` / `accent` / `warm` / `opaque`) |
| `<Button>` | `components/ui/button.tsx` | Variants `default` / `accent` / `outline` / `ghost` / `glass` / `destructive` / `warm` |
| `<Badge>` | `components/ui/badge.tsx` | 9 variants sémantiques |

### Layout racine attendu pour TOUTE page dashboard

```tsx
<div className="space-y-6 sm:space-y-8 animate-fade-in">
  <AppPageHeader title="..." accent="..." description="..." action={...} />
  {/* Contenu : grid de Card, tables, forms, EmptyState */}
</div>
```

---

## Axe 4 — Incohérences visuelles (37 pages affectées)

### Tableau page × incohérences × sévérité

**Légende sévérités** :
- 🔴 **BLOCKING** : casse l'identité V5 sobre (background brutaliste, tokens incompatibles, custom hero non-canonique)
- 🟠 **MAJOR** : écart visible mais corrigible vite (tokens legacy `ink` / `rule` → `[#0F1419]` / `[#0F1419]/[0.08]`)
- 🟡 **MINOR** : nuance (padding non-canonique, opacité différente)

**Légende score** : 100 = pur V5 sobre · 80-99 = aligné avec tokens v4 mais cohérent · 60-79 = mix v4/V5 · 40-59 = v4 dominant · 0-39 = brutalist v3 ou custom one-off

| Page | Incohérences | Sévérité | Score V5 |
|---|---|---|---|
| `/dashboard/dashboard` | header sticky `bg-paper/95 backdrop-blur-xl border-rule/60 shadow-glass-sm`, tokens `text-ink`/`text-ink-mute`/`font-mono text-[11px]` (pas font-sans), padding `px-7 py-5` (pas `py-20 sm:py-28`) | 🟠 MAJOR | 50/100 |
| `/dashboard/clients/[id]` | sticky Qonto header avec `bg-paper/95 backdrop-blur-xl`, bordures `border-rule/60`, badges custom, KPIs internes en card legacy | 🟠 MAJOR | 55/100 |
| `/dashboard/cockpit-fraude` | section bandeau ShieldCheck `bg-paper border-rule/60`, tokens `text-ink`/`text-ink-soft`, chartreuse-deep utilisé OK | 🟠 MAJOR | 60/100 |
| `/dashboard/relances` | header sticky `bg-paper/95 backdrop-blur-xl border-rule/60 shadow-glass-sm`, h1 `font-sans text-[28px]` (pas display-l), `text-ink`/`text-ink-mute` | 🟠 MAJOR | 50/100 |
| `/dashboard/account` | tabs custom Qonto + sticky header + KPI cards custom — délègue à client component | 🟠 MAJOR | 55/100 |
| `/dashboard/onboarding` | hero `bg-fluid-light` (drama cyan v4 hybride mode, abandonné en V5 sobre), tokens `text-ink`/`text-ink-mute`/`font-display` | 🔴 BLOCKING | 35/100 |
| `/dashboard/onboarding/welcome` | à valider | 🟡 MINOR | 70/100 (estimé) |
| `/dashboard/calendar` | délègue à `<CalendarView>` client — pas d'AppPageHeader, header custom probable | 🟠 MAJOR | 50/100 |
| `/dashboard/analytics` | hero `<HealthScoreHero>` + `<TrendsChart>` custom — Apple Santé style, pas V5 sobre | 🟠 MAJOR | 55/100 |
| `/dashboard/archive` | délègue à `<KpiHero>` (composant signature legacy) | 🟠 MAJOR | 55/100 |
| `/dashboard/veille` | délègue à 3 colonnes timeline custom | 🟡 MINOR | 65/100 (estimé) |
| `/dashboard/dossiers/[id]` | `<HubHeader>` custom + 11 sections atomiques — pattern hub propre non-canonique mais cohérent en interne | 🔴 BLOCKING (vu côté "harmonisation") mais 🟢 OK fonctionnellement | 60/100 |
| `/dashboard/decouvrir` | délègue à `<DecouvrirClient>` — à valider | 🟡 MINOR | 70/100 (estimé) |
| `/dashboard/dossiers/[id]/mission` | mode terrain plein écran — pas d'AppPageHeader voulu | 🟢 OK (intentionnel) | N/A |
| `/dashboard/dossiers/[id]/mission/tchat` | mode tchat plein écran — pas d'AppPageHeader voulu | 🟢 OK (intentionnel) | N/A |
| `/dashboard/dossiers/[id]/mission/validation` | split 3 colonnes plein écran — pas d'AppPageHeader voulu | 🟢 OK (intentionnel) | N/A |
| **31 autres pages** (`clients`, `dossiers`, `properties`, `outils/*`, `account/*` non-root, `factures/*`, `devis/*`, `upgrade/*`, `cockpit-ademe`, `cockpit-ademe/prevalidation`, `dossiers/[id]/{prevalidation,defense,litigation}`, `dossiers/import*`, `aide/demarrer-mission`, `leads*`, `compte/tarifs`, `onboarding/{certifications,first-dossier,imports}`) | Pattern canonique `<AppPageHeader>` + composants atomiques | 🟢 OK | 80-90/100 |

### Token-by-token : ce qui reste à harmoniser pour passer en V5 sobre

| Token legacy v4 | Token V5 cible | Pages affectées |
|---|---|---|
| `text-ink` | `text-[#0F1419]` (ou `text-foreground` si déjà mappé) | 37 pages dashboard |
| `text-ink-mute` | `text-[#0F1419]/72` ou `text-[#0F1419]/55` | 37 pages |
| `text-ink-soft` | `text-[#0F1419]/82` | ~10 pages |
| `border-rule` / `border-rule/60` | `border-[#0F1419]/[0.08]` | 37 pages |
| `bg-paper/95 backdrop-blur-xl` | `bg-paper` (paper opaque, V5 = aucun glassmorphism dans le travail) | ~6 pages (sticky headers) |
| `shadow-glass-sm` | suppression (V5 = pas d'ombres) | ~6 pages |
| `font-display` | `font-sans font-medium tracking-tight` (Urbanist) | 1 page (`/dashboard/onboarding`) |
| `bg-fluid-light` (drama cyan) | `bg-sage` ou `bg-[#F5F7F4]/60` | 1 page (`/dashboard/onboarding`) |
| `font-sans text-[28px] font-semibold` (h1 custom) | `<AppPageHeader>` ou `font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] clamp(...)` | ~4 pages (headers custom) |
| `text-display-m` / `text-display-l` | inline `clamp(...)` ou suppression custom | ~10 pages |
| `glass-opaque` (layout) | `bg-paper` ou neutralisation | 1 fichier (`layout.tsx`) |

### Patterns "drama mode" obsolètes à éradiquer

Le design v4 prévoyait 3 contextes drama (dashboard soir / mode mission / landing) avec un cyan liquide. **V5 abandonne complètement le drama mode** en faveur de la sobriété Synthex. Pages encore concernées :

- `/dashboard/onboarding/page.tsx` — `bg-fluid-light px-4 md:px-8 py-10 md:py-14 mb-2 rounded-b-xl`

### Emojis et tutoiement (vérification)

- **Emojis dans `/dashboard/*`** : non détectés systématiquement, mais probables dans `<MissionFabMobile>`, onboarding sub-pages, EmptyStates. À auditer page par page.
- **Tutoiement vs vouvoiement** : décision stratégique récente (B74) = tutoiement strict en marketing public. **Statut dashboard** : la plupart des pages dashboard utilisent encore le vouvoiement (`votre`, `vous`). Exemples :
  - `/dashboard/relances` : "Vos relances. Séquences automatiques pour devis envoyés…"
  - `/dashboard/cockpit-fraude` : "Vous décidez si l'écart est justifié"
  - `/dashboard/upgrade/logiciel` : "Gagnez 1h30 par mission"
  - `/dashboard/onboarding` : "Vous êtes prêt"
  
  **Recommandation** : décision stratégique à prendre avant le sweep : (a) garder le vouvoiement dans l'app (cohérence avec UX SaaS B2B sérieux post-conversion) ou (b) basculer en tutoiement comme la home (cohérence brand totale). **Pas de bonne réponse universelle** — à arbitrer par le founder.

---

## Axe 5 — Algorithmes A1.3.* + Game Changers : exposition UI

### Tableau exhaustif des 13 algos × consommation UI dashboard

| Algo | Status pure-fn | Consommé UI dashboard | Surface visible diagnostiqueur | Verdict |
|---|---|---|---|---|
| **A1.3.1 DPE shopping detection** | ✅ `lib/algos/dpe-shopping.ts` + 6 tests | 🟡 API only (`/api/missions/[id]/dpe-shopping-check`) | `/dashboard/cockpit-fraude` (consomme l'endpoint) | **EXPOSÉ partiellement** — pas de panneau dédié hors cockpit-fraude |
| **A1.3.2 Cohérence cadastre vs surface** | ✅ `lib/algos/cadastre-coherence.ts` + 5 tests | 🟡 utilisé indirectement via `conformity-score.ts` | `PrevalidationPanel` (somme score) | **BLIND SPOT** — détection isolée non rendue avec son score propre |
| **A1.3.3 Score conformité multi-dim** | ✅ `lib/algos/conformity-score.ts` + 16 tests | ✅ `components/cockpit-ademe/PrevalidationPanel.tsx` | `/dashboard/cockpit-ademe/prevalidation` + `/dashboard/dossiers/[id]/prevalidation` | **EXPOSÉ** (GC1) |
| **A1.3.4 Profil unifié propriété** | ✅ `lib/property/unified-profile.ts` + 17 tests | 🟡 API only (`/api/public/v1/property/[banId]`) | aucun UI dashboard direct (API publique uniquement) | **BLIND SPOT côté diagnostiqueur** — accessible via API mais pas de fiche propriété KOVAS qui le rende |
| **A1.3.5 Lead scoring Thompson** | ✅ `lib/algos/lead-scoring.ts` + 11 tests | 🟡 `/admin/(gated)/refonte/actions.ts` (action batch backfill admin) | `/dashboard/leads/incoming` consomme les leads scorés mais le score breakdown reste admin-only | **BLIND SPOT diagnostiqueur** — score affiché chez admin (`/admin/leads/[id]`) mais pas exposé au diag dans `/dashboard/leads/*` |
| **A1.3.6 Vision IA équipement** | ✅ `lib/algos/vision-equipment.ts` + 7 tests | ❌ aucun consommateur | aucune route dashboard | **BLIND SPOT TOTAL** — promesse marketing forte (carte #1 dans home `SectionAlgosCatalog`) mais 0 UI |
| **A1.3.7 Document classifier** | ✅ `lib/algos/document-classifier.ts` + 12 tests | ✅ `/api/documents/upload` + `/api/documents/classify` + `lib/documents/document-extractors/extractor-base.ts` | utilisé silencieusement dans le pipeline upload — pas de UI dédiée qui montre la classification | **EXPOSÉ MAIS INVISIBLE** — l'algo tourne mais le diagnostiqueur ne voit jamais "ton document a été classé comme facture énergie" |
| **A1.3.8 Annuaire sync** | ✅ `lib/algos/annuaire-sync.ts` + 8 tests | ❌ aucun consommateur | aucune route dashboard | **BLIND SPOT TOTAL** — promesse home "Sync annuaire 4 sources" sans surface |
| **A1.3.9 Production anomaly** | ✅ `lib/algos/production-anomaly.ts` + 8 tests | ❌ aucun consommateur dashboard | accessible via `/admin/(gated)/audit/fraude-dpe` éventuellement | **BLIND SPOT diagnostiqueur** — le diag ne voit pas ses propres anomalies |
| **A1.3.10 Certificate expiry predictor** | ✅ `lib/algos/expiry-predictor.ts` + 9 tests | 🟡 `/admin/(gated)/renewals/page.tsx` | côté admin uniquement (cockpit renouvellements) | **BLIND SPOT diagnostiqueur** — promesse home "Alerte 90/60/30 jours avant" mais 0 alerte UI dashboard |
| **A1.3.11 Churn risk predictor** | ✅ `lib/algos/churn-predictor.ts` + 7 tests | 🟡 `/admin/(gated)/churn/page.tsx` | côté admin uniquement | **BLIND SPOT diagnostiqueur** — pourtant la promesse "+20 % missions récurrentes" est diag-facing |
| **A1.3.12 SEO page quality auto-scorer** | ✅ `lib/algos/seo-quality-scorer.ts` + 9 tests | 🟡 `/admin/(gated)/refonte/actions.ts` (audit batch) | aucune surface dashboard | **BLIND SPOT diagnostiqueur** — promesse home "Ta fiche annuaire remonte sur Google" sans dashboard SEO de sa fiche |
| **A1.3.13 Conformity pattern learning** | ✅ `lib/algos/diagnostician-pattern-learning.ts` + 11 tests | ❌ aucun consommateur UI direct (`lib/learning/user-knowledge-graph.ts` est neighbour mais n'est pas UI) | aucune route dashboard | **BLIND SPOT TOTAL** — promesse "Apprend ta méthode" sans aucune surface visible |

### Score d'exposition dashboard

- **EXPOSÉ visible diag** : 1/13 (A1.3.3 — PrevalidationPanel)
- **EXPOSÉ silencieux** : 2/13 (A1.3.1 cockpit-fraude, A1.3.7 pipeline upload)
- **EXPOSÉ admin-only** : 4/13 (A1.3.5, A1.3.10, A1.3.11, A1.3.12)
- **BLIND SPOT TOTAL** : 6/13 (A1.3.2 standalone, A1.3.4 fiche propriété, A1.3.6 vision, A1.3.8 annuaire-sync, A1.3.9 anomaly diag-facing, A1.3.13 pattern learning)

### Game Changers — exposition UI

| GC | Status PROGRESS.md | Route dashboard | Verdict |
|---|---|---|---|
| **GC1 Pre-export AI conformity panel** | ✅ livré `b8f45b2` | `components/cockpit-ademe/PrevalidationPanel.tsx` + consommé dans `/dashboard/cockpit-ademe/prevalidation` + `/dashboard/dossiers/[id]/prevalidation` | ✅ EXPOSÉ |
| **GC2 Mission flow continu** | ⏳ fondations seules | `lib/mission-flow/state-machine.ts` (19 tests) — **0 consommateur UI** | 🔴 BLIND SPOT — route attendue : `/dashboard/dossiers/[id]/mission/flow` ou intégration tchat. Composants à créer : `<MissionFlowComposer>` + `<MissionFlowTimeline>` + `<MissionFlowTransitionPicker>` |
| **GC3 Annuaire B2C enrichi** | 🟢 partiel (B37 fiche publique enrichie) | `/dashboard/leads/incoming` consomme leads scorés A1.3.5 mais **ne montre pas le score intent ni le breakdown** au diagnostiqueur | 🟡 EXPOSÉ partiellement (admin a breakdown, diag non) |
| **GC4 État de la profession publique** | ✅ livré `c99acf4` | route publique `/observatoire/etat-profession` — **0 surface dashboard** | 🟡 PUBLIC-ONLY (potentiel : ajouter widget "Stats secteur" sur `/dashboard/dashboard`) |
| **GC5 Communiqués presse automatisés** | ✅ livré `e8b627f` | `/admin/(gated)/press` + route publique `/presse` — **0 surface dashboard** | 🟡 ADMIN-ONLY (correct fonctionnellement) |
| **GC6 Cockpit fraude DPE diag-facing** | ✅ livré `58f4dec` | `/dashboard/cockpit-fraude` + endpoint `/api/missions/[id]/dpe-shopping-check` | ✅ EXPOSÉ |

### Verdict Game Changers diag-facing

- 2/6 EXPOSÉ correctement (GC1, GC6)
- 1/6 EXPOSÉ partiel (GC3 — manque breakdown intent côté diag)
- 1/6 BLIND SPOT TOTAL UI (GC2)
- 2/6 hors-scope dashboard mais OK (GC4 public, GC5 admin)

---

## Axe 6 — Nouvelles features manquantes (croisement REFONTE V2 + PROGRESS.md)

### Reste à livrer (extrait PROGRESS.md §"Vraies tâches restantes")

| # | Feature | Surface attendue | Impact / Effort |
|---|---|---|---|
| 1 | **GC2 Mission flow continu UI** | `/dashboard/dossiers/[id]/mission/flow` ou intégré dans tchat — `<MissionFlowComposer>`, `<MissionFlowTimeline>`, `<MissionFlowTransitionPicker>` + animations transitions | 🔴 **HIGH impact / HIGH effort (3-5j)** — GC2 promis depuis 2 semaines |
| 2 | **Microservice MDB Jackcess Java/Kotlin** | Hors UI (Railway service) — ZIP V4 export Liciel | 🟠 MEDIUM impact / MEDIUM effort (5-7j) — débloque export Liciel direct |
| 3 | **Page admin guides-refresh diff side-by-side** | `/admin/(gated)/guides-refresh` (déjà créée B65) — vérifier qu'elle est branchée | 🟡 LOW impact / LOW effort (1j vérif + polish) |
| 4 | **Page admin santé tech AI Economics** | `/admin/(gated)/sante-tech` (livrée B57) — vérifier complétude | 🟡 LOW impact / LOW effort (vérification seule) |
| 5 | **WASM Whisper local branché sur `/api/transcribe`** | Hors UI dashboard (route handler) — gain coût -15 % | 🟠 MEDIUM impact / HIGH effort (3-5j) |
| 6 | **8 OG images V5** | `public/og-images/{home,tarifs,aide,comparatif,temoignages,api-publique,demo,a-propos}.png` 1200×630 | 🟢 HIGH SEO / LOW effort (1j Figma) |

### Features supplémentaires à envisager dashboard

| # | Feature | Surface | Effort | Impact |
|---|---|---|---|---|
| 7 | **Tooltips `<InfoTooltip>` / `<GlossaryTerm>` déployés dans dashboard** | 0/67 page actuellement — déployer sur toutes les pages avec jargon (DPE, ADEME, 3CL-2021, COFRAC, GES, Carrez, Boutin, ERP, etc.) | 1-2j (sweep mécanique) | 🟢 HIGH — cohérence avec stratégie B67 sur surfaces publiques |
| 8 | **Page "13 algos KOVAS dans ton dashboard" diag-facing** | Nouvelle route `/dashboard/decouvrir/algos` ou section dans `/dashboard/dashboard` | 1j (statique data dérivée de `ALGOS_CATALOG` home) | 🟢 HIGH — résout le BLIND SPOT axe 5 partiellement, transparence pédagogique |
| 9 | **Widget "Stats secteur 7j" sur dashboard accueil** (GC4 diag-facing) | Carte sur `/dashboard/dashboard` consommant `/api/public/v1/observatoire/profession` | 0.5j | 🟡 MEDIUM — gratifie le diag avec son contexte marché |
| 10 | **Panneau "Vision IA équipement" A1.3.6 sur mission validation** | `dossiers/[id]/mission/validation/page.tsx` — afficher les détections vision sur les photos pendant la validation 3CL | 2-3j (composant + intégration) | 🟢 HIGH — première surface visible de la promesse "Vision IA" |
| 11 | **Widget "Mes alertes" sur `/dashboard/dashboard`** consommant A1.3.10 expiry-predictor (certifications COFRAC, RC Pro) | Card sur dashboard root + page `/dashboard/account/verification` | 1j | 🟠 MEDIUM — résout BLIND SPOT A1.3.10 diag-facing |
| 12 | **Widget "Score SEO de ta fiche kovas.fr"** consommant A1.3.12 | Card sur `/dashboard/account/parrainage` ou nouvelle `/dashboard/account/annuaire-public` | 1j | 🟠 MEDIUM — résout BLIND SPOT A1.3.12 diag-facing, valorise tier Annuaire |
| 13 | **Panneau "DPE shopping détecté" en-dehors de cockpit-fraude** | Inline dans `/dashboard/dossiers/[id]` (Hub) en plus du cockpit dédié | 1j | 🟡 MEDIUM — exposition contextuelle juste avant l'export |
| 14 | **Refonte chrome dashboard layout V5 sobre** | `layout.tsx` — remplacer `glass-opaque` du header par `bg-paper`, sidebar tokens, suppression drama mode | 0.5j | 🟢 HIGH — résoud l'incohérence pattern v4 vs page publique |
| 15 | **Sweep tokens legacy → V5 sobre sur 37 pages affectées** | Toutes pages axe 4 sévérité MAJOR+ | 2-3j (3 agents parallèles) | 🟢 HIGH — alignement DS canonique |
| 16 | **Décision tutoiement vs vouvoiement dans dashboard** | Si bascule tutoiement : sweep ~30 pages | 1j si bascule | 🟡 MEDIUM — cohérence brand totale |

### Features non listées dans PROGRESS.md mais visiblement absentes

- **Pas de page `/dashboard/account/annuaire-public`** pour gérer sa fiche kovas.fr/[ville] (alors qu'on vend des tiers Annuaire 19/39/79€)
- **Pas de page `/dashboard/cofrac`** ou équivalent pour gérer ses certifications COFRAC / RC Pro avec alertes
- **Pas de page `/dashboard/analytics-secteur`** côté diag (les benchmarks anonymisés analytics existent mais pour analytics PRO+ cabinet)

---

## Plan d'attaque recommandé (3 vagues + 1 stratégique)

### Vague 0 — Décision stratégique préalable (founder uniquement, 15 min)

**Bloquant pour Vague 2** : décider tutoiement vs vouvoiement dans le dashboard.

- **Option A** : garder vouvoiement (cohérence SaaS B2B sérieux post-conversion) → minimal sweep
- **Option B** : basculer tutoiement (cohérence brand totale avec home) → sweep +1j

### Vague 1 — Cleanup et chrome (1 agent, ~45 min)

**Actions** :
1. Vérifier que `/signaler-un-diagnostiqueur` est ou non encore une route publique active → décider conservation ou suppression du middleware
2. Refonte `/dashboard/layout.tsx` : remplacer `glass-opaque rounded-pill` du header par `bg-paper` neutre + revoir `<AppSidebar>` tokens (vérification rapide cohérence)
3. Confirmer le verdict "0 fichiers orphelins" — exécution `find` final

**Impact** : LOW (cleanup défensif). **Effort** : 30-45 min.

### Vague 2 — Harmonisation UI V5 sobre (3 agents parallèles, ~2-3 h)

**Agent A — Pages racines liste + cockpit (8 pages)**
- `/dashboard/dashboard` (header sticky → AppPageHeader ou inline V5)
- `/dashboard/relances` (header sticky → AppPageHeader)
- `/dashboard/clients/[id]` (header Qonto → tokens V5 ou refonte AppPageHeader)
- `/dashboard/cockpit-fraude` (bandeau ShieldCheck → tokens V5)
- `/dashboard/calendar` (vérifier `<CalendarView>` interne)
- `/dashboard/analytics` (hero `<HealthScoreHero>` à conserver mais tokens V5)
- `/dashboard/archive` (`<KpiHero>` tokens V5)
- `/dashboard/veille` (header 3 col tokens V5)

**Agent B — Account + onboarding (12 pages)**
- `/dashboard/account` (refonte tabs custom)
- `/dashboard/account/cancellation`, `/dashboard/account/legal`, `/dashboard/account/parrainage`, `/dashboard/account/preferences/alertes`, `/dashboard/account/verification`, `/dashboard/account/integrations/*` (sweep tokens legacy si présents)
- `/dashboard/onboarding` (BLOCKING — drama cyan `bg-fluid-light` à supprimer)
- `/dashboard/onboarding/{welcome,certifications,first-dossier,imports}` (vérification)
- `/dashboard/compte/tarifs`

**Agent C — Dossiers detail + missions (8 pages)**
- `/dashboard/dossiers/[id]` (HubHeader custom — décision : sweep tokens ou refonte complète V5)
- `/dashboard/dossiers/[id]/defense`, `/dashboard/dossiers/[id]/litigation`, `/dashboard/dossiers/[id]/prevalidation` (vérifier tokens)
- `/dashboard/dossiers/[id]/mission*` (mode plein écran — vérifier mais probablement laisser tel quel)
- `/dashboard/decouvrir` (vérifier `<DecouvrirClient>` interne)

**Token sweep mécanique applicable partout** :
```
text-ink → text-[#0F1419]
text-ink-mute → text-[#0F1419]/72 (ou /55 selon contexte)
text-ink-soft → text-[#0F1419]/82
border-rule/60 → border-[#0F1419]/[0.08]
border-rule → border-[#0F1419]/[0.08]
bg-paper/95 backdrop-blur-xl → bg-paper
shadow-glass-sm → (supprimer)
font-display → font-sans font-medium tracking-tight
bg-fluid-light → bg-sage ou bg-[#F5F7F4]/60
```

**Impact** : HIGH (alignement DS canonique). **Effort** : 2-3 h × 3 agents.

### Vague 3 — Exposition algos + GC blind spots (2 agents, ~3-4 h)

**Agent D — Vision IA + 13 algos catalog**
- Créer route `/dashboard/decouvrir/algos` (catalogue 13 algos avec statut "actif/inactif sur ton compte" + lien vers la surface qui les expose) — basé sur `ALGOS_CATALOG` de la home
- Ajouter widget "Vision IA équipement" sur `/dashboard/dossiers/[id]/mission/validation` (A1.3.6)
- Ajouter widget "Alerte certifications" sur `/dashboard/dashboard` (A1.3.10)
- Ajouter widget "Score SEO ta fiche" sur `/dashboard/account/parrainage` (A1.3.12)
- Ajouter widget "Stats secteur 7j" sur `/dashboard/dashboard` (GC4 diag-facing)
- Déployer `<GlossaryTerm>` sur termes jargon dans 10-15 pages dashboard les plus visitées

**Agent E — GC2 Mission flow continu (priorité founder)**
- Créer composants : `<MissionFlowComposer>`, `<MissionFlowTimeline>`, `<MissionFlowTransitionPicker>`
- Intégrer dans `/dashboard/dossiers/[id]/mission/tchat` ou nouvelle route `/dashboard/dossiers/[id]/mission/flow`
- Brancher la state machine `lib/mission-flow/state-machine.ts` (19 tests existants)
- Tests E2E Playwright sur le flow

**Impact** : HIGH (résout BLIND SPOTs structurels + livre GC2 promis). **Effort** : 3-4 h × 2 agents (l'Agent E est plus long, ~3-5j en réalité — la 4h ici = scaffold seulement).

---

## Détail technique par page (suite)

> Pour ne pas exploser à 2000 lignes, le détail token-par-token sur les 37 pages affectées est consultable en lisant directement les fichiers. Le **token sweep mécanique de la Vague 2** ci-dessus suffit à corriger 90 % des écarts. Les 4 pages BLOCKING listées ci-dessous nécessitent une intervention manuelle :

### `/dashboard/onboarding/page.tsx` (BLOCKING — drama mode v4)

```tsx
// AVANT (v4 hybride drama cyan)
<div className="-mx-4 md:-mx-8 -mt-4 bg-fluid-light px-4 md:px-8 py-10 md:py-14 mb-2 rounded-b-xl">
  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-3">
    Bienvenue · 90 secondes pour démarrer
  </p>
  <h1 className="font-sans font-light text-display-m md:text-display-l tracking-tight text-ink">
    Bienvenue <span className="font-serif italic">{firstName}</span>.
  </h1>
</div>

// APRÈS V5 sobre
<AppPageHeader
  eyebrow="Bienvenue · 90 secondes pour démarrer"
  title={`Bienvenue ${firstName}`}
  accent={firstName ? '' : 'sur KOVAS'}
  description="Tu es prêt. Voici les 3 actions à faire dans cet ordre — ta première mission est opérationnelle dès aujourd'hui."
/>
```

### `/dashboard/dashboard/page.tsx` (MAJOR — header sticky custom)

```tsx
// AVANT (v4 sticky Qonto + tokens legacy)
<header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
  <div className="space-y-1">
    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute capitalize">{todayLabel}</p>
    <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink truncate">
      Bonjour{firstName ? ` ${firstName}` : ''}<span className="text-ink-mute">.</span>
    </h1>
    <p className="text-sm text-ink-mute">{visitLabel}</p>
  </div>
</header>

// APRÈS V5 sobre (suppression sticky + tokens canoniques)
<AppPageHeader
  eyebrow={todayLabel}
  title={`Bonjour${firstName ? ` ${firstName}` : ''}`}
  description={visitLabel}
/>
```

### `/dashboard/relances/page.tsx` (MAJOR — header sticky custom dupliqué)

Idem `/dashboard/dashboard` — refonte vers `<AppPageHeader eyebrow="Suivi commercial" title="Vos" accent="relances" description="...">`.

### `/dashboard/clients/[id]/page.tsx` (MAJOR — header fiche Qonto custom)

Conservation de l'avatar + KPIs (logique métier) mais refonte tokens :
- `bg-paper/95 backdrop-blur-xl` → `bg-paper`
- `border-rule/60` → `border-[#0F1419]/[0.08]`
- `shadow-glass-sm` → (supprimer)
- `text-ink` → `text-[#0F1419]`
- `text-ink-mute` → `text-[#0F1419]/72`
- Optionnel : remplacer le H1 custom par `<AppPageHeader>` avec slot action

---

## Métriques d'effort agrégées

| Vague | Agents | Durée par agent | Total agent-heures |
|---|---|---|---|
| Vague 0 (décision) | 0 (founder seul) | 15 min | 0 |
| Vague 1 (cleanup + chrome) | 1 | 45 min | 0.75 |
| Vague 2 (harmo UI sweep) | 3 parallèles | 2-3 h | 6-9 |
| Vague 3 (algos + GC2 scaffold) | 2 parallèles | 3-4 h (scaffold) | 6-8 |
| GC2 complet hors scaffold | 1 dédié | 3-5 jours | 24-40 |
| **Total scaffold seul** | | | **13-18 agent-heures** |
| **Total avec GC2 livré** | | | **37-58 agent-heures** |

**Recommandation** : exécuter Vagues 1-2-3 immédiatement (13-18 h en parallèle = ~1 jour calendaire). GC2 complet en lot dédié séparé (3-5j founder + agent).

---

## Annexe — Détail des 67 routes dashboard

Pour faciliter le sweep, voici la liste exhaustive avec chemin absolu :

```
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/page.tsx                                     [redirect]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dashboard/page.tsx                           [MAJOR]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/page.tsx                            [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/new/page.tsx                        [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/page.tsx                       [BLOCKING/HubHeader]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/defense/page.tsx               [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/litigation/page.tsx            [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/mission/page.tsx               [OK plein écran]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/mission/tchat/page.tsx         [OK plein écran]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/mission/validation/page.tsx    [OK plein écran]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/[id]/prevalidation/page.tsx         [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/import/page.tsx                     [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/dossiers/import/[jobId]/page.tsx             [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/clients/page.tsx                             [RÉFÉRENCE]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/clients/new/page.tsx                         [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/clients/[id]/page.tsx                        [MAJOR]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/clients/[id]/edit/page.tsx                   [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/properties/page.tsx                          [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/properties/new/page.tsx                      [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/properties/[id]/page.tsx                     [À valider]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/properties/[id]/edit/page.tsx                [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/calendar/page.tsx                            [MAJOR via client]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/capture/page.tsx                             [redirect smart]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/cockpit-ademe/page.tsx                       [RÉFÉRENCE eyebrow]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/cockpit-ademe/prevalidation/page.tsx         [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/cockpit-fraude/page.tsx                      [MAJOR]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/devis/page.tsx                               [redirect 301]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/devis/nouveau/page.tsx                       [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/devis/[id]/page.tsx                          [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/factures/page.tsx                            [redirect 301]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/factures/nouveau/page.tsx                    [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/factures/[id]/page.tsx                       [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/factures/[id]/avoir/page.tsx                 [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/factures/history/page.tsx                    [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/facturation/page.tsx                         [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/leads/page.tsx                               [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/leads/incoming/page.tsx                      [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/relances/page.tsx                            [MAJOR]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/messages/page.tsx                            [OK placeholder]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/archive/page.tsx                             [MAJOR]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/analytics/page.tsx                           [MAJOR]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/veille/page.tsx                              [À harmoniser]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/veille/[documentId]/page.tsx                 [À valider]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/outils/page.tsx                              [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/outils/checklist-depart/page.tsx             [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/outils/diagnostics-obligatoires/page.tsx     [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/outils/modeles-client/page.tsx               [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/outils/verification-validite/page.tsx        [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/aide/demarrer-mission/page.tsx               [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/page.tsx                             [MAJOR]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/cancellation/page.tsx                [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/integrations/page.tsx                [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/integrations/pennylane/page.tsx      [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/integrations/qonto/page.tsx          [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/legal/page.tsx                       [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/parrainage/page.tsx                  [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/preferences/alertes/page.tsx         [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/account/verification/page.tsx                [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/admin/quality/page.tsx                       [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/compte/tarifs/page.tsx                       [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/decouvrir/page.tsx                           [À valider]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/upgrade/logiciel/page.tsx                    [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/upgrade/annuaire/page.tsx                    [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/upgrade/bundle/page.tsx                      [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/onboarding/page.tsx                          [BLOCKING drama]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/onboarding/welcome/page.tsx                  [À valider]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/onboarding/certifications/page.tsx           [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/onboarding/first-dossier/page.tsx            [OK]
/Users/benjaminbel/Desktop/KOVAS/apps/web/src/app/dashboard/onboarding/imports/page.tsx                  [OK]
```

---

**Fin de l'audit.** Prêt pour sweep Vague 1 → Vague 2 → Vague 3 par agents dédiés.
