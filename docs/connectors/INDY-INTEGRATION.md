# Intégration Indy

> Statut : **API privée — accès sur demande**. Page utilisateur active avec CTA "Demander l'accès".

## Contexte

[Indy](https://indy.fr) est un logiciel de comptabilité automatique destiné aux indépendants français (freelances, professions libérales, BNC). Modèle freemium. Très populaire chez les solopreneurs en début d'activité.

À la date de ce document (mai 2026), Indy n'expose **pas d'API REST publique générale**. Quelques partenariats existent (banques, outils de facturation préselectionnés), accessibles sur demande commerciale.

## Architecture KOVAS

1. **Stub gracieux côté lib** — `apps/web/src/lib/indy/{client,types,mapper}.ts`. Le client renvoie HTTP `501 Not Implemented` tant que `INDY_API_PUBLIC_AVAILABLE !== 'true'`.
2. **Endpoint `POST /api/invoices/:id/sync-indy`** — détecte le 501 et propose à l'utilisateur de demander l'accès.
3. **Endpoint `POST /api/connectors/api-access-request`** — enregistre la demande dans la table `connector_api_access_requests` (statut `pending`, une seule demande pending par org).
4. **Page `/dashboard/account/integrations/indy`** — affiche l'état et le formulaire de demande.

## Procédure côté utilisateur

1. Se rendre sur Compte → Intégrations → Indy.
2. Saisir un email de contact + un message libre (volume mensuel, contexte d'usage).
3. KOVAS enregistre la demande et notifie l'équipe Benjamin.
4. Benjamin contacte Indy via `partenariats@indy.fr` (ou canal commercial dédié) avec la liste des demandes en cours.
5. Si Indy accepte, l'API key est ajoutée à la table `accounting_connectors` (chiffrée) et le statut passe à `active`.

## Procédure côté Benjamin

Quand une demande arrive (notification email à venir, lot suivant) :

1. Ouvrir le portail admin (`/admin/connectors-requests`, à construire) → voir les demandes pending.
2. Transmettre par batch à `contact@indy.fr` ou directement au commercial de KOVAS chez Indy.
3. Si Indy ouvre l'accès :
   - Ajouter dans `.env` (et Vercel) :
     - `INDY_API_PUBLIC_AVAILABLE=true`
     - `INDY_API_BASE_URL=https://api.indy.fr/v1` (à confirmer)
   - Pour chaque demande granted, copier l'API key dans `accounting_connectors.api_key_encrypted` et passer `status='active'` + `resolved_at=now()`.
4. Notifier l'utilisateur (email Resend).

## Modèle de données

```sql
-- accounting_connectors (table commune 4 providers)
provider = 'indy'
status   = 'inactive' | 'pending' | 'active' | 'error'
api_key_encrypted -- chiffrée côté app

-- connector_api_access_requests
provider, organization_id, requested_by, contact_email, message,
status = 'pending' | 'granted' | 'rejected',
requested_at, resolved_at, resolved_notes
```

## Roadmap

- **Phase 1 (actuelle)** : stub + collecte demandes.
- **Phase 2 (post-ouverture API)** : implémentation REST complète, sync auto invoices + devis.
- **Phase 3** : sync inverse (Indy → KOVAS) si Indy expose des webhooks.

## Variables d'environnement

| Variable | Description |
|---|---|
| `INDY_API_BASE_URL` | URL de base API Indy (défaut `https://api.indy.fr/v1`) |
| `INDY_API_PUBLIC_AVAILABLE` | `true` quand l'API publique est ouverte |
