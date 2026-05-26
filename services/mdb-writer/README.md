# KOVAS — mdb-writer microservice

> Microservice **Java 21 / Spring Boot 3 / Jackcess 4** déployé sur Railway.
> Convertit un JSON pivot Liciel V4 (validé Zod côté Next.js) en bytes `.mdb`
> Microsoft Access Jet 4.0 (format `V2003`), compatible avec l'import "format ZIP"
> Liciel.

Authority : CLAUDE.md §13 ("Stratégie Liciel — résilience multi-voies"). Schéma
pivot : [`apps/web/src/lib/liciel/zip-v4-schema.ts`](../../apps/web/src/lib/liciel/zip-v4-schema.ts).

---

## 1. Pourquoi Java + Jackcess ?

Le format `.mdb` Jet 4.0 n'a pas de writer JS / Python fiable cross-platform. Les
seules options écartées :

| Voie | Verdict |
|---|---|
| **Jackcess** (Java, Apache 2.0, lib industrielle) | ✅ **retenue** — supporte V2003 (Jet 4.0) en write, multiplateforme |
| `pyodbc` + driver ODBC Access | ❌ Windows-only, dépend driver Microsoft propriétaire |
| ADODB Wine | ❌ Fragile, instable Linux |
| WinAppDriver piloter Liciel UI | ❌ Encore plus fragile, casse à chaque update Liciel |
| Reverse Jet 4.0 en JS pur | ❌ 6+ mois de R&D, hors scope MVP |

Jackcess est utilisé en production par des outils enterprise (Pentaho, OpenOffice
Base import). Maintenu activement.

---

## 2. Stack

- **Java 21 LTS** (toolchain Gradle)
- **Spring Boot 3.4** (web + actuator + validation)
- **Jackcess 4.0.10** (`io.github.spannm:jackcess`)
- **Jackson** pour la désérialisation JSON pivot → POJO
- **Gradle 8.x** (Groovy DSL — scaffold existant, pas migré vers Maven pour
  préserver la compatibilité historique du repo)
- **JUnit 5** pour les tests

---

## 3. Architecture

```
Next.js (Vercel EU)
   └─ POST /api/liciel/build-zip (server-side route)
      └─ apps/web/src/lib/liciel/mdb-writer-client.ts
         └─ POST {MDB_WRITER_URL}/convert  + header X-API-Key
            └─ Microservice Java (Railway Hobby plan)
               ├─ ConvertController (Spring MVC)
               ├─ MdbConverter (Jackcess writer, in-memory)
               └─ application.yml (config)
            <─ application/x-msaccess  (bytes .mdb)
```

Service **stateless** : pas de DB, pas de cache, pas de session. Le fichier
temporaire `.mdb` est créé, lu en bytes, puis supprimé immédiatement (cf. `MdbConverter#toMdb`).

---

## 4. API contract

### `POST /convert`

| Champ | Valeur |
|---|---|
| **Path** | `POST /convert` |
| **Content-Type** | `application/json` |
| **Headers** | `X-API-Key: <KOVAS_MDB_WRITER_API_KEY>` (obligatoire, vérification constant-time) |
| **Body** | JSON pivot conforme à [`zip-v4-schema.ts`](../../apps/web/src/lib/liciel/zip-v4-schema.ts) — `LicielMissionV4` |
| **Response 200** | `Content-Type: application/x-msaccess` + body bytes `.mdb` Jet 4.0 |
| **Response 400** | Schema version ≠ "4.0", body manquant ou malformé |
| **Response 401** | `X-API-Key` absent ou invalide |
| **Response 500** | Erreur d'écriture Jackcess interne |

### `GET /health`

Health-check Spring Boot Actuator. Retourne `200 {"status":"UP"}` quand l'app
est prête. Utilisé par Railway pour le rolling deploy + par `pingMdbWriter` côté Next.js.

---

## 5. Setup local

```bash
# Pré-requis : Java 21 (OpenJDK Temurin recommandé) + Gradle 8.x optionnel
# (le wrapper sera ajouté la 1ère fois via `gradle wrapper`)

cd services/mdb-writer

# 1. Set API key locale (jamais commitée)
export KOVAS_MDB_WRITER_API_KEY="dev-only-key-$(openssl rand -hex 16)"

# 2. Init Gradle wrapper (1ère fois seulement)
gradle wrapper --gradle-version 8.10

# 3. Tests
./gradlew test

# 4. Run en mode dev
./gradlew bootRun
# → http://localhost:8080/health
# → POST http://localhost:8080/convert
```

### Smoke test manuel (curl)

```bash
curl -X POST http://localhost:8080/convert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $KOVAS_MDB_WRITER_API_KEY" \
  -d @../../apps/web/src/lib/liciel/__fixtures__/minimal-dpe.json \
  -o /tmp/kovas-test.mdb

# Vérifier le magic header Jet 4.0
xxd /tmp/kovas-test.mdb | head -2
# Doit afficher "Standard Jet DB" en offset 4-18
```

---

## 6. Déploiement Railway

### Variables d'environnement

| Var | Description |
|---|---|
| `KOVAS_MDB_WRITER_API_KEY` | Clé partagée avec Next.js (côté `MDB_WRITER_API_KEY`). Générer `openssl rand -hex 32` |
| `PORT` | Injecté automatiquement par Railway (Spring lit via `${PORT:8080}`) |
| `KOVAS_MDB_WRITER_MAX_BYTES` | (optionnel) Cap payload, défaut 25MB |

