# INCIDENT-RESPONSE.md — Procédure de réponse à incident KOVAS

> Document de référence pour la gestion des incidents production KOVAS.
> Owner : Benjamin Bel (astreinte solo M0-M9). Backup advisor M9+.
> Mis à jour 2026-05-27 — ajout procédure data breach RGPD-compliant (SECURITY-AUDIT 2026-05-27).

## Table des matières

### Partie A — Incident technique (downtime, bug, dégradation)

1. [Définitions](#1-définitions)
2. [Étape 1 — Détection (< 5 min)](#2-étape-1--détection--5-min)
3. [Étape 2 — Triage (< 10 min)](#3-étape-2--triage--10-min)
4. [Étape 3 — Mitigation (< 30 min)](#4-étape-3--mitigation--30-min)
5. [Étape 4 — Fix (< 4h)](#5-étape-4--fix--4h)
6. [Étape 5 — Post-mortem (< 48h)](#6-étape-5--post-mortem--48h)
7. [Template post-mortem](#7-template-post-mortem)
8. [Contacts d'astreinte](#8-contacts-dastreinte)

### Partie B — Data breach RGPD (fuite données / piratage / accès non autorisé)

9. [Procédure data breach RGPD (7 phases)](#9-procédure-data-breach-rgpd-7-phases)
   - 9.1 [Détection breach](#91-détection-breach)
   - 9.2 [Containment immédiat (T+0 à T+1h)](#92-containment-immédiat-t0-à-t1h)
   - 9.3 [Investigation (T+1h à T+24h)](#93-investigation-t1h-à-t24h)
   - 9.4 [Notification RGPD (T+24h à T+72h)](#94-notification-rgpd-t24h-à-t72h)
   - 9.5 [Eradication + Remediation (T+24h à T+1 semaine)](#95-eradication--remediation-t24h-à-t1-semaine)
   - 9.6 [Lessons learned](#96-lessons-learned)
   - 9.7 [Contacts d'urgence breach](#97-contacts-durgence-breach)

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
| Endpoint CSP report ([`/api/security/csp-report`](../apps/web/src/app/api/security/csp-report/route.ts)) | Logs Vercel + Sentry | P1 si pic anormal |

---

## 2. Étape 1 — Détection (< 5 min)

### Réception alerte

1. **SMS Better Stack** → confirmer dans les 2 min via page status
2. **Email Sentry** → ouvrir Sentry, regarder le rate d'erreurs sur les 15 dernières min
3. **Slack incident channel** → annoncer "Incident détecté, je prends — Benjamin" dans `#incidents`

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

→ **Si suspicion de fuite de données / accès non autorisé / piratage → bascule immédiate sur Partie B §9** (data breach RGPD).

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

---

# Partie B — Data breach RGPD

> **Quand appliquer cette partie** : dès suspicion ou confirmation de fuite de données, piratage, accès non autorisé à la DB, vol de credentials, ou tout incident pouvant donner accès à des données personnelles (emails, SIRET, photos missions, factures, identifiants).
> **Cadre légal** : RGPD art. 33 (notification autorité < 72h) + art. 34 (notification personnes concernées si risque élevé).
> **Référence audit** : [`docs/security/SECURITY-AUDIT-2026-05-27.md`](security/SECURITY-AUDIT-2026-05-27.md).

## 9. Procédure data breach RGPD (7 phases)

### 9.1 Détection breach

#### Sources de détection breach

- **Alertes Sentry** : pics d'erreurs `auth`, `403`, `429`, ou stack traces avec données sensibles exposées
- **Monitoring Better Stack** : downtime suspect coïncidant avec pics requêtes anormaux
- **Rapport utilisateur** : email à `security@kovas.fr` signalant accès non autorisé à son compte ou réception d'email de phishing imitant KOVAS
- **Audit log Supabase** : connexions admin depuis IP inconnue, queries SQL massives, modifications RLS policies
- **Endpoint CSP report** ([`/api/security/csp-report`](../apps/web/src/app/api/security/csp-report/route.ts)) : pic anormal de violations CSP → possible injection XSS ou script tiers compromis
- **Signalement externe** : chercheur en sécurité (`security.txt`), CERT-FR, ANSSI

#### Indicateurs concrets à surveiller

- [ ] Pics massifs de requêtes 429 (rate-limit) sur `/api/*` → tentative brute-force
- [ ] Erreurs Sentry massives `AuthApiError`, `JWTExpired`, ou `42501` (RLS denied)
- [ ] Queries DB anormales : `SELECT * FROM auth.users`, `pg_stat_statements` montrant exfiltration
- [ ] Échecs auth massifs : > 100 `auth.signInWithPassword` failed en < 5 min depuis IP unique
- [ ] Comptes admin loggés depuis IP non-FR (à confirmer via dashboard Supabase Auth → Users)
- [ ] Diff git inattendu sur `main` (commit malveillant injecté) → vérifier `git log --since=24h`

#### Décision : breach ou pas ?

- **Breach confirmé** = données personnelles accédées/exfiltrées/modifiées sans autorisation → procédure complète §9.2 à §9.7
- **Tentative bloquée** = rate-limit a tenu, pas d'accès effectif → log dans `docs/security/incidents/`, pas de notif CNIL
- **Incertain** = appliquer principe de précaution : §9.2 (containment) + §9.3 (investigation) puis décider

---

### 9.2 Containment immédiat (T+0 à T+1h)

Objectif : stopper l'hémorragie. **Ne pas attendre la confirmation à 100%** — agir au moindre doute.

#### Checklist containment

- [ ] **Activer kill switch IA** si compromission soupçonnée (évite que les algos exfiltrent davantage de data) :

```sql
-- Via Supabase Studio SQL Editor
UPDATE admin_settings SET ai_systems_enabled = false WHERE id = 1;
```

- [ ] **Mettre la DB en lecture seule** via Supabase Studio :
  - Database → Connection Pooling → max conn = 1 (étrangle l'attaquant)
  - OU Database → Settings → Pause project (downtime mais protection max)

- [ ] **Bloquer IP source** via Vercel/Cloudflare WAF :
  - Cloudflare → Security → WAF → Custom Rules → Block IP `X.X.X.X`
  - Vercel → Project → Settings → Security → IP Blocking

- [ ] **Révoquer sessions affectées** côté DB :

```sql
-- Via Supabase Studio SQL Editor
DELETE FROM auth.sessions WHERE user_id IN ('uuid-1', 'uuid-2');
-- OU global si breach massif
DELETE FROM auth.sessions;
```

- [ ] **Force logout** via Edge Function pour tous les users actifs :

```bash
# Appeler manuellement via Supabase CLI
npx supabase functions invoke force-logout-all --no-verify-jwt
```

  Ou via `auth.signOut({ scope: 'global' })` dans une route admin protégée.

- [ ] **Rotation immédiate des secrets critiques** :
  - Supabase `service_role` key → Dashboard → Settings → API → Reset
  - Stripe webhook signing secret → Dashboard → Developers → Webhooks → Rotate
  - GitHub Personal Access Tokens (PATs) actifs sur le repo → révoquer puis recréer
  - Anthropic API key → Console Anthropic → API Keys → Revoke
  - Resend API key → Dashboard → API Keys → Rotate

- [ ] **Snapshot DB avant action destructive** (Supabase PITR) :
  - Dashboard → Database → Point-in-Time Recovery → Create snapshot now

- [ ] **Notifier en interne** :
  - SMS Benjamin (auto-notif puisque solo M0-M9)
  - Email `security@kovas.fr` consigné en thread

#### Timer

T+0 = moment de la détection. **Objectif : containment en < 1h**.

---

### 9.3 Investigation (T+1h à T+24h)

Objectif : comprendre **scope**, **vecteur**, **données exposées**, **nombre users**.

#### Sources à consulter

1. **Logs Sentry** : timeline événements 24h pré-incident
   - Filtrer par tags `auth.*`, `db.*`, `api.*`
   - Identifier première occurrence anormale

2. **Audit log Supabase** : `Database → Logs` (filtrer queries suspectes)
   - `SELECT *` sur tables sensibles (`auth.users`, `cabinet_*`, `missions`, `clients`)
   - `INSERT/UPDATE` sur tables admin
   - Changements RLS (`ALTER POLICY`)

3. **pg_stat_statements** : queries anormales (durée + volume)

```sql
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
WHERE calls > 100 AND mean_exec_time > 100  -- > 100ms
ORDER BY total_exec_time DESC LIMIT 50;
```

4. **Diff git** (si suspicion code compromis) :

```bash
git log --since="48 hours ago" --all --oneline
git log --since="48 hours ago" --all --stat
# Vérifier surtout commits sur main hors PR workflow
```

5. **Vercel deployments** : `vercel deployments list --prod | head -10`
   - Y a-t-il un déploiement non attendu ?

6. **Cloudflare Analytics** : pics trafic suspects depuis IP/AS inconnues

#### Scope à déterminer

- **Nombre users touchés** : query DB filtrée sur `last_active` dans la fenêtre breach
- **Données accédées** : croiser tables exposées avec leur contenu (emails, SIRET, factures, photos missions, IBAN)
- **Sensibilité** :
  - **Faible** : emails seuls, données publiques annuaire
  - **Moyen** : SIRET + factures + missions
  - **Élevé** : credentials (passwords hashés inclus), IBAN, photos de pièces d'identité (Doctolib KYC), pièces clients sensibles

#### Document de tracking

Créer immédiatement `docs/security/incidents/YYYY-MM-DD-<slug>.md` avec :

- Timeline détaillée
- Capture des logs (à conserver pour autorité CNIL si demande)
- Hypothèses de vecteur d'attaque
- Liste users touchés (UUID seul, jamais en clair)

---

### 9.4 Notification RGPD (T+24h à T+72h)

> **Délai légal max : 72h après prise de connaissance** (art. 33 RGPD). À défaut, motiver le retard.

#### 9.4.1 Notification autorité CNIL

**Quand** : dès qu'il y a un risque pour les droits et libertés des personnes (art. 33§1).

**Critères généralement déclencheurs** :

- ✓ > 100 personnes concernées
- ✓ Données sensibles (santé, financier IBAN, identifiants login)
- ✓ Risque d'usurpation d'identité ou fraude
- ✓ Données enfants (non applicable KOVAS)

**Si aucun de ces critères → notifier quand même** (principe de précaution). Mieux vaut sur-notifier qu'omettre.

**Comment** :

1. Aller sur https://notifications.cnil.fr (formulaire en ligne authentifié SIRET)
2. Sélectionner "Notifier une violation de données"
3. Remplir le formulaire :
   - Date / heure de la violation
   - Date / heure de la détection
   - Nature de la violation (confidentialité / intégrité / disponibilité)
   - Catégories de données concernées
   - Catégories de personnes concernées
   - Nombre approximatif de personnes touchées
   - Mesures prises pour atténuer
   - Coordonnées DPO (Benjamin Bel directement en M0-M9, externalisation Vague 2 §14 CLAUDE.md)
4. Recevoir un numéro de dossier (à conserver)

**Délai strict** : 72h. Pas de week-end / jour férié qui prolonge.

#### 9.4.2 Notification personnes concernées (art. 34 RGPD)

**Obligatoire si** : risque élevé pour les droits et libertés (ex: vol IBAN, mots de passe, données médicales).

**Comment** :

- Email transactionnel via Resend depuis admin
- Template pré-rédigé à créer dans `apps/web/src/emails/security-breach-notification.tsx` (à faire post-incident — pas le moment d'improviser)
- Contenu obligatoire (art. 34§2) :
  - Nature de la violation
  - Coordonnées DPO
  - Conséquences probables
  - Mesures prises ou proposées
  - Recommandations pour atténuer (changer mot de passe, surveiller relevés bancaires, etc.)

**Délai** : sans délai injustifié — viser < 72h après notif CNIL.

#### 9.4.3 Communication presse / publique

**Quand** : > 1000 personnes touchées, OU impact grave (vol IBAN massif, données santé, etc.), OU media pression.

**Comment** :

- Page publique `kovas.fr/security/incident/YYYY-MM-DD`
- Communiqué bref factuel : ce qui s'est passé, scope, mesures, contact
- Statement Benjamin sur LinkedIn (transparence > silence)
- **PAS** sur X / autres réseaux avant validation avocat IP/Tech si engagé (Vague 2)

---

### 9.5 Eradication + Remediation (T+24h à T+1 semaine)

Une fois containment + investigation faits, traiter la cause racine.

#### Checklist eradication

- [ ] **Rotation de TOUS les secrets concernés** (même ceux non confirmés compromis, par précaution) :
  - Supabase `service_role` + `anon` keys
  - Stripe webhook signing secrets
  - Tous les PATs GitHub
  - Anthropic + OpenAI + Deepgram API keys
  - Resend API key
  - JWT secrets si custom
  - Tokens OAuth si présents

- [ ] **Patch vulnérabilité root cause** : selon l'investigation (§9.3)
  - Si XSS : audit toutes les `dangerouslySetInnerHTML` + escape strict
  - Si SQL injection : audit toutes les queries Server Actions + RLS
  - Si RLS bypass : audit policies `auth.is_member_of` + tests E2E
  - Si secret leak : audit `.env*` + repo history (`git secrets` + truffleHog)
  - Si dépendance vulnérable : `pnpm audit --fix` + Dependabot critical

- [ ] **Force password reset utilisateurs touchés** :

```sql
-- Generate password reset tokens pour tous les users concernés
-- Via Supabase Edge Function admin
```

  Envoyer email Resend "Votre mot de passe a été réinitialisé suite à un incident de sécurité — veuillez choisir un nouveau mot de passe via ce lien".

- [ ] **Backup avant patch** : confirmer le snapshot Supabase PITR du §9.2

- [ ] **Déploiement patch** :
  - Branche `hotfix/security-breach-YYYY-MM-DD`
  - Code review obligatoire (même solo : 2e relecture après pause)
  - Tests régression complets (`pnpm test --run` + Playwright `pnpm test:e2e`)
  - Déploiement → Vercel preview → smoke tests → promote prod

- [ ] **Tests régression** :
  - Tester le vecteur d'attaque exact (PoC) ne fonctionne plus
  - Tester les flux nominaux (auth, paiement, export) pas cassés
  - Tester monitoring + alertes (Sentry capture bien le pattern)

- [ ] **Post-mortem interne** : utiliser le template §7

---

### 9.6 Lessons learned

#### Documenter l'incident

Compléter `docs/security/incidents/YYYY-MM-DD-<slug>.md` créé en §9.3 avec :

- **Résumé exécutif** (3 lignes max)
- **Timeline complète**
- **Vecteur d'attaque confirmé**
- **Données réellement exposées** (volume + sensibilité)
- **Notifications envoyées** (CNIL n° dossier, users count, presse)
- **Patch déployé** (commit SHA + PR URL)
- **Mesures préventives ajoutées**

#### Identifier les mesures préventives transverses

À ajouter au backlog selon le pattern de l'incident :

- [ ] Nouvelle règle Semgrep (cf. `.semgrep.yml`)
- [ ] Nouvelle policy RLS Supabase
- [ ] Nouveau monitor Sentry alert
- [ ] Nouveau check Lighthouse CI / GitHub Action
- [ ] Update [`safe-logger.ts`](../apps/web/src/lib/security/safe-logger.ts) si nouveau pattern PII détecté
- [ ] Update [`scrub-pii.ts`](../apps/web/src/lib/security/scrub-pii.ts) Sentry beforeSend
- [ ] Update [`/api/security/csp-report/route.ts`](../apps/web/src/app/api/security/csp-report/route.ts) si nouvelle source CSP

#### Update cette procédure

Si nouveau pattern de breach découvert → ajouter section / checklist dédiée dans §9.

---

### 9.7 Contacts d'urgence breach

#### Astreinte technique

- **Benjamin Bel** : SMS Better Stack + email `benjamin@kovas.fr`
- **Téléphone perso Benjamin** : à compléter manuellement par Benjamin dans cette section (non versionné en clair pour éviter exposition publique)

#### Autorités

- **CNIL violation form** : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles
- **CNIL standard** : 01 53 73 22 22 (semaine 9h-12h / 14h-17h)
- **ANSSI / CERT-FR** : https://www.cert.ssi.gouv.fr/
- **ANSSI tel** : 01 71 75 84 04 (urgence cyber)

#### Conseil & légal

- **Avocat IP/Tech (Vague 2 — déclenchée M9-M18 quand MRR 5k€)** : Lefèvre Avocats ou Lex2B — cf. CLAUDE.md §14
- **Avocat IP/Tech (M0-M9 si breach grave)** : escalade exceptionnelle, budget Vague 2 anticipé

#### Police cyber (si pénal)

- **17** : police nationale (numéro standard, peut router vers cyber)
- **Cybermalveillance.gouv.fr** : https://www.cybermalveillance.gouv.fr — plateforme officielle assistance + signalement
- **OCLCTIC** (Office central de lutte contre la criminalité liée aux technologies) : signalement via PHAROS https://www.internet-signalement.gouv.fr

#### Assurance cyber

- **Hiscox** (cf. CLAUDE.md §15) — souscription M5 avant lancement bêta
  - Plafond Cyber Phase 1 : 500k€
  - RGPD Phase 1 : 50k€
  - Défense juridique : 100k€
  - **Numéro de police à compléter par Benjamin une fois souscrit**

---

## Références croisées

- Audit sécurité complet 2026-05-27 : [`docs/security/SECURITY-AUDIT-2026-05-27.md`](security/SECURITY-AUDIT-2026-05-27.md)
- Wrapper console scrub PII : [`apps/web/src/lib/security/safe-logger.ts`](../apps/web/src/lib/security/safe-logger.ts)
- Helper Sentry beforeSend scrub : [`apps/web/src/lib/security/scrub-pii.ts`](../apps/web/src/lib/security/scrub-pii.ts)
- Banner consent cookies : [`apps/web/src/lib/cookies/`](../apps/web/src/lib/cookies/)
- Endpoint CSP report : [`apps/web/src/app/api/security/csp-report/route.ts`](../apps/web/src/app/api/security/csp-report/route.ts)
- CLAUDE.md §14 Légal & §15 Hiscox & §16 Support
- Stratégie défensive Liciel (cas IP) : `.claude/orchestration-kovas-app/kovas-defense-strategy.md`

---

**Mis à jour 2026-05-27 — ajout Partie B data breach RGPD (post SECURITY-AUDIT)**
