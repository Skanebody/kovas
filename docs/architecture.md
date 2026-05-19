# Architecture KOVAS — État au 2026-05-19

Carte complète des routes, composants et flux de l'app KOVAS V1. Base pour refonte UX.

---

## 1. Routes publiques (non-authentifié)

| URL | Fichier | Rôle |
|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | Landing marketing (Hero + Stats + Features + HowItWorks + PricingTeaser + LandingFaq + FinalCTA + SiteFooter) |
| `/pricing` | `apps/web/src/app/pricing/page.tsx` | 3 tiers comparison + features incluses + options ponctuelles |
| `/faq` | `apps/web/src/app/faq/page.tsx` | 53 questions en 8 catégories + JSON-LD SEO + TOC sticky desktop |
| `/upload/[token]` | `apps/web/src/app/upload/[token]/page.tsx` | Page publique d'upload pour propriétaires (lien envoyé par le diag, **sans login**) |

**Header public** : Logo · Fonctionnalités · Tarifs · FAQ · Se connecter · Essai 14j
**Footer public** : © · FAQ · Mentions légales · CGU · Confidentialité · Contact

---

## 2. Routes auth

| URL | Fichier | Rôle |
|---|---|---|
| `/login` | `apps/web/src/app/(auth)/login/page.tsx` | Email + mot de passe |
| `/signup` | `apps/web/src/app/(auth)/signup/page.tsx` | Email pro + SIRET (validé INSEE M2-M3, format pour V1) |

Layout commun `(auth)/layout.tsx` : header logo + glass card centrée max-w-sm + footer mini.

---

## 3. Routes app (authentifié `/app/*`)

Layout commun `app/layout.tsx` :
- **Header sticky** : Logo KOVAS · `AppNavTabs` (Tableau de bord / Dossiers / Clients / Biens) · CommandPaletteTrigger (⌘K) · UsageWidget · UserMenu (Avatar + dropdown)
- **Sidebar desktop 64px** (`AppSidebar`) : Home · FileText · Users · Building2 · ThemeToggle bottom
- **Bottom nav mobile** (`AppMobileNav`) : 4 icônes
- **CommandPalette** monté global (⌘K)

| URL | Fichier | Rôle |
|---|---|---|
| `/app` | (root) | Pas de page directe, redirige via middleware |
| `/app/onboarding` | `apps/web/src/app/app/onboarding/page.tsx` | Premier setup utilisateur (nom org + SIRET) |
| `/app/dashboard` | `apps/web/src/app/app/dashboard/page.tsx` | **Cockpit** : TodayBlock · DashboardPipeline · StatsDonutGrid + GainTrackerCard · AlertsAndActions + RecentActivityBlock + DiagnosticsBreakdown |
| `/app/calendar` | `apps/web/src/app/app/calendar/page.tsx` | Vue hebdo navigable, click event → dossier |
| `/app/dossiers` | `apps/web/src/app/app/dossiers/page.tsx` | Liste dossiers (table + filtres) |
| `/app/dossiers/new` | `apps/web/src/app/app/dossiers/new/page.tsx` | Création (adresse BAN + types de diag + client optionnel) |
| `/app/dossiers/[id]` | `apps/web/src/app/app/dossiers/[id]/page.tsx` | **Cœur métier** — détail dossier (cf. section 4) |
| `/app/clients` | `apps/web/src/app/app/clients/page.tsx` | Liste clients |
| `/app/clients/new` | `apps/web/src/app/app/clients/new/page.tsx` | Création client |
| `/app/clients/[id]` | `apps/web/src/app/app/clients/[id]/page.tsx` | Détail client + DangerZone |
| `/app/clients/[id]/edit` | `apps/web/src/app/app/clients/[id]/edit/page.tsx` | Édition client |
| `/app/properties` | `apps/web/src/app/app/properties/page.tsx` | Liste biens |
| `/app/properties/new` | `apps/web/src/app/app/properties/new/page.tsx` | Création bien (BAN + appartement détails) |
| `/app/properties/[id]` | `apps/web/src/app/app/properties/[id]/page.tsx` | Détail bien + DangerZone |
| `/app/properties/[id]/edit` | `apps/web/src/app/app/properties/[id]/edit/page.tsx` | Édition bien |
| `/app/account` | `apps/web/src/app/app/account/page.tsx` | **Hub Mon compte** — Profil · Entreprise · Apparence · Abonnement · Plans · Légales (6 sections collapsibles, defaults adaptatifs) |
| `/app/billing` | `apps/web/src/app/app/billing/page.tsx` | `redirect('/app/account')` — consolidation |

