# Task 0.2 : Apple Developer + Google Play enrollment (M1) — ⚠️ DIFFÉRÉE V2

> **⚠️ STATUT MIS À JOUR 18/05** : cette task est **DIFFÉRÉE V2/Phase 2** suite au pivot PWA-only Phase 1 (cf. [`/docs/pwa-pivot-decision.md`](../../../../docs/pwa-pivot-decision.md)).
>
> **Économie immédiate** : $99/an Apple Developer + $25 lifetime Google Play.
>
> **Re-activation trigger** :
> - ≥ 20% users payants demandent app native via tickets/sondage, OU
> - ≥ 30% taux d'utilisateurs en mode browser (pas "Added to Home Screen") après 30j, OU
> - iPadOS update casse une feature critique PWA (peu probable mais surveillé)
>
> **D-U-N-S 281 515 446 déjà obtenu** (Task 0.1 ✅) — Apple Developer enrollment redémarrable en 1-7j ouvrés sans bottleneck.
>
> Le contenu ci-dessous reste **valide pour V2 ou Phase 2** si décision native.

---



## Objective

Enrôler le compte **Apple Developer Program** sous SASU Nexus 1993 (après réception D-U-N-S) + créer un compte **Google Play Developer** ($25 one-shot lifetime). Réserver le bundle ID iOS `com.nexus1993.kovas`.

## Context

Task à exécuter dès réception du D-U-N-S demandé en Task 0.1 (5-15 jours ouvrés). Sans Apple Developer Program, pas de TestFlight bêta et pas d'App Store submission M9. Google Play est moins urgent (Android = Phase 2 V2) mais $25 lifetime mérite d'être créé tôt.

## Dependencies

- Task 0.1 (D-U-N-S Number reçu et archivé)

## Blocked By

- Task 0.1 (notamment D-U-N-S — délai administratif 5-15j ouvrés)

## Research Findings

- De `research/mobile-stack.md` §8 : Apple Developer Program **$99/an** (~95€), D-U-N-S **5-15j ouvrés**, enrôler sous **org Nexus 1993** pour transfert futur possible
- De `research/mobile-stack.md` §8 : Sign in with Apple **obligatoire** si OAuth Apple/Google activé — pas de signin OAuth Phase 1, donc évité
- De `research/mobile-stack.md` §8 : TestFlight beta **10 000 testeurs externes max** (one-time review per build) — largement suffisant pour bêta 40-50

## Implementation Plan

### Step 1 : Apple Developer Program enrollment

- Aller sur https://developer.apple.com/programs/enroll/
- Choisir **Organization** (pas Individual)
- Renseigner :
  - **Legal Entity Name** : SASU Nexus 1993
  - **D-U-N-S Number** : (récupéré Task 0.1)
  - **Country** : France
  - **Address** : Dieppe (siège Nexus 1993)
  - **Contact** : Benjamin Bel, président
- Possible call de vérification Apple (rare pour SASU mais préparer KBis + RIB)
- Paiement $99 USD (~95€) via carte Qonto Nexus 1993
- Délai approbation : 1-7 jours ouvrés post-paiement

### Step 2 : Réservation Bundle ID iOS

Une fois enrôlement validé :

- App Store Connect → My Apps → Identifiers
- Créer **App ID** : `com.nexus1993.kovas`
- Description : "KOVAS App - SaaS diagnostic immobilier"
- Capabilities à activer (au minimum) :
  - [x] Sign in with Apple (réservé même si pas Phase 1)
  - [x] Push Notifications (Phase 2)
  - [x] Associated Domains
  - [x] In-App Purchase (jamais activé en pratique — B2B SaaS via web Stripe)
- Bundle ID **immuable** une fois créé

### Step 3 : Création App Store Connect record

- App Store Connect → My Apps → + → New App
- **Platforms** : iOS (universal)
- **Name** : KOVAS
- **Primary Language** : French
- **Bundle ID** : `com.nexus1993.kovas`
- **SKU** : `kovas-app-v1`
- App pas encore submise (juste enregistrée pour TestFlight + plus tard)

