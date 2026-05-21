# KOVAS — Intégrations open data publiques FR

> Tableau de référence des 7 APIs publiques utilisées par la fonction
> `open-data-enrichment` et les helpers `apps/web/src/lib/opendata/*.ts`.
>
> **Authority** : CLAUDE.md §3 #3 (auto-complétion adresse + cadastre) +
> `supabase/migrations/20260525160000_open_data_enrichments.sql`.
>
> **Cache TTL** : 7 jours par couple (`organization_id`, `mission_id`).
> Pas de cache cross-org (RGPD).

---

## 1. BAN — Base Adresse Nationale

| Item | Valeur |
|---|---|
| URL base | `https://api-adresse.data.gouv.fr` |
| Endpoint principal | `GET /search/?q=...&limit=1&autocomplete=0` |
| Gratuit | Oui |
| Clé requise | Non |
| Rate limit | ~50 req/s/IP soft (~5 req/s prudent) |
| Hébergeur | Etalab + IGN + INSEE |
| Helper | `apps/web/src/lib/opendata/ban.ts` (`geocodeBanAddress`) |
| Env var | `BAN_API_BASE_URL` (override pour tests) |

**Schéma de réponse (extrait)** :
```json
{
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [2.3522, 48.8566] },
      "properties": {
        "label": "10 Rue de la Paix 75002 Paris",
        "score": 0.95,
        "housenumber": "10",
        "street": "Rue de la Paix",
        "postcode": "75002",
        "citycode": "75102",
        "city": "Paris",
        "type": "housenumber"
      }
    }
  ]
}
```

**Exemple curl** :
```bash
curl 'https://api-adresse.data.gouv.fr/search/?q=10+rue+de+la+paix+paris&limit=1'
```

**Points de cassure** :
- Nouveaux lotissements (< 6 mois) souvent absents.
- Adresses ambiguës → fallback `type='street'` ou `'locality'`.

---

## 2. Cadastre IGN (apicarto)

| Item | Valeur |
|---|---|
| URL base | `https://apicarto.ign.fr` |
| Endpoint principal | `GET /api/cadastre/parcelle?geom={POINT}&_limit=1` |
| Gratuit | Oui |
| Clé requise | Non (V1) |
| Rate limit | Non documenté — ~5 req/s prudent |
| Hébergeur | IGN |
| Helper | `apps/web/src/lib/opendata/cadastre.ts` (`fetchCadastreParcelByPoint`) |
| Env var | `CADASTRE_API_BASE_URL` |

**Schéma de réponse (extrait)** :
```json
{
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "idu": "750000000AB0123",
        "code_insee": "75002",
        "prefixe": "000",
        "section": "AB",
        "numero": "0123",
        "contenance": 240
      }
    }
  ]
}
```

**Exemple curl** :
```bash
curl 'https://apicarto.ign.fr/api/cadastre/parcelle?geom=%7B%22type%22%3A%22Point%22%2C%22coordinates%22%3A%5B2.3522%2C48.8566%5D%7D&_limit=1'
```

**Points de cassure** :
- DOM-TOM partiellement couvert.
- Lotissements neufs → 404.
- Migration annoncée vers Géoplateforme (2026, à surveiller).

---

## 3. BDNB — Base de Données Nationale des Bâtiments

| Item | Valeur |
|---|---|
| URL base | `https://api.bdnb.io` |
| Endpoint principal | `GET /v1/bdnb/batiment_groupe?on_point=<lng>,<lat>&limit=1` |
| Gratuit | Oui (lecture publique) |
| Clé requise | **Optionnelle** (`BDNB_API_KEY`) — recommandée en prod si rate limit |
| Rate limit | ~10 req/s sans clé (à confirmer prod) |
| Hébergeur | CSTB (Centre Scientifique et Technique du Bâtiment) |
| Helper | `apps/web/src/lib/opendata/bdnb.ts` (`fetchBdnbBuildingByPoint`) |
| Env var | `BDNB_API_BASE_URL`, `BDNB_API_KEY` |

