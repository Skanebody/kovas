# KOVAS — Stratégie défensive face à Liciel/Enersweet

**Date** : 2026-05-13
**Auteur** : Benjamin Bel
**Statut** : Authority document, à consulter par TOUS les agents d'exécution travaillant sur le module Liciel
**Référencé par** : `research/liciel-format.md`, `DISCOVERY.md` §Paquet 10

> Ce document définit la **stratégie défensive technique et opérationnelle** de KOVAS face au risque d'agression juridique ou technique de Liciel/Enersweet. **Pas une défense juridique préventive — une architecture défensive intégrée au produit et aux opérations.**

---

## 1. Présomption de base

**Liciel attaquera tôt ou tard.** Pas une question de "si" mais de "quand" et "comment".

### Vecteurs probables (par ordre de probabilité)

| # | Vecteur | Probabilité | Délai estimé post-launch |
|---|---|---|---|
| 1 | **Mise en demeure médiatisée** (intimidation des clients KOVAS) | HIGH | M9-M15 (si KOVAS dépasse 100 abonnés) |
| 2 | **Changement de format défensif** à une release Liciel (casse l'import KOVAS du jour au lendemain) | MEDIUM | Toute release majeure |
| 3 | **Référé pour blocage commercial** avec demande de provision (même perdu, coûte du temps) | MEDIUM-LOW | M12-M24 |
| 4 | **Plainte concurrence déloyale** (pas contrefaçon — plus difficile à défendre que la PI pure) | MEDIUM-LOW | M12-M24 |
| 5 | **Pression sur diagnostiqueurs partenaires** (clauses d'exclusivité dans renouvellements licence Liciel) | MEDIUM | M6-M12 |

---

## 2. Ce qu'il faut faire MAINTENANT pour être prêt

### 2.1 Journal de découverte versionné, daté, signé GPG

Chaque geste technique du reverse-engineering est **horodaté et tracé** dans un repo Git privé avec commits signés GPG.

**Objectif** : pouvoir prouver, fichier par fichier, que KOVAS n'a jamais touché au code source/objet Liciel. Défense principale en cas de procès. Gratuit.

**Setup concret** :
- Repo Git **`kovas-discovery-log`** séparé du repo produit
- Commits signés GPG à chaque session de découverte (clé GPG dédiée Benjamin Bel)
- **Screencasts Loom/OBS** de chaque session importante (ouverture Liciel, observation comportement, **jamais de désassembleur visible**)
- Logs des outils utilisés (`mdb-schema`, `mdb-export` — strictement read-only)
- **Format de commit message** :
  ```
  type: observation/test/fixture
  date: 2026-05-13 14:30 CEST
  source: Liciel V4 démo licence Benjamin Bel
  L122-6-1: III (observation/étude du logiciel acquis légitimement)
  scope: <description geste, ex: "extraction schéma table tblDossiers via mdb-schema">
  outputs: <chemins fichiers générés>
  ```

### 2.2 Acquisition propre des fixtures

- **Licence Liciel achetée à ton nom**, payée par carte pro Nexus 1993, **facture archivée** dans le repo privé.
- Pas de licence d'un partenaire. Pas de version "empruntée". Pas de licence d'essai expirée utilisée au-delà.
- **NDA + contrat de prestation** avec les 3 diagnostiqueurs partenaires LinkedIn :
  - Ils fournissent des exports anonymisés de **leurs propres dossiers** (à eux, pas à leurs clients)
  - Paiement 100-200€/personne (facture KOVAS Nexus 1993)
  - Contrat écrit (template à préparer)
  - Pas de zone grise
- **Anonymisation systématique avant versionning** : nom, adresse, n° ADEME, SIREN, téléphone, email — tous remplacés par des valeurs synthétiques.
- **Script d'anonymisation** versionné dans le repo discovery-log.

### 2.3 Architecture "résilience par diversification" (POINT LE PLUS IMPORTANT)

**Ne jamais avoir un seul chemin d'import vers Liciel.**

| Voie | Statut | Robustesse à une contre-attaque Liciel |
|---|---|---|
| ZIP "Importer format ZIP" | À valider Sprint 1-2 | 🔴 Fragile (Liciel peut casser facilement) |
| **Imports spécifiques XML** | À valider Sprint 1-2 | 🟢 Solide (passerelle publique documentée) |
| **Imports spécifiques Excel** | À valider Sprint 1-2 | 🟢 Solide (passerelle publique documentée) |
| Pilotage UI Liciel (pywinauto) | Fallback ultime | 🟡 Très fragile mais imparable |
| Phase 2 : envoi ADEME direct | Roadmap M10-M18 | 🟢 Indépendance totale |

**Règle dure** : **tester les 3 premières en Sprint 1-2, supporter au moins 2 en production dès le lancement.**

Si Liciel casse l'import ZIP du jour au lendemain, KOVAS bascule **silencieusement** sur l'import XML/Excel sans interruption client.

### 2.4 Plan de continuité "Liciel casse tout"

**Runbook de bascule d'urgence documenté et testé** :

1. **Détection** : CI nightly détecte que la dernière release Liciel rejette les imports KOVAS
2. **Communication client** : message pré-rédigé "incident d'interopérabilité côté éditeur, basculement automatique sur voie alternative en cours" (envoyé via Resend en masse aux utilisateurs actifs)
3. **Bascule technique** : feature flag PostHog côté KOVAS qui force le canal alternatif (XML ou Excel selon disponibilité)
4. **Reverse de la nouvelle version** : protocole de découverte du nouveau format, ETA 48-72h
5. **Post-mortem public** : article blog KOVAS expliquant techniquement (sans agressivité) ce qui s'est passé.

**Narrative à construire** : "petit acteur indépendant face à un quasi-monopole consolidé par fonds d'investissement Pictet AM". C'est de la com de crise préparée.

### 2.5 Préparer la com de crise (assets pré-rédigés Phase 1)

Si Liciel envoie une mise en demeure ou attaque publiquement, la réponse doit être prête **avant que ça arrive**, pas improvisée.

**3 assets à rédiger pendant Phase 1 (Sprint 0-2)** :

1. **Page "Pourquoi KOVAS"** sur le site, qui mentionne l'arrêt SAS Institute / WPL **sans le citer juridiquement** (mais l'esprit) : interopérabilité, choix du diagnostiqueur, concurrence loyale. À publier dès le lancement.

2. **FAQ technique publique** : "Comment KOVAS fonctionne avec Liciel" — transparente, factuelle, qui explique que KOVAS utilise les passerelles d'import publiques. Cadre la perception avant que Liciel le fasse.

3. **Communiqué de presse de réponse**, déjà rédigé, à publier dans les heures suivant une attaque publique. Ton **calme, factuel, pas victimaire** :

   > *"Nous sommes surpris de la position de Liciel/Enersweet, alors que l'article L122-6-1 du Code de la propriété intellectuelle, qui est d'ordre public, garantit explicitement le droit d'observer et de tester un logiciel pour assurer l'interopérabilité. KOVAS n'a jamais accédé ni reproduit le code de Liciel. Nous utilisons les passerelles d'import publiques documentées par Liciel lui-même dans son wiki utilisateur."*

   Auto-publication possible — pas besoin d'avocat pour citer un texte de loi.

### 2.6 Diversifier les diagnostiqueurs partenaires

Les 3 partenaires LinkedIn pour les fixtures, c'est bien. Mais penser plus loin : **les premiers 20-50 clients KOVAS sont aussi tes témoins potentiels.** Si Liciel les harcèle :

- **Canal de signalement direct** : email dédié `juridique@kovas.fr`, archivage
- **Posture publique** : "KOVAS protège ses utilisateurs — toute pression d'un éditeur tiers nous est signalée et archivée"
- **Dossier "Pratiques anticoncurrentielles Liciel/Enersweet"** que tu pourrais saisir devant l'**Autorité de la concurrence** si ça devient grave.

**Point clé** : Liciel a maintenant ~50% de parts de marché et est en **position dominante consolidée**. C'est **leur point faible juridique majeur**, pas le tien. Tout abus de cette position dominante pour bloquer KOVAS est attaquable côté concurrence.

### 2.7 Assurance RC pro avec extension PI

**Pas un avocat préventif, mais une assurance qui paie l'avocat le jour où l'attaque arrive.**

**Configuration** :
- Souscription via **Hiscox** (cf. D702 dans DISCOVERY.md)
- Demander explicitement les couvertures :
  - **"Litige propriété intellectuelle"** (contrefaçon, parasitisme, concurrence déloyale)
  - **"Défense pénale et recours"**
- Budget supplémentaire : **200-400€/an** sur la RC pro déjà prévue (~900€/an base)
- Sans cette extension : le jour de la mise en demeure, tu paies l'avocat IT à 350€/h de ta poche.

---

## 3. Ce qu'il ne faut PAS faire (même tentant)

| Interdit | Pourquoi |
|---|---|
| **Désassembleur (Ghidra, IDA, dotPeek, dnSpy) sur Liciel.exe** | Sort du périmètre L122-6-1 III. Un log de download d'IDA Pro dans ton historique retrouvé en perquisition = bombe au procès. Même par curiosité, même en sandbox |
| **Employé / stagiaire ex-Liciel sur les rôles techniques** | Concurrence déloyale automatique (présomption d'utilisation d'informations confidentielles obtenues lors de l'emploi précédent). Aucune exception, pas même un stagiaire 3 mois |
| **Scraping de WikiLiciel privé via compte tiers** | Délit pénal séparé : accès non autorisé à un système informatique (art. 323-1 Code pénal). Plus grave que la question PI |
| **Mention publique de Liciel dans le marketing KOVAS** (12 premiers mois) | Voler sous le radar. Pas de "compatible Liciel", pas de "alternative à Liciel". Parler uniquement de "votre logiciel actuel" en générique |
| **Communication sur forums Diagnostic-immo.com / groupes FB métier** | Probablement surveillé par Liciel. Communication uniquement via canaux KOVAS contrôlés |
| **Acceptation des CGU Liciel sur un compte qui n'est PAS Benjamin Bel** | Toute observation/test doit être faite sous la licence achetée légitimement à Benjamin Bel. Pas de "le compte de mon ami" |

---

## 4. Priorité d'action révisée (intégrée à PHASES.md)

| Sprint / Phase | Actions défensives obligatoires |
|---|---|
| **Sprint 0 (avant tout code)** | • Souscription RC pro Hiscox avec **extension PI** confirmée<br>• Ouverture du repo `kovas-discovery-log` avec setup GPG (clé Benjamin Bel)<br>• Écriture du **runbook bascule d'urgence**<br>• Rédaction des **3 assets de com de crise** (page Pourquoi KOVAS, FAQ technique, communiqué de presse) |
| **Sprint 1** | • Démo Liciel installée légitimement<br>• Licence Liciel 1 mois achetée à Benjamin Bel<br>• Journal de découverte commence à se remplir (commits GPG signés)<br>• Tests parallèles des 3 voies d'import (ZIP / XML / Excel) |
| **Sprint 2** | • Décision technique sur la voie principale + au moins **une voie de fallback** prête en production<br>• NDA + contrats de prestation 3 diagnostiqueurs partenaires signés |
| **Sprint 6 (avant bêta)** | • Test du runbook bascule d'urgence sur scenario "Liciel rejette KOVAS" simulé<br>• 3 assets com de crise publiés (page Pourquoi + FAQ technique au minimum)<br>• Canal `juridique@kovas.fr` opérationnel |
| **Phase 2 (M10-M18)** | • Certification ADEME KOVAS lancée<br>• Indépendance totale de Liciel = goal Phase 2 |

---

## 5. Tableau récap des assets défensifs

| Asset | Type | Localisation | Owner | Échéance |
|---|---|---|---|---|
| Repo `kovas-discovery-log` (commits GPG) | Tech / Légal | Repo privé GitHub Nexus 1993 | Benjamin | Sprint 0 |
| Screencasts sessions découverte | Légal | OBS / Loom + repo discovery-log | Benjamin | À chaque session |
| Licence Liciel + factures | Légal | Repo discovery-log + Qonto | Benjamin | Sprint 1 |
| Contrats prestation diagnostiqueurs | Légal | Repo discovery-log | Benjamin | Sprint 2 |
| Script d'anonymisation fixtures | Tech | Repo `kovas-app` (privé) | Benjamin | Sprint 1 |
| Runbook bascule d'urgence | Ops | Repo `kovas-app` + Notion | Benjamin | Sprint 0 |
| Feature flag bascule import (PostHog) | Tech | Code produit | Benjamin | Sprint 6 |
| Page "Pourquoi KOVAS" | Marketing | Site kovas.fr | Benjamin | Sprint 6 |
| FAQ technique publique | Marketing | Site kovas.fr | Benjamin | Sprint 6 |
| Communiqué presse de réponse pré-rédigé | Com | Notion + Resend draft | Benjamin | Sprint 2 |
| Extension PI RC pro Hiscox | Légal | Police Hiscox | Benjamin | Sprint 0 (M5) |
| Canal `juridique@kovas.fr` | Ops | Google Workspace | Benjamin | M5 (avant bêta) |
| Dossier "Pratiques anticoncurrentielles" | Légal | Repo discovery-log | Benjamin | À déclencher si harcèlement |

---

## 6. Conclusion

Cette stratégie défensive **n'est pas une assurance qu'il ne se passera rien**. C'est une **architecture qui permet à KOVAS de survivre à une attaque sans interruption commerciale ni effondrement narratif**.

**Les 5 piliers** :
1. **Journal de découverte versionné GPG** → preuve juridique pour le procès
2. **Architecture multi-voies d'import** → résilience technique à une contre-attaque format
3. **Com de crise pré-rédigée** → maîtrise du narratif dès la 1ère heure d'attaque
4. **Assurance RC pro + extension PI** → financement de la défense quand elle arrive
5. **Position dominante Liciel/Enersweet** → munition juridique côté concurrence si nécessaire

**Ce n'est pas paranoïaque, c'est professionnel.** Toute entreprise qui s'attaque à un monopole installé prépare son arrivée. Cette préparation **coûte ~500€/an supplémentaires** (extension PI + screencasts + temps de rédaction), pour une économie potentielle de **plusieurs dizaines de milliers d'euros** d'avocat le jour de l'attaque.
