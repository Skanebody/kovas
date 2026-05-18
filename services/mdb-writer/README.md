# MDB Writer microservice (Java/Jackcess)

> Microservice Java sur Railway Linux pour écrire des fichiers `.mdb` Jet 4.0 compatibles Liciel.
> Stub — implémentation Sprint MVP J11-J12 (cf. Task 4.2).

## Pourquoi un microservice Java ?

Le format `.mdb` Microsoft Access Jet 4.0 utilisé par Liciel ne peut pas être écrit depuis Node.js/Linux nativement.

**Seules options write cross-platform** :

1. **Jackcess** (Java, Apache 2.0) — le seul writer mature multiplateforme
2. ADODB Windows-only via Wine (rejeté, fragile)
3. WinAppDriver piloter Liciel UI (rejeté, fragile)

Cf. `.claude/orchestration-kovas-app/research/liciel-format.md` §4.

## Architecture

```
Next.js Edge Function (Vercel/Supabase)
   ↓ POST /api/build-liciel-zip
   ↓ Bearer token
Microservice Java Spring Boot (Railway Linux)
   ↓ Jackcess writes .mdb Jet 4.0
   ↓ JSZip equivalent assembles ZIP
   ← Response: application/zip
```

## Endpoint

```http
POST /api/build-liciel-zip
Authorization: Bearer <KOVAS_MDB_WRITER_API_KEY>
Content-Type: application/json

{
  "missionId": "uuid",
  "dossierAdmin": { ... },
  "dossierTerrain": { ... },
  "photos": [{ "path": "...", "metadata": {} }]
}

Response: application/zip
```

## Stack

- Java 21 LTS
- Spring Boot 3.x
- Jackcess 4.0.10
- Gradle 8.x
- Docker image (deploy Railway)

## TODO Sprint MVP J11-J12

1. Init Spring Boot project
2. Endpoint `POST /api/build-liciel-zip`
3. Jackcess writer pour 14 tables principales Liciel
4. Tests sur 25-50 fixtures du corpus `kovas-discovery-log/fixtures-anonymized/`
5. Dockerfile + Railway deploy config
6. Health check `/health` endpoint
7. Bearer token auth middleware

## Cadre légal

- **L122-6-1 §III CPI** : observation/étude logiciel acquis légitimement → autorisé
- **CJEU SAS Institute c/ WPL (2012)** : format fichiers données non protégé
- **Repo `kovas-discovery-log` séparé** : journal GPG signé de toutes observations
- **JAMAIS** de désassembleur (Ghidra, IDA, dotPeek) sur Liciel.exe

Cf. `kovas-defense-strategy.md`.
