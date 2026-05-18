# Protocole de tests — 25 cas pré-launch + monitoring post-launch

> **Objectif** : valider que l'export ZIP KOVAS → import Liciel fonctionne sur les cas d'usage réels avec > 99% de réussite et < 1% d'écart de classification DPE.
> **À jour** : 2026-05-18

---

## 1. Phase 1 — Tests internes (Sprint J12)

### 25 cas de test obligatoires

| Type de mission | Nombre cas | Description |
|---|---|---|
| DPE vente maison ancienne (< 1948) | 3 | Bâti pierre/pisé, isolation faible, classes E/F/G |
| DPE vente maison 1948-1974 | 2 | Parpaing, isolation partielle |
| DPE vente maison 1975-2000 | 2 | Béton, double vitrage début |
| DPE vente appartement | 3 | Copropriété, chauffage collectif |
| DPE location maison/appartement | 3 | Variantes vente, mais étiquette diagnostic location |
| DPE neuf | 2 | Bâti RT2012/RE2020, classe A/B |
| Amiante seul | 2 | Maison < 1997, repérage par locaux |
| Plomb CREP seul | 2 | Bâti < 1949, parties commune + privatives |
| Multi-missions (DPE + Amiante + Plomb) | 3 | Mission combinée, cohérence cross-diag |
| Cas extrêmes (F/G avec recos détaillées) | 3 | 3 scénarios travaux chiffrés, MaPrimeRénov' |
| **Total** | **25** | |

### Pour chaque cas

1. **Saisir dans KOVAS** toutes les données (workflow user complet)
2. **Générer le ZIP** via le bouton "Partager vers Liciel"
3. **Importer dans Liciel** (installation sur Mac via Parallels ou PC dédié)
4. **Comparer** avec une saisie native équivalente Liciel (faite manuellement)
5. **Mesurer** :
   - Temps d'import (cible **< 1 min**)
   - Champs correctement importés (cible **> 99%**)
   - Classification DPE identique (cible **100%** ou écart ≤ 1 lettre documenté)
   - Photos correctement liées aux pièces (cible **100%**)

### Livrable

Tableau de bord interne `tools/test-liciel-export-report.html` :
- 25 lignes (1 par cas)
- Colonnes : statut import, écarts champs, classification DPE, photos OK
- Export PDF pour archive

---

## 2. Fixtures anonymisées

### Sources

Benjamin Bel constitue les 25 cas à partir de :
- **Sa propre licence Liciel achetée légitimement** (cadre légal cf. [`kovas-defense-strategy.md`](../.claude/orchestration-kovas-app/kovas-defense-strategy.md))
- **Missions test fictives** créées dans Liciel, données entièrement anonymisées
- **Données techniques publiques** (DPE de référence ADEME, exemples pédagogiques)

### Ce qui est interdit (rappel cadre légal)

| Interdit | Pourquoi |
|---|---|
| Désassembleur sur Liciel.exe (Ghidra, IDA, dotPeek, dnSpy) | Hors cadre Art. L122-6-1 III CPI |
| Scraping WikiLiciel privé avec compte tiers | Violation CGU |
| Employé/stagiaire ex-Liciel sur rôle tech | Risque secret d'affaires |
| Mention publique de Liciel dans marketing M0-M12 | Stratégie défensive |

### Versionnement

Toutes les fixtures + journal de découverte sont versionnés dans un repo GPG-encrypted séparé `kovas-discovery-log` (privé, hors monorepo public).

---

## 3. Phase 2 — Tests bêta (M6-M9, 40-50 utilisateurs)

### Charte bêta

Les Founders s'engagent à fournir un retour structuré :
- **Min 10 missions réelles** sur la période bêta
- **Remontée bugs et frictions** (1-2 retours/semaine via in-app feedback)
- **1 visio feedback mensuelle** (30 min avec Benjamin)
- **Accord écrit pour citation témoignage** si satisfait

### Métriques trackées

| Métrique | Cible | Mesure |
|---|---|---|
| Taux réussite import Liciel | **≥ 99%** | events `import_liciel_success` / `import_liciel_attempt` |
| Temps moyen import | **< 2 min** | events `import_liciel_started` / `import_liciel_completed` |
| Variation classification DPE vs Liciel natif | **< 1%** | survey post-mission |
| Réclamations utilisateurs liées import | **< 5%** | tickets support catégorisés |
| Conversion essai → payant | **22-28%** | events Stripe webhook |

### Outils

- **PostHog** : tracking events utilisateur ([`/lib/analytics`](../apps/web/src/lib/) — à créer J13)
- **Sentry** : error tracking + alerts si taux d'erreur import > 1%
- **Resend** : emails Founders + Benjamin
- **In-app feedback widget** : bouton flottant "Signaler" → ticket support

---

## 4. Phase 3 — Surveillance continue post-launch

### Dashboard monitoring `/admin/qa`

Métriques temps réel (refresh 1 min) :

