# Spécifications parser Liciel — Export ZIP natif

> **Périmètre** : génération d'un ZIP Liciel importable nativement depuis une mission KOVAS.
> **Source** : WikiLiciel (documentation officielle), reverse-engineering de fixtures anonymisées.
> **Cadre légal** : Art. L122-6-1 III CPI + jurisprudence CJUE SAS Institute c/ WPL (2012) — format de fichiers non protégé. Cf. [`.claude/orchestration-kovas-app/kovas-defense-strategy.md`](../.claude/orchestration-kovas-app/kovas-defense-strategy.md).
> **À jour** : 2026-05-18

---

## 1. Vue d'ensemble

Liciel utilise **8 000+ champs** au total dans son schéma. Pour un DPE complet, **150-300 champs** sont effectivement remplis par mission. KOVAS doit générer un ZIP contenant l'ensemble des champs critiques pour que Liciel puisse importer la mission sans erreur ni perte de données.

### Structure ZIP cible

```
LICIEL_dossier_[REF].zip                    # 15-30 MB typique
├── LICIEL_Dossiers.mdb                     # Base Microsoft Access (500 KB - 2 MB)
├── XML/
│   ├── LIV_donnees.xml                     # Données principales
│   ├── LIV_administratif.xml               # Donneur d'ordre, propriétaire
│   ├── LIV_DPE.xml                         # Spécifique DPE
│   ├── LIV_amiante.xml                     # Spécifique amiante
│   ├── LIV_plomb.xml                       # Spécifique plomb
│   ├── LIV_gaz.xml
│   ├── LIV_electricite.xml
│   ├── LIV_termites.xml
│   ├── LIV_carrez.xml
│   └── LIV_erp.xml
├── Photos/
│   ├── PIECE_001/photo_001.jpg
│   ├── PIECE_001/photo_002.jpg
│   ├── PIECE_002/photo_001.jpg
│   └── ...
├── Rapports/
│   ├── DPE_[REF].pdf                       # Optionnel (Liciel régénère)
│   └── ...
└── Annexes/
    ├── facture_energie.pdf
    ├── plan.pdf
    └── ...
```

---

## 2. Champs critiques par catégorie (DPE complet)

### A. Identité du bien (15-20 champs)

| Champ KOVAS | Champ Liciel | Type | Obligatoire |
|---|---|---|---|
| `properties.address` | `LIV_DPE.adresse_complete` | text | ✅ |
| `properties.postal_code` | `LIV_DPE.code_postal` | varchar(10) | ✅ |
| `properties.city` | `LIV_DPE.ville` | varchar(120) | ✅ |
| `properties.location` (lng,lat) | `LIV_DPE.gps_longitude` + `LIV_DPE.gps_latitude` | decimal | ⚠️ |
| `properties.cadastre_section` | `LIV_DPE.cadastre_section` | varchar(10) | ⚠️ |
| `properties.cadastre_number` | `LIV_DPE.cadastre_numero` | varchar(10) | ⚠️ |
| `properties.cadastre_prefix` | `LIV_DPE.cadastre_prefixe` | varchar(10) | ⚠️ |
| `properties.property_type` | `LIV_DPE.type_batiment` | enum | ✅ |
| `properties.year_built` | `LIV_DPE.annee_construction` | int | ✅ |
| dérivé de `year_built` | `LIV_DPE.periode_construction` | enum 5 valeurs ADEME | ✅ |
| `properties.surface_carrez` | `LIV_DPE.surface_carrez` | decimal | ⚠️ |
| `properties.surface_total` | `LIV_DPE.surface_habitable` | decimal | ✅ |
| `properties.surface_total` | `LIV_DPE.surface_au_sol` | decimal | ✅ |
| `properties.floors` | `LIV_DPE.niveaux_count` | int | ⚠️ |
| À calculer | `LIV_DPE.hauteur_sous_plafond_moyenne` | decimal | ⚠️ |
| À ajouter | `LIV_DPE.orientation_principale` | enum N/S/E/O | ⚠️ |

**Périodes construction ADEME (`LIV_DPE.periode_construction`)** :
- `avant_1948`
- `1949_1974`
- `1975_1988`
- `1989_2000`
- `apres_2001`

### B. Propriétaire et donneur d'ordre (10-15 champs)

| Champ KOVAS | Champ Liciel | Obligatoire |
|---|---|---|
| `clients` (jointure `properties.client_id` ou `missions.client_id`) | `LIV_administratif.proprietaire_*` | ✅ |
| `clients.first_name` + `clients.last_name` | `nom_prenom` | ✅ |
| `clients.address` | `adresse` | ✅ |
| `clients.phone` | `telephone` | ⚠️ |
| `clients.email` | `email` | ⚠️ |
| Donneur d'ordre (si ≠ propriétaire) | `LIV_administratif.donneur_ordre_*` | ⚠️ |
| Agent immobilier (optionnel) | `LIV_administratif.agent_*` | ⚠️ |

