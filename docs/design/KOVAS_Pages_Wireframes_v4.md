# KOVAS — Structure détaillée de chaque page (v4)

> **Document de référence — Wireframes textuels page par page.**
> Spec d'implémentation des écrans, complète le design system canonique `KOVAS_UIUX_App_Complete_v4.md`.
>
> Version 1.0 — 19 mai 2026

---

## Légende composants

- `<Pill>` = bouton pill (variants: primary, amber, glass, ghost, danger)
- `<GlassCard>` = card translucide
- `<StatusPill>` = badge statut (5 variants)
- `<DiagChip>` = chip type diagnostic (8 variants)
- `<SidebarLeft>` = sidebar navigation 240px
- `<BottomNav>` = tab bar mobile 64px
- `<CmdK>` = recherche universelle

---

## Sections

### 1. AUTHENTIFICATION
- `/login` — Connexion (Drama cyan + GlassCard 480px max)
- `/inscription` — Création de compte (Wizard 3 étapes : plan → infos → Stripe)

### 2. ONBOARDING (4 écrans, 90 secondes)
- `/onboarding/welcome` — Drama cyan, Serif italic 64px
- `/onboarding/certifications` — Clear, certifications COFRAC par diagnostic
- `/onboarding/imports` — Clear, import Liciel / modèles / from zero
- `/onboarding/first-dossier` — Drama cyan, form inline BAN + diag + client + RDV

### 3. AUJOURD'HUI (Dashboard)
- `/` mode matin — Drama cyan, KPI hero "4" Serif italic 168px, hero card glass + missions list
- `/` mode soir — Drama navy plein, GainTracker hero "23h 47" Serif italic 168px

### 4. DOSSIERS
- `/dossiers` — Liste table glass + filtres pill + workflow inline mini
- `/dossiers/[id]` — Header glass + WorkflowStepper 2×3 + accordion sections
- `/dossiers/nouveau` — Wizard 3 étapes (bien → diagnostics → client/RDV)

### 5. PLANNING
- `/planning?view=day` — Timeline verticale 7h-20h
- `/planning?view=week` — Grille 7 jours × heures
- `/planning?view=month` — Calendrier classique + pastilles colorées

### 6. CLIENTS
- `/clients` — Table glass + filtres type + badge "Fidèle" si >5 missions
- `/clients/[id]` — Header card + tabs (Dossiers/Historique/Facturation/Notes)

### 7. BIENS — V1.5
- `/biens` — Grid cards 3-col avec photo Street View + meta
- `/biens/[id]` — Hero image 300px + caractéristiques + historique + propriétaires successifs

### 8. FACTURATION — V1.5
- `/facturation` — Stats hero 4 cards Drama partiel + tabs Devis/Factures/Avoirs
- `/facturation/{devis|factures}/[id]` — Panneau actions + preview A4

### 9. PERFORMANCE — V1.5
- `/performance` — Header Drama cyan + KPI hero grid 4 cards + graphique évolution

### 10. MESSAGES — V1.5
- `/messages` — 3 colonnes (conversations | thread | contexte) + suggestion IA en draft (jamais envoi auto)

### 11. MODE MISSION (drawer global)
- Drama navy plein
- Tabs : Checklist (default) / Photos / Notes vocales / Mesures / Documents
- Footer sticky Pill amber "Terminer la mission" (disabled si obligatoires non OK)

### 12. COMPTE (10 sections)
- `/compte/profil` — Photo + identité + identité publique + préfs régionales
- `/compte/certifications` — Compteur DPE annuel hero + cartes par certif + RC pro + QR code + formations
- `/compte/entreprise` — Informations légales + adresses + bancaire + mentions légales
- `/compte/abonnement` — Plan + overage + comparaison + paiement + historique
- `/compte/factures` — Factures KOVAS reçues + export FEC/Pennylane/ZIP
- `/compte/notifications` — Toggle par canal (mail/push/SMS/in-app) + fréquence + silence
- `/compte/integrations` — Liciel/Gestiondiag/Yousign/Brevo/Stripe/etc + API KOVAS
- `/compte/apparence` — Mode visuel/densité/animations/dashboard/couleurs diag
- `/compte/securite` — Authentification (passkeys + 2FA) + sessions + historique + confidentialité
- `/compte/rgpd` — Droits + export ZIP + stockage + rétention + IA + cookies + suppression

