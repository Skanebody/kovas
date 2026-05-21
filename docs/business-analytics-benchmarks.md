# KOVAS — Business analytics & benchmarks anonymisés

**Auteur** : Benjamin Bel — KOVAS App
**Dernière maj** : 2026-05-25
**Modules concernés** : Module 9 (Analytics business) — migrations
`20260525190000_business_analytics_snapshots.sql` et
`20260525191000_anonymous_benchmarks.sql`.

---

## 1. Vue d'ensemble

Le système d'analytics KOVAS repose sur **deux couches** :

1. **Snapshots business par cabinet** (`business_analytics_snapshots`)
   — données privées multi-tenant, lues par les membres de l'organisation
   uniquement, alimentent la page `/performance` (CLAUDE.md §3).
2. **Benchmarks anonymisés inter-cabinets** (`anonymous_benchmarks`)
   — agrégats statistiques par région / segment, accessibles à
   tout utilisateur authentifié. **Aucune donnée nominative** par construction.

Les deux tables sont calculées **mensuellement** par 2 Edge Functions
cron :

| Function | Cron | Job |
|---|---|---|
| `business-analytics-snapshot` | `0 3 1 * *` (1er du mois 03:00 UTC) | Pour chaque org active, calcule + UPSERT snapshot du mois précédent |
| `benchmark-compute` | `0 4 1 * *` (1er du mois 04:00 UTC) | Agrège tous les snapshots du mois précédent en P25/P50/P75 par (region, cabinet_size) avec k-anonymity ≥ 5 + anti-déduction |

---

## 2. Schema `business_analytics_snapshots`

Voir migration `20260525190000_business_analytics_snapshots.sql` pour
le DDL exact. Champs clés :

| Champ | Type | Description |
|---|---|---|
| `organization_id` | uuid | FK organisations (multi-tenant) |
| `snapshot_period` | date | `YYYY-MM-01` du mois calculé |
| `period_type` | text | `'month'` (autres : day/week/quarter/year — future-proof) |
| `missions_total` | int | Toutes missions créées sur le mois |
| `missions_completed` | int | Missions en status `completed` ou `done` |
| `missions_exported` | int | Missions avec `exported_at IS NOT NULL` |
| `missions_cancelled` | int | Missions en status `cancelled` |
| `diagnostic_mix` | jsonb | `{ "dpe": 12, "amiante": 8, "carrez": 5, ... }` |
| `revenue_ht_cents` / `revenue_ttc_cents` | bigint | Centimes (convention KOVAS — jamais de float pour la monnaie) |
| `avg_mission_value_cents` | bigint | `revenue_ht_cents / missions_completed` |
| `ai_cost_cents` | bigint | Somme `missions.ai_cost_eur` × 100 (TODO V2 enrichir) |
| `variable_cost_cents` | bigint | V1 = `ai_cost_cents` seulement (TODO ajouter stockage, Whisper minutes) |
| `gross_margin_cents` | bigint | `revenue_ht_cents - variable_cost_cents` |
| `gross_margin_ratio` | numeric(5,4) | 0-1 |
| `unique_clients` | int | Clients distincts via dossiers du mois |
| `recurring_clients` | int | Clients avec > 1 mission sur le mois |
| `metadata` | jsonb | `{ conversion_rate, repeat_client_rate, diversity_index, health_score, growth_ratio, ... }` |

RLS : SELECT membres org · INSERT/UPDATE admin uniquement (cf. migration).

---

## 3. Formules des métriques

### 3.1 `conversion_rate`

```
sent_quotes  = quotes WHERE status IN ('sent','accepted','refused','expired')
accepted     = quotes WHERE status = 'accepted'
conversion   = accepted / sent_quotes     (NULL si sent_quotes = 0)
```

Cible cabinet typique : 0.45-0.55.

### 3.2 `repeat_client_rate`

```
unique_clients   = COUNT(DISTINCT dossiers.client_id WHERE created_at IN month)
recurring        = clients avec COUNT(dossiers) > 1 dans le mois
repeat_rate      = recurring / unique_clients     (NULL si 0)
```

Cible : 0.15-0.25 (récurrence mensuelle ; sur 12 mois, taux > 0.5
attendu).

### 3.3 `diversity_index` (Shannon normalisé)

```
H        = -∑ (p_i × ln(p_i))    avec p_i = count_i / total
H_max    = ln(N)                  où N = nombre de types présents
diversity = H / H_max              ∈ [0, 1]
```

1 = parfaite répartition entre N types, 0 = un seul type.

### 3.4 `health_score` (composite 0-100)

```
revenue_score   = min(revenue_ht_cents / 5_000_00, 1) × 30
conversion_score= min(conversion_rate / 0.5, 1)        × 20  (0 si NULL)
diversity_score = min(diversity_index / 0.7, 1)        × 20  (0 si NULL)
growth_score    = max(0, min(growth_ratio + 1, 2) / 2) × 30  (0 si NULL)

health          = somme arrondie 2 décimales
```

Pondération : revenue 30% · conversion 20% · diversity 20% · growth 30%.

### 3.5 `growth_ratio`

```
prev_revenue = business_analytics_snapshots.revenue_ht_cents
              WHERE snapshot_period = previous_month
growth_ratio = (current_revenue - prev_revenue) / prev_revenue
            (NULL si pas de snapshot précédent)
```

---

## 4. Schema `anonymous_benchmarks`

Tous les champs sont **agrégats** — aucune `organization_id`, aucun
identifiant nominatif. Lecture publique pour les utilisateurs
authentifiés. Insertions/updates en `service_role` uniquement (aucune
policy `INSERT` pour `authenticated` — cf. migration).

Combinaisons stockées :

