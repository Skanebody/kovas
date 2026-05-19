# KOVAS — UI/UX Complet de l'Application (v4 canonique)

> **Document de référence canonique pour le design system KOVAS v4** — 19 mai 2026
>
> **Authority** : ce document supersède CLAUDE.md §9 sur les détails de spec composant et tokens. CLAUDE.md reste autorité sur les règles produit / business / vocabulaire.
>
> **Inspiration visuelle** : Payrix/Drippi (drama cyan liquide) + Synthex (clear productif). Design system KOVAS v3+ étendu.
>
> **Time-box dev validé** : 3 sprints A/B/C (~12j) sur les fondations + 3 écrans clés. Le reste (Performance / Messages / Biens / Facturation détaillée / Onboarding 4 écrans) → V1.5 post-MVP.

---

## 1. Système visuel hybride — Clear / Drama

KOVAS v4 utilise **deux ambiances visuelles complémentaires** :

### Mode "Clear" (par défaut, productif — 80% du temps)
- Fond `#FAFBFC` (presque blanc)
- Glass cards floating ombre subtile
- KPI navy en grande typo
- Sidebar navy `#0F2436` toujours sombre
- Pages : Liste dossiers, Page dossier, Planning, Clients, Biens, Facturation, Compte

### Mode "Drama" (moments forts — 20% du temps)
- Fond : gradient cyan liquide `#4A8FB5 → #DFF3EB`
- Glass cards translucides ultra premium
- KPI hero Instrument Serif italic 120-168px
- Pages : Dashboard matin (Drama cyan), Dashboard soir (Drama navy), Mode mission (Drama navy plein), Onboarding, Performance hero, success states

### Règle de switch
| Écran | Mode |
|---|---|
| Dashboard matin (avant 14h) | **Drama cyan** — émotion départ |
| Dashboard soir (après 14h) | **Drama navy intense** — récap héroïque |
| Mode mission (drawer) | **Drama navy plein** — focus immersif |
| Liste dossiers, dossier, planning, clients, biens, facturation, compte | Clear |
| Performance | Drama partiel (KPI hero Drama, tableau Clear) |

---

## 2. Design tokens v4 — figés

```css
:root {
  /* Navy 5 niveaux */
  --navy-900: #0F2436;  /* Sidebar, hero deep */
  --navy-800: #163144;  /* Boutons primary */
  --navy-700: #1B405B;  /* Brand principal */
  --navy-600: #2A5478;  /* Hover */
  --navy-500: #3B6995;  /* Accent */

  /* Clear */
  --clear-bg: #FAFBFC;
  --clear-elevated: #FFFFFF;
  --clear-mint: #DFF3EB;
  --clear-mint-deep: #C5E5D5;

  /* Drama cyan liquide */
  --cyan-deep: #1B6FA0;
  --cyan-base: #5FA5CB;
  --cyan-light: #8FC5DC;
  --cyan-pale: #C5DDE8;

  /* Accents */
  --amber: #F59E0B;
  --coral: #F87171;
  --green: #10B981;

  /* Status (5 figés) */
  --status-amber: #F59E0B;
  --status-blue: #3B82F6;
  --status-green: #10B981;
  --status-coral: #F87171;
  --status-muted: #94A3B8;

  /* Diagnostic chips (8 types) */
  --chip-dpe:       #DBEAFE;  /* blue-mist */
  --chip-amiante:   #FED7AA;  /* orange-mist */
  --chip-plomb:     #FECACA;  /* coral-mist */
  --chip-gaz:       #D9F99D;  /* lime-mist */
  --chip-elec:      #DDD6FE;  /* violet-mist */
  --chip-termites:  #FEF3C7;  /* cream-deep */
  --chip-carrez:    #E0E7FF;  /* indigo-mist */
  --chip-erp:       #FED7E2;  /* pink-mist */

  /* Glass */
  --glass-bg-light:   rgba(255,255,255,0.45);
  --glass-bg-medium:  rgba(255,255,255,0.55);
  --glass-bg-strong:  rgba(255,255,255,0.72);
  --glass-bg-dark:    rgba(255,255,255,0.10);
  --glass-border:     rgba(255,255,255,0.4);
  --glass-shadow:     0 8px 32px rgba(15,36,54,0.08), 0 1px 0 0 rgba(255,255,255,0.5) inset;

  /* Typo */
  --font-body:    'Urbanist', sans-serif;
  --font-display: 'Instrument Serif', serif;
  --font-mono:    'JetBrains Mono', monospace;

  /* Spacing 4x */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px;
  --s-12: 48px; --s-16: 64px; --s-20: 80px;

  /* Radius */
  --r-sm: 8px;  --r-md: 14px; --r-lg: 22px;
  --r-xl: 28px; --r-2xl: 36px; --r-full: 999px;

  /* Motion */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 3. Composants atomiques canoniques (à utiliser PARTOUT)

### `<Pill>` — 5 variants
- `primary` : navy `#163144`, ombre, hover lift
- `amber` : ambre `#F59E0B`, énergie positive — **MAX 1 par écran**
- `glass` : translucide blanc, sur fonds colorés
- `ghost` : transparent, actions secondaires
- `danger` : coral `#F87171`, suppressions

Sizes : sm (h-7 px-3), md (h-9 px-5), lg (h-11 px-7). Tous `rounded-pill`.

### `<GlassCard>` — 4 variants
- `light` : `rgba(255,255,255,0.45)` — overlays
- `medium` : `0.55` — cards intérieures, missions preview
- `strong` (défaut) : `0.72` — cards principales
- `dark` : `rgba(255,255,255,0.10)` — sur fond Drama navy

Backdrop blur 40px saturate 180% + border subtle. Padding sm/md/lg/xl.

