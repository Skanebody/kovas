# Data.gouv.fr & APIs publiques FR — Opportunités pour KOVAS

> **Statut** : exploration M0 (rapport initial, 2026-05-26)
> **Auteur** : Claude (exploration sous instruction Benjamin Bel)
> **Cible lecteur** : founder + futur sprint planning (effort × valeur business)
> **Sources** : URLs vérifiées via WebSearch — toutes citées en fin de section
> **Périmètre** : APIs ouvertes ou habilitables gratuites/peu coûteuses, alignées 8 diagnostics standards (DPE/Amiante/Plomb/Gaz/Élec/Termites/Carrez/ERP), cohérent CLAUDE.md (pas audit/DTG/marketplace MAR-RGE)

---

## 0. TL;DR — pour les pressés

L'écosystème public FR offre **bien plus que les 8 sources déjà branchées** (ADEME/DVF/INSEE/BAN/IGN/Géorisques/Sirene/DHUP). Trois trouvailles majeures pour KOVAS :

1. **BDNB CSTB** (Base de Données Nationale des Bâtiments) + **RNB** (Référentiel National des Bâtiments avec ID unique) → carte d'identité de chaque bâtiment FR (année construction, matériaux murs, type toit, énergie chauffage estimée, présence amiante probable selon date permis). **Game changer pré-remplissage missions**.
2. **API Mes Aides Réno** (publi.codes officiel, gratuit, conversational API, sans quota) → simulateur officiel MaPrimeRénov' réutilisable → KOVAS peut **vendre du conseil rénovation post-DPE sans construire le moteur**.
3. **API Professionnels RGE** + **API Recherche d'Entreprises** → identifier qualifications d'un cabinet diagnostic (Qualibat, Qualiopi, OPQIBI) → **badge "Conformité KOVAS" vérifiable côté annuaire B2C**.

**Top 5 prio** (détail §3) : RNB + BDNB Open (2j) · Mes Aides Réno (1,5j) · API Géorisques étendue (1j) · API GPU urbanisme (2j) · Annuaire Éducation Nationale (0,5j). **Total ~7j dev** pour un gain qualitatif et défensif majeur vs Liciel.

---

## 1. Architecture des catalogues officiels FR

### 1.1 Les deux portes d'entrée

| Portail | URL | Rôle |
|---|---|---|
| `api.gouv.fr` | https://api.gouv.fr | Catalogue **éditorialisé** des APIs publiques (~80 APIs production), repo GitHub `betagouv/api.gouv.fr` |
| `data.gouv.fr` | https://www.data.gouv.fr | Catalogue **brut** des datasets (~50 000 jeux) + section `/dataservices` qui répertorie les APIs |

**Stratégie** : `api.gouv.fr` pour découvrir les APIs maintenues production, `data.gouv.fr/dataservices` pour les APIs moins éditorialisées mais souvent très exploitables.

### 1.2 Deux bouquets habilités (auth, gratuits sous condition)

- **API Entreprise** (entreprise.api.gouv.fr) — **réservée administrations**. KOVAS ne pourra pas l'utiliser directement, mais des APIs **dérivées open data** (API Sirene, API Recherche d'Entreprises) sont accessibles librement.
- **API Particulier** (particulier.api.gouv.fr) — JWT + habilitation DINUM. **Réservée administrations**. Non utilisable pour KOVAS Phase 1.

### 1.3 Sources

