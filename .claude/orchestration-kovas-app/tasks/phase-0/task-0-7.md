# Task 0.7 : Acquisition fixtures Liciel + journal découverte GPG (M1-M3)

## Objective

Construire un corpus de 25-50 exports ZIP Liciel anonymisés couvrant 10 variantes critiques + setup repo Git séparé `kovas-discovery-log` avec commits GPG signés (defense strategy pour preuve juridique en cas de procès).

## Context

Le moment-clé qui sécurise toute la Phase 1 produit. Sans fixtures Liciel réels, impossible de valider le ZIP KOVAS au sprint MVP J12. Sans journal GPG signé, défense juridique fragile en cas d'attaque Liciel/Enersweet.

Approche hybride en 3 étapes du fondateur (D1001) : (1) démo Liciel gratuite + (2) 3 diagnostiqueurs LinkedIn + (3) licence Liciel 1 mois conditionnelle. Budget total 0-200€.

## Dependencies

- Task 0.1 (GitHub Nexus 1993 org créée)
- Task 0.5 (3 diagnostiqueurs partenaires identifiés via LinkedIn outreach)
- Task 0.8 (kovas-defense-strategy.md référencée, runbook prêt)

## Blocked By

- Task 0.5 ≥ 20 entretiens (pour identifier 3 partenaires fixtures non-concurrents géographiquement de Benjamin)

## Research Findings

- De `research/liciel-format.md` §1 + §7 : Liciel V4 démo gratuitement téléchargeable sur https://www.liciel.fr/telechargement-logiciel-page-new.html (étape 1 corpus)
- De `research/liciel-format.md` §3 : cadre légal **L122-6-1 §III CPI** + jurisprudence **CJUE SAS Institute c/ WPL** (format de fichiers de données NON protégé) — base légale du reverse-engineering
- De `kovas-defense-strategy.md` §2.1 : journal de découverte GPG = défense principale en cas de procès Liciel — preuve fichier par fichier que KOVAS n'a jamais touché code source/objet Liciel
- De `kovas-defense-strategy.md` §3 : interdits absolus — pas de désassembleur (Ghidra, IDA, dotPeek), pas d'ex-employé Liciel, pas de scraping WikiLiciel privé via compte tiers
- De `kovas-defense-strategy.md` §2.2 : licence Liciel achetée à Benjamin Bel + factures archivées + NDA + contrat 100-200€/diagnostiqueur

## Implementation Plan

### Step 1 : Setup repo `kovas-discovery-log` avec GPG signing (J0-J5)

#### Création repo séparé

- Sur GitHub Nexus 1993 org → New repository (private) → `kovas-discovery-log`
- **NE PAS confondre avec repo principal `kovas-app`** — repo séparé volontairement pour isolation juridique
- Clone localement : `~/Code/kovas-discovery-log/`

#### Configuration GPG signing (mandatory)

```bash
# Génération clé GPG dédiée Benjamin Bel
gpg --full-generate-key
# Choisir : RSA + RSA, 4096 bits, expire jamais
# Identité : Benjamin Bel <benjamin@kovas.fr>
# Passphrase forte (sauvegarder dans password manager)

# Exporter clé publique
gpg --armor --export benjamin@kovas.fr > ~/Code/kovas-discovery-log/benjamin-bel-gpg.pub

# Ajouter clé publique sur GitHub
gh ssh-key add  # OR https://github.com/settings/gpg/new

# Configurer git local pour signing automatique
cd ~/Code/kovas-discovery-log
git config commit.gpgsign true
git config user.signingkey <KEY_ID>
git config user.name "Benjamin Bel"
git config user.email "benjamin@kovas.fr"
```

#### Structure repo

