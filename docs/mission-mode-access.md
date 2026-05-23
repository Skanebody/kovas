# Mode mission — Points d'accès et workflow

> **Statut** : V1.5 (FIX-JJ, 2026-05-23)
> **Authority** : ce document décrit les 6 points d'accès au mode mission tchat IA. CLAUDE.md §3 features 1 + 10 reste la source canonique des décisions produit.

## 1. Pourquoi 6 points d'accès ?

Le mode mission est l'**écran que le diagnostiqueur utilise plusieurs fois par jour** sur le terrain. Le rendre rapide d'accès depuis n'importe où dans l'app est un levier de productivité majeur :

- Gain de temps mesurable (objectif KOVAS : 1h30/mission, cf. CLAUDE.md §2)
- Réduction de friction sur l'ergonomie tactile (mobile-first)
- Multi-contexte : matin bureau / arrivée site / pause / fin de journée → chaque scénario a son entrée naturelle

## 2. Architecture des 6 points d'accès

```
                                  /api/dossiers/[id]/start-mission
                                                 │
                                                 ▼
                                  /api/dossiers/[id]/actions/start_mission
                                  (handler canonique : INSERT mission_session
                                   + UPDATE dossiers.status='on_site')
                                                 │
                                                 ▼
                              /dashboard/dossiers/[id]/mission/tchat
                              (interface conversationnelle full-screen)
                                                 ▲
              ┌─────────┬─────────┬──────────────┼──────────────┬─────────┐
              │         │         │              │              │         │
        ┌─────┴────┐ ┌──┴──┐ ┌────┴───┐ ┌────────┴───────┐ ┌────┴────┐ ┌──┴────┐
        │ Dashboard│ │ Side│ │Calendar│ │ Liste dossiers │ │ FAB     │ │ Cmd+K │
        │ "Action" │ │bar  │ │event   │ │ bouton inline  │ │ mobile  │ │ Cmd+M │
        │ du jour  │ │Capt-│ │detail  │ │ "Mission"      │ │ bottom- │ │ "Démar│
        │          │ │ure  │ │sheet   │ │                │ │ right   │ │  -rer"│
        └──────────┘ └─────┘ └────────┘ └────────────────┘ └─────────┘ └───────┘
            #1         #2        #3            #4              #5         #6
```

### #1 — Dashboard accueil : "Action du jour"

- **Fichier** : `apps/web/src/app/dashboard/dashboard/action-du-jour.tsx`
- **Trigger** : RDV imminent (< 30 min) OU mission déjà en cours (`status='on_site'`)
- **CTA** : "Démarrer ma prochaine mission" chartreuse, gros bouton
- **Comportement** : redirige directement vers `/dashboard/dossiers/[id]/mission/tchat`

### #2 — Sidebar : item "Capture"

- **Fichier** : `apps/web/src/app/dashboard/capture/page.tsx` (server redirect intelligent)
- **Registre** : `apps/web/src/lib/sidebar/sidebar-items.ts` (item `capture`, href = `/dashboard/capture`)
- **Comportement** :
  1. Mission en cours → reprendre via `/mission/tchat`
  2. RDV imminent (< 60 min) → démarrer via `/mission/tchat`
  3. Sinon → wizard `/dashboard/dossiers/new`

### #3 — Calendrier : bouton "Démarrer" sur event

- **Fichier** : `apps/web/src/app/dashboard/calendar/event-detail-sheet.tsx`
- **Affichage** : Dialog ouverte au clic sur un event, bouton chartreuse en pleine largeur "Démarrer la mission"
- **Comportement** : lien direct vers `/dashboard/dossiers/[id]/mission/tchat`

### #4 — Liste dossiers : pillule "Mission" inline

- **Fichier** : `apps/web/src/app/dashboard/dossiers/dossiers-list-client.tsx`
- **Fonction** : `isMissionEligible(item)` qui retourne `true` si :
  - `status='on_site'` (reprendre)
  - `status='scheduled'` ET scheduled ∈ [maintenant−1h .. maintenant+48h]
