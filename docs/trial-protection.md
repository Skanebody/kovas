# Protections anti-abus essai gratuit 14 jours

> **Contexte économique** : coût marginal par essai abusif ~6,90€ max (30 missions × 0,23€).
> **Objectif** : free riders 8% → <1%. Économies projetées : ~480€/an à 1 000 essais/an.
> **Statut V1** : Protections 1-4 = CRITIQUE pré-launch. Protection 5 (détection patterns) = V1.5.
> **À jour** : 2026-05-18

---

## 1. Vue d'ensemble — 5 protections

| # | Protection | Statut V1 | Effort |
|---|---|---|---|
| 1 | Email professionnel obligatoire (blocklist disposables + free) | ✅ CRITIQUE | 0,5j |
| 2 | Vérification SIRET (format Luhn V1, INSEE Sirene V1.5) | ✅ CRITIQUE | 0,5j |
| 3 | 1 SIRET = 1 essai à vie (table `cabinet_trials`) | ✅ CRITIQUE | 0,5j |
| 4 | Watermark essai sur exports PDF/Word/ZIP | ✅ CRITIQUE | 0,5j (stub) + impl à J11-J12 |
| 5 | Détection patterns d'abus + dashboard admin | ⏳ V1.5 | 2j |

**Total V1** : ~2j dev (sprint J3.5 actuel).

---

## 2. Protection 1 — Email professionnel obligatoire

### Règles

**Bloqué à l'inscription** :
- Domaines free providers : `gmail.com`, `yahoo.fr`, `yahoo.com`, `hotmail.com`, `hotmail.fr`, `outlook.com`, `outlook.fr`, `live.fr`, `live.com`, `wanadoo.fr`, `orange.fr`, `free.fr`, `sfr.fr`, `laposte.net`, `bbox.fr`, `numericable.fr`, `aol.com`, `icloud.com`, `me.com`, `proton.me`, `protonmail.com`
- Domaines temporaires/jetables : `10minutemail`, `mailinator`, `guerrillamail`, `tempmail`, `throwaway`, `yopmail`, `getairmail`, `getnada`, `temp-mail`, `mintemail`, `mohmal`… (liste open source [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) — ~3 000 domaines)

**Autorisé** :
- Email avec domaine custom (`@cabinet-martin.fr`, `@diagnostic-paris.com`)
- Validation lien email obligatoire (double opt-in)

### Implémentation

[`apps/web/src/lib/email-validation.ts`](../apps/web/src/lib/email-validation.ts)

Maintenance : import du JSON de `disposable-email-domains` 1× par trimestre via script dans `tools/`.

### Message si refus

```
KOVAS est réservé aux professionnels du diagnostic immobilier.
Merci d'utiliser votre adresse email professionnelle (avec votre nom de domaine).
```

---

## 3. Protection 2 — Validation SIRET réelle au registre SIRENE

### V2 (actuel) — API Recherche d'Entreprises (api.gouv.fr)

Remplace la simple validation Luhn par un appel réel au registre SIRENE via
l'API ouverte [api.gouv.fr/les-api/api-recherche-dentreprises](https://recherche-entreprises.api.gouv.fr/docs/).

**Implémentation** : `apps/web/src/lib/data-gouv/recherche-entreprises/`
+ cache 7j Supabase (`sirene_check_cache`, migration `20260620300000`).

**Contrôles à l'inscription** :
1. Format : exactement 14 chiffres (filtre rapide sans appel réseau).
2. Établissement trouvé au registre (`results.length > 0`).
3. Établissement actif (`etat_administratif === 'A'`).
4. Code NAF dans le périmètre diagnostic immobilier :
   - `71.20B` — Analyses, essais et inspections techniques (coeur de cible).
   - `71.12B` — Ingénierie, études techniques (cabinets multi-activités).
   - `71.20A` (Contrôle technique automobile) **exclu** — pas le métier.

**Comportement** :
- Erreur réseau/rate-limit/timeout → blocage avec message "Vérification SIRET
  temporairement indisponible". Pas de cache négatif, l'utilisateur retente.