---

## 4. Cœur métier : `/app/dossiers/[id]`

C'est LA page la plus complexe (597 lignes). Toutes les actions terrain et bureau y convergent.

### Structure verticale

```
1. Bouton Retour
2. Header : reference + titre + Status badge + DossierMoreMenu (...)
3. DiagnosticStatusPills (barre pillules couleurs par diag, scan visuel)
4. Card compacte "Détails visite" : 📍 adresse · année · surface  [✏️ Modifier]
   + ligne 2 : 👤 client + 📅 scheduled_at [.ics ↓]
5. WorkflowStepper (6 étapes, active déployée, autres collapsées)
6. CoherenceWarnings (alertes incohérences détectées)
7. CollapsibleSection "Documents propriétaire" + ClientUploadLink + OwnerDocumentsList
8. CollapsibleSection "Pièces" + RoomsList (defaultOpen si vide)
9. CollapsibleSection "Photos terrain" + PhotoCapture + PhotoGallery (defaultOpen si 0 photo)
10. CollapsibleSection "Notes vocales" + VoiceRecorder + VoiceNotesList (closed default)
11. Toggle ViewToggle (Vue par pièce / Vue par diag)
12. — Si vue par pièce : RoomsMatrixView (matrice pièces × diagnostics)
    — Si vue par diag : liste MissionCardCollapsible (compact ~70px) avec MissionsWithDrawer wrapper
13. Notes internes (si présent)
14. (DangerZone : déplacé dans DossierMoreMenu ⋮)
```

### Mode mission focus (overlay)

Quand l'utilisateur clique "Mode mission" sur une card mission → `MissionFocusDrawer` overlay plein écran :
- Header : Retour Dossier + label mission + % + Fermer X
- Body scroll : MissionChecklist + Pièces + Photos + Notes vocales (réutilise les sections du dossier)
- Floating bar bottom : Photo / Note / Pièces (scroll-to) + bouton Terminer

### Données chargées (Promise.all, 7 queries)

1. dossier (avec properties + clients joins)
2. missions (id, type, status, completed_at, metadata)
3. rooms (dossier_rooms)
4. photos (avec view_type, room_id)
5. voice_notes (avec transcript)
6. owner_documents (avec extracted_data)
7. clients (liste pour le picker dans DossierInfoEdit)

### Composants spécifiques (24 fichiers dans `/app/dossiers/[id]/`)

