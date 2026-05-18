# Convention de nommage des fichiers KOVAS

> **Objectif** : un fichier doit être auto-descriptif. Le diagnostiqueur retrouve n'importe quel fichier en 10 secondes via le nom seul.
> **Gain temps estimé** : 30-60 heures économisées par an et par utilisateur.
> **Implémentation** : [`apps/web/src/lib/file-naming.ts`](../apps/web/src/lib/file-naming.ts).
> **À jour** : 2026-05-18

---

## 1. Structure générale

```
[DATE]_[TYPE]_[CLIENT]_[ADRESSE]_[REF].[ext]
```

Tous les fichiers respectent **5 questions** auxquelles le nom répond :

| Question | Segment | Exemple |
|---|---|---|
| Quand ? | `[DATE]` | `2026-05-18` (ISO 8601) |
| Quoi ? | `[TYPE]` | `DPE`, `AMIANTE`, `LICIEL-EXPORT` |
| Qui ? | `[CLIENT]` | `DUPONT-Pierre` |
| Où ? | `[ADRESSE]` | `12-rue-Republique-Paris` |
| Quelle mission ? | `[REF]` | `MIS-2026-00143` ou `DOS-2026-00042` |

---

## 2. Règles strictes

### Date ISO 8601 (YYYY-MM-DD)
Tri chronologique correct sur tous les systèmes (Windows, macOS, Drive, Dropbox). Pas d'ambiguïté FR/US.

```
✓  2026-05-18_DPE_...        (tri parfait)
✗  18-05-2026_DPE_...        (mélange dates)
✗  18/05/2026_DPE_...        (caractère / interdit Windows)
```

### Type de diagnostic en MAJUSCULES

| Mission type | Tag fichier |
|---|---|
| `dpe_vente` | `DPE` |
| `dpe_location` | `DPE-LOC` |
| `copropriete` | `DPE-COPRO` |
| `amiante_vente` | `AMIANTE` |
| `amiante_avant_travaux` | `AMIANTE-AT` |
| `plomb_crep` | `PLOMB` |
| `gaz` | `GAZ` |
| `electricite` | `ELEC` |
| `termites` | `TERMITES` |
| `carrez_boutin` | `CARREZ` |
| `erp` | `ERP` |

### Client : NOM-Prenom (tirets, pas espaces)

```
✓  DUPONT-Pierre              (nom en MAJ, prénom en CamelCase)
✗  Dupont Pierre              (espace casse les URLs/liens)
✗  DUPONT_Pierre              (underscore moins lisible)
```

### Adresse : tirets, pas d'accents, abréviations

```
✓  12-rue-Republique-Paris
✗  12 rue de la République, Paris  (accents, espaces, virgules)
```

**Abréviations automatiques** (pour rester ≤ 60 caractères) :

| Plein | Abrégé |
|---|---|
| boulevard | bd |
| avenue | av |
| place | pl |
| impasse | imp |
| résidence | res |
| appartement | appt |
| lotissement | lot |
| chemin | ch |
| allée | all |
| square | sq |
| passage | pas |
| faubourg | fbg |

### Référence KOVAS

Format `[TYPE]-[ANNÉE]-[NNNNN]` :
- `MIS-2026-00143` — mission individuelle (1 diagnostic)
- `DOS-2026-00042` — dossier (1 visite = N diagnostics)
- `FAC-2026-00007` — facture (Phase 2)
- `DEV-2026-00012` — devis (Phase 2)

Reset chaque 1er janvier. Format 5 chiffres permet 99 999 par an.

### Caractères interdits
- Espaces (utiliser tirets)
- Accents (slugification NFD)
- `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` (incompatibles Windows)
- `'`, `"`, `&`, `;`, `#` (problèmes URLs)

### Longueur max : 100 caractères
- Windows : limite 260 chars pour chemin complet → marge confortable
- macOS / Linux : 255 chars → idem

---

## 3. Cas d'usage

### Rapport de diagnostic

```
2026-05-18_DPE_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00143.pdf
2026-05-18_AMIANTE_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00144.pdf
2026-05-18_PLOMB_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00145.pdf
```

### Export universel KOVAS (PDF + Word + CSV + JSON + photos)

```
2026-05-18_KOVAS-EXPORT_DUPONT-Pierre_MIS-2026-00143.zip
```

### Export ZIP Liciel

```
2026-05-18_LICIEL-EXPORT_DUPONT-Pierre_DOS-2026-00042.zip
```

### Photo de pièce

```
[DATE]_PIECE-[NUM]-[NOM]_[NUM-PHOTO]_[VUE]_[REF].webp
```

```
2026-05-18_PIECE-01-Salon_001_VUE-GENERALE_DOS-2026-00042.webp
2026-05-18_PIECE-01-Salon_002_FENETRE-OUEST_DOS-2026-00042.webp
2026-05-18_PIECE-01-Salon_003_RADIATEUR_DOS-2026-00042.webp
2026-05-18_PIECE-02-Cuisine_001_VUE-GENERALE_DOS-2026-00042.webp
2026-05-18_PIECE-02-Cuisine_002_CHAUDIERE-FRISQUET_DOS-2026-00042.webp
```

