# Recherche : Liciel — format export, faisabilité reverse-engineering, viabilité Phase 1 KOVAS App

**Date** : 13 mai 2026
**Wave** : First (révisée v2 par fondateur avec recherche web vérifiée)
**Périmètre** : Faisabilité technique, juridique et opérationnelle de la génération d'un export ZIP au format natif Liciel par KOVAS App, pour import dans Liciel V4 et calcul DPE certifié.

**Recommandation globale en tête (résumé exécutif)** : **Faisable, niveau de confiance MEDIUM-HIGH sur le plan juridique, MEDIUM sur le plan technique, avec une contrainte d'architecture forte** : un poste/VM Windows avec Liciel installé est très probablement nécessaire en production, pas seulement pour le développement. Le pivot Phase 1 est viable mais doit être repensé : ne pas chercher à *générer* un `.mdb` ex nihilo depuis Linux/Node, mais piloter Liciel installé sur une VM Windows ou — option supérieure — re-piloter le scénario inverse (export XML/CSV depuis KOVAS, import via les passerelles natives Liciel : Excel, XML, Imports spécifiques). Voir Section 7 pour la stratégie révisée.

> ⚠️ **Note importante au lecteur** : cette recherche est faite à partir de sources publiques. Les éléments les plus critiques — structure exacte du ZIP, schéma de tables de `LICIEL_Dossiers.mdb`, contenu des CGV Liciel — sont **derrière authentification client** (WikiLiciel privé, espace compte). Plusieurs findings sont marqués `[À VALIDER avec démo/licence]` et exigent une inspection byte-level d'exports réels avant de coder.

---

## 1. Architecture Liciel et contexte entreprise

### 1.1 Liciel Environnement — entité juridique et acquisition

- **Forme** : SAS au capital de 600 000 € ; SIREN 538 746 702 ; APE 6201Z ; siège 32 Bd de Strasbourg, CS 30108, 75468 Paris Cedex 10. Source : notice d'installation officielle (Liciel, 2026), https://www.liciel.fr/pdf/LICIEL_Diagnostics_Notice_installation.pdf
- **Création** : 2007 par Stéphane Delot. Source : https://www.enersweet.com/liciel-environnement/
- **Acquisition Enersweet** : annoncée publiquement le 14 septembre 2023 ; date effective juillet 2023. Conseil juridique de l'acquéreur : Levine Keszler. Financement : Pictet Asset Management (dette privée).
- **Stratégie acquéreur** : Enersweet (fondé 2022 par Mickaël Cabrol) consolide le secteur du diagnostic via une stratégie "buy and build". Acquisitions enchaînées :
  - juillet 2023 : Liciel Environnement
  - avril 2024 : Arobiz, Sogexpert, Quotidiag (10 000 utilisateurs cumulés avec Liciel)
  - décembre 2024 : Egreen
  - septembre 2025 : OBBC Développement (concurrent direct historique, éditeur de WinDiagnostics)
- **Conséquence stratégique pour KOVAS** : Enersweet/Liciel consolide le marché ; à terme une "plateforme intégrée" remplaçant les multiples logiciels concurrents est explicitement annoncée. Cela renforce le verrouillage Liciel sur le marché, et **augmente la pertinence d'une solution alternative neutre comme KOVAS**, mais aussi **le risque qu'une fusion future (OBBC+Liciel) change le format de fichier**.
- **Liciel revendique 7 000+ utilisateurs actifs et "plusieurs millions de rapports de diagnostic par an"**.

### 1.2 Stack technique Liciel Diagnostics V4

