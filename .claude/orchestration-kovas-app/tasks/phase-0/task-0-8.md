# Task 0.8 : 3 assets com de crise + runbook bascule Liciel (M2-M5)

## Objective

Préparer la communication de crise (3 assets pré-rédigés publiables en 1 clic) et le runbook de bascule d'urgence Liciel AVANT le lancement bêta, pour pouvoir réagir en heures (pas en jours) si Liciel/Enersweet attaque ou casse l'import.

## Context

Vague stratégique defense strategy (cf. `kovas-defense-strategy.md` §2.4, 2.5). Le pari : Liciel/Enersweet attaquera tôt ou tard (mise en demeure médiatisée OU changement de format défensif OU référé OU pression sur diagnostiqueurs partenaires). KOVAS doit pouvoir répondre en heures avec une narrative préparée et un fallback technique opérationnel.

## Dependencies

- Task 0.4 (documents légaux préparés, base argumentaire RGPD + sous-traitants)
- Task 0.1 (Google Workspace pour `juridique@kovas.fr`)

## Blocked By

- Tasks 0.4 + 0.1 (en parallèle complétables)

## Research Findings

- De `kovas-defense-strategy.md` §1 : 5 vecteurs probables attaques Liciel (mise en demeure médiatisée, changement format, référé blocage, plainte concurrence déloyale, pression diagnostiqueurs)
- De `kovas-defense-strategy.md` §2.5 : 3 assets pré-rédigés = page "Pourquoi KOVAS" + FAQ technique + communiqué presse réponse
- De `kovas-defense-strategy.md` §2.4 : runbook 5 étapes = détection + communication client + bascule technique + reverse new version + post-mortem public
- De `research/liciel-format.md` §3.5 : positioning juridique = L122-6-1 §III + SAS Institute, **JAMAIS** invoquer L122-6-1 §IV (décompilation) dans com publique
- De `research/liciel-format.md` §5.6 : narrative "petit acteur indépendant face à quasi-monopole consolidé Pictet AM" — punchy mais factuel

## Implementation Plan

### Step 1 : Asset 1 — Page "Pourquoi KOVAS" (M2-M3)

`docs/crisis-comms/page-pourquoi-kovas.md` (à publier sur kovas.fr/pourquoi au lancement public M9) :

Ton : factuel, pédagogue, premium, pas victimaire.

Structure :

1. **Hero** : "KOVAS, l'app iPad qui transforme 3h de DPE en 30 minutes"
2. **Le problème** :
   - 13 000 diagnostiqueurs immobiliers FR
   - Logiciels existants : Windows desktop 2007-2012, Word pour les rapports, aucune IA
   - Pain points : re-saisie, croquis frustrants, pas de vocal, etc.
3. **Notre approche** :
   - Mobile-first iPad + iPhone + Web PWA
   - IA-first (vocal Whisper, photos géolocalisées, exports universels)
   - **Compagnon** de votre logiciel actuel — pas remplaçant Phase 1
4. **Interopérabilité ouverte** :
   - "KOVAS exporte vos données dans 5 formats universels (PDF, Word, CSV, JSON, et au format de votre logiciel actuel)"
   - "Vous gardez votre liberté de choix"
   - Sans citer Liciel/Enersweet par leur nom — mais en référence "votre logiciel actuel"