### Step 4 : Création certificats + provisioning profiles

- Via Expo EAS : `eas credentials` → Configure for iOS
- EAS gère automatiquement les certificats + provisioning profiles
- Stocker `eas.json` avec config dev / preview / production

### Step 5 : Google Play Developer enrollment ($25 one-shot lifetime)

- Aller sur https://play.google.com/console/signup
- Compte sous Nexus 1993 (entité)
- Paiement $25 USD lifetime via carte Qonto
- Approbation 1-2 jours ouvrés
- Réserver package name : `com.nexus1993.kovas` (cohérent iOS)

### Step 6 : Configuration `apps/mobile/app.json` (préparation)

```json
{
  "expo": {
    "name": "KOVAS",
    "slug": "kovas",
    "version": "0.1.0",
    "orientation": "default",
    "icon": "./assets/icon.png",
    "scheme": "kovas",
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "com.nexus1993.kovas",
      "buildNumber": "1",
      "supportsTablet": true,
      "requireFullScreen": false,
      "userInterfaceStyle": "automatic"
    },
    "android": {
      "package": "com.nexus1993.kovas",
      "versionCode": 1
    }
  }
}
```

## Files to Create

- `apps/mobile/app.json` (préparation, sera étendue Task 2.1)
- `apps/mobile/eas.json` (préparation EAS profiles)
- `docs/credentials-setup.md` (update : ajouter Apple Developer Team ID, Google Play account ID)

## Files to Modify

- `.env.example` (ajouter `APPLE_TEAM_ID`, `EXPO_TOKEN` éventuel)

## Contracts

### Provides (for downstream tasks)

- **Bundle ID iOS** : `com.nexus1993.kovas` (immuable, base pour Task 2.1, 5.1)
- **Apple Team ID** : pour configuration EAS Build (Task 2.1)
- **Google Play Package Name** : `com.nexus1993.kovas`

## Acceptance Criteria

- [ ] Apple Developer Program enrolled sous Nexus 1993 (~95€/an)
- [ ] App Store Connect : record "KOVAS" créé
- [ ] Bundle ID `com.nexus1993.kovas` réservé
- [ ] Google Play Developer compte créé ($25 lifetime)
- [ ] `apps/mobile/app.json` préparé avec bundle ID + config iOS/Android
- [ ] `eas.json` initialisé via `eas credentials` configure iOS

## Testing Protocol

### Browser Testing (Claude_in_Chrome MCP)

- Login https://appstoreconnect.apple.com → dashboard "KOVAS" visible
- Login https://developer.apple.com/account → Team ID visible
- Login https://play.google.com/console → compte actif
- Vérifier facturation Qonto Nexus 1993 : prélèvement Apple $99 + Google $25 effectués

### Build Check (light)

- `eas credentials -p ios --profile production` ne lève pas d'erreur
- `eas build --platform ios --profile development --local` lance un build (peut échouer sur code pas encore prêt, mais doit reconnaître les credentials)

## Skills to Read

- `kovas-design-system` (préparation app.json cohérente avec branding)

## Research Files to Read

- `research/mobile-stack.md` §8 (App Store + D-U-N-S)
- `research/mobile-stack.md` §9 (EAS Build + OTA strategy)

## Git

- Branch : `feature/0-2-apple-dev-google-play`
- Commit message prefix : `Task 0.2:`

## Notes anti-pattern

- ⛔ Ne PAS enrôler Apple Developer en compte Individual (Benjamin) — toujours sous Nexus 1993 (Organization) pour transfert futur
- ⛔ Ne PAS activer Sign in with Apple Phase 1 si OAuth Google/Apple non utilisés (déclenche obligation Apple)
- ⛔ Ne PAS oublier `supportsTablet: true` (iPad first product)
- ⛔ Ne PAS oublier `requireFullScreen: false` (Stage Manager compat)