| Composant | Rôle |
|---|---|
| `workflow-stepper.tsx` | 6 étapes guidées, optimistic UI |
| `mission-checklist.tsx` | Checklist par diagnostic (items auto+manuels) |
| `mission-card-collapsible.tsx` | Card mission compact 70px |
| `mission-focus-drawer.tsx` | Mode terrain plein écran |
| `missions-with-drawer.tsx` | Wrapper état du drawer |
| `diagnostic-status-pills.tsx` | Barre pillules colorées tap-to-scroll |
| `dossier-info-edit.tsx` | Édition inline date/notes/client (avec conflict detection) |
| `dossier-more-menu.tsx` | Dropdown ⋮ (Supprimer + placeholders Duplicate/Archive) |
| `rooms-list.tsx` | CRUD pièces avec inline edit |
| `rooms-matrix-view.tsx` | Matrice pièce × diagnostic (J17) |
| `photo-capture.tsx` | Camera input + type vue picker |
| `photo-gallery.tsx` | Grille photos avec overlay actions |
| `voice-recorder.tsx` | Enregistrement + Whisper transcription |
| `voice-notes-list.tsx` | Liste notes transcrites |
| `owner-documents-list.tsx` | Liste docs uploadés par client + extracted_data |
| `client-upload-link.tsx` | Génération + révocation lien public |
| `coherence-warnings.tsx` | Warnings validation cohérence |
| `share-button.tsx` | Export ZIP Liciel (email/drive/download) |
| `resume-button.tsx` | "Reprendre" mission |
| `status-button.tsx` | Changement status mission |
| `remove-mission-button.tsx` | Trash mission du dossier |
| `add-mission.tsx` | Dropdown desktop / BottomSheet mobile |
| `view-toggle.tsx` | Toggle vue pièces/diags |
| `actions.ts` | 17 server actions |

---

## 5. Dashboard `/app/dashboard`

Layout grid 12-col cockpit :

```
[Bonjour {prénom} + date]                              [+ Nouveau dossier]
[TodayBlock — full width]                                    (vital matinal)
[DashboardPipeline 4 col Kanban]                                  (semaine)
[StatsDonutGrid 4 donuts (8 col)][GainTrackerCard navy (4 col)]    (stats)
[AlertsAndActions][RecentActivityBlock][DiagnosticsBreakdown]   (3 × 4 col)
```

Composants (`apps/web/src/app/app/dashboard/`) :
- `today-block.tsx` — visites planifiées aujourd'hui + badges docs manquants + actions rapides (tel/SMS/GPS) + bouton Démarrer + lien Voir le planning
- `today-mission-actions.tsx` — boutons tel/SMS/GPS/Relancer (F5)
- `dashboard-pipeline.tsx` — 4 col (À démarrer / En cours / À finaliser / Terminé)
- `stats-donut-grid.tsx` — 4 donuts (Missions actives / Documents reçus / Exports / Terminées) + trend %
- `gain-tracker-card.tsx` — shell V1 (missions × 1h30, target 30/mois)
- `alerts-and-actions.tsx` — alertes critiques cross-entité
- `recent-activity-block.tsx` — timeline 10 events (14j)
- `diagnostics-breakdown.tsx` — barres horizontales par type ce mois
- `overview-donuts-block.tsx` — bloc legacy (vérifier si encore utilisé)

---

## 6. Routes API (`/api/*`)

| Endpoint | Méthode | Rôle |
|---|---|---|
| `/api/auth/callback` | GET | Supabase Auth callback (email confirm) |
| `/api/ban/search` | GET | Proxy API BAN française (autocomplete adresse) |
| `/api/billing/checkout` | POST | Crée session Stripe Checkout pour un tier |
| `/api/billing/portal` | POST | Redirige vers Stripe Customer Portal |
| `/api/billing/webhook` | POST | Webhook Stripe (subscription updates) |
| `/api/dev/enter` | GET | Mode dev : session sans saisie |
| `/api/dossiers/[id]/calendar.ics` | GET | Télécharge .ics pour le dossier |
| `/api/missions/[id]/export` | GET | Export ZIP Liciel (MDB + XML + photos) |
| `/api/owner-documents/[id]/extract` | POST | Claude vision : extract data depuis PDF/photo uploadé |
| `/api/structure` | POST | Claude Haiku : structuration transcription vocale |
| `/api/transcribe` | POST | OpenAI Whisper : transcription audio |
| `/api/upload-owner-document` | POST | Upload public client (via lien token) |

---

## 7. UI primitives (`apps/web/src/components/ui/`)

