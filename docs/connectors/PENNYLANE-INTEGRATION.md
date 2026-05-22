# Connecteur Pennylane (PDP DGFiP) — KOVAS

> Statut : implémenté V1.5 (mai 2026) — token API utilisateur, sync sortante factures + devis.

## 1. Contexte business

[Pennylane](https://www.pennylane.com) est une **Plateforme de Dématérialisation Partenaire (PDP)** enregistrée auprès de la DGFiP en 2024. C’est l’outil comptable le plus répandu chez les diagnostiqueurs indépendants français interrogés lors des 50 entretiens découverte (~38% des interviewés).

KOVAS ne remplace pas Pennylane (qui sert de tenue comptable + tableau de bord) — il **alimente** Pennylane en factures et devis émis depuis l’app, évitant la double-saisie.

## 2. Récupération du token utilisateur

| Étape | Détail |
|---|---|
| Forfait requis | **Pennylane Pro ~22€/mois** (l’accès API n’est pas inclus dans le forfait Solo) |
| Chemin | `app.pennylane.com → Paramètres → API → Générer un token` |
| Nom recommandé | `KOVAS sync` |
| Copie | **Le token n’est affiché qu’une seule fois.** Si perdu, en générer un nouveau (l’ancien reste valide jusqu’à révocation explicite). |

Le diagnostiqueur saisit ensuite ce token dans :
**`/app/account/integrations/pennylane`** → champ « Token API Pennylane » → bouton **Tester** (ping `GET /customers?per_page=1`) → cocher « Activer » → **Enregistrer**.

## 3. Architecture technique

### 3.1 Stockage du token

- Chiffrement **AES-256-GCM** via `apps/web/src/lib/security/encrypt.ts`
- Clé : variable d’environnement `ENCRYPTION_KEY` (32 octets base64, générée via `openssl rand -base64 32`)
- Format DB : base64( iv (12B) || authTag (16B) || ciphertext )
- Aucune trace du token en clair dans la DB, les logs Vercel, Sentry, ou PostHog

### 3.2 Table `accounting_connectors`

Schéma générique partagé avec d’autres connecteurs (Qonto, Iopole…) — voir `supabase/migrations/20260522100000_pennylane_connector.sql`.

| Colonne | Type | Usage |
|---|---|---|
| `organization_id` | `uuid` | FK organizations |
| `provider` | `text` | `'pennylane'` (unique avec org_id) |
| `status` | `text` | `inactive` / `active` / `error` |
| `encrypted_token` | `text` | AES-256-GCM base64 |
| `metadata` | `jsonb` | libre (workspace_id, etc.) |
| `last_sync_at`, `last_test_at`, `last_test_status`, `last_test_error` | timestamps + statuts | trace audit |

RLS : isolation stricte par organisation via `is_member_of()`.

### 3.3 Colonnes ajoutées

- `invoices.pennylane_invoice_id`, `pennylane_customer_id`, `pennylane_synced_at`, `pennylane_public_url`
- `quotes.pennylane_quote_id`, `pennylane_customer_id`, `pennylane_synced_at`
- `clients.pennylane_customer_id`, `pennylane_synced_at` (cache mapping)

## 4. Mapping KOVAS → Pennylane

### 4.1 Client → Customer

| KOVAS (`clients`) | Pennylane (`customer`) | Notes |
|---|---|---|
| `type` ∈ {agence, notaire, syndic, entreprise, collectivite} | `source_type: 'company'` | nom = `company_name` ou fallback `display_name` |
| `type = 'particulier'` | `source_type: 'individual'` | first_name + last_name renseignés |
| `siret` | `reg_no` | utilisé en clé de recherche prioritaire |
| `vat_number` | `vat_number` | TVA intracom |
| `email` | `emails: [email]` | clé de recherche fallback |
| `phone` | `phone` | |
| `address`, `postal_code`, `city` | idem | |
| `country` | `country_alpha2` | défaut `FR` |

**Résolution customer** (avant chaque sync) :

1. Cache local : `clients.pennylane_customer_id` non null → utilisé tel quel
2. Sinon, recherche par SIRET : `GET /customers?filter[reg_no]=XXX`
3. Sinon, recherche par email : `GET /customers?filter[email]=XXX`
4. Sinon, création : `POST /customers`

L’ID Pennylane retourné est persisté dans `clients.pennylane_customer_id` pour les sync suivantes.

### 4.2 Facture → Customer Invoice

| KOVAS (`invoices`) | Pennylane | Conversion |
|---|---|---|
| `reference` | `external_id` | idempotence : si `external_id` déjà présent côté Pennylane, doublon évité |
| `issued_at` (timestamptz) | `date` | converti en `YYYY-MM-DD` UTC |
| `due_date` | `deadline` | converti en `YYYY-MM-DD` |
| `line_items[].unit_price_cents` | `currency_amount` | centimes integer → string décimal EUR (`12345` → `"123.45"`) |
| `line_items[].tva_rate` ou `invoices.tva_rate` | `vat_rate` | code symbolique (cf. ci-dessous) |
| `currency` | `'EUR'` | figé Phase 1 |
| `language` | `'fr_FR'` | figé |
| `draft` | `false` | finalisation **immédiate** : Pennylane attribue le numéro officiel |

### 4.3 Codes TVA Pennylane

| KOVAS `tva_rate` | Pennylane `vat_rate` |
|---|---|
| 20 | `FR_200` |
| 10 | `FR_100` |
| 5.5 | `FR_55` |
| 2.1 | `FR_21` |
| 0 ou null | `FR_exempt` |
| autre (8.5, etc.) | `FR_{rate*10}` (best-effort) |

### 4.4 Devis → Estimate

Endpoint `POST /estimates`. Mapping similaire (date, expiration_date, quote_lines). **Tous les abonnements Pennylane n’incluent pas les devis** — si l’API retourne 404/405, l’endpoint KOVAS renvoie 501 avec un message clair et la sync devis est ignorée silencieusement.

## 5. Endpoints API KOVAS

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/invoices/[id]/sync-pennylane` | Synchronise une facture KOVAS → Pennylane (idempotent : retourne `already_synced` si `pennylane_invoice_id` déjà set) |
| `POST` | `/api/quotes/[id]/sync-pennylane` | Synchronise un devis KOVAS → Pennylane |
| `POST` | `/api/integrations/pennylane/test` | Body `{ apiToken }`. Teste la validité d’un token sans le persister |

Codes de statut :

| HTTP | Sens |
|---|---|
| `200` | OK + payload |
| `400` | Payload invalide |
| `404` | Ressource introuvable côté KOVAS |
| `412` | Connecteur Pennylane non configuré ou inactif |
| `422` | Payload rejeté côté Pennylane (ex. lignes vides, TVA invalide) |
| `429` | Rate limit Pennylane |
| `501` | Fonctionnalité non supportée par l’abonnement (devis sur forfait Solo) |
| `502` | Pennylane upstream KO (5xx ou token révoqué 401/403) |
| `504` | Timeout (>15s) |

## 6. Cas limites

| Cas | Comportement KOVAS |
|---|---|
| **TVA non applicable** (auto-entrepreneur non assujetti) | `tva_rate = 0` ou `null` → code `FR_exempt`. La mention légale (« TVA non applicable, art. 293 B du CGI ») doit être ajoutée par le diagnostiqueur dans le PDF KOVAS — non transmise en ligne Pennylane. |
| **Facture déjà syncée** | `already_synced: true` retourné sans nouvel appel API |
| **Client sans SIRET ni email** | Création anonyme (`name` seul) — Pennylane accepte mais la fiche client sera moins exploitable |
| **Token révoqué côté Pennylane** | 401/403 upstream → KOVAS retourne `502` + message « Connecteur invalide » ; l’utilisateur doit régénérer un token |
| **Rate limit (429)** | Remonté tel quel — pas de retry automatique côté KOVAS (à ajouter en V2 avec backoff exponentiel) |
| **Multi-journaux comptables** | Non géré V1 : on utilise le journal par défaut Pennylane. Phase 2 : ajouter `journal_id` dans `accounting_connectors.metadata` |
| **Multi-établissements** (SIRET secondaires) | Non géré V1 : utiliser le SIRET principal côté KOVAS |
| **Avoirs (credit notes)** | Non implémenté V1 — table `invoices.status = 'credit_note'` à mapper plus tard via `POST /credit_notes` |

## 7. Variables d’environnement

```bash
# 32 octets en base64 — généré une fois pour toute, JAMAIS commité
ENCRYPTION_KEY=<openssl rand -base64 32>
```

À ajouter dans Vercel (production + preview) et `.env.local` (dev).

## 8. Tests manuels

1. Créer un compte Pennylane Pro de test (essai gratuit 14j)
2. Générer un token API et le saisir dans `/app/account/integrations/pennylane`
3. Cliquer **Tester** → toast vert « Connexion réussie »
4. Créer une facture KOVAS sur un client (avec SIRET de préférence)
5. Cliquer **Synchroniser Pennylane** sur la facture → vérifier dans Pennylane que la fiche client est créée et la facture finalisée
6. Recliquer → vérifier `already_synced`
7. Révoquer le token côté Pennylane → cliquer Synchroniser → 502 « Connecteur invalide »

## 9. Roadmap

- [ ] V1.6 : Avoirs (`credit_notes`)
- [ ] V1.6 : Backoff exponentiel sur 429
- [ ] V2 : Webhooks entrants Pennylane (statut paiement → MAJ `invoices.paid_at`)
- [ ] V2 : Multi-journaux configurables par organisation
- [ ] V2 : Récupération PDF Factur-X généré par Pennylane → stockage Supabase