```
kovas-discovery-log/
├── README.md (avec section "Cadre légal" citant L122-6-1 §III + SAS Institute)
├── timeline.md (chronologie horodatée de toute action)
├── licences/
│   ├── liciel-v4-demo-{date}.pdf (téléchargement démo + license terms)
│   └── liciel-licence-1-mois-{date}.pdf (si étape 3 activée)
├── factures/
│   ├── liciel-{date}.pdf (factures licence achetée)
│   └── diagnostiqueurs/
│       ├── diag-{prenom}-{nom}-{date}.pdf (factures prestation 100-200€)
├── contrats/
│   ├── diag-{prenom}-{nom}-NDA-{date}.pdf (NDA signés)
│   └── diag-{prenom}-{nom}-prestation-{date}.pdf (contrats prestation)
├── fixtures-raw/  ← AVANT anonymisation, .gitignore'd (pas commit)
│   └── liciel-export-{id}.zip
├── fixtures-anonymized/  ← APRÈS anonymisation, commités
│   └── liciel-export-{id}-anon.zip
├── scripts/
│   ├── anonymize-liciel-export.py
│   └── validate-no-pii.py
├── screencasts/
│   └── session-{date}-{topic}.mp4 (Loom/OBS, archivé hors repo, lien dans timeline.md)
└── observations/
    └── {date}-{topic}.md (observations format, structure ZIP, schéma .mdb)
```

#### README.md template

```markdown
# KOVAS Discovery Log

This private repository documents the timestamped observation, study, and testing
of Liciel Diagnostics V4 software, conducted under the legal framework of:

- **Article L122-6-1 §III** of the French Code de la Propriété Intellectuelle
  ("The user is authorized to observe, study, or test the functioning of a
  software in order to determine the ideas and principles underlying any element
  of the software")
- **CJEU SAS Institute v World Programming Ltd (2 May 2012, C-406/10)** —
  confirming that file formats are not protected by copyright

All observation activities are conducted on software acquired legitimately
(demo, paid license). No reverse engineering of source code or object code is
performed. Black-box observation only.

This log serves as evidentiary documentation in case of dispute. Every commit
is GPG-signed by Benjamin Bel (president, SASU Nexus 1993).

License of this repo: Private — internal documentation only.
Confidentiality: this repository must NEVER be made public.
```

### Step 2 : Étape 1 corpus — Démo Liciel V4 gratuite (Sprint 0-1, 0€)

#### Téléchargement légitime

```bash
# Visite manuelle (Benjamin) :
# https://www.liciel.fr/telechargement-logiciel-page-new.html
# Télécharger Liciel V4 démo Windows installer
# Archiver dans : ~/Code/kovas-discovery-log/licences/liciel-v4-demo-{date}.pdf
# (screenshot + sauvegarde license terms acceptés)
```

#### Installation sur VM Windows

- Setup VM Windows Server 2022 sur Hetzner CX21 (~10€/mo) ou local Parallels/VMware
- Installation Liciel V4 démo (Office 2010+ requis, prévoir Office 365 license ou LibreOffice si compatible — à valider)
- Activation démo : email Benjamin Bel → confirmation activation reçue
- **Test export ZIP** : créer 5-10 dossiers fictifs variant les modules (DPE vente, DPE location, audit, copro, etc.) et vérifier que "Fichier → Exporter format ZIP" fonctionne en mode démo

⚠️ **Risque** : si démo Liciel **n'autorise pas** l'export ZIP en mode non-activé, étape 3 (achat licence) devient obligatoire dès Sprint 0-1.

#### Analyse structure ZIP

Pour chaque export ZIP démo produit :

```bash
# Décompression
unzip liciel-export-demo-1.zip -d demo-1/

# Inspection structure
tree demo-1/

# Inspection .mdb avec mdbtools (read-only, autorisé L122-6-1 §III)
mdb-tables demo-1/LICIEL_Dossiers.mdb > observations/{date}-tables-list.txt
mdb-schema demo-1/LICIEL_Dossiers.mdb > observations/{date}-schema.sql
mdb-export demo-1/LICIEL_Dossiers.mdb tblDossiers > observations/{date}-tblDossiers.csv

# Documenter dans observations/{date}-structure-zip-demo.md
```

Commit avec GPG signing systematique :

```bash
git add observations/{date}-*
git commit -m "L122-6-1-III observation: inspect Liciel V4 demo export ZIP structure

Black-box observation of demo Liciel V4 export ZIP, downloaded legitimately.
No reverse engineering of source/object code. mdb-tools read-only used."
# Sera signé GPG automatiquement
```

