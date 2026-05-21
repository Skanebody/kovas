# Audit UI/UX — Modules différenciants KOVAS

**Date** : 2026-05-20
**Auditeur** : agent UX (Claude)
**Périmètre** : 7 modules différenciants (10 routes auditées)
**Référence** : Design System v5 (Synthex sage `#F5F7F4` / chartreuse `#D4F542` / sidebar dark `#0F1419`) — CLAUDE.md §9 et `docs/design/KOVAS_UIUX_v5_Final.md`
**Avatar** : diagnostiqueur 35-55 ans, ex-cadre, ton sobre professionnel, règle des 5 secondes

---

## Synthèse — Top 10 issues par priorité

| # | Sévérité | Issue | Module concerné |
|---|---|---|---|
| 1 | **P0** | `bg-fluid-navy` legacy (gradient navy v4 abandonné en v5) utilisé sur Hero page `/app/gain` | gain |
| 2 | **P0** | Formulaire pré-validation : 10 champs en 2 blocs sans progression visible ni hint d'aide — friction cognitive forte avatar | cockpit-ademe/prevalidation |
| 3 | **P0** | `Card variant="opaque"` (rétrocompat v3 = `glass-opaque`) utilisé massivement en cockpit-ademe + Card warm avec gradient ambre. Tout le module ADEME ne respecte pas la palette sage/chartreuse v5 | cockpit-ademe, ademe components |
| 4 | **P1** | Empty state `/app/veille` (timeline vide) renvoie un simple "Aucun document ne correspond à vos filtres" sans expliquer **"la veille tourne cette nuit, repassez demain"** — anxiogène pour avatar | veille |
| 5 | **P1** | Chat veille : pas d'affichage explicite du quota restant (30 msg/h) avant le 429. L'utilisateur tape 31 messages sans warning visuel | veille/chat |
| 6 | **P1** | `/app/analytics` UpsellCard : la copy "Réservé aux tiers Standard et Volume" est sobre mais le CTA "Voir les tiers" renvoie vers `/app/account/billing` (interne), pas un comparatif — friction. Le user ne sait pas QUEL prix il doit payer | analytics |
| 7 | **P1** | `/app/communaute/nouveau` : 8 champs textarea/select sans indicateur de progression, sans estimation de temps ("5-10 min pour rédiger"). Le tooltip "Anonymisation automatique" n'explique PAS ce qui sera retiré | communaute/nouveau |
| 8 | **P1** | `/app/prescripteurs` table 8 colonnes : sur mobile, plusieurs colonnes `hidden md:table-cell` cachent les KPIs critiques (Missions, Panier moyen, Dernière) — table mobile très pauvre | prescripteurs |
| 9 | **P2** | Discussion communauté sur page veille document est un placeholder "apparaîtra prochainement" hardcodé — anti-confiance (signe que c'est inachevé) | veille/[documentId] |
| 10 | **P2** | Pas de skeleton loader / état de chargement sur les pages server-rendered. En cas de cold start Supabase, l'écran reste blanc 1-3s sans feedback | toutes |

---

## Détail par page

### 1. `/app/cockpit-ademe` + `/cockpit-ademe/prevalidation`

**Fichiers** : `apps/web/src/app/app/cockpit-ademe/page.tsx`, `prevalidation/page.tsx`, `apps/web/src/components/ademe/*.tsx`

#### Conformité DS v5 : **5/10**

**Issues palette/typo** :
- `AdemeKpiCard.tsx:58` — `Card variant="opaque"` partout (alias rétrocompat v3, pas v5). La spec v5 dit "cards solides (glass = marketing only)". OK fonctionnellement mais sémantique design system pas pure.
- `AdemeKpiCard.tsx:60` — KPI hero `text-5xl md:text-6xl` Instrument Serif italic ✓ conforme.
- `AdemeFranceMap.tsx:116` — Path silhouette FR avec `fill="rgba(212, 245, 66, 0.06)"` (chartreuse à 6%) ✓ conforme accent v5.
- `AdemeAlertsList.tsx:98` — `bg-cream-deep/60` = palette v4 (cream Ron) au lieu de v5 sage/paper.
- `AdemeKpiCard.tsx:100` — `bg-cream-deep` pour fond progress bar, idem v4.
- `AdemeProfessionComparison.tsx:56` — `bg-cream-deep` idem.
- Card variant `warm` (gradient ambre `linear-gradient(135deg, rgba(255,213,168,...))`) défini dans `card.tsx:39-43` — gradient interdit en v5 (ambre warm v3, pas v5 sage/chartreuse).
- `RISK_BADGE_CLASS` (AdemeKpiCard:36) utilise pastels `bg-lime-mist`, `bg-orange-mist`, `bg-coral-mist` (palette v3 Ron) au lieu de status pills v5.

**Radius** : `rounded-2xl` (Hero KPI) + `rounded-md` (form) + `rounded-pill` (badges) — OK partiellement, mais Card default est `rounded-lg` en variant définition (`card.tsx:6`).

#### Frictions UX (règle 5s)

| Frottement | Page | Verdict |
|---|---|---|
| 4 KPI hero en grid 4 colonnes (dpe12m, ratio_fg, distance, risk_score) | cockpit | **OK** : chiffres serif italic gros lisibles |
| CTA pré-validation : `Card` paper avec accent navy `Button variant="accent"` | cockpit:104 | **OK** : trouvable < 5s |
| Carte FR + alertes en 2 colonnes desktop | cockpit:110 | **OK** mobile : carte au-dessus, alertes en dessous |
| Formulaire pré-validation 10 champs | prevalidation | **P0** : empilement de 2 grosses cards (bien à diagnostiquer / résultats DPE) — pas de stepper visuel. Avatar voit "DPE proposé étiquette A-G" sans contexte explicatif. Default value `etiquetteDpe='D'` arbitraire (PrevalidationForm:95) |
| `LabelRadioGroup` étiquettes A-G colorées | prevalidation:285 | **OK** : pattern métier reconnu, mais `border-2` non-conforme système borders 1px |
| Pas de "barre de progression" ni de "Étape 1/2" | prevalidation | **P1** : friction cognitive |
| Submit button "Évaluer le risque" | prevalidation:271 | **OK** trouvable, état loading clair |

#### Issues techniques

- `cockpit-ademe/page.tsx:32-66` — 5 requêtes Supabase en parallèle non-réactives (force-dynamic). Pas de skeleton.
- `AdemeKpiCard.tsx:144` — badge delta affiche "vs référence" sans dire QUELLE référence.
- Bouton "Pré-valider un DPE" est l'unique CTA hero mais visuellement minoritaire par rapport aux 4 KPIs (`cockpit:97-107`).

#### Recos

- **P0** Refactor palette : remplacer toutes occurrences `bg-cream-deep` par `bg-paper`/`bg-sage`/v5 token natif dans `ademe/*.tsx`.
- **P1** Découper `PrevalidationForm` en stepper 3 étapes : (1) Bien + adresse, (2) Énergie + climatisation, (3) Résultats DPE/GES.
- **P1** Ajouter sur prevalidation un encart d'aide "Pourquoi pré-valider ?" en haut du form (économies, anti-contrôle).
- **P2** Toolt-tip "vs référence nationale (ratio F/G 27% médiane FR)" sur badges delta.

---

### 2. `/app/veille` + `/app/veille/[documentId]` + `/app/veille/chat`

**Fichiers** : `apps/web/src/app/app/veille/page.tsx`, `[documentId]/page.tsx`, `chat/page.tsx`, `apps/web/src/components/regulatory/*.tsx`

#### Conformité DS v5 : **6/10**

**Issues palette/typo** :
- `veille/page.tsx:185-194` — Header avec `font-serif italic text-4xl/5xl` ✓ conforme pattern signature v5.
- `veille/page.tsx:130` — `glass-opaque` sur form filters : OK fonctionnel.
- `RegulatoryFiltersBar.tsx:101,126,151` — `bg-navy text-paper border-navy` pour pillules actives + hover `bg-cream-deep` : v4 navy + v3 cream. **Non conforme v5** (sidebar dark unique = navy, sinon chartreuse pour states actifs).
- `RegulatoryAIChat.tsx:242` — Avatar `bg-navy text-paper` rounded-full : OK fonctionnel mais v5 préconise dark `#0F1419` sidebar-bg, pas navy.
- `RegulatoryAIChat.tsx:316` — Textarea `focus:border-navy focus:ring-navy/10` : pattern navy v4 conservé.
- `RegulatoryAIChat.tsx:349` — Bubble assistant `bg-cream-deep` : v3 Ron palette.
- `RegulatoryAIChat.tsx:339` — Bubble user `bg-navy text-paper` : OK pattern mais devrait être `bg-ink`/dark v5.
- `veille/[documentId]/page.tsx:225` — H1 `font-serif italic` ✓ v5.

#### Frictions UX (règle 5s)

| Frottement | Page | Verdict |
|---|---|---|
| Filtres en colonne sticky gauche desktop | veille | **OK** trouvable |
| Empty timeline | veille:211 | **P1** : "Aucun document ne correspond à vos filtres." Manque pédagogie : si NO filter et 0 docs (premier jour), le user ne sait pas que c'est normal et que la veille tourne nuitamment |
| CTA "Poser une question" → chat | veille:195 | **OK** : Button accent (chartreuse v5) bien visible |
| Document détail : header + résumé IA + actions appliquées | [documentId] | **OK** : structure narrative claire |
| Chat empty state "Posez votre question." | chat:282-289 | **OK** mais pas d'exemples cliquables (chips de "questions courantes") |
| Chat : streaming SSE + citation pills | chat:363-378 | **OK** : citations cliquables vers veille/[id] |
| Chat : quota 30/h | chat:196-198 | **P1** : le user voit le 429 SEULEMENT en cas de dépassement. Aucune jauge "X messages restants ce mois/h" |
| Chat erreur 429 message | chat:196 | OK : "30 messages / heure maximum. Réessayez plus tard." mais ne dit pas dans combien de temps |
| Bubble erreur stream `text-[#8B1414]` | chat:381 | **P2** : couleur hardcodée hex (pas token `var(--danger)`) |
| Bouton "Nouvelle session" | chat:263 | OK trouvable, mais perd l'historique sans confirmation (destructif silencieux) |

#### Issues techniques

- `veille/page.tsx:122-130` — Parsing filters URL très permissif (cast `as RegulatoryModule[]`). Robuste.
- `veille/page.tsx:165-169` — Mark-as-read fait directement dans page SSR : OK mais best-effort silencieux peut masquer bugs.
- `RegulatoryAIChat.tsx:67-93` — Session unique par localStorage : pas de multi-session. OK V1 mais limitation visible.
- `RegulatoryAIChat.tsx:147-153` — `handleReset` abort + crée nouvelle session sans confirmation. **P2** destructif.

#### Recos

- **P0** Empty state veille : si `timelineItems.length === 0 && noFilters`, afficher : *"La veille réglementaire tourne chaque nuit à 03h CET. Aucun document publié récemment dans votre périmètre — repassez demain ou consultez les évolutions à venir →"* (avec CTA vers UpcomingChangesPanel).
- **P1** Chat : afficher en footer "X messages utilisés / 30 cette heure" (jauge légère).
- **P1** Chat : 3 chips "questions populaires" cliquables en empty state (ex. "Durée DPE résidentiel", "Diagnostic amiante avant 1997", "Repérage plomb CREP").
- **P2** Refactor `RegulatoryAIChat.tsx:381` → `text-danger`.
- **P2** "Nouvelle session" → ouvrir confirm dialog.

---

### 3. `/app/communaute` + `/communaute/[caseId]` + `/communaute/nouveau`

**Fichiers** : `apps/web/src/app/app/communaute/page.tsx`, `[caseId]/page.tsx`, `nouveau/page.tsx`, `apps/web/src/components/community/*.tsx`

#### Conformité DS v5 : **6,5/10**

**Issues palette/typo** :
- `communaute/page.tsx:130` — `glass-opaque` form filters : OK fonctionnel.
- `CommunityCaseForm.tsx:113-122` — Confirmation success card `border-chartreuse/40 bg-chartreuse/10` ✓ v5 chartreuse usage correct.
- `CommunityCaseForm.tsx:186-188` — pill diagnostic actif `bg-navy text-paper border-navy` : navy v4 (devrait être chartreuse pour states actifs en v5).
- `[caseId]/page.tsx:161-164` — Badge "Validé par expert" `border-chartreuse/60 bg-chartreuse/15` ✓ v5.
- `[caseId]/page.tsx:208` — Question `font-serif italic text-[20px]` ✓ pattern serif éditorial.
- `CommunityCaseForm.tsx:332-333` — Error `border-accent-red/40 bg-coral-mist text-[#8B1414]` : `coral-mist` v3 Ron + hex hardcodé.

#### Frictions UX (règle 5s)

| Frottement | Page | Verdict |
|---|---|---|
| Liste cas anonymisés avec filtres 5 colonnes | communaute | **OK** : header + filtres + grid 3 cols cards |
| CTA "Partager un cas" | communaute:118 | **OK** : Button accent (chartreuse) bien visible |
| Empty state "Aucun cas ne correspond" | communaute:185 | **OK** : EmptyState avec icon + CTA |
| Form soumission `/nouveau` | nouveau | **P1** : 8 champs textarea + tags + références — long, pas de stepper, pas d'estimation de temps |
| Tooltip "Anonymisation automatique avant publication" | nouveau:342 | **P1** : trop léger. Le user veut savoir CONCRÈTEMENT ce qui est retiré (noms ? adresses ? SIRET ?) — confiance |
| Confirmation submit | CommunityCaseForm:111-122 | **OK** : card chartreuse + countdown redirect 2.5s |
| Case detail : votes + vues + responses | [caseId] | **OK** : tout visible |
| "Cas similaires" disabled "V1.5" | [caseId]:247 | **P2** : montrer disabled OK, mais le user comprend que c'est inachevé |

#### Issues techniques

- `CommunityCaseForm.tsx:73-109` — Submit avec validations clientes minimales (`minLength`). Pas de feedback de validation inline avant submit.
- `communaute/page.tsx:99` — `q.replace(/[%_]/g, ' ')` — protection SQL OK.
- `[caseId]/page.tsx:81-117` — `MarkdownLike` custom rendu pseudo-markdown — pas une lib robuste (no inline emphasis, no links).
- `[caseId]/page.tsx:135-137` — Increment views fire-and-forget : OK.

#### Recos

- **P1** Modal "Comment l'anonymisation fonctionne" : checklist visuelle de ce qui est retiré (noms propres, adresses précises, n° de tel, SIRET). Lien depuis le hint `nouveau:342`.
- **P1** Ajouter stepper 3 étapes : (1) Type de bien, (2) Contexte + question, (3) Décision + tags.
- **P1** Préciser sur header "5-10 min pour rédiger un cas complet" (réduit angoisse "combien ça va prendre").
- **P2** Remplacer `MarkdownLike` par `FaqAnswer` (déjà utilisé en veille).

---

### 4. `/app/analytics`

**Fichier** : `apps/web/src/app/app/analytics/page.tsx` + `apps/web/src/components/analytics/*.tsx`

#### Conformité DS v5 : **7/10**

**Issues palette/typo** :
- `analytics:172-186` — UpsellCard (EmptyState avec icon Lock) — copy sobre ✓ conforme avatar sobre.
- KpiHero 4-grid avec serif italic ✓ v5.
- `analytics:434` — Footer Card `bg-cream-deep/50` — v3 palette.
- Pas de gradient/glow détecté ✓.

#### Frictions UX (règle 5s)

| Frottement | Verdict |
|---|---|
| Gating tier inactif → EmptyState Lock + "Réservé aux tiers Standard et Volume" | **OK conforme avatar sobre, mais P1 :** le CTA "Voir les tiers" pointe vers `/app/account/billing` (page de gestion abo interne), pas une comparaison. Le user ne voit pas le prix. |
| `secondaryAction` "Voir le Gain Tracker" | **OK** alternative douce |
| Hero KPIs 4 cards (CA, Missions, Health, Panier) | **OK** lisible < 5s |
| Health score breakdown | **OK** mais 3-col gardes une vue tassée mobile |
| Benchmarks "Panier moyen" + "Volume mensuel" | **OK** : médiane FR + recommandation textuelle si écart |
| Footer informatif K-anonymity | **OK** : très bon pour confiance avatar |

#### Issues techniques

- `analytics:163-188` — Gating server-side propre.
- `analytics:191-199` — Snapshots `period_type='month'` limit 12 : OK.
- `analytics:286-454` — Hero + 7 sections : très dense, pourrait scroller longtemps.

#### Recos

- **P1** UpsellCard `action` → `/pricing#compare` (page publique avec table comparative + prix) plutôt que `/app/account/billing`.
- **P1** Mentionner explicitement dans la copy upsell : *"À partir de 59€ HT/mois (tier Standard)."* — règle 5s : le user voit le coût en 1 lecture.
- **P2** Refactor `bg-cream-deep` → `bg-sage`/`bg-paper`.

---

### 5. `/app/prescripteurs`

**Fichier** : `apps/web/src/app/app/prescripteurs/page.tsx`

#### Conformité DS v5 : **6,5/10**

**Issues palette/typo** :
- 4 KpiHero ✓ pattern v5.
- `prescripteurs:197` — Form filters `glass-opaque` OK.
- `prescripteurs:303` — Silent badge `bg-coral-mist text-[#8B1414]` : v3 + hex hardcodé.
- `PRESCRIBER_TIER_BADGE_CLASS` (lib types) probablement définie avec pastels v3.

#### Frictions UX (règle 5s)

| Frottement | Verdict |
|---|---|
| 4 KPIs hero (Prescripteurs actifs / CA total / Tier dominant / Silencieux) | **OK** : structure narrative claire |
| Form filters 3 selects + bouton Filtrer | **OK** trouvable |
| Empty state "Aucun prescripteur encore" | **OK** : EmptyState Network |
| Table 8 colonnes (Nom, Type, Tier, Missions, CA, Panier, Dernière, Actions) | **P1** : sur mobile, 5 colonnes cachées (`hidden md:`, `hidden sm:`, `hidden lg:`) → mobile montre Nom + Tier + CA + Actions. Type/Missions/Panier/Dernière invisibles. Avatar mobile perd la valeur métier. |
| Indicateur silent rouge avec tooltip "Silencieux depuis X jours" | **OK** clair |
| Boutons Appeler/Email inline | **OK** : touch targets via `size="sm"` (min-h 36px) — limite touch 44px |

#### Issues techniques

- `prescripteurs:262-326` — Table très dense. Pas de pagination visible (`limit(200)` brut).
- `prescripteurs:316` — `tel:` et `mailto:` directs : OK.
- Pas de tri visuel (sort indicators) sur les colonnes du tableau — uniquement via select form séparé.

#### Recos

- **P1** Vue mobile : card stack à la place de table (chaque prescripteur = card avec nom + tier badge + CA + silent + actions).
- **P1** Bouton actions sm `min-h-[36px]` < 44px touch standard. Mettre `size="default"` sur Appeler/Email.
- **P2** Sort indicators dans les `<th>` du tableau (click-to-sort sans form reload).

---

### 6. `/app/archive`

**Fichier** : `apps/web/src/app/app/archive/page.tsx`

#### Conformité DS v5 : **7/10**

**Issues palette/typo** :
- 3 KpiHero (Fichiers / Volume / Dernier ajout) ✓ pattern v5.
- AppPageHeader avec accent "fichiers" serif italic ✓.
- Pas de gradient/glow détecté ✓.
- ArchiveTable et ArchiveFilters non audités en détail mais nommés ✓.

#### Frictions UX (règle 5s)

| Frottement | Verdict |
|---|---|
| Header + ArchiveBulkExportButton dans action slot | **OK** : trouvable |
| 3 KPIs hero | **OK** clair |
| Filtres + table | **OK** layout sobre |
| `formatBytesShort` : "X Ko/Mo/Go" | **OK** lisible |
| `formatRelative` : date courte FR | **OK** |
| KPI "Volume utilisé" hint "Calculé sur les 200 fichiers les plus récents" | **P2** : confusing — pourquoi 200 ? L'avatar peut penser que c'est tout son volume |

#### Issues techniques

- `archive:121-144` — 2 aggregations (global + filtered) + clients query parallel. Bon pattern.
- `archive:147-149` — `totalBytes` sur 200 fichiers max — sous-estime pour gros comptes. P2.

#### Recos

- **P2** Hint plus clair : *"Volume estimé sur 200 fichiers les plus récents. Volume total : <a href='/api/billing/usage'>voir le détail</a>"*.

---

### 7. `/app/gain`

**Fichier** : `apps/web/src/app/app/gain/page.tsx`

> Note : refonte en cours (tâche #23 in_progress par autre agent). Audit à l'instant T.

#### Conformité DS v5 : **3/10** — **NON CONFORME v5**

**Issues palette/typo critiques** :
- `gain:88` — `bg-fluid-navy` : **gradient navy v4 abandonné en v5**. La spec v5 dit explicitement "cards solides (glass = marketing only)" et "background sage pâle `#F5F7F4`". Le Hero `/app/gain` reste sur le pattern Drama navy v4.
- `gain:115,125,138,148` — `<GlassCard variant="dark">` avec serif italic blanc sur navy : pattern Drama v4.
- `gain:93` — `<Button variant="glass">` avec override `border-paper/25 bg-paper/10` — verre dark v4.
- `gain:188` — `barColor="#0F2436"` et `dotColor="#D4F542"` : hex hardcodés, mais chartreuse OK v5.
- `gain:168` — Card `p-8` : OK.

#### Frictions UX

| Frottement | Verdict |
|---|---|
| Header Drama navy + 4 KPI hero white-on-navy | **OK visuellement, mais contradiction DS v5** |
| KPI "Missions ce mois" / "Productivité gagnée" / "Temps moyen" / "Productivité €" | **OK clairs** |
| `eurosProductivity = Math.round((totalMinutes / 60) * EUROS_PER_HOUR)` à 50€/h | **P1** : hardcoded constant — l'avatar facture 60-80€/h. Devrait être configurable / lu depuis user profile |
| Bar chart 12 mois | **OK** : pattern signature v5 |
| GainTrackerCard + DpeCounterCard | **OK** : composants v5 corrects |

#### Recos

- **P0** Refonte cohérente avec v5 : supprimer `bg-fluid-navy` hero, remplacer par card paper solide avec KPIs serif italic noirs sur sage. Cf. tâche #23 in_progress.
- **P1** `EUROS_PER_HOUR` lu depuis user_profile.hourly_rate (avec fallback 50€).
- **P1** `MINUTES_SAVED_PER_MISSION` justifié par mesure réelle ou affiché comme "estimation conservative".

---

## Patterns systématiques à corriger

### Pattern 1 — Palette v3/v4 résiduelle dans modules différenciants

**Occurrences** :
- `bg-cream-deep` : 8+ usages (AdemeKpiCard, AdemeProfessionComparison, AdemeAlertsList, RegulatoryFiltersBar, RegulatoryAIChat, analytics footer)
- `bg-coral-mist` / `text-[#8B1414]` : prescripteurs, community form
- `bg-lime-mist` / `bg-orange-mist` : AdemeKpiCard risk badges
- `bg-navy` (en lieu et place de sidebar-bg dark v5) : RegulatoryFiltersBar pills actives, RegulatoryAIChat avatar/bubble, CommunityCaseForm pills

**Reco globale** : passe de remplacement systématique :
- `bg-cream-deep` → `bg-paper` ou `bg-sage` selon contexte
- `bg-navy` pour states actifs → `bg-chartreuse text-ink` (accent unique v5)
- pastels mist → tokens sémantiques `--status-*`

### Pattern 2 — `Card variant="opaque"` mais déclaré v5 "cards solides"

`card.tsx:9` définit `opaque: 'glass-opaque text-ink'`. Sémantique floue : la card "opaque" utilise un utility `glass-*`. Conforme fonctionnellement mais l'utilisation massive de `variant="opaque"` brouille la distinction "card solide travail" vs "glass surface flottante". 

**Reco** : renommer `variant="opaque"` en `variant="solid"` ou unifier en `flat` (déjà défini comme alias :11).

### Pattern 3 — Formulaires longs sans stepper

`PrevalidationForm` (10 champs), `CommunityCaseForm` (8 champs textarea + tags). Tous en page unique scrollable sans indicateur de progression. Avatar 43 ans, méfiant, sensible simplicité → friction cognitive.

**Reco** : stepper 2-3 étapes pour tous formulaires > 6 champs.

### Pattern 4 — Empty states pas assez pédagogiques

`/app/veille` empty timeline = juste "Aucun document". `/app/prescripteurs` empty = OK pédagogique mentionne workflow. `/app/communaute` empty filters = OK.

**Reco** : tout empty state mentionne **(1) pourquoi c'est vide, (2) quand ça se remplira, (3) action immédiate possible**.

### Pattern 5 — Quotas non visibles avant le 429

Chat veille (30/h) : feedback uniquement à 429. Pas de jauge "X messages restants".

**Reco** : afficher un compteur léger dans footer du chat. Étendre le pattern aux autres quotas (missions, voice minutes).

### Pattern 6 — Touch targets sous 44px sur mobile

`Button size="sm"` = `min-h-[36px]` (button.tsx:33). Utilisé sur `/app/prescripteurs` table actions (Appeler/Email), `/app/communaute` filter reset.

**Reco** : sur mobile (< 768px), forcer min-h-44px via media query CSS dans `globals.css`.

### Pattern 7 — Tables responsive cassées

`/app/prescripteurs` : 5 colonnes cachées en mobile. `/app/archive` ArchiveTable non audité mais probable même pattern.

**Reco** : pattern global "Table → Card stack sur mobile" dans `<AppListTable>` (déjà composant abstrait).

---

## Recap chiffres

- **Pages auditées** : 10 (7 modules + 3 sous-pages)
- **Issues P0** : 3 (gain bg-fluid-navy, prevalidation friction cognitive, cockpit-ademe palette v3/v4)
- **Issues P1** : 7
- **Issues P2** : 6+
- **Score conformité DS v5 moyen** : 5,7/10
- **Modules les plus problématiques** : `/app/gain` (3/10), `/app/cockpit-ademe` (5/10)
- **Modules les plus alignés v5** : `/app/analytics` (7/10), `/app/archive` (7/10)