- Établissement introuvable ou inactif → erreur bloquante.
- NAF hors périmètre → **on laisse passer l'essai** mais on flagge
  `signup_anomaly='naf_mismatch'` sur `cabinet_trials`. Benjamin valide
  manuellement via `/admin/signup-anomalies` (Approuver / Rejeter).

**Bypass DEV** : `NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1` skip l'appel API
(utile tests E2E Playwright).

**Cache** : 7 jours TTL. Lecture publique RLS (open data INSEE), écriture
service_role uniquement. Économise la pression sur le service public partagé.

**Légacy** : la fonction `validateSiret` (Luhn) reste exportée pour les
modules historiques (ex. `/api/sirene/lookup`), mais n'est plus appelée
dans le flow signup.

Cache résultats INSEE 24h dans Supabase pour éviter rate-limit (30 req/min).

### Bypass DEV

`process.env.NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1` → skip Luhn validation pour les tests automatisés (`tools/test-*.mjs`).

---

## 4. Protection 3 — 1 SIRET = 1 essai à vie

### Table SQL

```sql
CREATE TABLE cabinet_trials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  siret varchar(14) NOT NULL UNIQUE,        -- index unique → 1 essai max
  email varchar(255) NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ended_at timestamptz,
  converted_to_paid boolean NOT NULL DEFAULT false,
  blocked_reason text,                       -- 'fraud_detection' | 'siret_naf_invalid' | 'patterns_abuse'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cabinet_trials_email ON cabinet_trials (email);
CREATE INDEX idx_cabinet_trials_user ON cabinet_trials (user_id);
```

### Flow signup

```
1. User entre email + SIRET + password + full_name
2. Validation email (Protection 1)
3. Validation SIRET Luhn (Protection 2)
4. SELECT id FROM cabinet_trials WHERE siret = $1
5. Si existe :
   - Si converted_to_paid = true → message "Vous êtes déjà client, connectez-vous"
   - Sinon → message "Votre cabinet a déjà bénéficié d'un essai"
6. Sinon :
   - admin.createUser() (email_confirm: true)
   - INSERT INTO cabinet_trials (siret, email, user_id) VALUES (...)
   - Redirect /app/dashboard
```

### Message si SIRET déjà utilisé

```
Votre cabinet a déjà bénéficié d'un essai KOVAS.
Pour continuer, choisissez un abonnement à partir de 29€/mois.
[ Voir les tarifs ]
```

---

## 5. Protection 4 — Watermark essai sur exports

### Visuels

**PDF généré** :
- Footer fixe sur chaque page : `Document généré en essai KOVAS — kovas.fr`
- Police 8pt, gris `#888888`
- Position : centré bas de page, marge 5mm

**Word (.docx)** :
- Header section : `Essai KOVAS — kovas.fr`
- Style "Header_Footer", taille 9pt, gris

**CSV** :
- Première ligne : `# Essai KOVAS — kovas.fr — Mission [REF] — Date export`

**ZIP Liciel** :
- Champ `LIV_administratif.xml > <notes_administratives>` :
  ```xml
  <notes_administratives>Mission générée via essai KOVAS — kovas.fr</notes_administratives>
  ```
- Visible si import dans Liciel + vérification onglet "Notes administratives"

### Effet attendu