### 13. RECHERCHE UNIVERSELLE (⌘K)
- Modal cmdk 640px, sections Récents / Actions / Navigation / Paramètres
- Raccourcis : "n d" = nouveau dossier, "g a" = aller Aujourd'hui

### 14. NOTIFICATIONS (3 niveaux)
- **Toast** (Sonner) — bas droite desktop / top mobile, 4s auto-dismiss
- **Alert inline** — GlassCard avec border-left coral 4px
- **Badge sidebar** — count discret sur item nav
- **Banner top** — critique uniquement, pleine largeur

### 15. ÉTATS SYSTÈME
- Loading : skeleton glass cards avec gradient shimmer, stagger 80ms (jamais spinner)
- Empty states : illustration 160×160 + titre Serif italic 28px + CTA primary
- Error states : titre warning + description + CTA Réessayer/Signaler
- Offline : banner top + indicateur sidebar + queue auto + toast "✓ N synchronisés" au retour

### 16. BOTTOM SHEETS (mobile uniquement, via vaul)
- Création rapide : tap [+] BottomNav → sheet "Nouveau dossier/client/bien/devis/mission"
- Actions sur mission : long-press card → sheet (Démarrer/Appeler/Itinéraire/Modifier/Annuler)
- Filtres : tap icône filtre → sheet checkboxes + Appliquer

### 17. RESPONSIVE BREAKPOINTS
- Mobile S 320 (iPhone SE) · M 375 (iPhone 12-14) · L 414 (Plus)
- Tablet S 768 (iPad portrait) · L 1024 (landscape)
- Desktop S 1280 · M 1440 · L 1920+
- **< 1024** : sidebar masquée, bottom nav active
- **< 768** : layouts colonne, bottom sheets au lieu de modals
- **1024-1279** : sidebar collapsée (icônes uniquement)
- **≥ 1280** : sidebar full + main max 1400px

---

## État d'implémentation au 2026-05-19

### ✅ Implémenté (v4)
- Auth `/login` (basic, Drama atténué `bg-fluid-light`)
- Dashboard `/` matin/soir avec bascule auto 14h + DashboardModeToggle
- Liste dossiers `/app/dossiers` (table glass + DiagChip + filtres)
- Page dossier `/app/dossiers/[id]` (header + workflow stepper interactif + sections)
- Création dossier `/app/dossiers/new` (form simple)
- Planning `/app/calendar` (vue semaine)
- Clients `/app/clients` (liste + détail basique)
- Bien `/app/properties` (liste + détail basique)
- Mode Mission drawer Drama navy `bg-fluid-navy` (Checklist + Photos + Notes + Mesures)
- Compte `/app/account` (sections collapsibles : profil, entreprise, abonnement, plans, légales)
- Recherche universelle `⌘K` (CommandPalette via cmdk)
- Toast (Sonner)
- Bottom Nav mobile (4 tabs)
- Sidebar 240px permanente navy ultra-deep
- Pages légales : `/cgu`, `/confidentialite`, `/contact`, `/mentions-legales`

### 🟡 Partiellement implémenté
- Onboarding `/app/onboarding` (1 écran simple — wireframe 4 écrans)
- Page gain `/app/gain` (basique — wireframe drill-down Drama partiel)
- Planning vue jour/mois (vue semaine OK, jour/mois manquantes)
- Bien `/app/properties/[id]` (basique — wireframe hero Street View manquant)
- Inscription `/signup` (1 page — wireframe wizard 3 étapes plan/infos/Stripe)
- Filtres pills par section (mais filtres simples actuels)
- Bottom sheets : `vaul` installé, drawer existant mais pattern "Nouveau" + long-press pas câblés

### ❌ Pas implémenté (V1.5+)
- `/facturation/*` (3 tabs Devis/Factures/Avoirs + détail panneau-preview)
- `/performance` (Drama partiel + 4 KPI hero + graphique)
- `/messages` (3 colonnes + suggestion IA draft)
- `/biens/[id]` Street View hero
- `/compte/certifications` (compteur DPE hero + RC pro + QR code)
- `/compte/notifications` (matrice toggle 4 canaux)
- `/compte/integrations` (Liciel/Gestiondiag/etc)
- `/compte/apparence` détaillé (drag-drop widgets, custom couleurs diag)
- `/compte/securite` détaillé (passkeys, 2FA, sessions, IP whitelist)
- `/compte/rgpd` (export ZIP + rétention + suppression compte)
- Banner top offline + sync conflict resolution UI
- Empty states avec illustrations custom

---

*Document version 1.0 — 19 mai 2026*