| Composant | Rôle |
|---|---|
| `button.tsx` | Pillule navy CTA + variants outline/ghost/destructive/icon, hover lift |
| `card.tsx` | Glass (defaut) ou accent (navy plein) |
| `badge.tsx` | Variants default/outline/muted/blue/red/orange/green |
| `input.tsx` | Bordure navy 10% + bg-card/80 + focus ring navy |
| `select.tsx` | Idem input |
| `textarea.tsx` | Idem |
| `form-field.tsx` | Wrapper label + hint + error |
| `dropdown-menu.tsx` | Radix DropdownMenu stylé |
| `bottom-sheet.tsx` | Vaul Drawer wrapper (mobile actions) |
| `collapsible-section.tsx` | Section pliable persistée localStorage |
| `dialog.tsx` | Radix Dialog modal |
| `donut.tsx` | Donut SVG pur (0 dep), 5 couleurs |
| `avatar.tsx` | Initiales générées |
| `toaster.tsx` | Sonner wrapper + theme aware |
| `toast.tsx` | Radix Toast (legacy, pas utilisé) |
| `skeleton.tsx` | Loading state |
| `separator.tsx` | Radix Separator |
| `label.tsx` | Radix Label |
| `address-autocomplete.tsx` | BAN API autocomplete |

---

## 8. Composants globaux (`apps/web/src/components/`)

| Composant | Rôle |
|---|---|
| `app-nav-tabs.tsx` | Pillules navigation primaire header (desktop) |
| `app-sidebar.tsx` | Sidebar 64px desktop + AppMobileNav (bottom nav <md) |
| `user-menu.tsx` | Avatar dropdown : Mon compte / FAQ / Contact / Déconnexion |
| `command-palette.tsx` | Cmd+K universel (cmdk library) |
| `command-palette-trigger.tsx` | Bouton header avec kbd ⌘K |
| `usage-widget.tsx` | Mini compteur missions du mois |
| `theme-provider.tsx` | next-themes wrapper |
| `theme-toggle.tsx` | Dropdown Soleil/Lune/Système (sidebar bottom) |
| `theme-picker.tsx` | 3 boutons radio (account section Apparence) |
| `faq-answer.tsx` | Renderer markdown minimal (paragraphes/bullets/bold) |
| `mission-realtime.tsx` | Supabase Realtime subscription |
| `danger-zone.tsx` | Card rouge avec confirm textuel "supprimer" |
| `add-to-home-screen.tsx` | Banner PWA install |
| `query-provider.tsx` | TanStack Query provider |

---

## 9. Lib (`apps/web/src/lib/`)

| Fichier | Rôle |
|---|---|
| `supabase/client.ts` | createBrowserClient (client components) |
| `supabase/server.ts` | createServerClient (server components/actions) |
| `supabase/middleware.ts` | Session refresh middleware |
| `auth/current-user.ts` | `getCurrentUser()` cached + redirect /login |
| `dossier-workflow.ts` | 6 étapes workflow + auto-checks + manual toggles |
| `checklists.ts` | Check-lists par type de diagnostic |
| `coherence-validation.ts` | Règles métier "surface vs chaudière kW" etc. |
| `diag-room-matrix.ts` | Matrice pièce × diag tâches |
| `room-templates.ts` | Templates T2/T3/T4/T5 pré-remplis |
| `photo-view-types.ts` | 21 types de vue groupés en 5 catégories |
| `mission-helpers.ts` | Labels + variantes badge |
| `voice-parser.ts` | Parser JS custom 80% |
| `claude-structurer.ts` | Wrapper Claude Haiku pour structuration |
| `whisper-prompt.ts` | Prompt OpenAI Whisper |
| `document-extractor.ts` | Wrapper Claude Vision pour extraction documents |
| `file-naming.ts` | Convention nommage fichiers (slugify FR) |
| `ban.ts` | Wrapper API BAN |
| `geolocation.ts` | Wrapper getCurrentPosition |
| `image-compress.ts` | WebP 0.75 + max 1920×1080 |
| `watermark.ts` | Filigrane brouillon sur PDF |
| `ics.ts` | Génération iCalendar RFC 5545 |
| `format-address.ts` | Composition adresse FR (skip duplication ville) |
| `property-display.ts` | Compose "Bât. B · Apt 12 · 3e étage" |
| `faq-data.ts` | 53 Q&A typées (5 landing + 48 catégories) |
| `stripe.ts` | Client Stripe (stub si pas de key) |
| `stripe-config.ts` | KOVAS_TIERS (3 tiers : 29/59/99€) |
| `exports/*.ts` | Builders JSON/CSV/DOCX/PDF/ZIP Liciel |
| `hooks/use-expand-state.ts` | localStorage + sync onglets |
| `hooks/use-media-query.ts` | SSR-safe useIsDesktop |