### Étapes

1. Créer un nouveau service Railway "Empty Service"
2. Connecter le repo GitHub `kovas-app` + définir le **Root Directory** sur
   `services/mdb-writer`
3. Build : automatique via `Dockerfile` (détecté grâce à `railway.json`)
4. Healthcheck : `/health` (30s timeout, déjà configuré dans `railway.json`)
5. Ajouter les env vars (au moins `KOVAS_MDB_WRITER_API_KEY`)
6. Côté Next.js (Vercel), ajouter :
   - `MDB_WRITER_URL=https://kovas-mdb-writer.up.railway.app`
   - `MDB_WRITER_API_KEY=<même valeur que côté Railway>`

### Coût

Railway **Hobby plan $5/mois** suffit largement :

- Mémoire heap : 512 MB max (cf. `JAVA_OPTS` Dockerfile)
- Trafic prévu Phase 1 : ~2k missions/mois × 1 conversion = ~2 000 POST/mois
- Conversion typique : 100-300ms CPU, 10-50 MB RAM transient

---

## 7. Tests

### Java (côté microservice)

```bash
./gradlew test
```

Couvre dans `MdbConverterTest` :
- Rejet pivot `null`
- Rejet `schema_version ≠ "4.0"`
- Conversion DPE minimal → bytes valides (Jet 4.0 magic header)
- Round-trip : write puis re-open via Jackcess → vérifie tables + rows
- Multi-diagnostics : DPE + AMIANTE + ERP simultanés

### TypeScript (client côté Next.js)

```bash
cd apps/web
pnpm vitest run src/lib/liciel/mdb-writer-client.test.ts
```

Couvre dans `mdb-writer-client.test.ts` (8 tests, mocked fetch) :
- Cas nominal 200 OK → ArrayBuffer
- Validation Zod fail-fast (pas de fetch émis si pivot invalide)
- Erreur HTTP 401 avec body preview
- Erreur HTTP 500
- Config manquante → `MdbWriterConfigError`
- Propagation AbortSignal
- Health-check OK
- Health-check network error

---

## 8. Sécurité

- **Auth header `X-API-Key`** comparé en `MessageDigest.isEqual()` (constant-time,
  pas de timing leak)
- **Fail-closed** : si `kovas.api-key` non configuré côté serveur, toutes les requêtes
  /convert retournent 401
- **Pas de log du body** (PII : adresse client, contacts) — uniquement `mission_id` + `bytes_written`
- **Container non-root** : Dockerfile crée un user `kovas` dédié
- **Pas de mention publique de Liciel** dans le code ni la doc (conformément CLAUDE.md §13)
- **Cadre légal** : Art. L122-6-1 III CPI + CJUE SAS Institute c/ WPL (2012).
  Cf. `kovas-defense-strategy.md` (repo séparé `kovas-discovery-log`).

---

## 9. Roadmap

| Sprint | Tâche |
|---|---|
| ✅ B94 (V0) | Scaffold complet + 7 tables (Dossier, Contacts, Pièces, Équipements, Photos, Diagnostics, VoiceNotes) + tests + client TS |
| Sprint MVP J11-J12 | Ajout des **14 tables Liciel complètes** (audit, équipements détaillés, anomalies, …) sur la base des fixtures anonymisées `kovas-discovery-log/fixtures-anonymized/` |
| Sprint MVP J12 | Endpoint additionnel `POST /build-zip` qui empaquette mdb + photos + attachments dans un seul ZIP retourné à Next.js (au lieu de 2 round-trips) |
| Post-launch | Pré-warm Railway container (1 ping/5min via cron Vercel) pour éviter cold start ~3s sur trial users |
| Phase 2 (M10+) | Mode dual write : .mdb + appel ADEME direct pour préparer indépendance Liciel |

---

## 10. Schéma de tables actuel (V0)

| Table | Colonnes |
|---|---|
| `Dossier` | mission_id, reference, exported_at, transaction_context, property_type, address_full, postcode, city, insee_code, year_built, surface_total_m2, cadastre_parcelle_id, diagnostician_name, diagnostician_company, diagnostician_siret, diagnostician_cofrac |
| `Contacts` | mission_id, role, civilite, first_name, last_name, email, phone |
| `Pieces` | mission_id, room_id, room_name, surface_brute_m2, surface_carrez_m2, surface_boutin_m2, hauteur_sous_plafond_m, is_annexe |
| `Equipements` | mission_id, type, brand, model, power_kw, energy_class, year_install, serial_number |
| `Photos` | mission_id, file_ref, room_id, caption, exif_lat, exif_lng, exif_taken_at, width_px, height_px |
| `Diagnostics` | mission_id, type, result_summary, energy_class, ges_class, consumption_kwhep_m2_year, emissions_kg_co2_m2_year, observations, reserves |
| `VoiceNotes` | mission_id, room_id, transcript, confidence, recorded_at |

> Les noms de tables exactes attendues par Liciel seront figés Sprint J11-J12
> après inspection des fixtures anonymisées. Le schéma actuel est **fonctionnellement
> représentatif** mais ne prétend pas être 100% bit-compatible Liciel.