**Types de vue prédéfinis** :
- `VUE-GENERALE`
- `FENETRE-NORD` / `FENETRE-SUD` / `FENETRE-EST` / `FENETRE-OUEST`
- `PORTE-ENTREE` / `PORTE-INTERIEURE`
- `MUR` / `PLAFOND` / `SOL`
- `RADIATEUR` / `CHAUDIERE` / `CHAUFFE-EAU`
- `TABLEAU-ELECTRIQUE` / `PRISE` / `INTERRUPTEUR`
- `PLAQUE-SIGNALETIQUE`
- `ISOLATION` / `VMC` / `HOTTE`
- `ANOMALIE-DESORDRE`
- `DETAIL` (saisie libre via voix)

### Document client uploadé

```
2026-05-18_FACTURE-EDF_DUPONT.pdf
2026-05-18_ANCIEN-DPE_DUPONT.pdf
```

### Dossier de stockage

```
DOS-2026-00042_DUPONT-Pierre_Paris/
  ├── 2026-05-18_DPE_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00143.pdf
  ├── 2026-05-18_AMIANTE_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00144.pdf
  ├── 2026-05-18_LICIEL-EXPORT_DUPONT-Pierre_DOS-2026-00042.zip
  ├── photos/
  │   └── 2026-05-18_PIECE-01-Salon_001_VUE-GENERALE_DOS-2026-00042.webp
  └── documents-client/
      └── 2026-05-18_FACTURE-EDF_DUPONT.pdf
```

---

## 4. API JS

### Slugify

```ts
import { slugify, slugifyAddress, slugifyClientName } from '@/lib/file-naming'

slugify("Dupont Pierre")
// → "Dupont-Pierre"

slugifyAddress("12 boulevard du Maréchal de Lattre, 76200 Dieppe")
// → "12-bd-du-marechal-de-lattre-76200-dieppe"

slugifyClientName("Dupont Pierre")
// → "DUPONT-Pierre"
```

### Constructeurs de noms

```ts
import { buildReportFileName, buildZipFileName, buildPhotoFileName } from '@/lib/file-naming'

// Rapport PDF
buildReportFileName({
  ctx: {
    date: '2026-05-18',
    reference: 'MIS-2026-00143',
    client: { display_name: 'Dupont Pierre' },
    property: {
      address: '12 rue de la République',
      city: 'Paris',
      apartment_detail: 'Apt 12B',
      building_letter: 'B',
    },
  },
  missionType: 'dpe_vente',
  ext: 'pdf',
})
// → "2026-05-18_DPE_DUPONT-Pierre_12-rue-de-la-republique-b-apt-12b-paris_MIS-2026-00143.pdf"

// ZIP Liciel
buildZipFileName({
  ctx: { date: '2026-05-18', reference: 'DOS-2026-00042', client: { display_name: 'Dupont Pierre' } },
  target: 'LICIEL',
})
// → "2026-05-18_LICIEL-EXPORT_DUPONT-Pierre_DOS-2026-00042.zip"

// Photo
buildPhotoFileName({
  date: '2026-05-18',
  reference: 'DOS-2026-00042',
  roomIndex: 1,
  roomName: 'Salon',
  photoIndex: 3,
  viewType: 'RADIATEUR',
})
// → "2026-05-18_PIECE-01-Salon_003_RADIATEUR_DOS-2026-00042.webp"
```

---

## 5. UI : où les noms apparaissent

**Dans l'app KOVAS** : noms longs **invisibles**. L'utilisateur voit des libellés courts :
```
📄 Rapport DPE
📦 Export Liciel
🖼 47 photos (24 salon, 12 cuisine, 11 autres)
```

**Hors app** (téléchargement, partage, archive) : noms longs **descriptifs** :
```
2026-05-18_DPE_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00143.pdf
```

Le diag retrouve le fichier dans son finder/explorer sans ouvrir KOVAS.

---

## 6. Recherche full-text (V1.5)

Les `file_name` sont indexés en GIN full-text PostgreSQL :

```sql
CREATE INDEX idx_files_name_search ON mission_files
  USING gin(to_tsvector('french', file_name));
```

L'utilisateur cherche `"Dupont chaudière"` → match instantané sur tous les fichiers qui contiennent ces mots dans leur nom.

---

## 7. Roadmap implémentation

| Phase | Statut | Item |
|---|---|---|
| V1 | ✅ | `lib/file-naming.ts` (slugify + constructeurs) |
| V1 | ✅ | Application aux exports ZIP (universel + Liciel) |
| V1 | ✅ | Référence DOS/MIS embarquée dans les exports |
| V1.5 | ⏳ | Photo naming convention à la création (storage path) |
| V1.5 | ⏳ | Index GIN full-text sur file_name |
| V1.5 | ⏳ | Barre de recherche globale sur file_name |
| V2 | ⏳ | Migration des fichiers legacy (mass rename) |
