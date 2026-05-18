# Cartographie concurrence — Logiciels diagnostic immobilier FR

> **Marché total** : ~13 000 diagnostiqueurs indépendants FR.
> **Marché adressable KOVAS** : ~11 200 (**86%**) — exclut les diagnostiqueurs salariés des grands réseaux qui utilisent un logiciel propriétaire imposé.
> **À jour** : 2026-05-18

---

## 1. Vue d'ensemble — 3 catégories

| Catégorie | Marché | Adressable KOVAS | Pitch |
|---|---|---|---|
| **1. Logiciels desktop publics** (Liciel + cie) | 80-85% | ✅ 100% | "Vous re-saisissez tout au bureau. KOVAS élimine cette double saisie." |
| **2. Logiciels cloud/mobile modernes** (ORIS, Domofit…) | 12-15% | ✅ 100% | "Vous avez la mobilité, pas l'IA. KOVAS ajoute saisie vocale + structuration auto." |
| **3. Logiciels propriétaires réseaux** (Nautilus, W-Tab…) | 5-8% | ❌ 0% | Hors-cible (diagnostiqueurs salariés, pas de choix logiciel) |

**TAM KOVAS** : 11 200 diagnostiqueurs × ~75€/mo ARPU = **10 M€ ARR théorique max**.
**SAM réaliste M36** : 20% du marché adressable = **2 200 abonnés** (cf. [`economics.md`](../.claude/orchestration-kovas-app/economics.md)).

---

## 2. Catégorie 1 — Logiciels desktop publics (cible directe, 80-85%)

### Liste détaillée

| Logiciel | Éditeur | Part marché | Obsolescence | Force | Faiblesse |
|---|---|---|---|---|---|
| **Liciel** | Liciel Environnement (Enersweet/Pictet AM) | **40-52%** | Très obsolète | Couverture totale, communauté, écoles | Windows-only, croquis catastrophiques, UX 2010 |
| **Analys'Immo** | Atlibitum | 15% | Très obsolète | Spécialisé DPE | Stack vieillissante, peu d'évolution |
| **WinDiagnostic / WinAudit** | OBBC (racheté Enersweet 2025) | 10% | Très obsolète | Modules complets | Consolidation Liciel = redondance |
| **Imm'PACT** | ITGA | 8% | Très obsolète | Bon support | UX très datée |
| **Distotablet** | Fondis Electronic | 8% | Modérément obsolète | Intégration télémètres Bosch/Leica | Niche, prix élevé |
| **DS8** | Impartial Software | 3% | Très obsolète | Bas prix | Quasi-zombie |
| **Office Expert** | Office Expert | 3% | Très obsolète | Polyvalent | Communauté faible |
| **DTIMMO** | DTIMMO | 1% | Très obsolète | Spécialisé certaines régions | Marginal |
| **Imhotep** | LVDR | 0,5% | Très obsolète | Historique | En fin de vie |

**Total catégorie 1** : ~88,5% du marché — utilisateurs frustrés par UX desktop obsolète.

### Pitch commercial catégorie 1 (Liciel & co)

> *"Vous utilisez Liciel ? Vous re-saisissez tout au bureau après la visite. KOVAS élimine cette double saisie. Saisie vocale terrain + photos géolocalisées + export ZIP Liciel en 30 secondes. Vous gagnez 1h30 par mission. Compagnon, pas remplaçant : vous gardez Liciel pour le calcul certifié et l'archive."*

---

## 3. Catégorie 2 — Cloud/mobile modernes (semi-cible, 12-15%)

### Liste détaillée

| Logiciel | Éditeur | Part marché | Particularité | Manque |
|---|---|---|---|---|
| **ORIS** | ORIS | ~5% | Cloud-first, UX moderne | Pas d'IA, saisie manuelle |
| **GestionDiag** | GestionDiag | ~3% | Cloud tout-en-un (admin + technique) | Pas d'IA terrain |
| **Immo-Diag** | Immo-Diag | ~3% | Économique (29-49€/mo) | Couverture limitée |
| **Domofit** | Domofit | ~2% | iOS first, design soigné | Pas d'IA, pas de PWA |
| **Diag Pilote** | Diag Pilote | ~2% | Gestion admin avancée | Faible côté terrain |

**Total catégorie 2** : ~15% — utilisateurs déjà mobiles, mais sans IA terrain.

### Pitch commercial catégorie 2 (ORIS, Domofit, GestionDiag)

> *"Vous utilisez ORIS / Domofit / GestionDiag ? Vous avez déjà la mobilité, mais vous décrivez les pièces à la main. KOVAS ajoute la saisie vocale structurée par l'IA — vous parlez, on saisit. 30-45 min de gain supplémentaire par mission. Compatible avec vos exports actuels."*

### Fenêtre concurrentielle

Les acteurs cloud n'ont **pas encore intégré l'IA terrain** (saisie vocale structurée, vision équipements). KOVAS dispose d'une **fenêtre de 12-18 mois** avant qu'ils rattrapent. Construire le moat rapidement via :
- Phase 2 DPE certifié ADEME (M10-M18)
- Base utilisateurs fidèles (Founder tier à vie)
- Données accumulées (fine-tuning Llama 3.3 — cf. [`ai-autonomy-strategy.md`](./ai-autonomy-strategy.md))

---

## 4. Catégorie 3 — Propriétaires réseaux (NON-CIBLE, 5-8%)

### Liste

| Logiciel | Réseau | Adressable KOVAS |
|---|---|---|
| **Nautilus** | Socotec Diagnostic | ❌ Non |
| **W-Tab** | Diagamter | ❌ Non |
| **Certim** | Agenda Diagnostics | ❌ Non |
| **DiagTab** | BC2E | ❌ Non |
| **Atlante Xpert** | AC Environnement | ❌ Non |