Sources directes WikiLiciel :
- **OS supporté** : Windows 10/11 uniquement (32/64 bits). Mac uniquement via émulateur.
- **Suite bureautique requise** : Microsoft Office Professional **2010 ou supérieur**.
- **Base de données** : **Microsoft Access (.mdb)** — confirmé : "Le logiciel Liciel Diagnostics V4 interroge une base de données Microsoft Access (.mdb)". Source : https://www.liciel.fr/wiki/article/view/4060
- **Fichier de base** : `LICIEL_Dossiers.mdb` dans `C:\LICIEL_Diagnostics\`.
- **Architecture installation** : 2 répertoires Windows par installation :
  - `LICIEL_Programmes` : exécutables et modèles
  - `LICIEL_Diagnostics` : base + dossiers terrain
- **Format dossier terrain** : XML + photos + Word/PDF générés. WikiLiciel "Export personnalisable" : *"plus de 8 000 champs différents (...) Il est possible d'exporter la totalité de ces informations dans de divers formats (xlsx, csv, xml, zip, etc.)"*.
- **Modèles de rapport** : Word (.docx).
- **Synchronisation cloud** : optionnelle ("LICIEL Cloud").
- **Modules** : 42+ modules selon Enersweet (DPE, Audit, Amiante, Plomb, Gaz, Électricité, Carrez/Boutin, ERP, Termites, Bât'Eval, Photo, Plan/Croquis, HAND'EX, etc.).
- **Langage de développement** : non confirmé publiquement, mais signalements forts vers Delphi ou VB.NET (utilisation `LICIEL_Launch.exe`, couplage Word/COM, recours à .mdb).

### 1.3 WikiLiciel — accessibilité et licence

- **URL racine** : https://www.liciel.fr/wiki/
- **Accessibilité** : **partiellement publique**. La plupart des articles fonctionnels (modules, interfaces, workflows) sont publics ; **les articles d'assistance et "Structure de la Base de Données" (article 84) sont gatés** derrière compte client. Vérifié : https://www.liciel.fr/wiki/article/view/84 renvoie "Accès restreint".
- **Licence du contenu** : "Copyright © 2026 LICIEL Environnement" en pied. **Pas de licence ouverte.** Conséquences :
  - Citer/référencer la doc dans le code KOVAS = OK
  - Reproduire substantiellement la doc dans un livrable KOVAS = contrefaçon
- **Les "8 000 champs"** : Liciel revendique ce chiffre. Le détail n'est pas entièrement indexé publiquement, mais une grande partie des champs de publipostage est accessible via le menu **"Outils > Afficher les champs de publipostage"** du logiciel installé. C'est probablement le filon d'extraction le plus efficace une fois la démo en main.

### 1.4 Implication pour l'architecture KOVAS

Le fait que Liciel s'appuie sur **Jet/Access .mdb** est un signal majeur :
- Le format est **stable depuis 1997-2010** (.mdb Jet 4.0). Mature, prévisible, ne change pas.
- Mais le format est **fermé** — aucun "écrivain" officiel hors de Microsoft Office / Access Database Engine sous Windows.
- **Conclusion** : le format ne va pas changer drastiquement, mais le **chemin d'écriture** est très étroit (Section 4).

---

## 2. Format ZIP d'export Liciel — ce que la doc publique révèle

### 2.1 Le menu utilisateur : deux niveaux d'export ZIP

WikiLiciel article 2163 (Gestion des dossiers) confirme la présence du menu **dans deux endroits** distincts :
1. **Mission (partie administrative)** : "Importer format ZIP" / "Exporter format ZIP"
2. **Dossier (partie terrain)** : "Exporter format zip" / "Importer format zip"

Ces deux exports ne contiennent **pas la même chose** :
- **Export admin** : ordre de mission, facturation, données client.
- **Export terrain** : XML(s) du diag, photos, plans, rapports Word/PDF générés.

### 2.2 Cas particulier : exports vers prestataires institutionnels (DiagInfo, Amiante 360)

L'article 3038 "Export DiagInfo" donne le plus de détail public sur **un** format ZIP Liciel :
- **Granularité** : "Liciel procédera à l'envoi d'un ZIP par mission" — 1 ZIP = 1 mission. Pour les immeubles : "1 ZIP pour le bâtiment et 1 ZIP par appartement".
- **Fichier de données identifié** : `LIV_données` (et `LIV_MISSION`).
- **Convention de nommage rapports** : "Nous vous invitons à ne pas modifier le nom des WORD générés (...) il faut à minima que les PDF finaux dans le répertoire Windows contiennent le mot 'DPE'".

⚠️ Ce format DiagInfo n'est **PAS le format ZIP "Exporter format ZIP" générique** — c'est un export spécialisé. À ne pas confondre.

### 2.3 Structure probable du ZIP "Exporter format ZIP" générique

Sur la base de l'architecture sur disque (déduite des articles 1932 et 3486) :

```
[NOM_DOSSIER].zip
├── LICIEL_Dossiers.mdb          ← copie partielle filtrée sur la mission ?
│                                  OU table CSV/XML représentant les lignes
│                                  ADMIN (ODM, facturation, client) [À VALIDER]
├── Dossiers_<ANNEE>/
│   └── <NOM_DOSSIER>/
│       ├── *.xml                ← données terrain (DPE, amiante, etc.)
│       ├── photos/              ← photos JPG/PNG numérotées
│       ├── plans/               ← croquis/plans
│       ├── *.docx / *.pdf       ← rapports générés (DPE_xxx.pdf, etc.)
│       └── log_export/          ← traces (optionnel)
└── [métadonnées éventuelles : .ini, .txt, manifest…] [À VALIDER]
```

**Confidence sur cette structure** : MEDIUM. À vérifier byte-par-byte avec un export réel dès que la démo Liciel V4 est installée.

### 2.4 Le .mdb dans l'export — point névralgique

C'est **la question critique** : quand on exporte un dossier en ZIP, est-ce que Liciel inclut :
- (a) une **copie partielle** de `LICIEL_Dossiers.mdb` filtrée sur la mission concernée ?
- (b) une **représentation textuelle** (XML/CSV) des lignes ADMIN, et le .mdb cible est reconstitué à l'import ?
- (c) un .mdb **dédié à la mission** ?

**Hypothèse de travail (à valider en priorité 1) : (c) — un mini-.mdb dédié à la mission est inclus dans le ZIP.**

Si **(c)** confirmé, alors KOVAS doit **savoir générer un .mdb** valide compris par Liciel (Section 4 contraignante).
Si **(b)** confirmé, alors KOVAS doit générer XML/CSV — beaucoup plus simple. **Meilleure nouvelle possible.**

### 2.5 Schéma du `LICIEL_Dossiers.mdb`

**Inaccessible publiquement.** L'article 84 "Structure de la Base de Données" est gaté.

**Approche** : après installation de la démo, exécuter `mdb-schema LICIEL_Dossiers.mdb` (mdbtools en read-only suffit) et `mdb-tables`. Geste numéro 1 du Sprint 1 dès la démo en main.

### 2.6 Format XML "données terrain"

L'article 3024 précise : *"Pour les formats plus complexes (fichiers XML), n'hésitez pas à vous retourner vers votre Donneur d'Ordre, car il est probable que celui-ci soit en mesure de vous proposer un Cahier des Charges complet déjà prévu par leurs équipes informatiques (par exemple des fichiers de validation XSD)."*

**Distinction critique pour KOVAS** :
- XML **interne Liciel** (dans l'export ZIP, format propriétaire) : non documenté → reverse-engineering.
- XML **ADEME** (envoyé par Liciel à l'Observatoire DPE) : standard public, schéma documenté → KOVAS pourrait théoriquement le générer directement *si* on était certifié ADEME (Phase 2).

### 2.7 Workflow "Fichier > Importer format ZIP"

Article 2163 : *"vous permettent d'échanger des fichiers entre différents ordinateurs sans passer par un réseau, serveur ou internet."* — autrement dit l'import accepte n'importe quel ZIP produit par n'importe quel poste Liciel.

**Question critique non résolue** : Liciel vérifie-t-il une signature/checksum/marker pour s'assurer que le ZIP provient bien d'un autre poste Liciel ? *Section 5.4.*

---

## 3. Cadre juridique reverse-engineering en France

### 3.1 Texte de loi : Article L122-6-1 du CPI

Source officielle (Légifrance) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044365559

**Article L122-6-1** transpose la directive 2009/24/CE. Quatre paragraphes :
- **I** — Usage conforme à la destination + correction des erreurs (peut être réservé par contrat).
- **II** — Copie de sauvegarde.
- **III** — **Observation, étude, test du fonctionnement ou de la sécurité du logiciel** : *"La personne ayant le droit d'utiliser le logiciel peut sans l'autorisation de l'auteur observer, étudier ou tester le fonctionnement ou la sécurité de ce logiciel afin de déterminer les idées et principes qui sont à la base de n'importe quel élément du logiciel."*
- **IV** — **Exception de décompilation pour interopérabilité**.

**Disposition d'ordre public (§ V)** : *"Toute stipulation contraire aux dispositions prévues aux II, III et IV du présent article est nulle et non avenue."*

→ Une clause CGU Liciel interdisant l'observation/étude (III) ou le reverse-engineering pour interopérabilité (IV) serait **juridiquement nulle**.

### 3.2 Jurisprudence clé : SAS Institute c/ World Programming Ltd (CJUE, 2 mai 2012, C-406/10)

**L'arrêt cardinal** pour le cas KOVAS. Pertinence quasi 1:1.

**Principes consacrés** :
1. **La fonctionnalité d'un logiciel n'est PAS protégée par le droit d'auteur.**
2. **Le langage de programmation N'EST PAS protégé**.
3. **Le format de fichiers de données N'EST PAS protégé** ("ni la fonctionnalité d'un programme d'ordinateur ni le langage de programmation et **le format de fichiers de données** utilisés dans le cadre d'un programme d'ordinateur pour exploiter certaines de ses fonctions ne constituent une forme d'expression de ce programme et ne sont, à ce titre, [pas] protégés par le droit d'auteur").
4. **Le titulaire d'une licence peut observer, étudier, tester** sans autorisation, **et même créer un programme concurrent** dès lors qu'il ne reproduit ni le code source ni le code objet.

**Application directe à KOVAS** :
- Le format ZIP/MDB/XML de Liciel **n'est pas protégé**.
- Avec une démo Liciel téléchargée légitimement, KOVAS a le droit d'observer son comportement, ses entrées/sorties, ses fichiers produits, **et de générer des fichiers compatibles**.
- KOVAS étant un logiciel concurrent (pas une simple "interopérabilité technique"), c'est l'article **L122-6-1 III (observation/étude)** qui sécurise le mieux le travail — **pas besoin d'invoquer le IV** (décompilation) tant qu'on n'accède pas au code source/objet.

### 3.3 Jurisprudence française complémentaire

- **CA Paris, 21 février 2006** : décompilation pour étudier la sécurité — **interdite**.
- **CA Caen, 28 octobre 2010** : décompilation pour maintenance corrective d'un tiers — **sanctionnée**.
- **CJUE, Top System c/ État belge, 6 octobre 2021** : décompilation pour corriger des erreurs autorisée à l'utilisateur légitime.

**Interprétation pour KOVAS** : la jurisprudence française est **stricte** sur le périmètre de la décompilation (IV). Elle est **largement permissive** sur l'observation/étude (III), surtout depuis SAS Institute. **La stratégie KOVAS doit absolument rester dans le périmètre du III (boîte noire, observation des entrées/sorties)** et **ne jamais toucher au code objet ou source de Liciel.**

### 3.4 CGU Liciel et clauses anti-reverse

**Validité** :
- Pour le **III** : **clause juridiquement NULLE** par effet de l'article L122-6-1 V (ordre public).
- Pour le **IV** : **clause également NULLE** pour le périmètre interopérabilité.
- Pour la **correction d'erreurs** (I) : la clause **peut être valide**.

**Conclusion** : même si Liciel inclut une clause anti-reverse, elle ne peut pas empêcher KOVAS d'observer le comportement d'une instance Liciel acquise légitimement et d'en reproduire le format de sortie.

### 3.5 Probabilité de poursuite par Liciel

- Liciel/Enersweet est dans une dynamique d'agressivité commerciale.
- Mais **un procès intenté à KOVAS serait perdu d'avance sur le fond** dès lors que KOVAS reste dans le périmètre L122-6-1 III.
- **Le risque réel** :
  - une **action en référé** pour bloquer temporairement KOVAS au lancement
  - une **plainte pour concurrence déloyale**
  - une **lettre de mise en demeure médiatisée**

**Précédents** : pas de précédent français connu d'éditeur diagnostic poursuivant un acteur tiers pour interopérabilité.

**Recommandation** : faire **valider la stratégie par un avocat spécialisé PI/IT** (budget 1 500-3 000 € pour une consultation d'opinion + relecture du code de découverte) **avant de mettre en production**.

### 3.7 Tableau de synthèse juridique

| Élément | Périmètre légal | Status pour KOVAS |
|---|---|---|
| Observer le comportement de Liciel (démo) | Art. L122-6-1 III + SAS/WPL | ✅ Autorisé, d'ordre public |
| Produire des exports ZIP réels avec Liciel pour étudier la structure | Art. L122-6-1 III | ✅ Autorisé |
| Lire les .mdb / XML / photos d'un export Liciel | Art. L122-6-1 III + format non protégé | ✅ Autorisé |
| Reproduire ce format dans KOVAS | Format de fichiers de données non protégé | ✅ Autorisé |
| Décompiler / désassembler Liciel.exe | Art. L122-6-1 IV — uniquement si infos non rendues facilement accessibles | ⚠️ Risqué, à éviter |
| Reproduire des éléments de WikiLiciel dans la doc KOVAS | Droit d'auteur classique | ❌ Interdit |
| Utiliser un compte WikiLiciel d'un tiers sans son accord | Accès non autorisé | ❌ Interdit |
| Embaucher un ex-employé Liciel pour son savoir technique | Concurrence déloyale possible | ⚠️ Risqué, contrat soigné nécessaire |

---

## 4. Manipulation Microsoft Access .mdb en 2026 — le mur technique

### 4.1 Version du moteur Liciel : Jet 4.0 confirmé

Liciel exige Office 2010+ et utilise `.mdb` (pas `.accdb`). Format **Jet 4.0** (Access 2000-2003).
- Page size : 4 096 octets.
- Encoding par défaut : **CP1252 (Windows-1252)** pour les chaînes.

### 4.2 Inventaire des bibliothèques d'**écriture** .mdb en 2026

| Library / Outil | Langage | Lecture | **Écriture** | Plateforme | Maintenance |
|---|---|---|---|---|---|
| **mdb-reader** v3.2.0 (npm) | TypeScript/Node | ✅ | **❌** | Toutes | Active (fév 2026) |
| **mdbtools** v1.0.1 | C (CLI) | ✅ | **❌** | Linux/Mac/WSL | Active (déc 2024) |
| **node-adodb** / `@el3um4s/node-mdb` | Node + ADODB | ✅ | ✅ | **Windows uniquement** | Active |
| **Jackcess** v4.x | Java (pur) | ✅ | **✅** | Toutes (JVM) | Active (Apache 2.0) |
| **UCanAccess** (JDBC sur Jackcess) | Java | ✅ | ✅ | Toutes (JVM) | Active |
| **pyodbc + MS Access Driver** | Python | ✅ | ✅ | **Windows uniquement** | Active |

### 4.3 Verdict technique sans appel

> **Il n'existe AUCUNE bibliothèque Node.js / TypeScript pour ÉCRIRE des fichiers .mdb compatibles Liciel.**

Il existe **trois et seulement trois** chemins crédibles pour générer un .mdb depuis KOVAS :

#### Chemin A — Jackcess (Java) sur serveur Linux
- **Faisabilité** : ✅ technique
- **Stack KOVAS** : ajouter un microservice Java (JVM) à côté du backend Node
- **Avantages** : pur Java, OS-agnostique, mature
- **Inconvénients** : Ajoute une dépendance JVM ; **Question critique** : Liciel reconstruira-t-il son schéma au moment de l'import, ou s'attend-il à lire un schéma précis ?

#### Chemin B — VM Windows avec ADODB + Liciel installé
- **Faisabilité** : ✅ technique mais **lourd opérationnellement**
- **Avantages** : Compatibilité **garantie** avec Liciel
- **Inconvénients** : Coût Hetzner Windows Server ~30-60 €/mois ; maintenance Windows

#### Chemin C — Piloter Liciel installé (automation)
- **Faisabilité** : ✅ mais **fragile**
- **Idée** : VM Windows avec Liciel V4 installé + démo licence. KOVAS envoie les données par CSV/XML, un script (PowerShell / AutoIt / Python pywinauto) lance Liciel, importe via menu, puis utilise "Exporter format ZIP"
- **Avantages** : Le ZIP produit est **byte-pour-byte identique** à du Liciel natif
- **Inconvénients** : **Fragile** ; risque de licence ; pas scalable ; latence

#### Chemin D — Convertir l'approche : input Liciel via passerelles natives

**C'est l'approche que cette recherche recommande au final.** Liciel a déjà des "Imports spécifiques" qui acceptent **XML et Excel** (article 2163 : *"Vous pouvez importer et exporter en format XML et Excel"*).

Si KOVAS génère un Excel ou un XML que Liciel sait importer dans un dossier nouvellement créé, on **évite complètement** le problème d'écriture .mdb. La contrepartie : ce n'est plus un "ZIP one-click" — l'utilisateur diagnostiqueur fait l'import depuis Liciel.

### 4.4 Benchmark performance (estimé, à valider)

| Chemin | Temps estimé pour 10 missions | Confiance |
|---|---|---|
| Jackcess (Java pur, Linux) | 2-5 s | MEDIUM |
| ADODB (Windows VM) | 5-15 s | HIGH |
| Pilotage Liciel UI (Windows VM) | 60-180 s | MEDIUM |
| Génération XML/Excel via Node (chemin D) | < 1 s | HIGH |

Le chemin D est **5× à 100×** plus rapide.

### 4.5 Risques techniques spécifiques au format .mdb

- **Corruption** : Jet 4.0 est sensible aux écritures concurrentes
- **Password protection** : Liciel pourrait chiffrer son .mdb — à valider en priorité 1
- **Encoding** : Windows-1252 par défaut côté .mdb, UTF-8 dans la stack moderne. Transcodage défensif obligatoire (`iconv-lite` côté Node, `Charset.forName("windows-1252")` côté Java)
- **Drift de version** : si Liciel passe un jour à .accdb, refonte nécessaire

---

## 5. Cycle de mise à jour Liciel et risques techniques

### 5.1 Fréquence des releases — analyse de l'historique

L'article 973 ("Historique des mises à jour") :

| Version | Date | Type |
|---|---|---|
| 4.277.5.1 → 5.4 | 17/02/2025 → 20/02/2025 | 4 versions en 4 jours |
| 4.278.2.2 | 26/08/2025 | majeure (DPE 2.5, Audit 2.4) |
| 4.278.2.9 → 2.91 | 17/11 → 19/11/2025 | hotfix BAN |
| 4.278.3.04 → 3.08 | 11/12 → 31/12/2025 | 5 versions en 20 jours |
| 4.278.3.09 | 13/01/2026 | (version observée Benjamin) |
| 4.279.06.04 | 06/05/2026 | la plus récente vue |

**Rythme observé** : **plusieurs releases par mois, jusqu'à 4-5 versions en 20 jours**.

### 5.2 Le format export change-t-il entre versions ?

**Hypothèses raisonnées** :
- Le **format ZIP "Exporter format ZIP" générique** est probablement **très stable** (utilisé en interne par les diagnostiqueurs depuis 15 ans)
- Le **schéma .mdb** des données admin est très probablement aussi stable
- Le **XML "données terrain"** évolue **avec la réglementation** : DPE 2020 → 2021 → 2024 → 2025 → 2026

### 5.3 Stratégie de monitoring KOVAS

- **Quotidien** : web scraper qui surveille `liciel.fr/wiki/article/view/973` et notifie en cas de nouvelle release
- **Hebdomadaire** : pipeline CI qui télécharge la dernière démo Liciel, crée une fixture de test, exporte en ZIP, et **compare byte-par-byte** avec la version précédente
- **Mensuel** : test d'intégration complet — KOVAS génère son ZIP, on tente l'import dans la dernière Liciel

### 5.4 Protection technique du ZIP : signature, checksum, watermark ?

**Pas trouvé après recherche** — à valider sur démo. Le ZIP poste-à-poste n'est **probablement pas signé** (sinon les diagnostiqueurs ne pourraient pas s'échanger des dossiers via clé USB).

### 5.5 Impact sur la signature ADEME du DPE final

**Clarification importante** :

Le flux complet d'un DPE est :
1. Diagnostiqueur saisit le DPE dans son logiciel d'édition (Liciel)
2. Le logiciel envoie le XML DPE à l'Observatoire ADEME via API authentifiée
3. L'ADEME valide les données, **délivre un n° à 13 chiffres** = signature de validation
4. Ce numéro s'insère dans le rapport Word/PDF signé manuscritement par le diagnostiqueur

**Pour KOVAS dans le scénario Phase 1** :
- KOVAS produit un ZIP que le diagnostiqueur importe dans Liciel
- **Le diagnostiqueur, depuis Liciel, envoie le dossier à l'ADEME**
- L'ADEME délivre le numéro — **à Liciel**, qui l'insère dans le dossier
- **Il n'y a pas de "marque KOVAS"** sur le DPE final. **L'ADEME ne sait pas** que les données ont initialement été saisies dans KOVAS

**Conséquence rassurante** : aucune compromission réglementaire pour le diagnostiqueur.

### 5.6 Risque "Liciel casse délibérément l'import ZIP"

**Évaluation** : **probabilité faible mais réelle.**

Arguments **contre** un changement défensif :
- Casser le format ZIP utilisé par les 7 000 utilisateurs Liciel = self-DDoS de leur support client
- Légalement, Liciel ne peut pas empêcher l'interopérabilité — un changement de format conçu spécifiquement pour bloquer KOVAS pourrait constituer un **abus de position dominante** (Liciel = numéro 1 du marché)

**Mitigation pour KOVAS** :
- **Diversification d'import** : ne pas dépendre uniquement de "Importer format ZIP". Supporter aussi Excel et XML (Imports spécifiques)
- **Communication discrète** : tant que KOVAS reste petit (<200 utilisateurs), il vole sous le radar
- **Plan B activé** : Phase 2 = certification ADEME propre

---

## 6. Projets reverse-engineering existants et benchmarks

### 6.1 Tentatives antérieures sur Liciel

**Recherche menée sur GitHub, GitLab, forums** : **aucun projet open source connu de reverse-engineering du format Liciel.**

**Interprétation** : KOVAS serait le **premier acteur à tenter cette interopérabilité**.

### 6.2 Standardisation industrielle

- **ADEME** : pousse une standardisation **XML pour les DPE/Audits** (Observatoire DPE), mais **pas un format pivot inter-logiciels d'édition**
- **Conclusion** : il n'existe **pas de format pivot ADEME** que KOVAS pourrait utiliser pour s'éviter le format propriétaire Liciel

### 6.3 Synthèse benchmarks

Les SaaS qui ont reverse-engineeré un format propriétaire ont systématiquement :
1. **Acquis légitimement** des copies
2. **Travaillé en équipe restreinte et nommée**
3. **Documenté minutieusement** le processus de reverse
4. **Évité tout employé ex-concurrent** sur les rôles techniques critiques
5. **Souscrit une assurance RC professionnelle** couvrant les litiges PI
6. **Communiqué via un avocat** dès la moindre menace écrite du concurrent

---

## 7. Stratégie pratique Phase 1 KOVAS — recommandations

### 7.1 Validation de la stratégie d'acquisition d'exports (D1001)

#### Étape 1 — Démo Liciel V4 gratuite : ✅ confirmée disponible
URL téléchargement : https://www.liciel.fr/telechargement-logiciel-page-new.html

**Risque** : si la démo Liciel **n'autorise pas** l'export ZIP en mode non-activé, alors recourir à l'étape 3.

#### Étape 2 — Recrutement 3 diagnostiqueurs LinkedIn : ✅ stratégie validée
- Cibler des diagnostiqueurs **non concurrents** géographiquement de Benjamin
- **Contrepartie** : 100-200 € pour 15-30 exports anonymisés, ou bien accès gratuit en bêta KOVAS pendant 12 mois
- **NDA simple** sur l'usage des exports
- **Anonymisation impérative** avant versioning

**Variantes critiques à couvrir** (priorisées) :
1. DPE 2020 maison individuelle complet
2. DPE 2020 appartement
3. DPE immeuble complet (multi-lots)
4. Amiante avant-vente
5. CREP (Plomb)
6. Carrez/Boutin (mesurage)
7. Gaz + Électricité
8. ERP
9. Termites
10. **Mission combinée vente complète** (DPE + amiante + plomb + gaz + élec + ERP + Carrez) — le plus important

#### Étape 3 — Licence Liciel 1 mois en backup : ✅ stratégie validée
Coût indicatif 120-200 €. Cette licence sert à :
- Installer Liciel en mode **activé complet** sur une VM Windows Hetzner
- Automatiser les tests de régression CI
- Piloter Liciel pour les chemins B et C

**Recommandation** : **acheter la licence Liciel dès le sprint 1**, ne pas attendre.

### 7.2 Test fixtures nécessaires

| Type | Min | Optimal |
|---|---|---|
| DPE 2020 maison standard | 3 | 8 |
| DPE 2020 appartement | 2 | 5 |
| DPE immeuble complet | 1 | 3 |
| Amiante | 2 | 4 |
| Plomb | 2 | 4 |
| Gaz, Électricité | 2 | 6 |
| Carrez/Boutin | 1 | 3 |
| ERP | 1 | 3 |
| Termites | 1 | 3 |
| **Mission combinée vente** | **3** | **8** |
| **Total minimum** | **18** | **47** |

**Recommandation** : viser **30 exports diversifiés** pour Phase 1.

### 7.3 Pipeline de découverte du format (Sprint 1-2)

```
WEEK 1 — Setup
- Installer démo Liciel sur VM Windows
- Acheter licence 1 mois Liciel
- Récupérer 5 exports tests (cas DPE simple)