### C. Type de mission DPE (5-8 champs)

| Champ KOVAS | Champ Liciel | Valeurs |
|---|---|---|
| `missions.type` | `LIV_DPE.type_mission` | `vente` / `location` / `neuf` |
| Fixe | `LIV_DPE.methode_calcul` | `3CL-2021` |
| `missions.completed_at` | `LIV_DPE.date_visite` | date |
| Calculé (+10 ans) | `LIV_DPE.date_fin_validite` | date |
| À ajouter | `LIV_DPE.nombre_occupants` | int |
| À ajouter | `LIV_DPE.mode_occupation` | `proprietaire` / `locataire` / `vacant` |

### D. Enveloppe (30-80 champs selon complexité)

**Murs** (5-10 champs par paroi) :
```
LIV_DPE.parois_murs[]:
  - type ('exterieur' | 'mitoyen' | 'donne_sur_local_non_chauffe')
  - materiau ('beton' | 'parpaing' | 'brique' | 'pierre' | 'pan_bois' | 'autre')
  - epaisseur_cm: decimal
  - isolation_type ('ITE' | 'ITI' | 'aucune' | 'inconnue')
  - isolation_epaisseur_cm: decimal
  - isolation_lambda: decimal
  - surface_m2: decimal
  - orientation: enum N/S/E/O
```

**Toiture** (5-8 champs) :
```
LIV_DPE.toiture:
  - type ('combles_amenages' | 'combles_perdus' | 'toit_terrasse')
  - materiau_couverture
  - isolation_type, isolation_epaisseur_cm, isolation_lambda
  - surface_m2
```

**Planchers** (5-10 champs par plancher) :
```
LIV_DPE.planchers[]:
  - position ('bas_sur_cave' | 'bas_sur_vide_sanitaire' | 'bas_sur_terre_plein' | 'haut_sur_combles')
  - materiau
  - isolation_type, isolation_epaisseur_cm
  - surface_m2
```

**Menuiseries** (10-30 champs total) :
```
LIV_DPE.menuiseries[]:
  - type ('fenetre' | 'porte_fenetre' | 'porte')
  - materiau ('PVC' | 'bois' | 'aluminium' | 'mixte')
  - vitrage ('simple' | 'double_air' | 'double_argon' | 'triple')
  - surface_m2
  - orientation
  - volets ('roulants' | 'battants' | 'persiennes' | 'aucun')
  - etancheite_air ('bonne' | 'moyenne' | 'mauvaise')
```

### E. Équipements (30-50 champs)

**Chauffage** (10-15 champs) — *table KOVAS `equipment_findings` avec `kind='chaudiere'`* :
```
LIV_DPE.chauffage:
  - type ('individuel' | 'collectif' | 'mixte')
  - generateur_principal ('chaudiere_gaz' | 'chaudiere_fioul' | 'PAC_air_air' | 'PAC_air_eau' | 'electrique_direct' | 'electrique_accumulation' | 'bois' | 'reseau_chaleur')
  - marque, modele, annee_installation
  - puissance_kW
  - rendement_nominal
  - distribution ('eau_chaude' | 'air_pulse' | 'rayonnement')
  - regulation ('thermostat_central' | 'sonde_exterieure' | 'aucune')
  - emetteurs[] : 'radiateurs' | 'plancher_chauffant' | 'soufflage' (avec surface)
```

**ECS** (5-10 champs) :
```
LIV_DPE.ecs:
  - type ('individuel' | 'collectif')
  - generateur ('chaudiere_mixte' | 'ballon_electrique' | 'ballon_thermodynamique' | 'solaire')
  - marque, modele, annee
  - capacite_litres
  - energie
```

**Ventilation** (3-5 champs) :
```
LIV_DPE.ventilation:
  - type ('VMC_simple_flux_hygro_A' | 'VMC_simple_flux_hygro_B' | 'VMC_double_flux' | 'naturelle' | 'aucune')
  - marque, modele
  - debit_m3_h
```

**Climatisation** (5-8 champs, si présente) :
```
LIV_DPE.climatisation:
  - type ('split' | 'multi_split' | 'reversible' | 'centrale')
  - marque, modele, puissance_kW
  - SEER, SCOP
```

### F. Consommations (5-15 champs)

```
LIV_DPE.consommations:
  - annee_n_1, n_2, n_3 (3 dernières années)
  - energie_kWh_an, gaz_kWh_an, fioul_kWh_an
  - factures_fournies: bool
  - mode_calcul ('factures_reelles' | 'methode_3CL' | 'mixte')
```

