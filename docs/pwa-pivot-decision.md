# KOVAS — Pivot PWA-only Phase 1 (Modification 17)

**Date** : 2026-05-18
**Statut** : Authority document — surclasse les sections "Frontend mobile" / RN+Expo dans CLAUDE.md, PRD, recherches
**Trigger** : Décision fondateur post-D-U-N-S — App Store n'étant PAS un canal d'acquisition pour B2B vertical FR (les 13 000 diagnostiqueurs n'arrivent JAMAIS via App Store), apps natives = friction inutile Phase 1.

---

## 1. Décision

**Phase 1 (M0-M9) = PWA-only**, pas d'apps iOS/Android natives.

**Phase 2 / V2 / déclenché si traction (M9-M12+)** : apps natives RN+Expo backportées si demande utilisateurs explicite (à valider via PostHog event tracking et tickets support).

D-U-N-S 281515446 obtenu reste **utile** : gratuit, lifetime, débloquera Apple Developer enrollment instantanément si décision native plus tard.

---

## 2. Justification stratégique

### Pourquoi PWA-only Phase 1

| Argument | Détail |
|---|---|
| **App Store ≠ canal acquisition B2B vertical FR** | Personne ne tape "logiciel DPE" dans App Store. Les 13 000 diagnostiqueurs arrivent via LinkedIn outreach + ADEME + parrainage + salons SIDIANE/FIDI |
| **Économie ~120€/an + 3-5j dev** | Apple Dev $99/an + Google Play $25 lifetime + setup EAS Build/TestFlight évités |
| **Updates instantanées** | Push code → users en F5 (vs 24-72h Apple Review pour features critiques) |
| **Zéro risque rejet Apple Review** | Apple = strict sur subscription rules ; éviter le risque sur Stripe paiement externe |
| **Stack simplifié** | 1 codebase Next.js 15 au lieu de monorepo RN+Expo + Next.js |
| **iPadOS PWA support mature** | Service Workers, IndexedDB, Web Audio, PointerEvents API tous fonctionnels |

### Compatibilité 6 features MVP

| Feature MVP | PWA OK ? | Notes |
|---|---|---|
| 1. Saisie vocale Whisper | ✅ Parfait | `MediaRecorder` + `getUserMedia` → m4a/webm 16kHz mono OK |
| 2. Photos géolocalisées | ✅ Bon | `getUserMedia` ou `<input type="file" capture="environment">` + EXIF GPS via FileReader |
| 3. Croquis 2D Apple Pencil | ⚠️ Dégradé acceptable | PointerEvents API : pression `event.pressure` OK, tilt/hover NON. Pour symboles porte/fenêtre/radiateur + calcul Carrez/Boutin = largement suffisant. Latence ~16-50ms (vs 9ms natif) imperceptible |
| 4. Auto-complétion adresse | ✅ Parfait | Fetch API standard sur BAN/IGN/Géorisques |
| 5. Export multi-format | ✅ Parfait | Server-side Edge Function (identique natif) |
| 6. Sync mobile/web + offline | ✅ Bon | Service Worker + IndexedDB (Dexie.js) au lieu d'op-sqlite + Drizzle |

---

## 3. Ce qu'on PERD (et mitigations)

| Perte | Impact | Mitigation |
|---|---|---|
| Apple Pencil tilt/hover/azimuth | Faible (croquis simples) | PointerEvents `event.pressure` suffit pour Phase 1 |
| Web Bluetooth télémètres Leica | Bloqué iOS Safari ⛔ | Télémètres BLE = V2 de toute façon |
| Frame processors live ML | Phase 2 feature, pas MVP | Vision IA = V2 de toute façon |
| HEIF natif | Compression sub-optimale | JPEG q=80 1920px ≈ 300 KB/photo OK |
| **⚠️ iPadOS efface PWA data après 7j inactivité** | Critique si pas mitigé | **Ceinture + bretelles** (cf. §4) |
| Crédibilité "vraie app" App Store | Faible pour Maxime <35 ans | OK Phase 1, V2 native si users demandent |

---

## 4. Stratégie persistence PWA — ceinture + bretelles

### Ceinture 1 — Force "Add to Home Screen" (PERMANENT-IFICATION)

Onboarding J0 obligatoire pour tous nouveaux users iPad/iPhone :

1. Détecter user-agent iPadOS/iOS via JS
2. Modal interrompante : *"Pour utiliser KOVAS comme une vraie app, ajoute-le à ton écran d'accueil en 3 clics"*
3. Tutoriel visuel : Safari → Partager → "Sur l'écran d'accueil"
4. Détection installation : `window.matchMedia('(display-mode: standalone)').matches`
5. Tracking PostHog event `pwa.installed` = true
6. **Si installation refusée 2x consécutivement → email J+3 "Tu rates 30% des features mobiles"**

**Une fois "Added to Home Screen" : data persiste indéfiniment** (Apple ne supprime PAS les data des apps PWA installées).

### Bretelle 2 — Sync forcé cloud tous les 5 jours

Service Worker periodic background sync (si supporté) + fallback :

- Toutes les **5 jours**, push notification email Resend : *"Reconnecte-toi pour synchroniser tes missions"*
- L'ouverture déclenche sync local → Supabase
- Email contient lien magic-link login (cf. D402)
- Tracking PostHog `last_active_at` : si < 5 jours → email auto

### Bretelle 3 — Monitoring PostHog `last_active_at`

Dashboard admin :
- Liste users avec `last_active_at > 5 days` (cohorte at-risk)
- Email manuel fondateur si > 7 jours sans activité
- Métriques M12 : taux d'utilisateurs en "Added to Home Screen" mode (cible ≥ 80%)

---

## 5. Stack technique mis à jour

### Frontend (unifié web + mobile via PWA)

| Layer | Technologie |
|---|---|
| Framework | **Next.js 15 App Router** + TypeScript strict (unifié, plus de séparation web/mobile) |
| Styling | Tailwind CSS + shadcn/ui + Lucide React |
| Theme | next-themes (light/dark auto + override) |
| i18n | next-intl |
| Animation | Framer Motion |
| Charts | Recharts ou Visx |
| **Croquis 2D** | **Konva.js + react-konva** (au lieu de @shopify/react-native-skia) |
| **Caméra** | `<input type="file" capture="environment">` + `getUserMedia` |
| **Audio** | Web Audio API + MediaRecorder |
| **Apple Pencil** | PointerEvents API (`event.pressure`, `event.pointerType === 'pen'`) |
| **Offline DB** | **Dexie.js** sur IndexedDB (au lieu d'op-sqlite + Drizzle) |
| **Service Worker** | next-pwa ou serwist (sync offline + cache) |
| **State management** | Zustand + TanStack Query (identique au plan initial) |

### PWA Manifest

`apps/web/public/manifest.json` :

```json
{
  "name": "KOVAS",
  "short_name": "KOVAS",
  "description": "App iPad diagnostic immobilier IA-first",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#0A0A0A",
  "background_color": "#F4F4F5",
  "lang": "fr-FR",
  "scope": "/",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["business", "productivity"],
  "shortcuts": [
    { "name": "Nouvelle mission", "short_name": "Mission", "url": "/missions/new" },
    { "name": "Mes clients", "short_name": "Clients", "url": "/clients" }
  ]
}
```

### Service Worker (serwist or next-pwa)

- Cache-first pour assets statiques (CSS, JS, images, fonts Outfit + Instrument Serif)
- Network-first pour API calls (avec fallback cache stale-while-revalidate)
- Background sync pour queue mutations offline
- Periodic background sync (si supporté) pour sync 5 jours

---

## 6. Structure monorepo simplifiée (révision CLAUDE.md §11)

```
kovas-app/
├── apps/
│   └── web/                    # Next.js 15 PWA (unifié, plus de apps/mobile/)
├── packages/
│   ├── shared/                 # types TypeScript, enums, utilitaires
│   ├── database/               # client Supabase, types générés
│   ├── ai/                     # wrappers Claude + Whisper + provider fallback
│   └── liciel-bridge/          # schéma JSON + MDB writer + XML CII
├── services/
│   └── mdb-writer/             # microservice Java/Jackcess (Linux Railway)
├── supabase/
│   ├── migrations/             # schéma SQL versionné
│   └── functions/              # Edge Functions
├── tests/e2e/                  # Playwright E2E sur PWA
├── pnpm-workspace.yaml, package.json, tsconfig.json, .env.example
└── CLAUDE.md, README.md
```

**Suppressions vs plan initial** : `apps/mobile/` (RN+Expo), packages mobile-specific.

---

## 7. Sprint MVP 14j révisé (simplifié)

Gains de simplification (~3-5 jours sur les 14, à réallouer en buffer ou polish) :

| Jour | Plan initial | Plan PWA-only |
|---|---|---|
| J1 | Setup monorepo + Supabase + auth + design system base | **Identique** |
| J2 | Design system complet (Ron Design Lab × Tectra : crème + cobalt + butter, Outfit + Instrument Serif italic) | **Identique** |
| J3 | CRUD missions/clients/biens + APIs gouv FR | **Identique** |
| J4 | EAS dev client + Vision Camera + Skia setup | **PWA setup** : Service Worker + IndexedDB Dexie + manifest + onboarding "Add to Home Screen" |
| J5 | Photos géolocalisées RN Vision Camera | **Photos PWA** : `<input capture>` + `getUserMedia` + EXIF GPS + Konva annotations |
| J6 | Capture audio Whisper + structuration Claude | **Identique** (MediaRecorder au lieu d'expo-audio, sinon pareil) |
| J7 | Checkpoint démo terrain | **Identique** |
| J8 | Croquis 2D Apple Pencil + Skia | **Croquis PWA** : Konva.js + PointerEvents + symboles |
| J9 | Dashboard + sync Realtime mobile/web | **Identique** (web only, plus simple) |
| J10 | Mode offline op-sqlite + Drizzle | **Mode offline PWA** : Dexie.js + Service Worker queue mutations |
| J11 | Exports multi-format | **Identique** |
| J12 | Export ZIP Liciel + tests | **Identique** |
| J13 | Stripe 4 tiers + tests E2E Playwright | **Identique** (plus simple, juste web) |
| J14 | Build prod Vercel + Expo EAS + TestFlight + 10 bêta-testeurs | **Deploy Vercel prod** + 10 bêta-testeurs invités via URL kovas.fr (plus de TestFlight) |

**Économie effort** : ~3-5 jours réutilisables en buffer polish post-J14 (J15-J18 réservé).

---

## 8. Bêta privée révisée

| Plan initial | Plan PWA-only |
|---|---|
| TestFlight invitation 40-50 bêta-testeurs | **Invitation par URL `kovas.fr/beta/{token}`** avec magic link |
| Build iOS via EAS, distribution App Store Connect | **Deploy Vercel** + accès direct |
| Délai Apple Review pour chaque release | **Push code → users instantané** |
| Limit 10 000 testeurs externes TestFlight | Pas de limite hard cap |
| Profils provisioning iPad spécifiques | **Aucun profil requis**, juste URL |

---

## 9. Comptes services révisés (vs CLAUDE.md §19)

### DIFFÉRÉS V2 (économies immédiates)

| Service | Coût Phase 1 économisé | Quand réactiver |
|---|---|---|
| Apple Developer Program | **$99/an (~95€)** | V2 si décision native (M10+) |
| Google Play Developer | **$25 lifetime** | V2 si décision Android |
| Expo EAS Production | **$29/mo** | V2 si retour RN+Expo |
| TestFlight | $0 (mais friction) | V2 si retour native |

### MAINTENUS (utilité PWA confirmée)

| Service | Usage Phase 1 PWA |
|---|---|
| D-U-N-S Number | **Gardé** (gratuit, lifetime, utile V2 native ou crédibilité B2B) |
| Vercel Pro | Hosting PWA production |
| Cloudflare | DNS + CDN + SSL kovas.fr |
| Tous autres (Supabase, Anthropic, OpenAI, Stripe, etc.) | Identiques |

---

## 10. Conflits avec décisions Discovery résolus

| ID Discovery | Décision initiale | Résolution PWA-only |
|---|---|---|
| D305 (paquet 3) | op-sqlite + Drizzle ORM | **Dexie.js** sur IndexedDB |
| D1102 (paquet 11) | Apple Developer M1 | **DIFFÉRÉ V2** |
| D1103 (paquet 11) | Google Play M1 | **DIFFÉRÉ V2** |
| D207b (paquet 2) | Dataset Vision IA 200 photos | Inchangé (V2) |
| Task 0.2 (PHASES) | Apple Dev + Google Play enrollment | **DIFFÉRÉE** |
| Task 2.1 (PHASES) | EAS dev client iOS | **REMPLACÉE** par "Setup Next.js 15 PWA + Service Worker + Manifest" |
| Task 2.2 (PHASES) | Photos Vision Camera 4 | **REMPLACÉE** par "Photos PWA `<input capture>` + Konva annotations" |
| Task 3.1 (PHASES) | Croquis Skia RN | **REMPLACÉE** par "Croquis Konva.js + PointerEvents" |
| Task 3.3 (PHASES) | Mode offline op-sqlite + Drizzle | **REMPLACÉE** par "Mode offline Service Worker + Dexie.js" |
| Task 5.1 (PHASES) | Deploy Vercel + EAS Build + TestFlight | **SIMPLIFIÉE** : Deploy Vercel only |

---

## 11. Trigger pour reconsidérer native V2

Si après M9 launch public :

- ≥ 20% des utilisateurs payants demandent explicitement "app native" via tickets/sondage
- OU PostHog métriques : ≥ 30% taux d'utilisateurs en mode browser (pas "Added to Home Screen") après 30 jours
- OU iPadOS update casse une feature critique PWA (peu probable mais surveillé)

→ Re-activation Task 0.2 (Apple Developer + Google Play enrollment) + backporting RN+Expo Phase 2/V2.

**D-U-N-S déjà obtenu** = enrollment Apple Dev redémarrable en 1-7j ouvrés sans bottleneck.

---

## 12. Récap : artefacts à mettre à jour

| Artefact | Priorité | Action |
|---|---|---|
| **CLAUDE.md** | HIGH | §3, §8, §11, §12 mises à jour PWA-only |
| **DISCOVERY.md** | HIGH | Ajouter Modification 17 (pivot PWA) |
| **PHASES.md** | MEDIUM | Task 0.2 DIFFÉRÉ, Task 2.1/2.2/3.1/3.3 remplacées |
| **planning-14-jours.md** | MEDIUM | J4-J5-J8-J10-J14 ajustés |
| **task-0-2.md** | HIGH | Marquer "DIFFÉRÉE V2" |
| **research/mobile-stack.md** | LOW | Note d'obsolescence "Repoussé V2/Phase 2" |
| **features-roadmap.md** | LOW | V2 ajouter "Apps natives iOS/Android" |
| **economics.md** | LOW | Coûts services Apple/Google retirés Phase 1 |

**TODO post-pivot** (peut être différé jusqu'à Sprint J1 si Benjamin veut démarrer dev maintenant) :
- Update task files Phase 0 → R, Phase 1 → R, Phase 2 → 5 pour refléter PWA-only
- Note d'obsolescence dans `research/mobile-stack.md` pointant vers ce document