WEEK 2 — Anatomie du ZIP
- Dezipper exports, dump arborescence
- mdb-schema *.mdb, mdb-tables, mdb-export sur chaque table
- Identifier les XML, valider leur lisibilité
- Documenter dans docs/liciel-format-internal.md (privé)

WEEK 3 — Mapping reverse
- Lister TOUS les champs Liciel (depuis "Outils > Afficher les champs de publipostage")
- Mapper avec les champs prévus dans KOVAS V1
- Identifier les GAPS

WEEK 4 — POC writer
- Implémenter Chemin A (Jackcess) sur 1 cas DPE simple
- Tester import dans Liciel V4
- Si Liciel accepte : continuer Chemin A
- Si Liciel refuse : pivoter vers Chemin C OU Chemin D
```

### 7.4 Stratégie révisée recommandée

> **Plutôt que de "produire un ZIP natif Liciel", produire un fichier d'import natif Liciel.**

Le menu **"Imports spécifiques"** (article 2163, article 4193) accepte des fichiers **Excel et XML** depuis d'autres logiciels (LICIWEB, WinCarrez 8.5).

**Avantages stratégie XML/Excel** :
1. **Plus simple techniquement** : 1 service Node pur, pas de JVM, pas de VM Windows
2. **Plus stable** : Liciel ne va pas casser ses propres passerelles d'import publiques
3. **Plus défendable juridiquement** : on n'imite pas un format propriétaire, on consomme une API publique
4. **Plus rapide** : génération < 1 seconde par mission
5. **UX diagnostiqueur** : "Importer Excel KOVAS → Liciel" aussi simple que "Importer ZIP"

**Inconvénients** :
1. **Pas un import "1-click"** : le diagnostiqueur doit ouvrir Liciel, créer la mission, importer
2. **Pas toutes les données** : certaines (photos, plans) peuvent ne pas passer par l'Excel/XML
3. **Limites de mappage** : les passerelles d'imports spécifiques sont conçues pour des cas business précis

**Recommandation finale** :
→ **Sprint 1-2 : tester EN PARALLÈLE les deux pistes :**
- **Piste A** : générer XML pour "Imports spécifiques" (chemin D)
- **Piste B** : générer ZIP via Jackcess + Windows VM (chemin A/B/C)

→ **Décider en fin de Sprint 2** lequel des deux est la voie principale Phase 1.

→ **Pari personnel : Piste A gagne**, sauf si Liciel refuse spécifiquement le format. Dans ce cas, fallback sur la combo Piste B chemin C (pilotage Liciel UI).

### 7.5 Documentation et maintenance du mapping

- **Mapping KOVAS ↔ Liciel** : tableau Excel/Notion structuré, owner Benjamin
- **Source of truth** : champs de publipostage Liciel
- **Tests de non-régression** : pipeline CI nightly avec import dans la dernière Liciel
- **Documentation publique KOVAS** : ne **JAMAIS** publier le mapping détaillé Liciel ↔ KOVAS dans la doc publique (risque concurrence déloyale)

### 7.6 Monitoring des updates Liciel

- **Scraper hebdo** : `liciel.fr/wiki/article/view/973` → diff release notes → notification Slack/email
- **Smoke test mensuel** : KOVAS → fixture → import dans Liciel → validation manuelle
- **Dossier "Veille Liciel"** dans Notion KOVAS pour tracer toutes les annonces produit

---

## 8. Pitfalls et edge cases techniques

### 8.1 Encoding

| Source | Encoding | Risque |
|---|---|---|
| .mdb Jet 4.0 | Windows-1252 par défaut | Caractères œ, Œ corrompus en UTF-8 naïf |
| XML "données terrain" Liciel | UTF-8 (probable) | Si CP1252, déclaration XML obligatoire |
| Photos JPG | Binaire | OK |
| Noms de fichiers Windows | UTF-16 / system locale | Préférer ASCII sans accents |

**Règle d'or** : tout le pipeline KOVAS travaille **strictement en UTF-8**, et **transcode** au moment précis de l'écriture dans le .mdb / XML / ZIP final.

### 8.2 Formats de date / Séparateur décimal / Caractères spéciaux français

- France : `DD/MM/YYYY` affichage, `YYYY-MM-DD` stockage
- Virgule pour affichage, point pour stockage `.mdb` / XML
- œ, Œ : **risque selon version Jet et OS Liciel**. Tester explicitement.

### 8.3 Photos — embedding et taille

- Compression configurable côté Liciel
- Format : JPG, PNG
- Taille max : non documenté
- **Compression côté KOVAS à 1920×1080 max @ 85% qualité** valeur défensive

### 8.4 Sécurité du .mdb

- Si Liciel chiffre son .mdb (à valider), Jackcess seul ne suffit pas → **Jackcess Encrypt** (extension)
- Si la base est ouverte sans password (le plus probable), Jackcess vanilla suffit

---

## 9. Synthèse — Tableau risk × mitigation

| Risque | Impact | Probabilité | Mitigation | Owner |
|---|---|---|---|---|
| Liciel refuse les ZIP non-natifs (signature) | 🔴 BLOQUANT Phase 1 | MEDIUM | Pivoter vers Imports spécifiques XML/Excel | Tech, Sprint 1 |
| Liciel change le format à la prochaine release | 🔴 BLOQUANT temporaire | LOW-MEDIUM | Monitoring hebdo + plan B Phase 2 (ADEME directe) | Tech, ongoing |
| Procès Liciel contre KOVAS | 🟠 SÉRIEUX | LOW | Consultation avocat + RC pro spéciale PI + journal de découverte | Benjamin, M0 |
| .mdb chiffré par Liciel | 🟡 RETARD | LOW | Jackcess Encrypt | Tech, Sprint 2 |
| Pas de bibliothèque Node pour écriture .mdb | 🟠 SÉRIEUX | CONFIRMÉ | Choix Jackcess (Java) ou Imports spécifiques XML | Tech, Sprint 1 |
| VM Windows nécessaire | 🟡 COÛT | CONFIRMÉ | Hetzner ~50€/mois | Ops |
| Update Liciel casse les tests intégration | 🟡 INTERMITTENT | MEDIUM | CI nightly + alertes | Tech, ongoing |
| Encoding CP1252 / UTF-8 mismatch | 🟡 BUGS DATA | MEDIUM-HIGH | Pipeline transcodage défensif | Tech, Sprint 1 |
| Anonymisation insuffisante des fixtures | 🟠 SÉRIEUX (RGPD) | LOW si rigoureux | Pipeline anonymisation systématique + NDA diagnostiqueurs | Benjamin, Sprint 1 |
| Concurrence déloyale Liciel (référé) | 🟠 SÉRIEUX | LOW | Avocat de défense identifié en amont + assurance | Benjamin, M0 |

---

## 10. Code snippets utiles

### 10.1 Lecture d'un .mdb Liciel (Node.js, Linux) — pour découverte

```typescript
// npm install mdb-reader@3.2.0
import MDBReader from "mdb-reader";
import { readFileSync } from "fs";

