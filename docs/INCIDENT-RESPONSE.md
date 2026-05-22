# INCIDENT-RESPONSE.md — Procédure de réponse à incident KOVAS

> Document de référence pour la gestion des incidents production KOVAS.
> Owner : Benjamin Bel (astreinte solo M0-M9). Backup advisor M9+.

## Table des matières

1. [Définitions](#1-définitions)
2. [Étape 1 — Détection (< 5 min)](#2-étape-1--détection--5-min)
3. [Étape 2 — Triage (< 10 min)](#3-étape-2--triage--10-min)
4. [Étape 3 — Mitigation (< 30 min)](#4-étape-3--mitigation--30-min)
5. [Étape 4 — Fix (< 4h)](#5-étape-4--fix--4h)
6. [Étape 5 — Post-mortem (< 48h)](#6-étape-5--post-mortem--48h)
7. [Template post-mortem](#7-template-post-mortem)
8. [Contacts d'astreinte](#8-contacts-dastreinte)

---

## 1. Définitions

### Niveaux de sévérité

| Niveau | Définition | Temps de réponse cible |
|---|---|---|
| **P1 — Critique** | Plateforme down complète. Aucun utilisateur ne peut accéder à `/app/*` ou signin. Fuite massive de données. | < 5 min détection, < 30 min mitigation |
| **P2 — Dégradation majeure** | Fonctionnalité critique cassée pour > 30% des utilisateurs (ex: export Liciel KO, paiement Stripe KO, voice transcribe KO). | < 15 min détection, < 1h mitigation |
| **P3 — Bug isolé** | Fonctionnalité secondaire cassée OU impact < 5% des utilisateurs. | < 1h détection, < 24h fix |

### Sources de détection

| Source | Canal | Sévérité associée |
|---|---|---|
| Better Stack | SMS + email | P1 (monitor `/api/health` 60s) |
| Sentry | Email + Slack | P2/P3 selon volume |
| Stripe webhooks | Slack `#stripe-failures` | P2 |
| Email user direct (`security@kovas.fr` / `support@kovas.fr`) | Email | P1/P2/P3 selon contenu |
| Support tickets `urgent` | Dashboard admin | P2/P3 |

---

## 2. Étape 1 — Détection (< 5 min)

### Réception alerte

1. **SMS Better Stack** → confirmer dans les 2 min via page status
2. **Email Sentry** → ouvrir Sentry, regarder le rate d'erreurs sur les 15 dernières min
3. **Slack incident channel** → annoncer "🟠 Incident détecté, je prends — Benjamin" dans `#incidents`

### Vérifications rapides

- [ ] Page `/api/health` retourne `{"status":"ok"}` ?
- [ ] Status Vercel : https://www.vercel-status.com — incident en cours ?
- [ ] Status Supabase : https://status.supabase.com — incident en cours ?
- [ ] Status Stripe : https://status.stripe.com — incident en cours ?
- [ ] Dashboard Vercel Analytics : pic d'erreurs HTTP 5xx ?

### Décision : P1 / P2 / P3 ?

- Si > 50% des requêtes en erreur → **P1**
- Si module critique (auth, paiement, export, voice) KO → **P2**
- Sinon → **P3**

---

## 3. Étape 2 — Triage (< 10 min)

### Identifier l'ampleur

```bash
# 1. Compter les utilisateurs impactés
# Sentry → filtre is_unhandled:true + last 1h
# OU PostHog Live → users actifs sur les pages erreur

# 2. Identifier la version déployée actuelle
vercel deployments list --prod | head -3
git log -5 --oneline

# 3. Vérifier les déploiements récents
# → Si déploiement < 30 min avant l'incident, rollback prioritaire
```

### Lire la stack trace

1. Ouvrir Sentry → trier par "count" desc, dernière heure
2. Identifier le top issue → ouvrir l'event
3. Noter :
   - **Fichier:ligne** de l'erreur
   - **User impactés** : count + sample emails
   - **Browser/OS** distribution
   - **URL** où ça crash

### Reproduire localement (si possible)

```bash
git checkout <commit-déploiement-actif>
corepack pnpm --filter @kovas/web dev
# Naviguer à l'URL reportée par Sentry
```

Si reproduction OK → cause identifiée, passer à mitigation immédiate.
Si non reproductible → suspect issue env-spécifique (env vars, DB state, cache CDN).

---

## 4. Étape 3 — Mitigation (< 30 min)

L'objectif est de **stopper l'hémorragie**, pas de fixer la cause racine. Ordre des actions selon le contexte :

### Option A — Rollback Vercel (recommandé si bug récent)

```bash
# 1. Identifier le dernier déploiement stable
vercel deployments list --prod

# 2. Promote l'ancien déploiement en production
vercel promote <deployment-url> --scope kovas

# 3. Vérifier
curl -I https://kovas.fr/api/health
```

**SLA cible** : 3 min pour rollback complet via Vercel UI.

### Option B — Feature flag disable

Si l'incident touche un endpoint spécifique :

```bash
# PostHog → Feature Flags → toggle off
# Ou via API :
curl -X PATCH https://app.posthog.com/api/projects/<PROJECT>/feature_flags/<FLAG>/ \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

### Option C — Cloudflare "Under Attack" mode

Si l'incident est dû à un afflux suspect (DDoS, bot abuse) :

1. Dashboard Cloudflare → kovas.fr → Security
2. Toggle "Under Attack Mode" ON
3. Wait challenge réduise le trafic
4. Retour `Off` une fois la situation maîtrisée (< 30 min idéalement)

### Option D — Disable Supabase Edge Function

Si une Edge Function plante en boucle :

```bash
npx supabase functions delete <function-name>
# ou désactiver via dashboard Supabase
```

### Communication user (P1 uniquement)

- [ ] Mettre à jour la status page `kovas.fr/status`
- [ ] Tweet `@kovas_fr` (V1.5+ quand compte créé)
- [ ] Email aux comptes Cabinet (impact business critique) via Resend bulk

---

## 5. Étape 4 — Fix (< 4h)

Une fois la situation stabilisée (P1/P2), on travaille au correctif définitif.

### Branche hotfix

```bash
git checkout main
git pull
git checkout -b hotfix/incident-YYYY-MM-DD-<slug>

# Coder le fix minimal — pas de refactoring opportuniste
# Ajouter UN test qui aurait détecté le bug

git add <files>
git commit -m "fix(<scope>): <description courte>

Incident YYYY-MM-DD : <résumé impact>
Cause : <one-liner>
Fix : <one-liner>
Test : <one-liner>"
```

### Test rapide

```bash
corepack pnpm --filter @kovas/web typecheck
corepack pnpm --filter @kovas/web test -- --run --reporter=verbose
corepack pnpm --filter @kovas/web build
```

### Déploiement

```bash
git push origin hotfix/incident-YYYY-MM-DD-<slug>
gh pr create --base main --title "hotfix: <description>" --body "Cf. incident YYYY-MM-DD"

# Si CI verte → merge immédiat (override branch protection si nécessaire, documenter dans le PR)
gh pr merge --squash

# Vercel déploie automatiquement sur main
```

### Vérification post-deploy

- [ ] Sentry rate d'erreurs revient à la baseline (~< 50/24h)
- [ ] Better Stack uptime monitor OK
- [ ] Vérification manuelle du flux impacté
- [ ] Communication user : update status page → "Résolu"

---

## 6. Étape 5 — Post-mortem (< 48h)

### Quand écrire un post-mortem

**Obligatoire** :

- Tous les incidents P1
- Incidents P2 avec impact > 50 utilisateurs OU > 30 min de downtime
- Tout incident de sécurité

**Optionnel mais recommandé** :

- Incidents P3 si pattern récurrent
- Incidents évités de justesse (near miss)

### Process

1. Créer page Notion `Post-mortem YYYY-MM-DD <slug>` depuis le template (§7)
2. Remplir factuel sans jugement (blameless culture)
3. Identifier 1-3 actions correctives concrètes avec owner + deadline
4. Mettre à jour ce doc ou QUALITY.md / SECURITY.md si nouvelle procédure
5. Si > 100 users impactés → publier version publique sur `kovas.fr/incidents/<date>`
6. Mettre à jour CVE table dans SECURITY.md §8 si incident sécurité

### Communication utilisateurs touchés

Si > 10 utilisateurs ont été significativement impactés :

- Email personnalisé via Resend (template `post-incident-apology.tsx`)
- Geste commercial : 1 mois offert sur la facturation suivante pour les comptes Cabinet
- Pas de geste pour Découverte/Standard (économie KOVAS) sauf incident sécurité

---

## 7. Template post-mortem

À copier dans Notion (page parent : `Engineering / Post-mortems / YYYY`).

```markdown
# Post-mortem — <Titre court> — YYYY-MM-DD

## Résumé exécutif (1 paragraphe, max 5 lignes)

Le DATE de HH:MM à HH:MM (durée totale : Xh Ymin), KOVAS a subi <description>.
Impact estimé : <N> utilisateurs touchés, <Z> requêtes échouées.
Cause racine : <one-liner>. Résolution : <one-liner>.
Sévérité : P1 / P2 / P3.

## Timeline (heure CET)

- **HH:MM** : <événement déclencheur>
- **HH:MM** : Détection via <source>
- **HH:MM** : Triage commence — <action>
- **HH:MM** : Mitigation appliquée — <action>
- **HH:MM** : Incident considéré résolu
- **HH:MM** : Communication user envoyée

## Que s'est-il passé ? (factuel)

<Description détaillée chronologique, sans hypothèses ni jugement>

## Pourquoi est-ce arrivé ? (cause racine)

<Analyse "5 why" — remonter à la cause structurelle, pas juste technique>

1. Pourquoi <symptôme> ?
   → Parce que <raison technique>.
2. Pourquoi <raison technique> ?
   → Parce que <raison process>.
3. ... (jusqu'à atteindre une cause systémique)

## Impact

- **Utilisateurs touchés** : <N> (sample : a@x.fr, b@y.fr, …)
- **Requêtes échouées** : <Z>
- **MRR à risque** : <€>
- **Réputation** : <faible / moyen / élevé>

## Ce qui a bien fonctionné

- ...
- ...

## Ce qui n'a pas fonctionné

- ...
- ...

## Actions correctives

| Action | Owner | Deadline | Statut |
|---|---|---|---|
| <Action 1> | Benjamin | YYYY-MM-DD | À faire |
| <Action 2> | Benjamin | YYYY-MM-DD | À faire |

## Leçons apprises

<3-5 puces génériques transférables à d'autres incidents>

## Annexes

- Sentry issue : <URL>
- Vercel deployment : <URL>
- Slack thread : <URL>
- Tickets support associés : #X, #Y
```

---

## 8. Contacts d'astreinte

### Phase actuelle (M0-M9) — Solo

| Rôle | Personne | Contact primaire | Contact secondaire |
|---|---|---|---|
| Incident manager | Benjamin Bel | SMS Better Stack | benjamin@kovas.fr |
| Tech lead | Benjamin Bel | SMS Better Stack | — |
| Comm utilisateurs | Benjamin Bel | benjamin@kovas.fr | — |
| Sécurité | Benjamin Bel | security@kovas.fr | — |

**Disponibilité** : 7j/7, 7h-23h CET. Hors plage : best-effort, SMS Better Stack uniquement P1.

### Phase post-recrutement (M9+)

| Rôle | Primaire | Backup |
|---|---|---|
| Incident manager | Benjamin Bel | Advisor diagnostiqueur |
| Tech lead | Benjamin Bel | — (solo confirmé jusqu'à M18+) |
| Comm utilisateurs | Benjamin Bel | Advisor (sur sujets métier uniquement) |
| Sécurité | Benjamin Bel | Avocat IP/Tech (sur breach RGPD) |

### Numéros / liens utiles

- **Better Stack incidents** : https://uptime.betterstack.com/team/<team-id>/incidents
- **Sentry KOVAS** : https://sentry.io/organizations/kovas/issues/
- **Vercel KOVAS** : https://vercel.com/kovas/kovas-app
- **Supabase KOVAS** : https://supabase.com/dashboard/project/<project-id>
- **CNIL violation form** : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles
- **Cabinet avocat IP/Tech (M9+)** : Lefèvre Avocats ou Lex2B (à activer post-M9)