---

## 10. Navigation entre routes

### Depuis le header app (`AppNavTabs`)
Dashboard ↔ Dossiers ↔ Clients ↔ Biens

### Depuis UserMenu (Avatar dropdown)
→ Mon compte (/app/account)
→ FAQ (/faq)
→ Contact (mailto:)
→ Se déconnecter

### Depuis Command Palette (⌘K)
- Visites aujourd'hui (missions scheduled today)
- Actions rapides : Nouveau dossier/client/bien
- Naviguer : 4 pages + raccourcis G+D/G+O/G+C/G+B
- Récents : 8 derniers dossiers/clients/biens
- Aide & compte : Mon compte / FAQ / Déconnexion

### Depuis dashboard
- TodayBlock → "Voir le planning" → /app/calendar
- TodayBlock card → /app/dossiers/[id]#mission-[id]
- DashboardPipeline card → /app/dossiers/[id]#mission-[id]
- AlertsAndActions → /app/dossiers
- "Nouveau dossier" → /app/dossiers/new

### Depuis dossier detail
- Status pills → scroll vers mission card
- "Mode mission" → ouvre MissionFocusDrawer overlay
- Property link → /app/properties/[id]
- Client link → /app/clients/[id]
- ".ics ↓" → download `/api/dossiers/[id]/calendar.ics`
- DossierMoreMenu → Supprimer (DangerZone modal)

---

## 11. Modèle de données (schema Supabase)

Tables principales :
- `organizations` (siret, vat_number, address, certification_n, plan, stripe_customer_id, default_logiciel)
- `profiles` (full_name, phone, locale, default_org_id)
- `memberships` (user × org × role)
- `clients` (display_name, email, phone, organization_id)
- `properties` (address, postal_code, city, year_built, surface_total + apartment_detail, building_letter, floor_number, lot_number)
- `dossiers` (reference DOS-YYYY-NNNNN, status, scheduled_at, property_id, client_id, client_upload_token, metadata jsonb)
- `missions` (reference MIS-YYYY-NNNNN, type, status, dossier_id, completed_at, metadata jsonb)
- `dossier_rooms` (name, room_type, surface_m2, position, dossier_id)
- `photos` (storage_path, width, height, room_id, view_type, location PostGIS POINT, partitioned by created_at)
- `voice_notes` (storage_path, transcript_raw, transcript_structured jsonb, ai_confidence, room_id)
- `owner_documents` (storage_path, doc_kind, extracted_data jsonb, extraction_status, dossier_id)
- `subscriptions` (tier, status, missions_included, overage_price_cents, organization_id)

Buckets Storage :
- `mission-photos` (privé, signed URLs 1h)
- `voice-notes` (privé)
- `owner-uploads` (privé)

---

## 12. Système design (CLAUDE.md §9 + docs/design-system.md)