const buffer = readFileSync("./fixtures/LICIEL_Dossiers_demo.mdb");
const reader = new MDBReader(buffer);

console.log("Tables:", reader.getTableNames());

for (const tableName of reader.getTableNames({ normalTables: true, systemTables: false })) {
  const table = reader.getTable(tableName);
  console.log(`\n=== ${tableName} (${table.rowCount} rows) ===`);
  console.log("Columns:", table.getColumnNames());
  console.log("Sample (first 3 rows):", table.getData({ rowLimit: 3 }));
}
```

### 10.2 Lecture .mdb en CLI (Linux, mdbtools)

```bash
sudo apt install mdbtools
mdb-tables LICIEL_Dossiers_demo.mdb
mdb-schema LICIEL_Dossiers_demo.mdb > liciel_schema.sql
mdb-export LICIEL_Dossiers_demo.mdb tblDossiers > tblDossiers.csv
mdb-json LICIEL_Dossiers_demo.mdb tblDossiers > tblDossiers.json
```

### 10.3 Écriture .mdb (Jackcess, Java sur Linux)

```java
// build.gradle: implementation "com.healthmarketscience.jackcess:jackcess:4.0.10"
import com.healthmarketscience.jackcess.*;
import java.io.File;

Database db = new DatabaseBuilder(new File("/tmp/kovas_export.mdb"))
    .setFileFormat(Database.FileFormat.V2000)  // .mdb Jet 4.0 — celui de Liciel
    .create();