5. **Concurrence loyale** :
   - "Nous croyons à un marché ouvert où chaque diagnostiqueur peut choisir l'outil qui lui convient"
   - "Le cadre juridique français (Code de la propriété intellectuelle) garantit explicitement le droit à l'interopérabilité — c'est ce qui permet l'innovation"
   - Citation indirecte de SAS Institute / WPL sans nommer (juste l'esprit)
6. **Notre équipe** :
   - Benjamin Bel, fondateur, Dieppe
   - Senior Advisor Diagnostic Immobilier (post-Task 0.6)
   - Bêta-testeurs : 40-50 pionniers (post-Task 6)

Longueur cible : 800-1200 mots. Ton premium. SEO-friendly (mots-clés : "alternative iPad Liciel", "logiciel DPE moderne", "saisie vocale diagnostic immobilier" — mais pas dans le H1, dans le corps).

### Step 2 : Asset 2 — FAQ technique "Comment KOVAS fonctionne avec votre logiciel actuel" (M3)

`docs/crisis-comms/faq-technique.md` (à publier sur kovas.fr/aide/integration au lancement public M9) :

Ton : transparent, technique, factuel.

Questions à couvrir :

1. **Comment KOVAS s'intègre avec mon logiciel principal ?**
   - "KOVAS génère des fichiers d'export dans 5 formats universels (PDF, Word, CSV, JSON) plus un format compatible avec votre logiciel actuel (ZIP standard)."
   - "L'import dans votre logiciel actuel se fait via la fonction d'import standard du logiciel (Fichier → Importer)."

2. **KOVAS modifie-t-il mon logiciel actuel ?**
   - "Non. KOVAS est une application iPad/iPhone/Web indépendante. Elle ne modifie, ne touche, ni n'accède à votre logiciel existant. Vous installez KOVAS séparément, sur votre iPad ou votre navigateur."

3. **Quel cadre juridique encadre l'interopérabilité KOVAS ?**
   - "Le Code de la propriété intellectuelle français autorise l'interopérabilité entre logiciels (Article L122-6-1)."
   - "Cette autorisation est d'ordre public — aucun éditeur ne peut s'y opposer contractuellement."
   - "KOVAS respecte strictement ce cadre : observation et test du fonctionnement uniquement, jamais d'accès au code source d'aucun autre logiciel."

4. **Que se passe-t-il si mon logiciel actuel change de format ?**
   - "KOVAS supporte plusieurs voies d'export indépendantes (5 formats au total). Si un format change, vous pouvez continuer à utiliser KOVAS via les 4 autres formats."
   - "Notre engagement : assurer la continuité de service à nos utilisateurs."

5. **Phase 2 (M10-M18) : KOVAS sera-t-il certifié ADEME ?**
   - "Oui. KOVAS Complet (Phase 2) intègrera le calcul DPE certifié ADEME 3CL-2021. Procédure de validation en cours auprès de l'ADEME et de la DHUP. Aboutissement attendu fin 2027."
   - "À partir de Phase 2, KOVAS peut remplacer entièrement votre logiciel actuel (mais le choix reste le vôtre)."

Longueur cible : ~1500 mots, format Q&A.

### Step 3 : Asset 3 — Communiqué de presse réponse (template pré-rédigé)

`docs/crisis-comms/communique-presse-reponse.md` (à activer en cas d'attaque publique Liciel/Enersweet) :

Ton : **calme, factuel, pas victimaire**. Citer le texte de loi sans drama.

Template :

```markdown
# KOVAS répond aux récentes communications de [Éditeur concurrent]

Dieppe, le [date]

KOVAS prend connaissance avec surprise des récentes communications de
[Liciel/Enersweet/concurrent], qui suggèrent que notre application porterait
atteinte à leurs droits.

KOVAS rappelle que :

1. **Le cadre juridique français garantit l'interopérabilité entre logiciels.**
   L'article L122-6-1 du Code de la propriété intellectuelle, qui est d'ordre
   public, autorise explicitement l'observation, l'étude et le test du
   fonctionnement d'un logiciel aux fins d'interopérabilité.

2. **KOVAS n'a jamais accédé ni reproduit le code de [Éditeur concurrent].**
   Notre développement repose exclusivement sur l'observation du comportement
   des logiciels acquis légitimement, dans le respect strict du cadre légal.

3. **Le format de fichier de données n'est pas protégé par le droit d'auteur.**
   La Cour de Justice de l'Union Européenne l'a confirmé sans ambiguïté dans
   sa décision SAS Institute Inc. c. World Programming Ltd (2 mai 2012,
   C-406/10).

4. **KOVAS soutient le libre choix des diagnostiqueurs immobiliers.**
   Notre conviction est qu'un marché ouvert et concurrentiel bénéficie aux
   utilisateurs finaux, qui doivent pouvoir choisir librement leurs outils
   métier.

Nous continuons à servir nos utilisateurs avec sérieux et professionnalisme.

Pour toute question : contact@kovas.fr

Benjamin Bel
Fondateur, KOVAS
SASU Nexus 1993
```

Variations à préparer (plus court / plus long / spécifique selon scénario) :

- **V1 — Court** (200 mots) : pour réaction LinkedIn rapide
- **V2 — Standard** (400 mots) : pour communiqué presse classique (ci-dessus)
- **V3 — Détaillé** (800 mots) : pour interview/podcast/article approfondi

### Step 4 : Runbook bascule d'urgence Liciel (M3-M4)

`docs/runbooks/liciel-bascule-urgence.md` :

Structure 5 étapes (cf. defense-strategy §2.4) :

#### Étape 1 — Détection (automatique CI nightly)

- CI GitHub Actions nightly : Windows VM Liciel V4 + KOVAS ZIP import → assert success
- Si échec → notification Slack + email `juridique@kovas.fr` + bandeau in-app
- Détection en 24-48h max

#### Étape 2 — Communication client (< 2h après détection)

Templates emails pré-rédigés (Resend) :

```markdown
Sujet : Incident temporaire d'interopérabilité — KOVAS reste pleinement fonctionnel

Bonjour [prénom],

Nous vous informons d'un incident temporaire d'interopérabilité concernant le
format ZIP de votre logiciel actuel. Suite à une modification côté éditeur, le
format d'import a évolué.

KOVAS reste **pleinement fonctionnel**. Nos exports PDF, Word, CSV et JSON
continuent de fonctionner normalement. Vous pouvez continuer à travailler sans
interruption.

Nous travaillons à restaurer le format ZIP compatible dans les 48-72 heures.

Pour toute question : support@kovas.fr

Cordialement,
Benjamin Bel
```

#### Étape 3 — Bascule technique (< 4h)

- Feature flag PostHog `liciel_zip_export_enabled = false`
- Bandeau in-app : "Export ZIP temporairement désactivé — exports PDF, Word, CSV, JSON disponibles"
- Métriques temps réel suivies : taux export PDF/Word/CSV utilisé en remplacement

#### Étape 4 — Reverse new version (ETA 48-72h)

- Repo `kovas-discovery-log` : nouvelle session observation
- Download dernière version Liciel V4 (démo ou licence active Benjamin)
- Comparaison schémas .mdb + structures XML avant/après
- Mise à jour `packages/liciel-bridge/schema/liciel-schema.json`
- Re-déploiement microservice Java/Jackcess
- A/B test 5% trafic avant rollout 100%

#### Étape 5 — Post-mortem public (J+7 max)

`apps/web/src/content/blog/post-mortem-liciel-{date}.mdx` :

- Article blog kovas.fr/blog factuel sur ce qui s'est passé
- Sans agressivité — narrative "petit acteur indépendant face à quasi-monopole consolidé Pictet AM" mais subtile
- Inviter la communauté à participer au débat sur l'interopérabilité
- Ne PAS poursuivre légalement (sauf cas extrême avec avocat Vague 2)

### Step 5 : Canal `juridique@kovas.fr` opérationnel

- Email pro `juridique@kovas.fr` créé Task 0.1 (Google Workspace)
- Configuration : autoresponder + forwarding vers Benjamin Bel personnel
- Documentation procédure réception mise en demeure : archive PDF + horodatage + escalation avocat Vague 2 si nécessaire

## Files to Create

- `docs/crisis-comms/page-pourquoi-kovas.md`
- `docs/crisis-comms/faq-technique.md`
- `docs/crisis-comms/communique-presse-reponse.md` (3 variations V1/V2/V3)
- `docs/runbooks/liciel-bascule-urgence.md`
- `docs/runbooks/email-templates/incident-interop-client.md`
- `apps/web/src/content/blog/post-mortem-liciel-template.mdx` (template pré-rédigé)

## Files to Modify

- `docs/credentials-setup.md` : ajouter section "Crisis comms assets" + emplacements

## Contracts

### Provides (for downstream tasks)

- **3 assets com de crise** : publiables en 1 clic sur kovas.fr au moment opportun
- **Runbook bascule** : procédure exécutable en heures (< 2h communication, < 4h bascule technique)
- **Feature flag PostHog `liciel_zip_export_enabled`** : à implémenter Sprint MVP J11 (Task 4.1)
- **Email templates Resend** : à intégrer Sprint MVP J14 (Task 5.3)

## Acceptance Criteria

- [ ] 3 assets pré-rédigés et stockés (publiables en 1 clic)
- [ ] Runbook bascule documenté avec feature flag PostHog opérationnel (implémenté Sprint MVP J11)
- [ ] Canal `juridique@kovas.fr` opérationnel (Google Workspace + autoresponder + forwarding)
- [ ] 3 variations communiqué presse (V1 court / V2 standard / V3 détaillé)
- [ ] Templates emails Resend prêts pour incident interop

## Testing Protocol

### Simulation à blanc (Sprint 6 post-MVP)

Exercice "fire drill" en simulation :

- Hypothèse : "Liciel a sorti version 4.280 qui rejette les ZIP KOVAS"
- Activation manuelle CI alert
- Test envoi email Resend à 5 testeurs internes
- Test feature flag PostHog bascule
- Test publication asset Pourquoi KOVAS sur staging.kovas.fr
- Mesure : Détection → Communication client réelle en < 2h ?

### Relecture critique

- Vérifier ton "calme, factuel, pas victimaire" sur 3 assets
- Vérifier absence mention Liciel/Enersweet par leur nom dans assets 1 et 2 (defense strategy)
- Vérifier citation L122-6-1 §III + CJUE SAS Institute dans asset 3 (template communiqué)
- Vérifier zéro citation L122-6-1 §IV (décompilation) — sort du périmètre KOVAS

## Skills to Read

- `kovas-defense-strategy` (lecture intégrale obligatoire)

## Research Files to Read

- `research/liciel-format.md` §3 (cadre juridique complet)
- `research/liciel-format.md` §5.6 (risque "Liciel casse délibérément l'import ZIP")
- `kovas-defense-strategy.md` complet

## Git

- Branch : `feature/0-8-crisis-comms-runbook`
- Commit message prefix : `Task 0.8:`

## Notes anti-pattern

- ⛔ Ne PAS citer Liciel/Enersweet par leur nom dans assets 1 et 2 (defense strategy : "votre logiciel actuel")
- ⛔ Ne PAS adopter un ton victimaire ou agressif dans les assets (= perte de crédibilité)
- ⛔ Ne PAS invoquer L122-6-1 §IV (décompilation) dans communications publiques (sort du périmètre KOVAS)
- ⛔ Ne PAS oublier la simulation à blanc Sprint 6 (sans drill, runbook = papier mort)
- ⛔ Ne PAS publier les assets sur kovas.fr AVANT lancement public M9 (laisser KOVAS voler sous le radar Liciel)
- ⛔ Ne PAS attendre une vraie attaque pour rédiger ces assets — préparation est défense