- **Affichage** : pillule chartreuse `<Play /> Mission` en absolute right (hors du `<Link>` parent pour ne pas perturber l'a11y)

### #5 — FAB mobile global

- **Fichier** : `apps/web/src/components/mission/MissionFabMobile.tsx`
- **Intégration** : `apps/web/src/app/dashboard/layout.tsx`
- **Position** : `fixed bottom-[80px+safe-area] right-4 z-20` (mobile only, sous le BottomNav, distinct du `+` central)
- **Comportement** : appelle `/api/dossiers/next-mission` (priorité on_site > scheduled <48h), redirige vers `/mission/tchat` du résultat, sinon toast + redirect `/dossiers/new`

### #6 — Command Palette + Cmd+M

- **Fichier** : `apps/web/src/components/command-palette/CommandPalette.tsx`
- **Listener** : `useEffect` global qui écoute `Cmd+M` (ou `Ctrl+M`) — ignoré si focus dans input/textarea
- **Action palette** : entrée prioritaire "Démarrer la mission" en tête du groupe "Actions" avec shortcut visible `⌘ M`
- **Backend** : même endpoint `/api/dossiers/next-mission` que le FAB

## 3. Workflow type d'un diagnostiqueur (8h–18h)

| Moment | Lieu | Action | Point d'accès utilisé |
|---|---|---|---|
| **8h00** | Bureau | Café + revue dossiers du jour | #4 Liste dossiers (preview missions du jour) |
| **8h30** | Bureau | Sync derniers documents propriétaire | Hub dossier classique |
| **9h00** | Voiture | Trajet vers 1er RDV | — |
| **9h45** | Site #1 | Arrive devant la porte client | **#5 FAB mobile** Sparkles chartreuse → mission tchat directe |
| **9h45–10h45** | Site #1 | Saisie vocale pièce par pièce + photos | Mode mission tchat IA |
| **10h45** | Site #1 | Termine + bouton "Terminer la mission" | Retour hub dossier |
| **11h00** | Voiture | Trajet vers 2e RDV | — |
| **11h30** | Site #2 | Arrive | **#5 FAB mobile** (ou #3 si il consulte d'abord le calendrier) |
| **12h30** | Restaurant | Pause + consultation calendar | #3 Calendrier (vérifie RDV après-midi) |
| **14h00** | Site #3 | RDV imminent (< 30 min) à l'arrivée | **#1 Action du jour** sur tableau de bord |
| **15h30** | Site #3 | Termine | Retour hub |
| **16h30** | Bureau | Démarre rapport export | **#6 Cmd+K** → "Démarrer la mission" (s'il y a un RDV de fin de journée) |
| **18h00** | Bureau | Synchronisation finale | Mode bureau classique |

**Observation clé** : le FAB mobile (#5) et l'action du jour (#1) couvrent ~70% des démarrages. Les 4 autres points couvrent les cas marginaux mais sont nécessaires pour ne jamais bloquer un usage atypique.

## 4. Comparaison avec workflow concurrents

### Liciel (50% PdM marché FR)

| Étape | Liciel | KOVAS |
|---|---|---|
| Création dossier | Bureau obligatoire (PC Windows) | Mobile-first depuis le terrain |
| Saisie terrain | Tablet Windows lourde, formulaires denses | Conversation IA pièce par pièce |
| Démarrage mission | 1) Ouvrir Liciel 2) Sélectionner dossier 3) Cliquer "Saisie" 4) Confirmer | 1 clic depuis n'importe où |
| Re-prise après pause | Re-naviguer dans l'arborescence | Re-clic sur le même point d'accès (le router redirige sur la session active) |
| Offline | Partiel (sync différée mais friction reprise) | Service Worker + IndexedDB transparent |

### AnalysImmo / OBBC / ORIS

Mêmes workflows que Liciel — passage par le bureau obligatoire, pas de mobile-first natif.

### Différenciateur KOVAS

> "Tu sors de ta voiture, tu cliques l'icône Sparkles chartreuse en bas à droite de ton écran : tu es déjà en mode mission tchat 1 seconde plus tard. Aucun concurrent ne fait ça."

## 5. Maintenance — où modifier quoi ?

| Si vous voulez… | Modifier… |
|---|---|
| Changer la priorité de sélection mission (on_site > scheduled) | `apps/web/src/app/api/dossiers/next-mission/route.ts` |
| Changer la durée d'éligibilité "imminent" (60 min par défaut) | `apps/web/src/app/dashboard/capture/page.tsx` (constante `in60min`) |
| Adapter le contenu du tchat IA (questions, validation) | `apps/web/src/app/dashboard/dossiers/[id]/mission/tchat/mission-tchat-interface.tsx` (constante `BASE_STEPS`) |
| Modifier le bouton primaire du HubHeader | `apps/web/src/lib/dossier/states.ts` (`getPrimaryActionForState`) |
| Ajouter un 7e point d'accès | Créer un nouveau fichier + référencer ici |

## 6. KPIs à tracker (V1.5 release)

À ajouter dans PostHog dès la mise en prod :

- `mission.start.access_point` (valeurs : `dashboard` / `sidebar` / `calendar` / `dossier_list` / `fab_mobile` / `command_palette`)
- `mission.start.time_to_first_action_ms` (entre clic et 1ère réponse user au tchat)
- `mission.tchat.offline_session_count` (sessions démarrées sans réseau)
- `mission.tchat.pause_resume_count` (pauses moyennes par mission)
- `mission.tchat.duration_seconds_p50` (médiane mission)

## 7. Roadmap V2 (post-launch)

- **Notification push** "Prochain RDV dans 15 min — touchez pour démarrer la mission" → 7e point d'accès passif
- **Apple Watch / Wear OS app** : bouton vocal "Hé KOVAS, démarrer ma mission" → 8e point d'accès
- **Widget iOS Home Screen** : bouton "Démarrer la mission" sans ouvrir l'app

---

**Auteur** : Benjamin Bel, fondateur KOVAS.
**Dernière mise à jour** : 2026-05-23 (FIX-JJ).