Table table = new TableBuilder("tblDossiers")
    .addColumn(new ColumnBuilder("id_dossier", DataType.LONG))
    .addColumn(new ColumnBuilder("numero_dossier", DataType.TEXT).setLength(50))
    .addColumn(new ColumnBuilder("date_creation", DataType.SHORT_DATE_TIME))
    .addColumn(new ColumnBuilder("nom_proprietaire", DataType.TEXT).setLength(100))
    .addColumn(new ColumnBuilder("adresse_bien", DataType.MEMO))
    .toTable(db);

table.addRow(1, "DPE-2026-001", new java.util.Date(), "Dupont", "12 rue de la Paix, 76200 Dieppe");
db.close();
```

### 10.4 Microservice Java exposé en HTTP

```java
@RestController
public class MdbExportController {
  @PostMapping("/api/mdb-export")
  public ResponseEntity<byte[]> generateMdb(@RequestBody MissionPayload payload) throws IOException {
    File tempFile = File.createTempFile("kovas-", ".mdb");
    try (Database db = new DatabaseBuilder(tempFile).setFileFormat(FileFormat.V2000).create()) {
      // ... création des tables et insertion à partir du payload
    }
    byte[] bytes = Files.readAllBytes(tempFile.toPath());
    tempFile.delete();
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(bytes);
  }
}
```

### 10.5 Génération ZIP côté Node (assemblage final)

```typescript
// npm install jszip
import JSZip from "jszip";

