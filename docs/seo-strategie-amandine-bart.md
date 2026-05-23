# Stratégie SEO Amandine Bart — KOVAS post-Core Update mai 2026

> Document de référence pour le SEO programmatique
> `/trouver-un-diagnostiqueur/[dept]/[city]` et les variantes futures.
> **Mise à jour** : 2026-05-23 (post-déploiement Core Update mai 2026)

---

## 1. Contexte — Google Core Update 21 mai 2026

Le Core Update du **21 mai 2026** a renforcé drastiquement plusieurs signaux :

| Signal | Impact | Détail |
|---|---|---|
| **E-E-A-T** | +++ | Expertise vérifiable, signature humaine obligatoire |
| **Helpful content** | +++ | Pages qui répondent vraiment aux questions |
| **Pogo-sticking** | ++ | Si user revient sur Google après ouverture = malus |
| **YMYL (immobilier)** | ++ | Exigence qualité doublée |
| **Sites pleins d'IA sans curation** | -- | Pénalité massive |
| **Auteurs identifiés + photo + qualif.** | +++ | Progression visible |
| **Agrégateurs sans valeur originale** | -- | Chute brutale |

### Conséquences immédiates pour KOVAS

1. **Plan initial 35 000 pages programmatiques abandonné** → cible révisée à **~5 000 pages premium** (volume × qualité).
2. **Tier 1 (1000 villes)** : traitement premium avec validation manuelle des stats locales + 3+ diagnostiqueurs réels.
3. **Tier 2 (4000 villes)** : traitement standard avec contrôle qualité automatique (quality_score > 70/100).
4. **Signature humaine Benjamin Bel** présente sur 100 % des pages programmatiques.

---

## 2. Architecture du contenu (page canonique)

Chaque page `/trouver-un-diagnostiqueur/[dept]/[city]` contient :

```
1. H1 : "Trouver un diagnostiqueur DPE à {city} ({postal})"
2. Hero + intro contextualisée
3. CTA double intent-match (devis + estimer DPE)
4. Section "Comment ça marche" en 3 étapes
5. [ÉLÉMENT UNIQUE 1] Statistiques exclusives KOVAS
   - Prix médian DPE local
   - Classe énergétique médiane locale
   - % passoires F+G locales
   - Délai médian rapport
6. Synthèse marché diagnostic (paragraphe narratif Amandine)
7. [ÉLÉMENT UNIQUE 3] 3+ diagnostiqueurs locaux réels
   - Si <3 locaux : élargissement dept + bandeau transparence
   - Fiches : nom, certifs, années expérience, note GMB
8. [ÉLÉMENT UNIQUE 2] Particularités locales 3-5 paragraphes
   - 8 dept à profil spécifique (75, 13, 69, 67, 59, 33, 06, 31)
   - + DROM (974) traité à part
   - Fallback générique par région sinon
9. FAQ 12 questions ville-spécifique
10. Mini-chart évolution prix DPE 2021-2026
11. Tableau Top 5 diagnostics demandés
12. Tableau prix moyens 8 diagnostics
13. Internal linking : 8 diagnostics × {city}
14. Internal linking : 8 villes voisines
15. [SIGNATURE HUMAINE] Bloc auteur Benjamin Bel
    - Photo + nom + qualifications
    - Lien LinkedIn (rel="me author")
    - Date dernière MAJ
16. CTA final dual (référencer + voir tous dept)
```

**Densité moyenne estimée** : ~2 500 mots / page (sections sémantiquement différenciées).

---

## 3. JSON-LD enrichi (E-E-A-T signals)

Schémas injectés sur chaque page :

| Schema | Rôle |
|---|---|
| `BreadcrumbList` | Hiérarchie Accueil → Trouver → Dept → Ville |
| `Article` | author = Benjamin Bel (sameAs LinkedIn + /a-propos) |
| `Place` | Commune + code postal + population |
| `Dataset` | Stats locales (prix médian, fgRate) → CC-BY |
| `ItemList` × `LocalBusiness` | 3+ diagnostiqueurs réels |
| `FAQPage` | 12 questions/réponses |