| `scope` | `scope_code` | `cabinet_segment` | Exemple |
|---|---|---|---|
| `national` | NULL | `all` | National toutes tailles |
| `national` | NULL | `solo`/`small`/`medium`/`large` | National par segment |
| `region` | code INSEE 2016 (ex. `'11'` = IDF) | `all` | Régional toutes tailles |
| `region` | code INSEE 2016 | `solo`/... | Régional × segment |

Pour chaque combinaison, on stocke :
- `cabinets_count` (≥ 5) + `missions_count`
- `median/p25/p75_missions_per_cabinet`
- `median/p25/p75_mission_value_cents`
- `median_conversion_rate`, `median_repeat_client_rate`, `median_health_score`
- `diagnostic_mix_pct` (somme = 100)
- `metadata.median_revenue_monthly_cents`

UNIQUE : `(snapshot_period, period_type, scope, scope_code, cabinet_segment, diagnostic_kind)`.

---

## 5. Méthodologie benchmark

### 5.1 k-anonymity

**Règle stricte : skip une combinaison si `cabinets_count < 5`.**

C'est le seuil de k-anonymity classique en open data, qui protège
contre la ré-identification d'un cabinet individuel par recoupement
d'attributs publics (région + segment + un mois).

`k_anonymity_threshold` stocké dans chaque ligne (5 en V1) pour
traçabilité — peut être relevé à 10 en Phase 2 si on observe des
attaques par recoupement.

### 5.2 Anti-déduction

**Règle : skip une combinaison si > 80% des snapshots du groupe ont
un `top_client_share_pct` moyen > 80%.**

Justification : si un groupe régional a 5 cabinets et que 4 d'entre
eux ont un seul gros prescripteur (notaire / agence dominant), le
benchmark révèle indirectement la performance de ce prescripteur
(qui est une donnée à protéger côté business).

L'heuristique V1 calcule la moyenne arithmétique de
`top_client_share_pct` (déjà stocké dans `business_analytics_snapshots`
par le worker) — si > 0.8, on skip.

**TODO V2** : remplacer par une vraie analyse k-anonymity avec
détection de quasi-identifiants (Mondrian / ARX).

### 5.3 Régions FR 2016

13 régions métropolitaines INSEE 2016 :

| Code | Nom |
|---|---|
| 11 | Île-de-France |
| 24 | Centre-Val de Loire |
| 27 | Bourgogne-Franche-Comté |
| 28 | Normandie |
| 32 | Hauts-de-France |
| 44 | Grand Est |
| 52 | Pays de la Loire |
| 53 | Bretagne |
| 75 | Nouvelle-Aquitaine |
| 76 | Occitanie |
| 84 | Auvergne-Rhône-Alpes |
| 93 | Provence-Alpes-Côte d'Azur |
| 94 | Corse |

Mapping département → région encodé dans
`apps/web/src/lib/analytics/benchmark.ts` (`DEPT_TO_REGION`)
+ `supabase/functions/benchmark-compute/index.ts`. Source :
[INSEE Régions et départements 2016](https://www.insee.fr/fr/information/2114819).

Limite V1 : on dérive la région depuis `organizations.postal_code`
(siège du cabinet). Une org parisienne couvrant toute l'IDF (et un
peu d'Eure-et-Loire) sera classée 100% IDF. C'est cohérent pour des
solopreneurs (l'org = le lieu d'exercice principal) mais imparfait
pour des cabinets multi-sites Phase 2. **TODO Phase 2** : utiliser
la médiane des `postal_code` des missions du mois.

### 5.4 Cabinet sizes

| Segment | Active members |
|---|---|
| `solo` | 1 |
| `small` | 2-3 |
| `medium` | 4-10 |
| `large` | 10+ |

Source : `memberships WHERE status = 'active'` groupé par
`organization_id`.

---

## 6. Audit / observabilité

Chaque exécution cron logue (via `console.log`, ingéré côté Supabase)
une ligne par org :

```
[snapshot] org=<uuid> ok=true missions=23 revenue_ht=187500cents health=72.4
```

**TODO** : intégrer `observability_audit_logs` (migration
`20260524130000_observability.sql`) dès que la table accepte
`operation='analytics_snapshot'` / `operation='benchmark_compute'`
comme valeurs canoniques.

---

## 7. Limites V1 documentées

- **Pas de break-down par diagnostic_kind** dans les benchmarks
  (champs présents mais non remplis par défaut — TODO Phase 2 :
  itérer sur les diagnostics standards (DPE / amiante / plomb / gaz /
  élec / termites / Carrez / ERP) et générer 1 ligne par
  (combinaison × diagnostic_kind)).
- **Segmentation par région postale → région imparfaite** (cf. §5.3).
- **Anti-déduction heuristique** sur `top_client_share_pct` moyen
  (pas une vraie analyse k-anonymity multi-attributs — cf. §5.2).
- **`ai_cost_cents` non remplie** en V1 (champ présent, alimenté en
  V2 par agrégation `ai_usage_log`).
- **Pas de saisonnalité hebdo/journalière** en V1 (champs
  `by_day_of_week` / `by_hour_of_day` présents mais non remplis).

---

## 8. Phase 2 — Roadmap

1. Détail diagnostic_kind dans benchmarks (×8 lignes par combinaison)
2. Saisonnalité hebdo/journalière (PostHog cron)
3. Cohorte par stade (essai / payant / payant>6 mois)
4. Détection anomalies (revenue drop > 30% MoM → alerte admin)
5. Exposition publique benchmarks sur kovas.fr (page `/benchmarks-diagnostiqueurs-france`)
   — SEO + démonstration "transparence de marché"
6. Anonymisation différentielle (ARX library port Deno ou worker Node)