Ces logiciels sont **imposés par les réseaux** à leurs diagnostiqueurs salariés. Pas de choix individuel possible. Hors périmètre KOVAS.

### Adressabilité future (Phase 4, M30+)

Si traction française forte (10%+ du marché indépendant à M30), envisager :
- Vente directe aux **réseaux** (offre B2B Enterprise)
- Partenariat **labels** (NF Diagnostic, Certima…) pour migration assistée

---

## 5. Les 7 raisons de la captivité Liciel (à exploiter, pas combattre)

> Document complet : [`.claude/orchestration-kovas-app/kovas-defense-strategy.md`](../.claude/orchestration-kovas-app/kovas-defense-strategy.md)

1. **Captivité historique des données** — 5-15 ans d'archives clients. Migration = risque inacceptable. **KOVAS ne demande pas de quitter Liciel en V1.**
2. **Sécurité réglementaire perçue** — Liciel a survécu à la réforme DPE 2021. Valeur refuge.
3. **Couverture fonctionnelle totale** — 8 000+ champs. KOVAS focus 8 diagnostics standards (92% volume).
4. **Créé par diagnostiqueur** — Stéphane Delot, ex-diagnostiqueur. Empathie métier. **Benjamin = futur diagnostiqueur certifié** (même ADN).
5. **Effet réseau et formation** — Écoles enseignent Liciel par défaut. KOVAS s'intègre dans l'écosystème.
6. **Acquisitions consolidatrices** — Liciel a racheté OBBC en 2025 → 60-65% marché. KOVAS = alternative non-frontale.
7. **Coût psychologique du risque** — Diagnostiqueurs = gestionnaires de risque. KOVAS = **zéro risque** (compagnon).

---

## 6. Stratégie parsers natifs progressive

| Phase | Logiciels couverts natif | % marché natif | % marché utilisable (incl. universel PDF/Word) |
|---|---|---|---|
| **V1 (M0-M3)** | Liciel | 50% | 80% (Liciel natif + 30% via PDF/Word/CSV universel) |
| **V2 (M3-M9)** | + Analys'Immo + WinDiagnostic OBBC | 75% | 90% |
| **V3 (M9-M15)** | + Imm'PACT + Distotablet | 91% | 96% |
| **V4 (M15+)** | + DS8 + Office Expert (selon demande) | 97% | 99% |

**Marketing honnête** : *"KOVAS est compatible avec 86% des logiciels du marché. Exports natifs pour Liciel et alternatives principales, exports universels (PDF/Word/CSV) pour les autres."*

---

## 7. Positionnement par phase

### Phase 1 (M0-M9) — Compagnon

> *"Gardez Liciel, ajoutez KOVAS pour le terrain. 1h30 gagnée par mission. Zéro risque."*

- Aucune demande de migration
- Le diagnostiqueur garde Liciel pour calcul certifié + archive + conformité
- KOVAS uniquement pour le terrain

### Phase 2 (M10-M18) — Alternative crédible

> *"Vous utilisez KOVAS depuis 18 mois ? Notre moteur DPE est certifié ADEME 3CL-2021. Migrez quand vous voulez."*

- Calcul DPE certifié intégré
- Migration assistée Liciel → KOVAS
- Économie utilisateur : 150€ Liciel + 80€ KOVAS = 230€/mo → KOVAS seul 99-149€/mo

### Phase 3 (M19+) — Standard nouvelle génération

> *"KOVAS, le standard moderne du diagnostic immobilier. 30% des diagnostiqueurs nous font confiance."*

- Effet réseau construit
- Écoles intègrent KOVAS au curriculum
- Marketplace sous-traitance entre diagnostiqueurs

---

## 8. Pièges marketing à éviter

| ⛔ Ne pas faire | Pourquoi |
|---|---|
| Attaquer Liciel frontalement | Backlash garanti — les utilisateurs ont **choisi** Liciel |
| Promettre de remplacer Liciel en V1 | Faux (pas de moteur DPE certifié) → reviews négatives |
| Sous-estimer la loyauté Liciel | Même avec KOVAS aimé, Liciel reste 18-36 mois |
| Mentionner Liciel dans marketing public M0-M12 | Stratégie défensive — éviter contre-attaque éditoriale Liciel |
| Discussions sur forums Diagnostic-immo.com | Idem — éviter visibilité prématurée |

---

## 9. Veille concurrence

### Sources à surveiller (mensuelle)

- **DiagActu** — newsletter sectorielle FR
- **QuotiDiag** — média pro diagnostic
- **WikiLiciel** — release notes Liciel (suivi quotidien parser KOVAS)
- **ADEME observatoire DPE** — évolutions réglementaires
- **LinkedIn** — page Liciel + concurrents
- **DiagActuTV** — chaîne YouTube métier

### Métriques à tracker

| Métrique | Source | Fréquence |
|---|---|---|
| Parts de marché logiciels | DiagActu enquêtes annuelles | Annuelle |
| Acquisitions / consolidation éditeurs | Veille presse FR | Mensuelle |
| Nouvelles features Liciel | Release notes | Quotidienne (automated) |
| Prix concurrents | Site éditeurs | Trimestrielle |
| NPS concurrents (Reddit, forums) | Veille manuelle | Trimestrielle |

---

## 10. Références

- DiagActu : https://www.diagactu.fr
- QuotiDiag : https://www.quotidiag.fr
- WikiLiciel : https://wiki.liciel.fr
- ADEME : https://observatoire-dpe.ademe.fr
- DiagActuTV : https://www.youtube.com/@DiagActuTV