### Step 3 : Étape 2 corpus — 3 diagnostiqueurs partenaires LinkedIn (Sprint 1-2, 0€)

#### Sélection 3 partenaires (post-Task 0.5)

Critères :
- Géographie : **hors Dieppe / Seine-Maritime / Eure / Somme** (pas de conflit local Benjamin)
- Profils variés : 1 urbain + 1 rural + 1 cabinet 2-3 personnes
- Cas d'usage variés : 1 spécialiste DPE vente + 1 mix DPE+amiante+plomb + 1 audit énergétique
- Disponibilité : ≥ 30 min échange + envoi 5-10 exports anonymisés

#### NDA + contrat prestation

`docs/legal/contrat-prestation-diagnostiqueur-template.md` :

- Parties : Nexus 1993 + Diagnostiqueur (personne physique)
- Mission : fournir 5-10 exports ZIP Liciel anonymisés de ses propres dossiers diagnostic
- Contrepartie : **100-200€/personne** (facture Nexus 1993) + accès gratuit bêta KOVAS 12 mois
- NDA : ne pas divulguer publiquement la participation au projet KOVAS (sauf accord écrit citation témoignage)
- **Garanties diagnostiqueur** : ses exports sont anonymisés AVANT envoi (par lui-même ou avec script KOVAS)
- Durée : one-shot (1 mois max pour livraison exports)
- Annulation : si export reçu mais qualité insuffisante (PII résiduelle), nouveau cycle anonymisation

Signature via DocuSeal.

#### Anonymisation systématique (côté diagnostiqueur OU côté KOVAS)

Script `scripts/anonymize-liciel-export.py` à fournir au diagnostiqueur (ou exécuter par Benjamin après réception) :

```python
import zipfile, sqlite3, re, json
from pathlib import Path
from faker import Faker

fake = Faker('fr_FR')

def anonymize_export(zip_path: Path, output_dir: Path):
    """Anonymize Liciel ZIP export: replace PII with synthetic values."""

    pii_mapping = {}  # original → fake mapping (for consistency within export)

    with zipfile.ZipFile(zip_path) as z:
        z.extractall(output_dir / "raw")

    # Anonymize .mdb tables (via mdbtools dump → modify → rebuild?)
    # OR via Jackcess Java microservice (preferred, write-capable)
    # For Phase 1: simple regex replacement on extracted CSV + XML

    # Anonymize XML files
    for xml_file in (output_dir / "raw").rglob("*.xml"):
        content = xml_file.read_text(encoding='cp1252')

        # Replace patterns: noms, adresses, emails, téléphones, SIRETs, n° ADEME
        content = anonymize_emails(content, pii_mapping)
        content = anonymize_phones(content, pii_mapping)
        content = anonymize_sirets(content, pii_mapping)
        content = anonymize_addresses(content, pii_mapping)
        content = anonymize_names(content, pii_mapping)
        content = anonymize_ademe_numbers(content, pii_mapping)

        xml_file.write_text(content, encoding='cp1252')

    # Anonymize photos: strip EXIF GPS + replace random pixels in faces if any
    for jpg_file in (output_dir / "raw").rglob("*.jpg"):
        strip_exif_gps(jpg_file)
        # Note: face anonymization deferred (rare in equipment photos)

    # Anonymize .mdb via Jackcess service
    # (TODO: implement with Java/Jackcess at Task 4.2)

    # Rebuild ZIP
    output_zip = output_dir / f"{zip_path.stem}-anon.zip"
    with zipfile.ZipFile(output_zip, 'w') as z:
        for f in (output_dir / "raw").rglob("*"):
            z.write(f, arcname=f.relative_to(output_dir / "raw"))

    return output_zip, pii_mapping
```

Validation post-anonymisation :

```bash
python scripts/validate-no-pii.py fixtures-anonymized/liciel-export-1-anon.zip
# Output: "✓ No PII detected" OR "✗ Detected: 3 phone numbers, 1 email"
```

Si PII résiduelle détectée : itération script + re-validation jusqu'à 0 résidu.

#### Réception + processing 3 × 5-10 exports