- [Catalogue api.gouv.fr](https://api.gouv.fr/)
- [data.gouv.fr — Catalogue API publiques](https://www.data.gouv.fr/dataservices)
- [Guide data.gouv.fr — Référence API v1](https://guides.data.gouv.fr/guide-data.gouv.fr/readme-1/reference)
- [Doctrine des API publiques](https://api.gouv.fr/guides/doctrine-api)

---

## 2. Inventaire détaillé — APIs pertinentes pour KOVAS

> **Légende** : ⭐ priorité haute (top 5) · 🟢 candidat sérieux · 🟡 niche / V2 · ⚪ déjà branché (rappel)

### 2.1 Bâti & référentiel immobilier

#### ⭐ RNB — Référentiel National des Bâtiments (ID-RNB)

- **URL** : https://rnb.beta.gouv.fr/ · API : https://rnb-api.beta.gouv.fr · catalog : [data.gouv.fr/dataservices/api-rnb](https://www.data.gouv.fr/dataservices/api-rnb)
- **Auth** : ouverte, gratuite. Token optionnel pour augmenter quotas
- **Format** : REST/JSON + vector tiles MVT pour cartes
- **Endpoints clés** :
  - `GET /buildings/{id_rnb}` — fiche bâtiment
  - `GET /buildings/?insee_code={code}` — liste bâtiments d'une commune
  - `GET /buildings/?bbox=...` — emprise géographique
  - `GET /diff?since={date}` — modifications depuis date
- **Fraîcheur** : mise à jour continue (géocommun bêta.gouv)
- **Volumétrie** : ~30 millions de bâtiments FR métropole + DROM
- **Licence** : Open License Etalab 2.0
- **Stabilité** : production officielle depuis 2024, intégré par 38+ bases (Blueway, Kayrros…)
- **Valeur KOVAS** : **identifiant pivot unique** entre nos missions et toutes les autres bases (BDNB, DPE, RPLS, cadastre). C'est la **clé étrangère qu'on n'a pas encore**.

#### ⭐ BDNB — Base de Données Nationale des Bâtiments (CSTB)

- **URL portail** : https://api-portail.bdnb.io · catalog : [data.gouv.fr/dataservices/api-bdnb-open](https://www.data.gouv.fr/dataservices/api-bdnb-open)
- **3 versions** :
  - **BDNB Open** : gratuit, ouvert, données agrégées
  - **BDNB Open Plus** : gratuit avec inscription, données enrichies
  - **BDNB Expert** : payant (à confirmer tarif), données fines individuelles
- **Auth** : inscription (key) pour Open Plus / Expert
- **Format** : REST/JSON + dumps PostgreSQL + GeoPackage
- **Données par bâtiment (32 millions FR)** :
  - Année construction (estimation)
  - Type de murs (matériaux)
  - Type de toiture
  - Énergie de chauffage estimée
  - Classe DPE consolidée (croisement DPE ADEME)
  - **Présence amiante probable** (calculée selon date permis de construire < 1997)
  - Hauteur estimée, surface, nombre étages estimés
- **Licence** : ODbL pour Open, contrat commercial Expert
- **Stabilité** : production CSTB, autorité officielle
- **Valeur KOVAS** : **pré-remplir 60-80% des champs mission avant visite terrain**. L'amiante probable seul = pré-qualification d'un devis amiante.

#### 🟢 API DPE — bâtiments tertiaires

- **URL** : [data.gouv.fr/dataservices/api-dpe-batiments-tertiaires](https://www.data.gouv.fr/dataservices/api-dpe-batiments-tertiaires)
- **Note** : KOVAS a déjà branché DPE logements existants. Ajouter le **tertiaire** = ouverture marché diagnostiqueurs ERP/bureaux.
- **Effort** : ~0,5 jour (même schéma que DPE existant ADEME)
- **Valeur KOVAS** : Phase 2 — débloque les diagnostiqueurs qui font aussi du tertiaire (~20% du marché).

#### 🟢 RPLS — Répertoire des Logements Locatifs Sociaux

- **URL** : [data.gouv.fr/datasets/donnees-detaillees-au-logement-du-repertoire-des-logements-locatifs-des-bailleurs-sociaux-rpls](https://www.data.gouv.fr/datasets/donnees-detaillees-au-logement-du-repertoire-des-logements-locatifs-des-bailleurs-sociaux-rpls)
- **Format** : ZIP CSV annuels par millésime
- **Pas d'API REST officielle**, mais ingestion possible
- **Valeur KOVAS** : niche (~4M logements sociaux). Utile pour outreach aux **bailleurs sociaux qui commandent en lot** (ESH, OPH). À garder pour Phase 2 stratégie B2B verticale.

#### 🟡 Registre National d'Immatriculation des Copropriétés (RNIC)

- **URL** : [data.gouv.fr/datasets/registre-national-dimmatriculation-des-coproprietes](https://www.data.gouv.fr/datasets/registre-national-dimmatriculation-des-coproprietes)
- **Couverture** : ~2/3 des copropriétés FR (déclaratif)
- **Mise à jour** : quotidienne depuis avril 2026
- **Valeur KOVAS** : V2 — corréler diagnostics aux copropriétés permet **observatoire copro** + cibler syndics dans funnel B2B.

### 2.2 Énergie & rénovation

#### ⭐ API Mes Aides Réno (publi.codes)

- **URL** : https://mesaides.france-renov.gouv.fr · [api-doc](https://mesaidesreno.beta.gouv.fr/api-doc)
- **Auth** : aucune, totalement libre
- **Format** : REST/JSON conversationnel (publi.codes engine)
- **Quotas** : **aucun**
- **Comportement** :
  - Input : situation (revenus, ménage, commune, projet renovation)
  - Output : montant aides éligibles + questions complémentaires si input incomplet
- **Couvre** : MaPrimeRénov', MaPrimeAdapt', CEE, éco-PTZ, aides locales
- **Stabilité** : production France Rénov' (officiel État)
- **Valeur KOVAS** : énorme. Quand un diagnostiqueur livre un DPE F/G, KOVAS peut **automatiquement générer le simulateur d'aides** côté client → outil de fidélisation + **différenciateur radical vs Liciel** (qui ne fait pas ça).
- **Cohérence CLAUDE.md** : pas d'audit ni de marketplace MAR/RGE — c'est juste **un calcul d'aides côté client** que le diagnostiqueur partage. ✅

#### 🟢 API Enedis Open Data

- **URL** : https://data.enedis.fr · catalog : [api.gouv.fr/producteurs/enedis](https://api.gouv.fr/producteurs/enedis)
- **Auth** : ouverte pour open data agrégé (commune/IRIS), **avec consentement client** pour données fines via SGE (point de livraison)
- **Données utiles** :
  - Consommation annuelle par adresse (entreprises) — utile pour DPE tertiaire
  - Consommation par IRIS (statistiques fines quartier)
  - Mix énergétique, type de logement
- **Limite KOVAS Phase 1** : pour accéder aux données nominatives d'un client, il faut **consent management** → coût UX et juridique → à reporter Phase 2/3.
- **Valeur Phase 1** : open data agrégé pour **observatoire de consommation** sur kovas.fr (SEO).

#### 🟢 API GRDF ADICT (gaz)

- **URL** : [sites.grdf.fr/web/portail-api-grdf-adict](https://sites.grdf.fr/web/portail-api-grdf-adict) · catalog : [data.gouv.fr/dataservices/api-grdf-adict](https://www.data.gouv.fr/dataservices/api-grdf-adict)
- **Auth** : contractualisation GRDF + consentement client par PCE
- **Quotas** : 1 appel/sec, 6000/jour pour < 5000 PCE
- **Valeur Phase 1** : limitée (consent management lourd). **Phase 2/3** pour cabinets qui font massivement du diag gaz.

#### 🟢 API Données Climatologiques (Météo-France)

- **URL** : [data.gouv.fr/dataservices/api-donnees-climatologiques](https://www.data.gouv.fr/dataservices/api-donnees-climatologiques) · https://donneespubliques.meteofrance.fr
- **Auth** : inscription portail Météo-France, clé gratuite usage non-commercial
- **Données** : DJU (degrés-jours unifiés), températures moyennes, séries climatologiques quotidiennes
- **Granularité** : station météo (≈ département / agglomération)
- **Stabilité** : production Météo-France
- **Valeur KOVAS** : **DJU = paramètre direct du calcul DPE certifié Phase 2**. Aujourd'hui Liciel utilise valeurs ADEME figées par zone climatique. KOVAS pourrait utiliser **DJU réels millésimés** → DPE plus précis. Différenciateur Phase 2 fort.

### 2.3 Géorisques & santé bâtiment

#### ⭐ API Géorisques (étendue)

- **URL** : https://www.georisques.gouv.fr/doc-api · [api.gouv.fr/les-api/api-georisques](https://api.gouv.fr/les-api/api-georisques)
- **KOVAS branché aujourd'hui** : ERP (État des Risques et Pollutions)
- **À ajouter** :
  - **TRI** (Territoires à Risque Important d'inondation) — 124 territoires, 3 niveaux d'aléa
  - **PPRI / PPRT** (Plans de prévention risques) zonage réglementaire
  - **Cavités souterraines** (potentiel effondrement)
  - **Sites pollués (BASOL/BASIAS)** — pollution sols
  - **Mouvements terrain** (argiles, retrait-gonflement)
  - **Sismicité** zonage 5 niveaux
- **Valeur KOVAS** : **enrichir l'état des risques (ERP)** au-delà du minimum réglementaire = **rapport client à valeur ajoutée**. Différenciateur fort vs Liciel qui se limite au strict réglementaire.

#### ⭐ Données Radon IRSN

- **URL** : [data.gouv.fr/datasets/connaitre-le-potentiel-radon-de-ma-commune](https://www.data.gouv.fr/datasets/connaitre-le-potentiel-radon-de-ma-commune)
- **Format** : CSV + GeoJSON
- **Zonage** : 3 catégories par commune (zone 1 faible / 2 modéré / 3 significatif)
- **Source** : IRSN officiel
- **Licence** : Open License
- **Valeur KOVAS** : **diagnostic radon obligatoire en zone 3** depuis arrêté 2018 — KOVAS peut **automatiquement détecter et alerter** le diagnostiqueur si la commune est en zone 3 → ajout module radon. **Pas dans les 8 standards CLAUDE.md** mais c'est un **diagnostic réglementaire 2018** à 75€-150€ par mission. À envisager comme **9e diagnostic** post-V1.

#### 🟡 Cartographie Termites / Mérules (Cerema)

- **URL** : https://www.cerema.fr/fr/actualites/cartographie-nationale-termites-merules
- **Format** : **pas d'API officielle**, PDFs préfecturaux + cartes statiques
- **Difficulté** : scrape arrêtés préfecturaux département par département
- **Valeur KOVAS** : **pré-qualification mission termites obligatoire**. Si la commune est sous arrêté → KOVAS alerte "mission termites obligatoire ici" → upsell automatique. Effort : 2-3j pour scrape initial + maintenance trimestrielle.

### 2.4 Foncier, urbanisme & valeur

#### ⭐ API Carto — module Géoportail de l'Urbanisme (GPU)

- **URL** : [data.gouv.fr/dataservices/api-carto-module-geoportail-de-lurbanisme-gpu](https://www.data.gouv.fr/dataservices/api-carto-module-geoportail-de-lurbanisme-gpu) · https://www.geoportail-urbanisme.gouv.fr/api/
- **Auth** : ouverte, gratuite
- **Format** : REST/JSON + WMS/WFS
- **Données** :
  - PLU / POS / Cartes communales / PSMV
  - Prescriptions (surfacique / linéaire / ponctuelle)
  - Servitudes d'utilité publique
  - Informations urbaines
- **Couverture** : majorité des communes FR (déclaratif)
- **Valeur KOVAS** : enrichir le contexte d'une mission avec **règles d'urbanisme** → si le client demande "puis-je agrandir ?" → KOVAS sort la fiche PLU directement. Différenciateur fort + ouverture vers Phase 2 conseil rénovation.

#### 🟢 API ADS / PermisAPI — Permis de construire (Sit@del2)

- **URL** : [data.gouv.fr/reuses/permisapi-1-2-million-de-permis-de-construire-de-france-en-acces-direct](https://www.data.gouv.fr/reuses/permisapi-1-2-million-de-permis-de-construire-de-france-en-acces-direct)
- **Sit@del2 official** : [data.gouv.fr/datasets/base-des-permis-de-construire-et-autres-autorisations-durbanisme](https://www.data.gouv.fr/datasets/base-des-permis-de-construire-et-autres-autorisations-durbanisme)
- **Volume** : 1,2 million permis depuis 2013, 89% géocodés
- **Fraîcheur** : mensuelle (SDES)
- **Auth** : open data
- **Valeur KOVAS** :
  - Vérifier **année construction** (= levier amiante < 1997)
  - Détecter **rénovations récentes** (= correction étiquette DPE possible)
  - Observatoire des **chantiers à proximité** d'une mission (utile pour rénovation H+H)
  - Phase 2 : alimenter recos rénovation

#### 🟢 API Cadastre (Carto IGN)

- **URL** : [api.gouv.fr/les-api/api_carto_cadastre](https://api.gouv.fr/les-api/api_carto_cadastre) · https://apicarto.ign.fr/
- **Auth** : ouverte, gratuite
- **Format** : REST/GeoJSON
- **Données** : parcelles, sections, communes, contours
- **Valeur KOVAS** : déjà partiellement utilisé via IGN. Ajout des **références cadastrales** = pré-remplissage automatique d'un champ légal obligatoire dans tous les diagnostics. **Quick win < 0,5j**.

#### 🟡 API Données Foncières (Cerema/DGALN)

- **URL** : [data.gouv.fr/dataservices/api-donnees-foncieres](https://www.data.gouv.fr/dataservices/api-donnees-foncieres)
- **Données** : DVF enrichi + indicateurs prix marché + consommation espace
- **Note** : DVF déjà branché. La variante enrichie Cerema apporte **indicateurs de tension** et **stats territoriales**.
- **Valeur KOVAS** : pour l'observatoire SEO + rapport de marché client (post-DPE F/G : "votre bien vaut Xk€, un DPE C vaudrait Y").

#### 🟢 Zones tendues + Encadrement loyers

- **Zones tendues** : [data.gouv.fr/datasets/observatoire-habitat-communes-situees-en-zone-tendue](https://www.data.gouv.fr/datasets/observatoire-habitat-communes-situees-en-zone-tendue) (décret 2025-1267)
- **Encadrement loyers** Paris/Lille : [data.gouv.fr/datasets/encadrement-des-loyers-de-paris](https://www.data.gouv.fr/datasets/encadrement-des-loyers-de-paris)
- **Format** : CSV liste communes / JSON par adresse Paris-Lille
- **Valeur KOVAS** : **info contextuelle dans rapport bail** (cas DPE location). Quick win 0,5j pour lookup commune.

### 2.5 Entreprises & cabinets

#### ⭐ API Recherche d'Entreprises (Annuaire Entreprises)

- **URL** : https://recherche-entreprises.api.gouv.fr/docs/ · [data.gouv.fr/dataservices/api-recherche-dentreprises](https://www.data.gouv.fr/dataservices/api-recherche-dentreprises)
- **Auth** : **aucune**, totalement ouverte
- **Format** : REST/JSON
- **Recherche** : nom, SIREN, SIRET, adresse, code NAF, dirigeants
- **Volume** : tous établissements actifs FR
- **Valeur KOVAS** :
  - **Anti-abus essai gratuit** (vérifier SIRET réel + activité 7120B diagnostic)
  - Pré-remplir page profil cabinet annuaire B2C
  - Détecter et exclure les non-pros à l'inscription
  - **Remplace Luhn vérification** + ajoute vérification activité

#### ⭐ API Sirene open data (INSEE)

- **URL** : [data.gouv.fr/dataservices/api-sirene-open-data](https://www.data.gouv.fr/dataservices/api-sirene-open-data) · https://api.insee.fr
- **Auth** : clé gratuite
- **Données** : identité complète, adresse, NAF, effectif, date création
- **KOVAS déjà branché** : oui (rappel — vérifier la doc CLAUDE.md mentionne "Sirene")
- **Note** : c'est l'API que cible probablement le brief CLAUDE.md sous "Sirene déjà branché". Si pas, à ajouter immédiatement.

#### ⭐ API Professionnels RGE (ADEME)

- **URL** : [api.gouv.fr/les-api/api_professionnels_rge](https://api.gouv.fr/les-api/api_professionnels_rge) · [data.gouv.fr/dataservices/api-professionnels-rge](https://www.data.gouv.fr/dataservices/api-professionnels-rge)
- **Auth** : ouverte
- **Données** : entreprises RGE, qualifications (Qualibat, Qualibat Energie, Qualifelec…), domaines travaux, validité certificat
- **Valeur KOVAS** :
  - **Pas pour faire de la marketplace MAR/RGE** (interdit CLAUDE.md)
  - Mais **insight ajouté au rapport DPE F/G** : "X artisans RGE qualifiés à <10km" (info simple, pas de relation commerciale)
  - **Badge cabinet KOVAS** : si le diagnostiqueur a une activité connexe RGE (rare), affichage automatique.

#### 🟡 API Annuaire Diagnostiqueurs Immobiliers (DHUP)

- **URL** : [data.gouv.fr/datasets/annuaire-des-diagnostiqueurs-immobiliers](https://www.data.gouv.fr/datasets/annuaire-des-diagnostiqueurs-immobiliers) · https://diagnostiqueurs.din.developpement-durable.gouv.fr
- **Statut KOVAS** : **déjà branché** ✅
- **Note** : confirmé dans CLAUDE.md (annuaire-diagnostiqueurs.md existe). Rien à faire.

### 2.6 Contexte habitat & population

#### ⭐ API Annuaire de l'Éducation Nationale

- **URL** : [api.gouv.fr/les-api/api-annuaire-education](https://api.gouv.fr/les-api/api-annuaire-education) · https://data.education.gouv.fr
- **Auth** : ouverte (clé gratuite via portail OpenDataSoft)
- **Format** : REST/JSON via OpenDataSoft v2.1
- **Volume** : 66 000 établissements (publics + privés, primaire à supérieur)
- **Données** : nom, type, adresse, coordonnées, type contrat, statut, RPI, code commune
- **Valeur KOVAS** :
  - **Info contextuelle dans rapport** : "École primaire à 350m, collège à 1.2km" → améliore valeur perçue du DPE
  - **SEO local** : page commune = DPE moyen + écoles + DVF + risques = mini-portail référence
  - **Quick win** ~0,5j

#### 🟢 API INSEE (Démographie)

- **URL** : https://api.insee.fr
- **Auth** : portail développeur, clé gratuite
- **Statut KOVAS** : déjà branché Sirene (idem catalogue INSEE)
- **À enrichir** : recensement population, ménages, indicateurs IRIS (~16k zones fines FR), revenus médians
- **Valeur KOVAS** : **observatoire SEO** par commune + **ciblage commercial intelligent** (densité diagnostiqueurs vs population vs revenus).

#### 🟡 API ATMO France — qualité air

- **URL** : [data.gouv.fr/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo](https://www.data.gouv.fr/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo)
- **Format** : WFS + CSV historique 365 jours
- **Données** : indice ATMO quotidien par commune (5 polluants : SO2, NO2, O3, PM10, PM2.5)
- **Licence** : ODbL
- **Valeur KOVAS** : niche. Info contextuelle dans rapport zone urbaine ("indice ATMO commune : moyen"). Pas prioritaire.

### 2.7 Adresses (rappel — KOVAS déjà branché)

- **API Adresse BAN** : nouvelle URL **https://data.geopf.fr/geocodage/search/** (depuis déc 2023, géré par IGN/Géoplateforme)
- **Ancien** : `https://api-adresse.data.gouv.fr/` (toujours fonctionnel, redirige)
- **Quota** : 50 calls/sec/IP en unitaire + 1 simultané en bulk CSV
- **Note** : vérifier que KOVAS utilise la nouvelle URL Géoplateforme (pas l'ancienne) pour pérennité.

### 2.8 Sources de cette section

- [api.gouv.fr — Producteurs Enedis](https://api.gouv.fr/producteurs/enedis)
- [api.gouv.fr — Producteurs GRDF](https://api.gouv.fr/producteurs/grdf)
- [API DPE logements](https://www.data.gouv.fr/dataservices/api-dpe-logements)
- [API BDNB Open](https://www.data.gouv.fr/dataservices/api-bdnb-open)
- [API RNB](https://www.data.gouv.fr/dataservices/api-rnb)
- [API Mes Aides Réno](https://www.data.gouv.fr/dataservices/api-mes-aides-reno)
- [API Géorisques](https://www.data.gouv.fr/en/dataservices/api-georisques/)
- [API Carto GPU](https://www.data.gouv.fr/dataservices/api-carto-module-geoportail-de-lurbanisme-gpu)
- [API Recherche d'Entreprises](https://www.data.gouv.fr/dataservices/api-recherche-dentreprises)
- [API Professionnels RGE](https://www.data.gouv.fr/dataservices/api-professionnels-rge)
- [API Annuaire Éducation](https://www.data.gouv.fr/dataservices/annuaire-de-leducation-nationale)
- [API Données Climatologiques Météo-France](https://www.data.gouv.fr/dataservices/api-donnees-climatologiques)
- [Indice ATMO](https://www.data.gouv.fr/datasets/indice-de-la-qualite-de-lair-quotidien-par-commune-indice-atmo)
- [Potentiel Radon IRSN](https://www.data.gouv.fr/datasets/connaitre-le-potentiel-radon-de-ma-commune)
- [Sit@del2 permis construire](https://www.data.gouv.fr/datasets/base-des-permis-de-construire-et-autres-autorisations-durbanisme)
- [Zones tendues](https://www.data.gouv.fr/datasets/observatoire-habitat-communes-situees-en-zone-tendue)
- [RNIC Copropriétés](https://www.data.gouv.fr/datasets/registre-national-dimmatriculation-des-coproprietes)
- [DiagFrance — Guide APIs open data 2026](https://diagfrance.com/outils-materiel-diagnostiqueur-guide/apis-open-data-diagnostic)

---

## 3. Opportunités stratégiques KOVAS — classement par valeur business

### A. Productivité diagnostiqueur (réduire le temps mission)

| API | Cas d'usage | Gain estimé |
|---|---|---|
| **RNB + BDNB** | Pré-remplir année construction, matériaux murs, type toiture, classe DPE antérieure, **amiante probable** dès saisie adresse | **5-10 min/mission** (saisie + recherche papier) |
| **API Cadastre IGN** | Pré-remplir références cadastrales obligatoires sur tous rapports | 2-3 min/mission |
| **API Recherche d'Entreprises** | Vérification SIRET diagnostiqueur à l'inscription + auto-fill profil cabinet | 5 min onboarding (one-shot) |
| **API ADS / Sit@del2** | Détecter rénovations récentes (permis < 5 ans) → alerter "DPE potentiellement périmé" | 5 min/mission (vérification documentaire) |
| **Mes Aides Réno** | Génération automatique simulation aides post-DPE F/G pour le client (PDF annexe) | 15-30 min (rédaction conseil rénovation manuelle) |
| **API GPU urbanisme** | Sortir fiche PLU si client demande potentiel d'agrandissement | 20-30 min/cas (recherche manuelle GPU) |

**Total gain potentiel** : facilement **15-25 min sur la mission DPE typique** en plus des **1h30 promise CLAUDE.md** via la saisie vocale.

### B. Référence d'information / SEO (devenir THE source d'autorité)

| Initiative | API utilisée | Effort | ROI SEO |
|---|---|---|---|
| **Page commune type** "DPE à {commune}" avec étiquette moyenne + DVF + ATMO + écoles + permis récents + risques | DPE + DVF + ATMO + Éducation + Sit@del2 + Géorisques | 3-5 jours (template + scaling) | **35 000+ communes FR** → 35k pages SEO templatées |
| **Observatoire mensuel** rénovations MaPrimeRénov' par département | Mes Aides Réno + ADEME + INSEE | 2 jours | mise en avant pour journalistes (relations presse gratuites) |
| **Alertes réglementaires** (newsletter) basées sur évolutions DPE / arrêtés / zones tendues | datasets monitoring | 1 jour scripts veille | retention diagnostiqueurs (utilité hors-mission) |
| **Carte radon interactive** par commune + alerte automatique | IRSN | 1 jour | Quick win référencement "radon mission" |
| **Page comparateur** "Diagnostic X à {commune} vs national" | ADEME + INSEE + DHUP | 2 jours | longue traîne SEO 100+ requêtes/jour |

### C. Avantage compétitif vs Liciel/concurrents

| Différenciateur | API source | Liciel le fait ? |
|---|---|---|
| Pré-remplissage **amiante probable** depuis date permis | BDNB + Sit@del2 | ❌ Non |
| **Simulation aides client** post-DPE F/G intégrée au rapport | Mes Aides Réno | ❌ Non |
| **DJU réels millésimés** dans calcul DPE Phase 2 (vs valeurs figées Liciel) | Météo-France | ❌ Non |
| Carte **risques étendue** (TRI/PPRI/Argiles/Cavités) au-delà ERP minimum | Géorisques | ⚠️ Partiel |
| **Détection rénovation récente** post-permis → recommandation re-DPE | Sit@del2 | ❌ Non |
| Identifiant **ID-RNB** unique partagé multi-bases | RNB | ⚠️ Pas encore |
| Détection **commune en zone radon 3** → alerte diagnostic obligatoire | IRSN | ❌ Non |
| **Vérification SIRET + activité 7120B** à l'inscription | Recherche Entreprises | ⚠️ Variable |

### D. Monétisation B2B/B2C — pistes nouvelles

| Piste | Modèle | API utilisée | Cohérence CLAUDE.md |
|---|---|---|---|
| **Badge "Cabinet vérifié KOVAS"** sur annuaire B2C (Sirene + DHUP + RGE croisés) | Inclus tier Annuaire | Recherche Entreprises + DHUP + RGE | ✅ |
| **API publique KOVAS** (insights enrichis BDNB+DVF+ADEME) en lecture seule, freemium | Add-on B2B Phase 2 | Toutes | ✅ (cf. roadmap Phase 2) |
| **Rapport contexte adresse** (PDF 1 page) pré-mission vendu 5€/u au diagnostiqueur ou inclus Cabinet+ | Add-on ponctuel | Toutes | ✅ |
| **Alertes leads** : nouveau permis construire dans rayon X km → diagnostiqueur reçoit push | Add-on Pro/Cabinet | Sit@del2 + BAN | ✅ |
| **Observatoire payant** clients institutionnels (presse, ANIL, bailleurs sociaux) | B2B niche Phase 3 | Toutes | À évaluer |

---

## 4. Top 5 priorité — implémentation recommandée

> **Critère** : effort × valeur business × cohérence CLAUDE.md (8 diagnostics standards, pas audit/DTG/marketplace)

### #1 — RNB + BDNB Open (priorité absolue)

- **Effort** : **2 jours** dev
- **Valeur business** : **10/10**
- **ROI cumulé** :
  - Pré-remplissage automatique année construction + matériaux + amiante probable
  - **ID-RNB = clé étrangère** entre toutes les autres APIs (effet multiplicateur)
  - Gain mission : 5-10 min/mission × 100 missions/mois × 1000 users = **massif**
- **Quick win possible** : oui, lookup RNB par adresse en 0,5j. BDNB Open Plus = 1,5j (inscription + ingestion).
- **Cohérence** : ✅ amélioration des 8 diagnostics standards.

### #2 — Mes Aides Réno (publi.codes officiel France Rénov')

- **Effort** : **1,5 jour** dev (API conversationnelle bien documentée)
- **Valeur business** : **9/10**
- **ROI cumulé** :
  - Différenciateur radical vs Liciel
  - Outil de fidélisation client final (diagnostiqueur paraît "expert global")
  - Annexe au rapport DPE F/G = valeur perçue +20-30%
- **Quick win possible** : oui — un seul appel API par mission DPE F/G + un template PDF
- **Cohérence** : ✅ pas de marketplace ni transactionnel, juste calcul d'aides officiel État.

### #3 — Géorisques étendu (TRI/PPRI/Argiles/Cavités/Radon)

- **Effort** : **1 jour** dev (KOVAS branche déjà ERP, ajouter 4-5 endpoints du même API)
- **Valeur business** : **8/10**
- **ROI cumulé** :
  - Enrichit le rapport ERP au-delà du minimum réglementaire
  - **Radon** = potentiel 9e diagnostic post-V1
  - **Argiles retrait-gonflement** = enjeu majeur 2026 (assurances)
- **Quick win possible** : oui, ~0,5j pour le radon seul, puis incrémental.
- **Cohérence** : ✅ extension du diagnostic ERP existant (1 des 8 standards).

### #4 — API GPU urbanisme (Carto IGN)

- **Effort** : **2 jours** dev
- **Valeur business** : **7/10**
- **ROI cumulé** :
  - Différenciateur fort sur les missions "diagnostic + projet client"
  - Ouverture Phase 2 conseil rénovation (cohérent vision M19+)
  - SEO commune (PLU = recherche populaire grand public)
- **Quick win possible** : non, chantier propre. Mais réutilisable observatoire SEO.
- **Cohérence** : ✅ info contextuelle, pas un nouveau diagnostic.

### #5 — Annuaire Éducation Nationale + Sit@del2

- **Effort** : **1 jour** combiné (deux quick wins additifs)
- **Valeur business** : **6/10**
- **ROI cumulé** :
  - Annexe contextuelle valorisante du rapport
  - **Sit@del2** = détection rénovation récente (info utile)
  - Pages commune SEO enrichies
- **Quick win possible** : **oui** — lookup adresse + filtre rayon. Templates PDF auto.
- **Cohérence** : ✅ enrichissement, pas de scope creep.

### Total Top 5 = ~7,5 jours dev

Comparable à 1 sprint MVP intermédiaire (~5-7 jours intensifs). Peut être **fractionné** en quick wins isolés : RNB (0,5j) + Radon (0,5j) + Mes Aides Réno (1,5j) = **2,5j pour 80% du ROI**.

---

## 5. APIs à NE PAS implémenter Phase 1 (justification)

| API | Pourquoi pas Phase 1 |
|---|---|
| **API Particulier / API Entreprise (habilités)** | Réservés administrations, DINUM ne donnera pas habilitation à un SaaS B2B |
| **GRDF ADICT / Enedis SGE** (nominatif) | Consent management lourd, ROI marginal Phase 1 |
| **RPLS** détaillé | Niche bailleurs sociaux, hors cible avatar (diagnostiqueur indépendant) |
| **RNIC Copropriétés** | Couverture 2/3 incomplète, V2 quand outreach syndics |
| **Cartographie Termites Cerema** | Pas d'API officielle, scrape PDF préfectoraux = dette technique élevée |
| **API DPE tertiaire** | Phase 2 quand KOVAS attaque le marché diagnostiqueurs tertiaire |
| **Données Foncières Cerema enrichies** | Bonus marginal vs DVF déjà branché |

---

## 6. Synergie avec roadmap existante CLAUDE.md

### Cohérence avec les 8 diagnostics standards

| Diagnostic standard | APIs publiques exploitables |
|---|---|
| **DPE** | RNB, BDNB, ADEME (existant), DJU Météo-France (Phase 2), Mes Aides Réno (post-DPE F/G) |
| **Amiante** | BDNB (présence probable), Sit@del2 (date permis < 1997) |
| **Plomb CREP** | BDNB (date construction < 1949), ARS données saturnisme |
| **Gaz** | GRDF ADICT (Phase 2/3 consentement), BDNB type chauffage |
| **Électricité** | Enedis open data (commune), BDNB type chauffage |
| **Termites** | Cerema cartographie (scrape), Géorisques |
| **Carrez / Boutin** | Cadastre IGN, RNB |
| **ERP** | Géorisques (étendu : ERP + TRI + PPRI + Argiles + Cavités + Radon + Sismicité) |

**100% des 8 diagnostics enrichis** par au moins 1 API publique. ✅

### Pas de scope creep vers Audit / DTG / Marketplace MAR-RGE

Aucune des APIs proposées ne pousse KOVAS vers :
- ❌ Audit énergétique réglementaire (interdit CLAUDE.md)
- ❌ DTG (interdit CLAUDE.md)
- ❌ Marketplace MAR/RGE (interdit CLAUDE.md)

L'API **RGE** est utilisée en **info contextuelle uniquement** (badge cabinet, liste artisans proches) — pas en relation commerciale.

L'API **Mes Aides Réno** est un **simulateur officiel État** — pas un marketplace, pas un intermédiaire commercial.

### Sources

- [CLAUDE.md — section 3 (8 diagnostics standards)](../CLAUDE.md)
- [CLAUDE.md — section 20 (différenciateurs)](../CLAUDE.md)
- [DiagFrance — Guide 2026](https://diagfrance.com/outils-materiel-diagnostiqueur-guide/apis-open-data-diagnostic)

---

## 7. Risques & limites identifiés

| Risque | Mitigation |
|---|---|
| **APIs bêta.gouv.fr en alpha** (RNB, Mes Aides Réno) — peuvent évoluer | Wrapper KOVAS isolant + monitoring de breaking changes via Sentry |
| **Quotas non-publiés / variables** (BDNB Open, Géorisques) | Cache agressif (Redis Upstash existant) + dégradation gracieuse |
| **Données déclaratives parfois incomplètes** (BDNB, RNIC, GPU 100% communes) | Stratégie "best effort" + champ optionnel + saisie manuelle override |
| **Licence ODbL** (BDNB, ATMO) impose **share-alike** sur publications de la donnée | Légal à valider sur produits dérivés (observatoire SEO OK car contextuel) |
| **Évolution Géoplateforme IGN** en cours (BAN/Géorisques migrent) | Suivre forum Etalab + utiliser nouvelles URLs `data.geopf.fr` |
| **Dépendance technique sur APIs État** (panne / déprécation) | Cache long TTL + monitoring uptime + plan B (DB miroir hebdomadaire pour BDNB Open dump) |

---

## 8. Annexe — URLs vérifiées (référence rapide)

### APIs production (les plus stables)

- **API Adresse BAN** : https://api-adresse.data.gouv.fr (legacy) → https://data.geopf.fr/geocodage/search/ (nouveau)
- **API Sirene** : https://api.insee.fr/entreprises/sirene
- **API Recherche Entreprises** : https://recherche-entreprises.api.gouv.fr/docs/
- **API DPE Logements** : https://data.ademe.fr/datasets/dpe03existant (+API)
- **API Carto IGN** (cadastre, GPU) : https://apicarto.ign.fr/
- **API Géorisques** : https://www.georisques.gouv.fr/doc-api
- **API RNB** : https://rnb-api.beta.gouv.fr
- **API BDNB** : https://api-portail.bdnb.io
- **API Mes Aides Réno** : https://mesaides.france-renov.gouv.fr — doc : https://mesaidesreno.beta.gouv.fr/api-doc
- **API Professionnels RGE** : https://data.ademe.fr (dataset) + endpoint via data.gouv
- **API Annuaire Éducation** : https://data.education.gouv.fr/api/explore/v2.1/console
- **API Données Climato Météo-France** : https://donneespubliques.meteofrance.fr

### Catalogues

- Catalogue principal : https://api.gouv.fr/
- Catalogue datasets : https://www.data.gouv.fr/dataservices
- Guides développeur : https://guides.data.gouv.fr/
- Repo GitHub catalogue : https://github.com/betagouv/api.gouv.fr

---

## 9. Décision attendue

Benjamin → **choisir 2-3 APIs du Top 5 pour le prochain sprint** post-refonte acqui-target.

Recommandation Claude (synthèse exploration) :

1. **RNB + BDNB Open** (2j) — fondation incontournable, débloque tout le reste
2. **Mes Aides Réno** (1,5j) — différenciateur radical immédiat
3. **Géorisques étendu + Radon** (1j) — extension naturelle ERP existant

Total ~4,5j → 1 sprint léger entre 2 vagues refonte. ROI mesurable dès la première livraison sur les missions terrain.

Les pistes #4 (GPU) et #5 (Éducation + Sit@del2) restent dans le backlog comme **chantiers d'enrichissement Phase 2** quand on attaquera l'observatoire SEO commune.
