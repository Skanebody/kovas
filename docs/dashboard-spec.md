# Dashboard KOVAS — Spec cockpit V1

> Vision complète discutée 2026-05-18. Ce doc cadre **uniquement le périmètre V1**.
> Les blocs/optimisations V1.5+ sont listés en bas pour traçabilité.

## Philosophie

Le dashboard est la première chose vue chaque matin. Cible : **cockpit business** pour avatar diagnostiqueur 43 ans (sobre, dense mais pas surchargé, mobile-first, JAMAIS gaming/lifestyle).

L'utilisateur ouvre KOVAS le matin → voit sa journée → démarre. C'est tout.

## Blocs V1 (sprint courant)

### 1. Header + identité
Existant (`apps/web/src/app/app/layout.tsx`) :
- Logo + nom user + UsageWidget + ThemeToggle + Logout
- Sticky, glassmorphism `bg-card/80 backdrop-blur-md`
- **Pas de refonte V1** : le shell actuel respecte déjà le DS §9 CLAUDE.md

### 2. Bloc "Vue du jour" (priorité #1)
Liste des dossiers `scheduled_at::date = today` (timezone Europe/Paris) :
- Heure RDV
- Référence + adresse + ville
- Badges types de diag (DPE, Amiante, …)
- Bouton **Reprendre / Démarrer** → `/app/dossiers/{id}` (ou `/#mission-{id}` pour la première mission active)

**Empty state** : "Aucune visite aujourd'hui. Profitez-en pour finaliser vos exports."

### 3. Bloc "À finaliser"
Dossiers terminés sur le terrain mais pas exportés. Critères :
- `dossiers.status IN ('back_office', 'on_site')`
- OR missions avec `status='to_review'`
- OR missions avec checklist incomplète depuis > 1 jour (post-V1, trop coûteux à calculer côté serveur en V1)

Pour chaque dossier → bouton "Compléter" → `/app/dossiers/{id}`.

**Empty state** : "Tout est à jour. Bien joué."

### 4. Bloc "Stats semaine"
Agrégats simples sur `missions.completed_at >= lundi_courant` :
- Dossiers traités
- Missions terminées
- Nouveaux clients
- Comparaison vs semaine précédente (delta % en vert/rouge sobre)

**Pas de graphes** V1 — juste des chiffres en gras.

### 5. Bloc "Activité récente"
Timeline des 10 derniers events (cross-entité), tri par `created_at desc` :
- Dossier créé
- Mission terminée
- Photo uploadée
- Document client reçu
- Note vocale transcrite

Format sobre : `Il y a 5 min · Mission DPE Dupont terminée`.

### 6. CTA principal "+ Nouveau dossier"
Déjà présent. Conserver, juste s'assurer qu'il est très visible (CTA navy KOVAS).

## Hors-V1 (V1.5+, à NE PAS faire maintenant)

- ❌ Météo locale (API tierce + cache + clé)
- ❌ Trajets entre missions (Mapbox €€)
- ❌ Tournée optimisée sur carte
- ❌ Pipeline commercial devis/factures (Phase 2)
- ❌ Gain Tracker permanent (planifié sprints 15-17, V1.5)
- ❌ Mode tournée plein écran (V1.5)
- ❌ Widgets PWA iOS/Android (V2)
- ❌ Drag-and-drop blocs + `user_dashboard_preferences` (V2)
- ❌ Workflow Bézier 4 colonnes connectées (overkill — `WorkflowStepper` linéaire suffit)
- ❌ Recherche universelle FTS (V1.1)

## Performance

- **Promise.all** sur les queries de chaque bloc → 1 round-trip côté server component
- Cible TTI : < 800 ms (mesurer post-implémentation)
- Pas de skeleton V1 (Server Components → page rendue prête)

## Design tokens

Hérite intégralement de CLAUDE.md §9 — palette, Manrope, glassmorphism, accents délavés. **Aucune redéfinition** ici.