```
═══════════════════════════════════
KOVAS QA Dashboard
Aujourd'hui · 2026-09-15
═══════════════════════════════════

EXPORTS LICIEL (24h)
- Total : 142
- Succès : 141 (99,3%) ✅
- Échecs : 1 (Stack trace logged)
- Temps moyen : 47 sec

CLASSIFICATION DPE
- Écart 0 lettre : 138 (97,2%)
- Écart 1 lettre : 4 (2,8%) — log
- Écart 2+ lettres : 0 ⚠️

SUPPORT IMPORT
- Tickets ouverts : 2
- Temps moyen résolution : 3h 12 min
- SLA respecté : 100%

PARSER LICIEL
- Version : v2026.05.18
- Dernière vérif release notes Liciel : il y a 2h
- Tests automatisés : 25/25 ✅
```

### Tests automatisés quotidiens

Cron GitHub Actions (1×/jour 6h CET) :
```yaml
name: Liciel parser nightly tests
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:liciel-parser  # rejoue les 25 cas
      - if: failure()
        uses: ./.github/actions/notify-resend
        with:
          to: benjamin@kovas.fr
          subject: '⚠️ Parser Liciel KOVAS — échec test nightly'
```

### Alertes Sentry

- Erreur import Liciel → Sentry capture + Slack/Resend alert si > 5/h
- Taux réussite < 99% sur 1h glissante → alerte critique
- Mise à jour parser < 24h après détection changement Liciel

---

## 5. Suite de tests Vitest

### Structure cible (à créer J12)

```
apps/web/src/lib/liciel/
├── __tests__/
│   ├── fixtures/                  # 25 cas JSON fictifs anonymisés
│   │   ├── dpe-vente-maison-1900.json
│   │   ├── dpe-vente-appartement-1980.json
│   │   └── ...
│   ├── build-zip.test.ts          # Tests unitaires builder
│   ├── xml-validation.test.ts     # Tests schema XML
│   └── integration.test.ts        # Tests E2E import simulé
├── build-zip.ts
├── xml-builder.ts
└── mdb-client.ts (appel Railway)
```

### Tests E2E simulés (sans Liciel binaire)

On ne peut pas automatiser l'import dans Liciel.exe en CI (Windows-only, GUI). Solution :
1. **Tests unitaires** : valider la structure du ZIP + XML conforme au schéma
2. **Tests d'intégration simulés** : parser le ZIP généré et reconstruire les données, comparer au payload initial
3. **Tests manuels mensuels** : Benjamin importe 5 cas dans Liciel réel et valide visuellement

### Coverage cible

- **Unit tests** : > 80% sur `apps/web/src/lib/liciel/`
- **Integration tests** : 25 cas fixtures couverts
- **Manuel** : 5 cas réels Liciel / mois

---

## 6. Cas particulier — Tests cross-OS

### Liciel = Windows only

Benjamin doit avoir un PC Windows ou Mac avec Parallels/UTM pour tester Liciel manuellement.

**Setup recommandé** :
- Mac M2/M3 + Parallels Desktop 19+ (~99€/an)
- VM Windows 11 + Liciel installé légalement (licence achetée)
- Snapshots VM pour reproduire bugs

### Photos / iPhone

Tests obligatoires sur Safari iOS :
- Caméra Web API
- Géolocalisation
- Upload Service Worker
- Compression WebP

Outils : **Playwright** pour tests automatisés desktop + **manual checks** iPhone via TestFlight Web App (PWA installable).

---

## 7. Métriques de réussite globales

| Métrique | M0 (launch) | M6 | M12 |
|---|---|---|---|
| Taux import Liciel réussi | ≥ 95% | ≥ 99% | ≥ 99,5% |
| Temps moyen import | ≤ 2 min | ≤ 1 min | ≤ 45 sec |
| Écart classification DPE | ≤ 5% | ≤ 2% | ≤ 1% |
| Tickets support import / mission | ≤ 10% | ≤ 5% | ≤ 2% |
| NPS utilisateurs Founders | 35+ | 50+ | 60+ |

---

## 8. Procédure de rollback parser

Si un changement Liciel casse le parser KOVAS en production :

1. **Détection** : alerte Sentry / monitoring < 99% sur 1h
2. **Investigation** (< 30 min) : reproduire en local sur fixture du jour
3. **Décision** :
   - Si fix < 2h → patch + déploiement Vercel
   - Si fix > 2h → **rollback parser à la version stable précédente** (feature flag `LICIEL_PARSER_VERSION`)
4. **Communication** : banner in-app + email Founders ("Maintenance parser en cours")
5. **Post-mortem** : doc interne + tests régression ajoutés

### Versionnement parser

Toutes les versions parser sont taggées Git :
```
parser/v2026.05.18
parser/v2026.05.20  (fix après MAJ Liciel)
parser/v2026.06.01  (release majeure)
```

Feature flag dans Supabase `feature_flags` :
```sql
INSERT INTO feature_flags (key, value) VALUES
  ('liciel_parser_version', 'v2026.05.18');
```

---

## 9. Références

- Cadre légal : [`.claude/orchestration-kovas-app/kovas-defense-strategy.md`](../.claude/orchestration-kovas-app/kovas-defense-strategy.md)
- Specs parser : [`liciel-parser-specs.md`](./liciel-parser-specs.md)
- Risques associés : [`risk-management.md`](./risk-management.md)