Cible volume : **15-30 exports anonymisés** au total via 3 diagnostiqueurs partenaires.

### Step 4 : Étape 3 corpus — Licence Liciel 1 mois CONDITIONNELLE (Sprint 6-7 si nécessaire, 120-200€)

**Déclenchée UNIQUEMENT si étapes 1+2 manquent variantes critiques** :

- Module audit énergétique
- Module DTG copropriété
- Cas extrêmes (grandes maisons multi-lots, copropriétés)

#### Achat licence

- Aller sur https://www.liciel.fr/ → contact commercial pour licence 1 mois découverte
- Souscription au nom **Benjamin Bel** (président Nexus 1993, paiement Qonto)
- Conserver facture dans `factures/liciel-{date}.pdf`
- License Liciel = base légale L122-6-1 §III ("lawful user")

#### Production exports manquants

- Installer Liciel sur VM Windows licence activée
- Créer dossiers couvrant variantes manquantes
- Export ZIP → anonymisation script → ajout corpus

### Step 5 : Test parser KOVAS sur corpus (validation, peut être différée Task 4.2)

Pour chaque export du corpus (25-50 total) :

```bash
# Read-only inspection (mdb-tools)
mdb-tables fixture.mdb
mdb-schema fixture.mdb > schemas/{id}-schema.sql

# Documenter dans observations/structure-comparative.md :
# - Champs communs entre exports
# - Variations selon type mission (DPE/audit/amiante)
# - Encoding (CP1252 confirmé sur 5 fixtures test)
```

### Step 6 : Documentation timeline complète

`timeline.md` mise à jour à chaque action :

```markdown
# Timeline KOVAS Discovery

## 2026-05-20 09:30 CEST — Setup repo
Repo created. GPG signing configured. README + structure ready.

## 2026-05-22 14:15 CEST — Étape 1 démo Liciel
Liciel V4 demo downloaded from https://www.liciel.fr/telechargement-logiciel-page-new.html.
License terms accepted (screenshot archived in licences/).
Installation Windows VM Hetzner OK.

## 2026-05-25 10:00 CEST — Étape 1 démo : 5 exports test
Created 5 fictional dossiers (DPE vente house, DPE vente apt, DPE location, audit, copro).
Exported via "Fichier → Exporter format ZIP" each.
mdb-tables read on all 5. Tables list documented in observations/2026-05-25-tables-demo.md.

## 2026-06-03 16:20 CEST — Étape 2 diag 1 : Jean Dupont (Marseille)
Contrat prestation signé via DocuSeal (archivé contrats/).
NDA signed. Facture 150€ émise Nexus 1993.
Awaiting exports anonymized.

## 2026-06-10 11:00 CEST — Étape 2 diag 1 : 6 exports reçus
6 ZIP files received, anonymized by diag himself.
Validation script: 0 PII detected on 5/6 (1 had residual phone, re-anonymized).
Total corpus: 11 fixtures (5 demo + 6 diag 1).

## ... (continuer pour chaque action)
```

## Files to Create

Dans repo **`kovas-discovery-log`** (séparé, GPG signing required) :

- `README.md` (cadre légal L122-6-1 + SAS Institute)
- `timeline.md` (chronologie horodatée)
- `scripts/anonymize-liciel-export.py`
- `scripts/validate-no-pii.py`
- `licences/liciel-v4-demo-{date}.pdf`
- `contrats/diag-{n}-NDA-{date}.pdf`, `contrats/diag-{n}-prestation-{date}.pdf`
- `factures/liciel-{date}.pdf`, `factures/diagnostiqueurs/diag-{n}-{date}.pdf`
- `fixtures-anonymized/` (25-50 ZIP)
- `observations/{date}-*.md` (notes structurées)

Dans repo principal **`kovas-app`** :

- `docs/legal/contrat-prestation-diagnostiqueur-template.md`

## Files to Modify

- `.gitignore` (kovas-discovery-log/) : exclure `fixtures-raw/`, `screencasts/`, clé GPG privée

## Contracts

### Provides (for downstream tasks)

