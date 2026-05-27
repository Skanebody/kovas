# Migration — Secrets par endpoint internal (anti-single-point-of-failure)

> Statut : Phase 1 implémentée (2026-05-27). Phase 2 + 3 = actions Benjamin restantes.
> Origine : Audit SECURITY-AUDIT-1 Agent D ligne 14 — fallback `CRON_SECRET` partagé sur 3+ endpoints internal.

---

## Pourquoi

Les endpoints internal (`/api/internal/*`) héritaient tous d'un fallback vers un unique `CRON_SECRET` global. **Si ce secret fuite, plusieurs endpoints sont compromis simultanément** :

- `/api/internal/rgpd-send` (envoi emails RGPD pré-purge, accès à toutes les fiches diagnostiqueurs)
- `/api/internal/ghost-notify` (envoi alertes lifecycle, accès `service_role` Supabase)

Le principe **anti-single-point-of-failure** impose qu'un secret partagé n'autorise jamais plus d'une seule capacité critique.

---

## Endpoints concernés

| Endpoint | Nouveau secret (Phase 2) | Fallbacks (Phase 1) |
|---|---|---|
| `/api/internal/rgpd-send` | `INTERNAL_RGPD_SEND_SECRET` | `INTERNAL_RGPD_SECRET` → `CRON_SECRET` |
| `/api/internal/ghost-notify` | `INTERNAL_GHOST_NOTIFY_SECRET` | `INTERNAL_CRON_SECRET` → `CRON_SECRET` |

Note : `/api/observatoire/revalidate` utilise déjà un secret dédié (`OBSERVATOIRE_REVALIDATE_TOKEN`) — non concerné par la migration.

---

## Plan de migration en 3 phases

### Phase 1 — Code accepte les 2 schémas (FAIT 2026-05-27)

Chaque endpoint résout son secret dans cet ordre :

1. `INTERNAL_<ENDPOINT>_SECRET` dédié (cible Phase 2)
2. Secret legacy historique (`INTERNAL_RGPD_SECRET` / `INTERNAL_CRON_SECRET`)
3. `CRON_SECRET` global (déprécié)

Aux étapes 2 et 3, un `console.warn('[security] ...')` est émis pour signaler la migration à faire. La backward compat est garantie tant que `CRON_SECRET` reste configuré côté Vercel.

### Phase 2 — Action Benjamin : générer + configurer secrets dédiés en prod

```bash
# Générer 2 secrets dédiés via openssl
openssl rand -hex 32  # → valeur pour INTERNAL_RGPD_SEND_SECRET
openssl rand -hex 32  # → valeur pour INTERNAL_GHOST_NOTIFY_SECRET
```

Puis sur **Vercel** (Project Settings → Environment Variables → Production + Preview) :

- Ajouter `INTERNAL_RGPD_SEND_SECRET=<valeur 1>`
- Ajouter `INTERNAL_GHOST_NOTIFY_SECRET=<valeur 2>`

Puis sur **Supabase Edge Functions** (Vault) :

- `diagnostician-rgpd-cron` : mettre à jour secret `INTERNAL_RGPD_SECRET` → renommer en `INTERNAL_RGPD_SEND_SECRET` avec la même nouvelle valeur que Vercel
- `ghost-lifecycle-cron` : mettre à jour secret `INTERNAL_CRON_SECRET` → renommer en `INTERNAL_GHOST_NOTIFY_SECRET` avec la même nouvelle valeur que Vercel

Redéployer.

### Phase 3 — Action Benjamin : retirer fallbacks legacy

Une fois Phase 2 stable en prod (24-48h sans warning Sentry sur fallback) :

- Retirer `INTERNAL_RGPD_SECRET` (legacy) de Vercel et Supabase Vault
- Retirer `INTERNAL_CRON_SECRET` (legacy) de Vercel et Supabase Vault
- Garder `CRON_SECRET` uniquement pour `/api/cron/*` (Vercel Crons)
- Nettoyer le code : supprimer les fallbacks dans `rgpd-send/route.ts` et `ghost-notify/route.ts` (laisser uniquement la lecture du secret dédié)

---

## Vérification post-migration

1. `console.warn('[security] ...')` ne doit plus apparaître dans les logs Sentry / Vercel.
2. Smoke test : déclencher manuellement `diagnostician-rgpd-cron` + `ghost-lifecycle-cron` → réponses 200.
3. Test de fuite simulée : revoke `INTERNAL_GHOST_NOTIFY_SECRET` seul → `/api/internal/rgpd-send` doit rester fonctionnel (isolation confirmée).
