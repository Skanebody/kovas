# Intégration Tiime

> Statut : **API REST disponible avec bearer token + companyId**.

## Contexte

[Tiime](https://www.tiime.fr) est un logiciel de comptabilité automatique payant, orienté mobile-first. Connexion bancaire, OCR factures, génération automatique des écritures comptables. Cible : indépendants + TPE qui veulent une compta quasi-zéro effort.

API REST documentée sur `https://api.tiime.fr/v1`. Authentification via bearer token attaché à un workspace (company).

## Architecture KOVAS

1. **Lib `apps/web/src/lib/tiime/{client,types,mapper}.ts`** — client REST avec injection bearer + companyId.
2. **Endpoints sync** :
   - `POST /api/invoices/:id/sync-tiime`
   - `POST /api/quotes/:id/sync-tiime`
3. **Configuration** : `POST /api/connectors/tiime/configure` — sauvegarde token + companyId dans `accounting_connectors` (status `active`).
4. **Page `/dashboard/account/integrations/tiime`** — formulaire de saisie + statut.

## Procédure côté utilisateur

1. Se connecter à votre espace Tiime.
2. Ouvrir **Paramètres → API** (ou contactez votre conseiller Tiime — la fonctionnalité API n'est pas toujours visible en self-service).
3. Demander :
   - Un **token API** (bearer token long-lived).
   - L'**identifiant de votre société** (companyId) — souvent visible dans l'URL Tiime ou fourni par le support.
4. Coller ces deux valeurs dans Compte → Intégrations → Tiime → Configurer.
5. KOVAS effectue un ping de vérification puis active le connecteur.

## Endpoints utilisés

| Action | Méthode | Path Tiime |
|---|---|---|
| Ping (vérif identifiants) | GET | `/companies/{companyId}` |
| Créer un client | POST | `/companies/{companyId}/customers` |
| Créer une facture | POST | `/companies/{companyId}/invoices` |
| Créer un devis | POST | `/companies/{companyId}/quotes` |

> Le payload exact peut évoluer côté Tiime — consultez leur documentation officielle avant de modifier les mappers.

## Mapping KOVAS ↔ Tiime

| KOVAS | Tiime | Notes |
|---|---|---|
| `invoice.reference` | `number` | Référence affichée client |
| `invoice.amount_ht` (cents) | `total_amount_excluding_taxes_cents` | Conversion 1:1 |
| `invoice.amount_ttc` (cents) | `total_amount_including_taxes_cents` | Conversion 1:1 |
| `invoice.tva_rate` | line.`vat_rate` | En % (20, 10, 5.5, 0) |
| `client.display_name` | `name` | |
| `client.siret` | `siret` | |
| `client.address` etc. | `address.line1/city/zip_code/country_code` | |

## Sécurité

- Le bearer token est stocké chiffré dans `accounting_connectors.oauth_access_token_encrypted`.
- Aucune réaffichage en clair après enregistrement.
- L'utilisateur doit re-saisir le token à chaque mise à jour.
- RLS Supabase : seuls les membres de l'organisation peuvent lire/écrire la ligne du connecteur.

## Variables d'environnement

| Variable | Description |
|---|---|
| `TIIME_API_BASE_URL` | Override de l'URL API (défaut `https://api.tiime.fr/v1`) |

## Roadmap

- **Phase 1 (actuelle)** : sync sortante invoices + devis.
- **Phase 2** : webhooks Tiime → KOVAS (paiements détectés).
- **Phase 3** : OAuth flow plutôt que bearer manuel.
