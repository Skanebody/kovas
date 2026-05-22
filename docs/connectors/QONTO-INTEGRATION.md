# Connecteur Qonto — Intégration KOVAS

> **Statut** : V1 — sync miroir comptable (factures + clients)
> **PDP DGFiP** : Qonto est Plateforme de Dématérialisation Partenaire officielle depuis 2024
> **Doc API** : https://api-doc.qonto.com/
> **Base URL** : `https://thirdparty.qonto.com/v2`

## 1. Procédure diagnostiqueur — récupérer ses identifiants Qonto

1. Se connecter à [app.qonto.com](https://app.qonto.com)
2. Aller dans **Paramètres → Intégrations → Clés API**
3. Cliquer sur **Générer une clé API**
4. Copier :
   - **Identifiant API (login)** : format `kovas-1993-xxxx`
   - **Clé secrète** : visible **une seule fois**, à conserver précieusement
5. Dans KOVAS, ouvrir **Compte → Intégrations → Qonto** et coller les deux valeurs
6. Cliquer sur **Tester et activer** : KOVAS vérifie la connexion en lisant votre organisation Qonto avant de stocker le token

> **Sécurité** : Le token est chiffré AES-256-GCM en base de données avec une clé serveur. Il n'est jamais réaffiché en clair dans l'UI, et la connexion peut être révoquée à tout moment via le bouton **Supprimer la connexion**.

## 2. Ce qui est synchronisé

### À l'émission d'une facture KOVAS

| Étape | Action côté Qonto |
| --- | --- |
| 1. Création client | Si le client KOVAS n'a pas encore de `qonto_customer_id`, KOVAS crée le client dans Qonto via `POST /clients`. L'ID Qonto est stocké pour les factures suivantes. |
| 2. Création facture | KOVAS appelle `POST /client_invoices` avec : référence, dates, lignes, TVA, échéance. Statut Qonto : `unpaid`. |
| 3. Tracking | KOVAS stocke `qonto_invoice_id` + `qonto_synced_at` sur la facture. |

### Resynchronisation manuelle

Depuis **Compte → Intégrations → Qonto**, le bouton **Resynchroniser tout** rejoue la sync sur **toutes les factures émises** sans `qonto_invoice_id` (par lots de 50, ordonnées par date d'émission).

### Devis

Qonto ne dispose pas d'objet « quote » dédié dans l'API v2 publique. KOVAS prépare uniquement le client côté Qonto. La facture est créée à la conversion devis → facture KOVAS.

## 3. Mapping champs KOVAS → Qonto

### Client

| KOVAS (`clients`) | Qonto (`POST /clients`) | Note |
| --- | --- | --- |
| `type='professionnel'` ou `company_name` non vide | `type: 'company'` | |
| Sinon | `type: 'individual'` | |
| `company_name` | `name` | Pour `company` |
| `display_name` (parsé) | `first_name` + `last_name` | Pour `individual` |
| `email` | `email` | |
| `siret` | `tax_identification_number` | Pour `company` uniquement |
| `address` + `city` + `postal_code` + `country` | `billing_address` | Tous requis ; si absent, omis |
| — | `currency: 'EUR'`, `locale: 'FR'` | Hard-codé V1 |

### Facture

| KOVAS (`invoices`) | Qonto (`POST /client_invoices`) | Conversion |
| --- | --- | --- |
| `reference` (ex. FAC-2026-00042) | `number` | Direct |
| `issued_at` | `issue_date` | Date ISO → `YYYY-MM-DD` UTC |
| `due_date` (ou +30j par défaut) | `due_date` | Date ISO → `YYYY-MM-DD` UTC |
| `tva_rate` (numeric 20.0 ou 0.20) | `vat_rate` (enum string `'20'`) | Auto-normalisation (cf. `mapper.ts → tvaRateToQonto`) |
| `line_items[].label` | `items[].title` | |
| `line_items[].description` | `items[].description` | |
| `line_items[].quantity` | `items[].quantity` | Number → string |
| `line_items[].unit_price_cents` (integer) | `items[].unit_price.value` (string EUR) | `centsToEurString(150_00)` = `"150.00"` |
| `line_items[].vat_rate` (optionnel) | `items[].vat_rate` | Override par ligne possible |
| — (KOVAS sync uniquement les factures émises) | `status: 'unpaid'` | Hard-codé V1 |
| — | `currency: 'EUR'`, `report_einvoicing_to_government: false` | Phase 1 |

### Conversions centrales (cf. `lib/qonto/mapper.ts`)

- **Centimes → EUR string** : `centsToEurString(15000)` → `"150.00"` (sans float)
- **EUR string → centimes** : `eurStringToCents("150.00")` → `15000`
- **TVA float ou pct → enum Qonto** : `tvaRateToQonto(0.20)` ou `tvaRateToQonto("20.00")` → `'20'`
- **Date ISO → YYYY-MM-DD UTC** : `toIsoDate('2026-05-22T10:00:00Z')` → `"2026-05-22"`

## 4. Cas limites et règles métier

### Factures non synchronisables

| Cas | Comportement |
| --- | --- |
| Facture en statut `draft` | Rejeté avec `422 invoice_draft` — émettez la facture avant. |
| Facture sans `client_id` (RGPD delete + snapshot uniquement) | Rejeté avec `422 invoice_no_client`. |
| Aucun `line_items[]` | Fallback : une ligne unique avec `title = "Prestation {reference}"` et `amount_ht` global. |
| `tva_rate` non standard (ex. 17%) | Approximation à la valeur Qonto la plus proche (`20`, `13`, `10`, `8.5`, `5.5`, `2.1`, `0`). Logged côté serveur. |
| Connecteur en statut `error` ou `inactive` | Rejeté avec `412 qonto_not_connected`. |

### Comportement réseau

- **Timeout** : 15 s par requête HTTP, configurable via `QontoClient` options.
- **Retry** : 3 tentatives avec backoff exponentiel (200 ms / 600 ms / 1.8 s + jitter) sur 5xx et timeouts uniquement.
- **4xx** : aucun retry, throw immédiat — le statut connecteur passe à `active` (erreur métier ponctuelle) mais `last_error` est renseigné.
- **5xx persistant** : statut connecteur passe à `error`, banner d'alerte UI.

### Multi-tenant et sécurité

- 1 connecteur actif maximum par couple `(organization_id, provider='qonto')` — contrainte SQL `UNIQUE`.
- Token chiffré AES-256-GCM via `ENCRYPTION_KEY` (32 bytes hex). Format stocké : `v1:iv:tag:data`.
- Lecture du token uniquement par service-role Supabase côté serveur Next.js (jamais exposé à PostgREST/RLS client).
- RLS active sur `accounting_connectors` : `is_member_of(organization_id)` pour lecture et écriture.

### Sandbox / Test

Qonto ne fournit pas d'environnement sandbox public. Pour développer localement :
- Créer un compte Qonto Pro gratuit (essai 30 jours) pour générer un token de test.
- Override `baseUrl` du `QontoClient` est possible via options pour pointer un mock local (cf. tests futurs).

## 5. Phase 2 — Transmission e-invoicing DGFiP

À partir de la Phase 2 KOVAS (post-cert ADEME M10-M18), le flag `report_einvoicing_to_government: true` sera proposé par facture pour transmission officielle via Qonto PDP. Cette option nécessite :
- SIRET et TVA renseignés dans les paramètres entreprise KOVAS
- Format Factur-X valide (déjà généré par KOVAS sur les invoices premium)
- Réconciliation Qonto ↔ DGFiP via webhook (à implémenter)

Voir `apps/web/src/lib/qonto/mapper.ts` → option `reportToGovernment`.

## 6. Schéma DB

```sql
-- Table connecteurs (multi-provider)
accounting_connectors (
  id              uuid PK,
  organization_id uuid FK → organizations,
  provider        text CHECK IN ('qonto','pennylane','indy','tiime'),
  token_encrypted text,   -- v1:iv:tag:data (AES-256-GCM)
  status          text,   -- active|inactive|error
  last_sync_at    timestamptz,
  last_error      text,
  UNIQUE (organization_id, provider)
)

-- Tracking IDs Qonto (colonnes ajoutées)
invoices.qonto_invoice_id   text  -- ID retour POST /client_invoices
invoices.qonto_synced_at    timestamptz
quotes.qonto_quote_id       text  -- "pending:{customer_id}" V1
quotes.qonto_synced_at      timestamptz
clients.qonto_customer_id   text
clients.qonto_synced_at     timestamptz
```

Migration : `supabase/migrations/20260522085315_qonto_connector.sql`.

## 7. Endpoints API KOVAS

| Endpoint | Méthode | Rôle |
| --- | --- | --- |
| `/api/account/integrations/qonto` | GET | Statut connecteur (sans token) |
| `/api/account/integrations/qonto` | POST | Activer (test + chiffrement + upsert) |
| `/api/account/integrations/qonto` | PATCH | Suspendre / réactiver |
| `/api/account/integrations/qonto` | DELETE | Supprimer (token effacé) |
| `/api/account/integrations/qonto/resync` | POST | Resync batch (≤ 50 factures) |
| `/api/invoices/[id]/sync-qonto` | POST | Sync 1 facture |
| `/api/quotes/[id]/sync-qonto` | POST | Sync 1 devis (prépare client uniquement) |