async function buildLicielZip(payload: KovasPayload): Promise<Buffer> {
  // 1. Appel microservice Java pour le .mdb
  const mdbBuffer = await fetch("http://127.0.0.1:8081/api/mdb-export", {
    method: "POST",
    body: JSON.stringify(payload.admin),
  }).then(r => r.arrayBuffer());

  // 2. Génération XML "données terrain"
  const xmlTerrain = renderLicielXml(payload.terrain);

  // 3. Assemblage ZIP
  const zip = new JSZip();
  zip.file("LICIEL_Dossiers.mdb", Buffer.from(mdbBuffer));
  const dossierFolder = zip.folder(`Dossiers_${new Date().getFullYear()}`)!
    .folder(payload.numeroDossier)!;
  dossierFolder.file(`${payload.numeroDossier}.xml`, xmlTerrain);

  for (const photo of payload.photos) {
    dossierFolder.folder("photos")!.file(photo.filename, photo.buffer);
  }
  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
```

---

## 11. Conclusion exécutive

### 11.1 Faisabilité : verdict

| Dimension | Verdict | Confiance |
|---|---|---|
| Légalité du reverse-engineering format Liciel | ✅ Oui (Art. L122-6-1 III + SAS/WPL) | **HIGH** |
| Lecture des exports Liciel | ✅ Oui, outils matures (mdb-reader, mdbtools) | **HIGH** |
| Génération .mdb compatible Liciel depuis Linux/Node | ❌ Non sans dépendance Java (Jackcess) OU Windows VM | **HIGH** |
| Génération .mdb via Java (Jackcess) | ✅ Faisable techniquement, à valider si Liciel accepte | **MEDIUM** |
| Génération XML/Excel pour Imports spécifiques | ✅ Probablement la voie la plus simple et stable | **MEDIUM-HIGH** |
| Stratégie d'acquisition (D1001) | ✅ Validée | **HIGH** |
| Maintenance long-terme | ⚠️ Charge constante (CI nightly + scraper releases + smoke tests mensuels) | **MEDIUM** |
| Risque procès Liciel | 🟢 Faible si bonnes pratiques | **MEDIUM** |

### 11.2 Décision recommandée pour Phase 1

**Procéder avec confiance**, en intégrant les ajustements suivants au PRD :

1. **Architecture** : ajouter un microservice Java (Jackcess) ou maintenir la décision Hetzner Windows VM. **Idéalement, faire les deux** : Linux/Java pour développement et scale, Windows VM pour tests d'intégration et fallback (pilotage Liciel)
2. **Voie principale** : tester **les "Imports spécifiques" (XML/Excel)** en parallèle du "Exporter format ZIP", et choisir le chemin gagnant après Sprint 2
3. **Légal** : **consultation avocat PI** avant le lancement, budget 1 500-3 000 €. Souscription RC pro avec clause PI
4. **Test fixtures** : 30 exports diversifiés minimum
5. **Monitoring** : pipeline CI nightly + scraper hebdo + journal de découverte versionné
6. **Plan B** : Phase 2 préparée dès maintenant (chemin direct ADEME, certification logiciel KOVAS)

### 11.3 Niveau de confiance global : MEDIUM-HIGH

**Pourquoi pas HIGH** :
- Schéma .mdb Liciel non inspecté byte-level (article 84 WikiLiciel gaté)
- Aucune garantie que Liciel accepte un .mdb généré par Jackcess (sémantique vs syntaxe)
- Le format ZIP poste-à-poste pourrait contenir un marker propriétaire
- Pas de précédent juridique français spécifique au diagnostic immobilier

**Pourquoi pas LOW** :
- Cadre juridique extrêmement favorable (SAS/WPL clair)
- Outils techniques d'écriture .mdb existent (Jackcess)
- Liciel a déjà des passerelles d'import publiques (XML/Excel) constituant un plan B robuste
- Stratégie d'acquisition d'exports crédible et abordable

**Confiance gagnée par cette recherche** : **forte sur la légalité**, **mesurée sur la technique pure**, **élevée sur l'existence d'un chemin pragmatique** (probablement les Imports spécifiques).

---

## Annexe — Sources principales consultées

### Liciel / Enersweet
- Notice installation Liciel V4 : https://www.liciel.fr/pdf/LICIEL_Diagnostics_Notice_installation.pdf
- WikiLiciel — Gestion des dossiers : https://www.liciel.fr/wiki/article/view/2163
- WikiLiciel — Transfert ZIP : https://www.liciel.fr/wiki/article/view/455
- WikiLiciel — Lenteur serveur (.mdb confirmé) : https://www.liciel.fr/wiki/article/view/4060
- WikiLiciel — Déplacer la base : https://www.liciel.fr/wiki/article/view/3486
- WikiLiciel — Export DiagInfo (LIV_données) : https://www.liciel.fr/wiki/article/view/3038
- WikiLiciel — Export personnalisable (XML, 8000 champs) : https://www.liciel.fr/wiki/article/view/3024
- WikiLiciel — Historique mises à jour : https://www.liciel.fr/wiki/article/view/973
- WikiLiciel — DPE/ADEME envoi : https://www.liciel.fr/wiki/article/view/1792
- Annonce rachat Enersweet : https://www.quotidiag.fr/liciel-change-de-proprietaire/
- Acquisitions Enersweet 2024 : https://www.immomatin.com/logiciels/web-agency-immo/diagnostic-immobilier-enersweet-acquiert-arobiz-sogexpert-et-quotidiag.html
- Acquisition OBBC : https://www.quotidiag.fr/rapprochement-obbc-liciel-lessentiel/
- Téléchargement Liciel : https://www.liciel.fr/telechargement-logiciel-page-new.html

### Cadre juridique
- Légifrance — Article L122-6-1 CPI : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044365559
- SAS Institute / WPL — Dalloz : https://actu.dalloz-etudiant.fr/a-la-une/article/une-protection-amenagee-du-droit-dauteur-du-logiciel-informatique/
- SAS Institute / WPL — Next-Law : https://next-law.fr/2012/05/28/la-cjue-rappelle-que-les-fonctionnalites-dun-logiciel-ne-sont-pas-proteges-par-le-droit-dauteur/
- DDG — Décompilation jurisprudence : https://www.ddg.fr/actualite/decompiler-un-logiciel-enseignements-recents-la-jurisprudence-communautaire

### Technique .mdb
- mdb-reader : https://www.npmjs.com/package/mdb-reader
- mdbtools : https://github.com/mdbtools/mdbtools
- Jackcess : https://jackcess.sourceforge.io/
- Jackcess FAQ (read/write v2000-2019) : https://jackcess.sourceforge.io/faq.html
- node-adodb : http://nuintun.github.io/node-adodb/
- Guide 2026 Access on Linux/Mac : https://copyprogramming.com/howto/working-with-an-access-database-in-python-on-non-windows-platform-linux-or-mac

### ADEME
- DPE — Ministère écologie : https://www.ecologie.gouv.fr/politiques-publiques/diagnostic-performance-energetique-dpe