---

## 4. Stratégie 1000 villes premium + 4000 standard

### Tier 1 — Premium (1000 villes)

- 213 villes du `registry.ts` (V1, déjà premium avec lat/lng + neighbors)
- + 787 villes additionnelles dans `top-5000.ts` (extras curated)
- **Critères qualité minimum** :
  - 3+ diagnostiqueurs réels par ville
  - Stats locales validées contre DVF/ADEME
  - Signature humaine systématique
  - Contexte ville-spécifique premium (8 départements détaillés)

### Tier 2 — Standard (4000 villes)

- Extension future via dataset INSEE COG 2024 complet
- Génération on-demand ISR 24h
- **Critères qualité minimum** :
  - Signature humaine (toujours)
  - Data déterministe locale (toujours)
  - Diagnostiqueurs élargis au département si <3 locaux
  - Quality_score > 70/100 minimum requis pour rester indexée

### Limite actuelle 2026-05-23

Le dataset hardcodé compte **~640 villes uniques** (213 registry + 445 extras dédupliqués). L'extension à 5 000 villes nécessite l'intégration du dataset INSEE COG 2024 (61 MB JSON), prévue après validation positions Search Console sur les ~640 premières.

---

## 5. Monitoring positions Search Console + helpful content

### Table `seo_page_quality_signals`

Migration : `supabase/migrations/20260524230000_seo_page_quality_signals.sql`

Tracking par page :
- `bounce_rate` (PostHog ou GA4)
- `avg_time_on_page_sec`
- `pogo_stick_count` (sessions courtes < 10s)
- `total_visits` / `total_conversions`
- `has_real_diagnostician` (boolean)
- `has_local_data` (boolean)
- `has_human_signature` (boolean — par défaut true via template)
- `quality_score` (0-100, formule pondérée)

### Page admin `/admin/seo/quality-monitor`

Liste les pages à risque (bounce > 70 %, time < 30s, pogo > 5) avec action "Refresh content".

### Job nightly à câbler

Cron `ingest-posthog-seo-signals` (à créer Phase 2) :
- Pull événements PostHog 24h glissantes
- Calcule signaux par URL
- UPSERT dans `seo_page_quality_signals`
- Recalcule `quality_score` avec formule :
  ```
  score = 30 * (1 - bounce_rate)
        + 30 * min(avg_time_on_page_sec / 120, 1)
        + 20 * (total_conversions / max(total_visits, 1))
        + 20 * (has_real_diag + has_local_data + has_human_signature) / 3
  ```

---

## 6. Procédure d'urgence si chute positions Google

**NE PAS PANIQUER. Observer 2 semaines avant action.**

Cycle d'évaluation Google = ~14 jours. Une chute brutale post-Core Update peut être réversible si on attend la phase de stabilisation.

### Étape 1 — Diagnostic (jour 1-3)

1. Vérifier dans Search Console : quelles pages ont chuté ? (filtrer URL = `/trouver-un-diagnostiqueur/*`)
2. Vérifier les requêtes Trends 30 jours : la requête utilisateur a-t-elle changé d'intention ?
3. Examiner les signaux comportementaux dans `seo_page_quality_signals`

### Étape 2 — Observation (jour 4-14)

- Ne pas modifier le contenu (Google peut interpréter ça comme du gaming)
- Documenter dans `docs/seo-incidents.md` la chute observée
- Notifier l'équipe via #seo Slack

### Étape 3 — Action si chute confirmée (jour 15+)

Selon le diagnostic :
- **Bounce élevé** → enrichir contenu unique (ajouter section spécifique commune)
- **Pogo-sticking** → revoir H1 pour mieux matcher l'intention
- **Pas de fiche diag réelle** → urgent : intégrer 3+ diagnostiqueurs locaux
- **Signature manquante** → vérifier AuthorBio bien injecté