- Light + Dark mode actif via next-themes (toggle dans /app/account + sidebar), defaultTheme `light`
- Glassmorphism léger (Ron Design Lab × Tectra) + ombres neutres
- Palette : crème `#F5F1EA` + paper `#FBF8F2` + cobalt `#2C3FA8` CTA + butter `#FFE89C` accent énergique + sémantiques (bleu/rouge/orange/vert)
- Typo : Outfit (UI) + Instrument Serif italic (KPIs, mots-clés éditoriaux)
- Radius : `1.25rem`/`1.5rem` cards, `100px` (pill) CTA et badges, `0.75rem` inputs
- Animations : transitions CSS ~200ms, prefers-reduced-motion respecté
- Toasts : Sonner (`@/components/ui/toaster`)
- Bottom sheets mobile : Vaul (`@/components/ui/bottom-sheet`)
- Progressive disclosure : `CollapsibleSection` partout (account, dossier sections), `<details>` natif pour FAQ

---

## 13. État des features (CLAUDE.md §3 — 10 V1)

| # | Feature | Statut |
|---|---|---|
| 1 | Saisie vocale terrain (Whisper + Claude Haiku hybride) | ✅ |
| 2 | Photos géolocalisées + WebP compression | ✅ |
| 3 | Auto-complétion adresse BAN | ✅ |
| 4 | Templates pièces T2/T3/T4/T5 | ✅ |
| 5 | Check-lists par type de diagnostic | ✅ |
| 6 | Upload documents propriétaire (lien public) | ✅ |
| 7 | Validation cohérence basique | ✅ |
| 8 | Bouton Partager 3 modes | ✅ (Email + Drive + Download via share-button) |
| 9 | Export multi-format universel | ✅ (PDF/Word/CSV/JSON/ZIP Liciel) |
| 10 | Sync mobile/web + offline | Partiel (PWA serwist installé, queue mutations offline incomplet) |

Hors-V1 documentés (V1.5+) :
- Mission imminente card auto T-30/T-15 (Edge Function cron)
- Indicateur sync permanent (queue offline)
- Quick Add Mission vocal (BAN + géocoding)
- Compteur DPE 1000/an
- Gain Tracker complet (sprints 15-17)
- Mode tournée plein écran
- Génération 7 rapports conformes (V2 post-cert ADEME + advisor + audit legal)
- Sync OAuth Google/Outlook Calendar (.ics couvre 95%)

---

## 14. Points sensibles pour refonte UX

### Pages au cœur du métier (refonte impacte tout)
- `/app/dashboard` — première chose vue chaque matin
- `/app/dossiers/[id]` — 597 lignes, 24 composants, page la plus dense
- `/app/calendar` — récente (J37), neuve, prête pour itérations

### Pages avec faible volume de contenu (rapides à refondre)
- Listings (clients, properties, dossiers) — simples tables
- /app/account — déjà collapsible, structure stable
- /faq — content-driven

### Composants à fort impact visuel
- `Card` (utilisé partout — variant glass ou accent)
- `Button` (CTA pillule navy)
- `Badge` (status partout)
- Layout shell (`app/layout.tsx` + AppSidebar + AppNavTabs + UserMenu)

### Patterns établis à respecter (cohérence)
- Glassmorphism `bg-card/85 backdrop-blur-xl`
- Status badges : variants standards (green/orange/red/blue/muted)
- Progressive disclosure : `CollapsibleSection` avec defaults adaptatifs
- Mobile : BottomSheet via `useIsDesktop()` pour les dropdowns longs
- Optimistic UI : `useOptimistic` sur toggles fréquents (checklist, workflow)
- Toasts : `toast.success/error/warning/info` via Sonner

### Anti-patterns à éviter (déjà tentés et rejetés)
- ❌ Dark-first + violet brand (override CLAUDE.md §9)
- ❌ Manrope, Inter, ou autre sans-serif neutre (mandate Outfit + Instrument Serif italic depuis 2026-05-19)
- ❌ Sidebar 240px avec labels (on a 64px icons)
- ❌ Workflow Bézier 4 colonnes connectées (linéaire suffit)
- ❌ Drag-and-drop blocs dashboard (V2)
- ❌ Composants `Kovas*` parallèles à shadcn (on étend les existants)
- ❌ Mentions "Phase 1/Phase 2" côté user