- **Corpus 25-50 exports Liciel anonymisés** : base de tests pour Task 4.2 (Export ZIP Liciel + tests)
- **Journal GPG signé** : preuve juridique défense Liciel
- **Schémas .mdb documentés** : input pour `packages/liciel-bridge/schema/liciel-schema.json` (Task 4.2)

## Acceptance Criteria

- [ ] Repo `kovas-discovery-log` créé, GPG signing testé (`git commit -S` réussi)
- [ ] Démo Liciel V4 téléchargée légitimement par Benjamin (étape 1) + 5-10 fixtures produits
- [ ] 3 diagnostiqueurs partenaires sous NDA + contrat prestation 100-200€/personne signés
- [ ] 25-50 exports ZIP Liciel anonymisés collectés couvrant 10 variantes critiques
- [ ] Script anonymisation versionné + tests sur 5 cas (0 PII résiduel)
- [ ] Licence Liciel 1 mois conditionnelle (étape 3) achetée par Benjamin Bel SI étapes 1+2 manquent variantes
- [ ] Timeline horodatée complète dans `timeline.md`
- [ ] Tous commits GPG signés (`git log --show-signature` confirme)

## Testing Protocol

### Validation corpus

- Pour chaque export : `mdb-schema` + `mdb-tables` + `mdb-export` réussissent sans erreur
- Script anonymisation : 0 PII résiduelle détectable (test sur 5 cas variés)
- Coverage 10 variantes critiques (cf. CLAUDE.md §3 D1001) :
  - [ ] DPE 2020 maison individuelle
  - [ ] DPE 2020 appartement
  - [ ] DPE immeuble complet
  - [ ] Amiante avant-vente
  - [ ] CREP (Plomb)
  - [ ] Carrez/Boutin
  - [ ] Gaz + Électricité
  - [ ] ERP
  - [ ] Termites
  - [ ] Mission combinée vente complète (DPE + amiante + plomb + gaz + élec + ERP + Carrez)

### Validation GPG

```bash
git log --show-signature
# Tous commits doivent afficher "Good signature from Benjamin Bel"
```

### Validation légale

- Vérifier que toutes actions sont conformes L122-6-1 §III (observation/étude only)
- Vérifier ABSENCE de désassembleur (Ghidra/IDA/dotPeek/dnSpy) dans historique browser/téléchargements
- Confirmer que licence Liciel (démo + payée si étape 3) est au nom Benjamin Bel (lawful user)

## Skills to Read

- `kovas-liciel-bridge` (préparation Task 4.2)
- `kovas-defense-strategy` (interdits absolus + GPG signing)

## Research Files to Read

- `research/liciel-format.md` §1-3, §7 (architecture Liciel + cadre légal + stratégie acquisition)
- `kovas-defense-strategy.md` complet (notamment §2.1 journal GPG + §3 interdits)

## Git

- Branch principal `kovas-app` repo : `feature/0-7-corpus-liciel-defense`
- Repo séparé `kovas-discovery-log` : commits directs sur `main` (privé, pas de PR review nécessaire car solo)
- Commit message prefix repo principal : `Task 0.7:`
- Commit message prefix repo discovery-log : `L122-6-1-III observation:` ou `L122-6-1-III testing:` ou `Acquisition:` (selon nature)

## Notes anti-pattern

- ⛔ **JAMAIS** de désassembleur (Ghidra, IDA, dotPeek, dnSpy) sur Liciel.exe — sort du périmètre L122-6-1 §III
- ⛔ Ne PAS utiliser compte d'un partenaire pour scraper WikiLiciel privé (délit pénal séparé)
- ⛔ Ne PAS embaucher / consulter ex-employé Liciel (concurrence déloyale automatique)
- ⛔ Ne PAS skipper l'anonymisation avant commit (RGPD violation + perte argument défense)
- ⛔ Ne PAS oublier GPG signing sur chaque commit (perte argument preuve juridique)
- ⛔ Ne PAS rendre public le repo `kovas-discovery-log` (perte secret défense + risque RGPD si fuite)
- ⛔ Ne PAS skipper le contrat + NDA + facture pour les diagnostiqueurs partenaires (zone grise juridique)
- ⛔ Ne PAS commiter clé GPG privée dans le repo (catastrophe sécurité)