### `<StatusPill>` — 5 variants (mission/dossier/facture)
- `amber` (en cours, pulse)
- `blue` (programmée)
- `green` (terminée)
- `coral` (problème, en retard)
- `muted` (à démarrer, brouillon)

Dot 6px + halo glow + label canonique.

### `<DiagChip>` — 8 types diagnostic
- `DPE` → blue-mist `#DBEAFE`
- `AMIANTE` → orange-mist `#FED7AA`
- `PLOMB` → coral-mist `#FECACA`
- `GAZ` → lime-mist `#D9F99D`
- `ELECTRICITE` → violet-mist `#DDD6FE`
- `TERMITES` → cream `#FEF3C7`
- `CARREZ` → indigo-mist `#E0E7FF`
- `ERP` → pink-mist `#FED7E2`

Format : pill 11px uppercase 700, padding 2px 8px.

### `<WorkflowStepper>` — 2 colonnes × 3 étapes
6 étapes KOVAS canoniques :
1. Identité bien
2. Pré-visite
3. Pièces
4. Saisie terrain (mode mission)
5. Relevés spécifiques
6. Validation & livraison

Lignes de connexion : bleu plein (complétée), pointillé bleu (en cours), pointillé coral (à risque), pointillé gris (à venir).

---

## 4. Sitemap canonique 12 sections

```
/                       → Aujourd'hui (dashboard matin/soir auto-switch)
/dossiers               → Liste dossiers
/dossiers/[id]          → Page dossier (workflow stepper + sections accordion)
/dossiers/new           → Créer dossier
/planning               → Vue jour/semaine/mois
/clients                → Liste clients
/clients/[id]           → Page client
/biens                  → Liste biens (V1.5)
/biens/[id]             → Page bien (V1.5)
/facturation/{devis,factures,avoirs}  → Facturation (V1.5)
/performance            → KPI hero + tables (V1.5)
/messages               → Conversations clients (V1.5)
/compte/*               → 10 sections paramètres
```

**Pages déjà actives** : dashboard, dossiers, clients, planning (calendar), compte.
**Pages à créer V1.5** : biens, facturation, performance, messages.

---

## 5. Règles strictes (non négociables)

- **Urbanist** 100% du texte UI sauf KPI hero
- **Instrument Serif italic** UNIQUEMENT : hero KPI + emphasis dans titres
- **JetBrains Mono** : IDs techniques, montants tabular-nums
- **UN seul `<Pill variant="primary">` par écran**
- **MAX UN `<Pill variant="amber">` par écran**
- **JAMAIS de spinner rond** — toujours skeleton glass
- **JAMAIS de modale centrée mobile** — toujours bottom sheet (vaul)
- **Touch targets ≥ 44pt** sur mobile
- **Animations spring** `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Glass requires** `backdrop-filter blur(40px) saturate(180%)` + `-webkit-backdrop-filter`

---

## 6. Vocabulaire produit figé

✅ **TOUJOURS** : mission · dossier · diagnostic · rapport · propriétaire · vendeur · acquéreur · client · relevé · checklist · bien · tournée · planning · RDV · prix · tarif · mode terrain · livraison

❌ **JAMAIS** : affaire · livrable · intervention · donneur d'ordre · prospect · passoire thermique · commande · compte (pour client)

---

## 7. Microcopy canonique

| Contexte | Phrase exacte |
|---|---|
| CTA matin | "Démarrer la tournée" |
| CTA mission | "Démarrer la mission" |
| CTA fin mission | "Terminer la mission" |
| CTA livraison | "Livrer au client" |
| Header matin | "Bonjour Benjamin, aujourd'hui sera dense." |
| Header soir succès | "Belle journée, Benjamin." |
| Section alertes matin | "À traiter avant de partir" |
| Section docs propriétaire | "Ce que le client nous a envoyé" |
| Zone sensible compte | "Actions définitives" |
| Empty matin | "Journée libre. Profitez-en." |
| Empty liste dossiers | "Premier dossier en 90 secondes." |
| Mode offline | "Mode hors ligne · synchronisation au retour" |
| Mesure incohérente | "Cette mesure semble incohérente." |

---

## 8. Roadmap d'implémentation time-boxée (3 sprints validés)

### Sprint A — Fondations atomiques (4j)
- [ ] Tokens v4 figés (CSS variables + tailwind aliases)
- [ ] `<Pill>` composant (5 variants × 3 sizes)
- [ ] `<GlassCard>` composant (4 variants × 4 paddings)
- [ ] `<StatusPill>` raffiné (5 variants au lieu de 4)
- [ ] `<DiagChip>` (renommage MissionTypeTag, 8 types canoniques)
- [ ] `<WorkflowStepper>` 2×3 visuel
- [ ] Sidebar 240px permanente (refonte AppSidebar)

### Sprint B — Dashboard + Mode Mission (5j)
- [ ] Dashboard matin Drama cyan (KPI 168px + 4 mission previews + alertes)
- [ ] Dashboard soir Drama navy (GainTracker 168px + récap timeline)
- [ ] Mode Mission drawer Drama navy plein (Checklist / Photos / Notes / Mesures)
- [ ] Switch auto 14h conservé + toggle manuel

### Sprint C — Pages clés v4 (3j)
- [ ] Liste dossiers v4 (table glass + workflow inline)
- [ ] Page dossier v4 (header + stepper 6 étapes + accordion sections)
- [ ] DiagChip câblé partout (today-block, dashboard-pipeline, dossier-detail)

### Hors-scope (V1.5+)
- Pages `/biens`, `/performance`, `/messages`, `/facturation` détaillée
- Onboarding 4 écrans
- Tests E2E + WCAG
- Empty states custom illustrations

---

*Document version 1.0 — 19 mai 2026 — Time-box validé par Benjamin Bel*