Un free rider qui veut utiliser KOVAS gratuitement pour facturer ses clients **ne peut pas livrer** ces documents (le client ou l'agence voient le watermark "essai"). Forte incitation à convertir.

### Upgrade payant

Conversion essai → payant déclenche :
1. Mise à jour `cabinet_trials.converted_to_paid = true`
2. Suppression du watermark sur **nouvelles missions**
3. Régénération possible sans watermark des **missions de l'essai** (1 clic dans `/app/missions/[id]`)

### Implémentation

[`apps/web/src/lib/watermark.ts`](../apps/web/src/lib/watermark.ts) — utilitaires :
- `applyPdfWatermark(pdfBuffer: Buffer, message: string): Buffer`
- `applyDocxWatermark(docxBuffer: Buffer, message: string): Buffer`
- `applyCsvWatermarkLine(csv: string, message: string): string`
- `applyZipLicielWatermark(xmlContent: string, message: string): string`

V1 (sprint J3.5) : stub avec signatures + tests unitaires sur strings. Implémentation réelle à J11-J12 quand le module exports est construit.

---

## 6. Protection 5 — Détection patterns d'abus (V1.5)

### Table SQL

```sql
CREATE TABLE abuse_detection_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type text NOT NULL,        -- 'volume_anormal' | 'comportement_bot' | 'multi_comptes_ip' | 'temps_actions_irrealiste'
  severity int NOT NULL,            -- 1, 2, 3
  details jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  action_taken text                  -- 'logged' | 'suspended' | 'banned'
);

CREATE INDEX idx_abuse_org_severity ON abuse_detection_logs (organization_id, severity, detected_at DESC);
```

### Patterns surveillés

**A. Volume anormal**
- 10+ missions créées en 24h (max physique humain ~5-6)
- 30 missions atteintes en moins de 3 jours

**B. Comportement automatisé / bot**
- Création missions sans photos réelles (toutes vides ou identiques)
- Saisies vocales identiques entre missions (hash de contenu)
- Adresses GPS toutes identiques ou suspectes
- User-agent suspect (signatures de bots connus)

**C. Multi-comptes même IP**
- 3+ essais distincts depuis même IP en 7 jours
- Tolérance pour cabinets multi-postes (lien SIRET prioritaire)

**D. Temps d'actions non-humain**
- < 100ms entre actions (impossible humainement)
- Patterns de clics répétitifs identiques

### Actions automatiques

| Signaux | Action |
|---|---|
| 1 signal | Log silencieux + notification Resend → benjamin@kovas.fr |
| 2 signaux | Suspension temporaire essai + email user "Vérification manuelle" |
| 3 signaux | Bannissement définitif IP + SIRET (`cabinet_trials.blocked_reason = 'patterns_abuse'`) |

### Implémentation V1.5

- Edge Function Supabase `detect_abuse_patterns` (cron 1×/h)
- PostHog pour tracking events utilisateur
- Alertes Resend → benjamin@kovas.fr
- Dashboard admin `/admin/trials` (sprint 17 post-launch)

---

## 7. Dashboard anti-abus interne (V1.5)

Route protégée admin uniquement (`role='owner' AND profile.is_admin = true`).

### `/admin/trials`

- Liste essais actifs (J+1 à J+14)
- Filtre essais "suspects" (≥ 1 signal détecté)
- Métriques globales :
  - Taux conversion essai → payant (cible **22-28%**)
  - Taux free riders détectés (cible **< 1%**)
  - Coût total essais du mois (€ Whisper + Claude + storage)
  - ROI essais (LTV converti / coût total)
- Actions manuelles :
  - Suspendre essai (set `cabinet_trials.blocked_reason`)
  - Bannir SIRET définitivement
  - Activer compte manuellement (cas Benjamin valide à l'œil)

---

## 8. Impact économique projeté

| Scenario | Free riders | Coût annuel @ 1000 essais |
|---|---|---|
| Sans protections | 8% × 6,90€ | **552€/an** |
| Avec protections 1-4 (V1) | ~2% × 6,90€ | **138€/an** |
| Avec protection 5 ajoutée (V1.5) | < 1% × 6,90€ | **< 70€/an** |

**Économie cible V1** : ~414€/an
**Économie cible V1.5** : ~480€/an

### ROI essai global avec protections

- 1 000 essais × 2,30€ coût moyen = 2 300€ coût total
- 250 conversions (25%) × 1 920€ LTV = 480 000€ revenu cumulé
- **ROI : ×209**

---

## 9. Roadmap

| Sprint | Livrable |
|---|---|
| **J3.5 (actuel)** | Migration SQL + `email-validation.ts` + `siret-validation.ts` + table `cabinet_trials` + signup hardening + `watermark.ts` stub |
| **J11-J12** | Watermark réel sur exports PDF/Word/CSV/ZIP Liciel |
| **Post-launch S3** | Compte INSEE Sirene API + branchement validation NAF |
| **Post-launch S17** | Protection 5 (patterns + dashboard admin) |

---

## 10. Références

- Disposable email domains list : https://github.com/disposable-email-domains/disposable-email-domains
- INSEE Sirene API : https://api.insee.fr/entreprises/sirene/V3
- Algorithme Luhn : ISO/IEC 7812-1