**Champs récupérés** :
- `batiment_groupe_id` (identifiant CSTB persistant)
- `classe_bilan_dpe` (étiquette DPE théorique CSTB, indicative — peut différer du DPE réel)
- `annee_construction`
- `usage_principal` (résidentiel / tertiaire)
- `s_geom_groupe` (surface emprise au sol m²)

**Exemple curl** :
```bash
curl 'https://api.bdnb.io/v1/bdnb/batiment_groupe?on_point=2.3522,48.8566&limit=1'
```

**Points de cassure** :
- `batiment_groupe_id` peut changer entre millésimes (annuel) — ne pas
  l'utiliser comme clé de jointure persistante hors snapshot.
- API en évolution — schéma stabilisé mais champs additionnels possibles.

**TODO admin** : si l'API rate-limite trop fortement en prod, demander une
clé sur https://bdnb.io et configurer `BDNB_API_KEY` dans Vercel.

---

## 4. RNB — Référentiel National des Bâtiments

| Item | Valeur |
|---|---|
| URL base | `https://rnb-api.beta.gouv.fr` |
| Endpoint principal | `GET /api/alpha/buildings/?point=<lng>,<lat>&page_size=1` |
| Gratuit | Oui |
| Clé requise | Non |
| Rate limit | Non documenté (alpha) |
| Hébergeur | beta.gouv.fr (DGALN) |
| Helper | `apps/web/src/lib/opendata/rnb.ts` (`fetchRnbIdByPoint`) |
| Env var | `RNB_API_BASE_URL` |

**Champs récupérés** :
- `rnb_id` (identifiant unique 12 caractères)
- `status` (`constructed` / `constructionProposed` / `demolished`)
- `point` (centroïde WGS84)
- `ext_ids` (références externes BDNB, etc.)

**Exemple curl** :
```bash
curl 'https://rnb-api.beta.gouv.fr/api/alpha/buildings/?point=2.3522,48.8566&page_size=1'
```

**Points de cassure** :
- **API en version alpha** : breaking changes possibles d'ici fin 2026.
- Bâtiments en cours de référencement → status `constructionProposed`.
- Couverture nationale en montée de charge (priorité métropole d'abord).

---

## 5. Géorisques

| Item | Valeur |
|---|---|
| URL base | `https://www.georisques.gouv.fr/api/v1` |
| Endpoints utilisés | `/gaspar/risques`, `/radon`, `/zonage_sismique`, `/retrait-gonflement-argile` |
| Gratuit | Oui |
| Clé requise | Non |
| Rate limit | ~5 req/s (soft) |
| Hébergeur | MTECT (Ministère Transition Écologique) + BRGM |
| Helper | `apps/web/src/lib/opendata/georisques.ts` (`fetchGeorisquesByLocation`) |
| Env var | `GEORISQUES_API_BASE_URL` |

**Données récupérées (agrégat)** :
- Risques naturels (inondation, mouvement de terrain, sismique)
- Risques technologiques (industriel SEVESO, nucléaire)
- Plans de Prévention des Risques (PPR) applicables
- Arrêtés de catastrophe naturelle récents (10 derniers)
- Zone sismique (1 à 5)
- Potentiel radon (classe 1, 2, 3)
- Aléa retrait-gonflement argile (faible / moyen / fort)

**Utilité KOVAS** : alimentation automatique de l'État des Risques et
Pollutions (ERP, ex-ERNMT) — composante du diagnostic `erp` (article L125-5 CE).

**Exemple curl** :
```bash
curl 'https://www.georisques.gouv.fr/api/v1/gaspar/risques?code_insee=75102'
curl 'https://www.georisques.gouv.fr/api/v1/radon?code_insee=75102'
curl 'https://www.georisques.gouv.fr/api/v1/retrait-gonflement-argile?latlon=48.8566,2.3522'
```

**Points de cassure** :
- 404 pour communes < 50 habitants (non documenté).
- Format `retrait-gonflement-argile` varie selon couverture cartographique.
- Arrêtés préfectoraux : pas les textes intégraux, juste les références + URLs JOFR.

**Note RGPD/légale** : ne pas reproduire les textes intégraux d'arrêtés dans
l'app KOVAS (droit d'auteur Légifrance limité). On stocke uniquement les
références + URLs.