### G. Recommandations (50-100 champs, surtout DPE F/G)

```
LIV_DPE.recommandations:
  - scenarios[]: array de 3 scénarios travaux
    - description
    - cout_min_eur, cout_max_eur
    - economie_annuelle_eur
    - temps_retour_annees
    - amelioration_lettre (A/B/C/D)
  - aides_eligibles[]:
    - nom ('MaPrimeRénov''' | 'CEE' | 'TVA_5_5' | 'eco_PTZ')
    - montant_estime
```

> ⚠️ **Pour KOVAS V1**, on génère les scénarios via Claude Sonnet 4.6 en Phase 2 (M10+). En V1, on permet la saisie manuelle des recommandations par le diagnostiqueur.

### H. Annexes (variables)

Photos liées aux pièces — *table KOVAS `photos` avec FK `mission_rooms`* :
```
Photos/
  PIECE_[room_id_court]/
    photo_001.jpg
    photo_002.jpg
```

Le ZIP doit conserver le mapping pièce → photo. Dans `LIV_DPE.xml` :
```xml
<pieces>
  <piece id="PIECE_001" nom="Salon" surface="35.5">
    <photos>
      <photo file="Photos/PIECE_001/photo_001.jpg" tag="cheminée"/>
      <photo file="Photos/PIECE_001/photo_002.jpg" tag="fenêtre sud"/>
    </photos>
  </piece>
</pieces>
```

---

## 3. Champs custom donneur d'ordre (26 champs paramétrables)

Liciel permet 26 champs personnalisés par mission, configurables par donneur d'ordre (notaires, syndics, grandes agences).

**Schéma KOVAS** : table `client_custom_fields` (à créer en V1.5)
```sql
CREATE TABLE client_custom_fields (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  field_key text NOT NULL,        -- ex: 'reference_notaire', 'numero_lot'
  field_label text NOT NULL,      -- ex: 'Référence dossier notaire'
  field_type text NOT NULL,       -- 'text' | 'number' | 'date' | 'boolean'
  display_order int NOT NULL,
  required boolean DEFAULT false
);

CREATE TABLE mission_custom_values (
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value text,
  PRIMARY KEY (mission_id, field_key)
);
```

Export ZIP : un noeud `<custom_fields>` dans `LIV_administratif.xml`.

---

## 4. MDB Writer Java/Jackcess

La base `LICIEL_Dossiers.mdb` est un format **Microsoft Access** (.mdb), pas directement écrivable depuis Node.js. Solution : **microservice Java/Jackcess** sur Railway.

**Endpoint** :
```
POST https://mdb-writer.railway.app/generate
Authorization: Bearer <MDB_WRITER_API_KEY>
Content-Type: application/json

{
  "mission_id": "uuid",
  "data": { /* tout le payload structuré */ }
}

Response: binary .mdb file (or signed URL)
```

**Stack microservice** :
- Java 21 + Spring Boot 3
- Jackcess 4.0+ (Apache OpenJackcess)
- Déployé Railway eu-west (Frankfurt fallback)
- Dockerfile dans [services/mdb-writer/](../services/mdb-writer/)

**Flow KOVAS** :
1. User clique "Partager vers Liciel" sur une mission
2. Edge Function Supabase `build-liciel-zip` :
   - Récupère mission + property + client + photos + rooms + equipment_findings
   - Construit les XML (Node.js `fast-xml-parser` ou `xmlbuilder2`)
   - Appelle MDB Writer Railway → récupère .mdb
   - Zip le tout (Node.js `archiver` ou Deno `zip`)
   - Upload Supabase Storage avec URL signée
3. Retourne URL signée au client → email / GDrive / DL direct

---

## 5. Tests obligatoires (cf. [`testing-protocol.md`](./testing-protocol.md))

25 cas de test avant launch :
- Taux import réussi cible **> 99%**
- Variation classification DPE vs saisie native Liciel : **< 1%**
- Photos correctement liées aux pièces : **100%**
- Temps moyen import : **< 1 minute** (cf. [`risk-management.md`](./risk-management.md) §1)

---

## 6. Roadmap implémentation

| Sprint | Livrable |
|---|---|
| **J11** | Stub MDB Writer Railway + 1er XML LIV_donnees minimal + tests sur 1 DPE |
| **J12** | XML complets (8 diagnostics) + photos taggées + ZIP final + tests 25 cas |
| **Post-launch S3** | Champs custom donneur d'ordre (table SQL + UI templates) |
| **Phase 2** | Recommandations DPE auto via Claude Sonnet |

---

## 7. Références

- WikiLiciel : https://wiki.liciel.fr (consulter pour champs détaillés)
- Schéma DPE 3CL-2021 ADEME : décret 2021-822
- Jackcess (Java) : https://jackcess.sourceforge.io