### Étape 4 — Recovery (jour 30+)

Si action engagée et pas de recovery J+30 :
- Désindexer temporairement (`noindex`) les pages à quality_score < 50
- Concentrer le budget crawl sur les 200-300 villes top traction
- Documenter dans rapport mensuel observatoire

---

## 7. Critères qualité minimum par page

| Critère | Seuil minimum |
|---|---|
| **Bounce rate** | < 60 % |
| **Avg time on page** | > 60 secondes |
| **Quality score** | > 70/100 |
| **Diagnostiqueurs réels** | ≥ 3 (locaux ou dept) |
| **Mots uniques par section** | > 100 |
| **Stats locales** | 4 KPI minimum (prix, classe, F+G, délai) |
| **FAQ ville-spécifique** | ≥ 12 questions |
| **Internal linking** | ≥ 16 liens (8 diag + 8 voisins) |
| **Signature humaine** | OBLIGATOIRE (AuthorBio composant) |
| **JSON-LD** | 6 schémas minimum (cf. § 3) |

---

## 8. Plan d'application Core Update mai 2026 — actions immédiates

| # | Action | Status |
|---|---|---|
| 1 | Refonte template page ville avec 3 éléments uniques | ✅ Fait (FIX-GG) |
| 2 | AuthorBio composant + photo Benjamin Bel | ✅ Fait (FIX-GG) |
| 3 | JSON-LD enrichi 6 schémas | ✅ Fait (FIX-GG) |
| 4 | top-5000.ts dataset (~640 villes) | ✅ Fait (FIX-GG) |
| 5 | Table seo_page_quality_signals | ✅ Fait (FIX-GG) |
| 6 | Page admin /admin/seo/quality-monitor | ✅ Fait (FIX-GG) |
| 7 | Sitemap-villes-5000.xml | ✅ Fait (FIX-GG) |
| 8 | generateStaticParams + ISR 24h | ✅ Fait (FIX-GG) |
| 9 | Dataset INSEE COG complet → 5000 villes | ⏳ Backlog (M3-M4) |
| 10 | Job nightly ingest-posthog-seo-signals | ⏳ Backlog (M3) |
| 11 | Photo Benjamin Bel `/press-kit/photo-benjamin-bel.jpg` | ⏳ Backlog (avant déploiement) |
| 12 | Page /a-propos auteur (sameAs LinkedIn) | ✅ Existante |

---

## 9. Métriques de succès M+3 post-Core Update

| KPI | Baseline | Cible M+1 | Cible M+3 |
|---|---|---|---|
| Pages indexées (Search Console) | ~150 | ~400 | ~600 |
| Pages avec position ≤ 20 | ~40 | ~100 | ~200 |
| Pages avec position ≤ 3 | ~5 | ~15 | ~50 |
| Bounce moyen pages programmatiques | inconnu | < 65 % | < 55 % |
| Conversion lead/visite | ~1,5 % | 2 % | 2,5 % |
| Quality score moyen | n/a | > 70 | > 80 |

---

## 10. Veille concurrentielle

Acteurs à surveiller dans Search Console / SimilarWeb :

| Concurrent | Approche SEO |
|---|---|
| **Pages Jaunes Pro** | Annuaire massif + UGC reviews |
| **Diag-Performance.fr** | Pages /ville + comparateur tarifs |
| **Allodiagnostic.com** | Pages /ville/diagnostic + leads paid |
| **Hello Diag** | Marketing growth + landing pages |
| **Quotatis** | Pages comparateur multi-corps métiers |

Notre différenciation : **signature humaine fondateur + data observée vérifiée + intégration diagnostiqueur SaaS** (KOVAS app B2B).

---

> Auteur : Benjamin Bel — Fondateur KOVAS, SASU NEXUS 1993
> Contact : contact@kovas.fr
> Dernière révision : 2026-05-23