---

## 6. DVF — Demandes de Valeurs Foncières

| Item | Valeur |
|---|---|
| URL base | `https://api.cquest.org/dvf` (mirroir Etalab community-maintained) |
| Endpoint | `GET /?lat=...&lon=...&dist=<m>` |
| Gratuit | Oui |
| Clé requise | Non |
| Rate limit | Non documenté |
| Hébergeur | Etalab (data.gouv.fr) + mirroir cquest |
| Helper | `apps/web/src/lib/opendata/dvf.ts` (`fetchDvfNearby`) |
| Env var | `DVF_API_BASE_URL` |

**Champs récupérés** :
- Transactions immobilières dans un rayon (défaut 500 m, 5 dernières années)
- Pour chaque mutation : date, valeur foncière, surface bâti, type de local
- Calcul prix médian au m² (utile pour estimation interne diagnostiqueur)

**Utilité KOVAS** : estimation de valeur foncière indicative. **Usage interne
diagnostiqueur uniquement** — JAMAIS publié au client final ni dans le PDF.

**Exemple curl** :
```bash
curl 'https://api.cquest.org/dvf?lat=48.8566&lon=2.3522&dist=500'
```

**Points de cassure** :
- DVF mis à jour 2x/an (avril + octobre) → données récentes < 12 mois absentes.
- Format `resultats` vs `records` varie entre versions API mirroir.
- Si le mirroir cquest tombe, fallback possible vers
  `https://app.dvf.etalab.gouv.fr/api/...` (à valider en prod).

---

## 7. ADEME — Observatoire DPE (référence, non utilisé par open-data-enrichment)

| Item | Valeur |
|---|---|
| URL base | `https://observatoire-dpe-audit.ademe.fr/api` |
| Gratuit | Oui |
| Clé requise | Non (lecture publique) |
| Rate limit | ~100 req/min |
| Hébergeur | ADEME |
| Utilisation | Edge Functions `ademe-daily-sync` + `ademe-prevalidate` (modules existants) |

**Note** : ADEME ne fait pas partie de `open-data-enrichment` car déjà
intégré via les fonctions dédiées de cohérence DPE (cf. migrations
`20260525101000_ademe_dpe_cache.sql` et suivantes).

---

## Stratégie de cache (résumé)

| Niveau | TTL | Clé |
|---|---|---|
| `open_data_enrichments` (BDD) | 7 jours | `(organization_id, mission_id)` |
| Override manuel | `force: true` dans le body | bypass cache |

**Pourquoi pas un cache par adresse normalisée mutualisé entre orgs ?**
RGPD : un enrichissement contient des indices contextuels (parcelle, voisinage
DVF) liés au bien d'un client. Mutualiser entre orgs = data-leak potentiel.
Coût d'API publique négligeable (~0,001 € par mission re-fetched) — le gain
de mutualisation ne justifie pas le risque RGPD.

---

## Configuration externe requise (admin/devops)

| Élément | Action requise | Document de référence |
|---|---|---|
| Brevo MX records | Configurer `MX 10 in1-mxa.bind.brevo.com` + `MX 20 in2-mxb.bind.brevo.com` sur `kovas.fr` | console.brevo.com → Settings → Inbound Parsing |
| Brevo Webhook | Créer rule "Forward to webhook" pointant vers `/functions/v1/inbound-email-process` + header `X-Brevo-Webhook-Signature: ${BREVO_INBOUND_WEBHOOK_SECRET}` | console.brevo.com |
| DNS catch-all `devis-*@kovas.fr` | Configurer côté Cloudflare (registrar) ou Brevo selon l'option choisie | docs Brevo |
| BDNB clé API (optionnel) | Demander une clé sur https://bdnb.io si rate limit atteint en prod | bdnb.io |
