# Logos des éditeurs logiciels métier diagnostic immobilier

Manifest des 8 logos cibles pour la grille « Compagnon de votre logiciel actuel » sur la landing KOVAS (composant `apps/web/src/components/landing/CompatGrid.tsx`).

Date de collecte initiale : 2026-05-20
Date refonte identité visuelle propre (7 logos non-Liciel) : 2026-05-28

---

## État actuel — 8 logos SVG avec identité visuelle propre

Pivot 2026-05-28 : abandon de la stratégie "wordmark KOVAS uniforme" pour les 7 logos non-Liciel. Désormais chaque logo a sa propre couleur et son propre traitement typographique, soit récupéré des sources officielles, soit retracé fidèlement à partir d'observation visuelle des originaux, soit créé en wordmark stylé distinctif quand aucune source officielle exploitable n'existe.

| # | Logiciel | Fichier | Couleur principale | Méthode |
|---|----------|---------|-------------------:|---------|
| 1 | **LICIEL** | `liciel-logo.svg` | `#E84242` rouge | SVG officiel (inchangé) |
| 2 | **AnalysImmo** | `analysimmo-logo.svg` | `#F39C1F` orange + `#1F3A6E` navy | Retracé fidèle (PNG officiel observé) |
| 3 | **WinDiagnostics (OBBC)** | `windiagnostics-logo.svg` | `#E84E2A` orange + `#1B3A6E` navy | Retracé fidèle (PNG officiel OBBC observé) |
| 4 | **GestionDiag** | `gestiondiag-logo.svg` | `#0F0F0F` noir + `#F7931E` orange (renard) | Retracé fidèle (PNG officiel observé) |
| 5 | **Im'Diag** | `imdiag-logo.svg` | `#1F2937` charcoal + `#9D174D` magenta accent | Wordmark stylé créé (aucune source) |
| 6 | **ORIS** | `oris-logo.svg` | `#334155` slate + `#0EA5E9` cyan accent | Wordmark stylé créé (aucune source univoque) |
| 7 | **Argos** | `argos-logo.svg` | `#1F2A2A` charcoal + dégradé vert `#3DD68C → #1A6E50` | Retracé fidèle (AVIF officiel observé) |
| 8 | **DPEWin** | `dpewin-logo.svg` | `#1E40AF` bleu Perrenoud + `#16A34A` vert (éclair énergie) | Wordmark stylé créé (DPEWin = produit boîte, pas de wordmark autonome trouvé) |

---

## Détail par logo

### 1. LICIEL — `liciel-logo.svg` (inchangé)
- **Source** : SVG officiel récupéré sur https://www.liciel.fr/images_fr/logo/logo_liciel.svg
- **Format source** : SVG natif (738×220, viewBox propre, 10 Ko)
- **Couleur** : `#E84242` rouge officiel
- **Statut** : aucune modification. Préservation intégrité marque (CPI L.713-3 strict).
- **Récupération** : 2026-05-20

### 2. AnalysImmo — `analysimmo-logo.svg`
- **Source** : https://www.atlibitum.com/wp-content/uploads/logo_Analysimmo_bleuetorange-300x72.png (PNG basse résolution officiel)
- **Format source** : PNG observé visuellement → SVG retracé
- **Description observée** : icône à gauche (deux livres empilés bleu marine + un livre/dossier ouvert orange par-dessus) + wordmark "Analys" en orange + "immo" en bleu marine, italique bold sans-serif
- **Couleurs identifiées** : `#F39C1F` (orange Analys + livre orange) + `#1F3A6E` (navy "immo" + livres bleus)
- **Note fidélité** : reproduction approximative — couleurs et structure conservées, glyphes des livres simplifiés (la version vectorisée originale n'est pas accessible publiquement)
- **Création** : 2026-05-28

### 3. WinDiagnostics (OBBC) — `windiagnostics-logo.svg`
- **Source** : https://obbc.fr/wp-content/uploads/2019/09/obbc-crea-3.png (PNG officiel OBBC Développement)
- **Format source** : PNG observé visuellement → SVG retracé
- **Description observée** : "O" remplacé par un triangle équilatéral pointe en haut (silhouette emblématique OBBC), suivi de "BBC" en lettres épaisses orange corail. Sous-titre "DÉVELOPPEMENT" en bleu marine fin et espacé en-dessous.
- **Adaptation** : sous-titre "WINDIAGNOSTICS" substitué à "DÉVELOPPEMENT" pour refléter le nom produit (la grille KOVAS référence WinDiagnostics, pas la maison-mère OBBC). C'est cohérent avec la nomenclature commerciale OBBC.
- **Couleurs identifiées** : `#E84E2A` orange corail + `#1B3A6E` bleu marine
- **Note** : note.fr "windiagnostics.fr" lui-même est inaccessible — OBBC porte la marque produit
- **Création** : 2026-05-28

### 4. GestionDiag — `gestiondiag-logo.svg`
- **Source** : https://gestiondiag.fr/wp-content/uploads/2022/02/Copy-of-Copy-of-Unnamed-Design-2.png (PNG Canva exporté)
- **Format source** : PNG observé visuellement → SVG retracé
- **Description observée** : à gauche, icône d'un renard stylisé géométrique (oreilles + tête + tache poitrine gris clair) en orange/jaune ; à droite, wordmark "GestionDiag" en noir, sans-serif extrêmement bold (style Inter/Manrope ExtraBold), G et D en capitales.
- **Couleurs identifiées** : `#F7931E` orange (renard) + `#0F0F0F` noir (texte)
- **Note fidélité** : renard simplifié (géométrie 4 segments — corps + 2 oreilles + tache claire), nettement reconnaissable mais pas fidèle au pixel. Reproduction d'idée graphique, pas du tracé exact.
- **Création** : 2026-05-28

### 5. Im'Diag — `imdiag-logo.svg` (wordmark créé)
- **Source** : aucune. Aucun éditeur public "Im'Diag" identifié malgré recherches multiples. Hypothèse : nom commercial alternatif ou distribution restreinte.
- **Format source** : wordmark stylé créé ex-nihilo
- **Description créée** : wordmark "Im'Diag" en sans-serif bold compressed charcoal `#1F2937`, apostrophe accentuée en magenta `#9D174D` (rappel typographique discret), petite barre d'accent magenta de 48px sous "Diag"
- **Couleur principale** : `#9D174D` magenta sobre (couleur d'accent demandée parmi la palette autorisée)
- **Justification** : aucune marque verbale Im'Diag identifiable comme protégée → reproduction nominative en typographie neutre = citation factuelle (L.713-3 CPI, pas de risque)
- **Création** : 2026-05-28

### 6. ORIS — `oris-logo.svg` (wordmark créé)
- **Source** : aucune source officielle exploitable. Plusieurs entités "ORIS" coexistent (oris-it.fr en parc informatique, oris-connect.com en infrastructure BIM) mais aucun produit "ORIS diagnostic immobilier" n'a de site officiel identifiable, malgré sa mention récurrente dans les comparatifs comme cloud-based concurrent de Liciel.
- **Format source** : wordmark stylé créé ex-nihilo
- **Description créée** : wordmark "ORIS" en majuscules espacées (letter-spacing 4) bold sans-serif slate `#334155`, petite pastille cyan `#0EA5E9` en exposant après le "S" (évocation cloud/sync — référence à sa position cloud-first)
- **Couleur principale** : `#334155` slate (couleur d'accent demandée parmi la palette autorisée)
- **Justification** : reproduction nominative neutre, aucun élément figuratif spécifique reproduit
- **Création** : 2026-05-28

### 7. Argos — `argos-logo.svg`
- **Source** : https://cdn.prod.website-files.com/6645d4883e8630f9ce74e8b1/67fe2d1ba55e697b6d94e943_ARGOS-LOGO_Couleurs.avif (AVIF officiel converti localement en PNG via `sips`)
- **Format source** : AVIF observé visuellement → SVG retracé
- **Description observée** : icône à gauche d'une maison stylisée pointue avec un coin de "feuille pliée" (effet origami) en dégradé vert `#3DD68C → #1A6E50` du haut vers le bas ; à droite wordmark "Argos" en charcoal très foncé `#1F2A2A`, sans-serif arrondi bold (style Eudoxus Sans ou similaire).
- **Couleurs identifiées** : dégradé vert + `#1F2A2A` charcoal
- **Note fidélité** : reproduction approximative — silhouette maison simplifiée + coin origami suggéré par superposition, glyphe correct mais courbes du tracé original (qui ont des courbures subtiles) approximées par polygones droits.
- **Création** : 2026-05-28

### 8. DPEWin — `dpewin-logo.svg` (wordmark créé)
- **Source** : aucune. Le produit DPEWin de Logiciels Perrenoud est commercialisé en boîte/clé USB physique, sans wordmark autonome distinct du logo Perrenoud (maison-mère). Le site logicielsperrenoud.com ne sert qu'un PNG de "clé USB" produit, pas un logo DPEWin.
- **Format source** : wordmark stylé créé ex-nihilo
- **Description créée** : petite icône éclair (énergie / DPE) en vert `#16A34A` à gauche, puis wordmark "DPE" en bleu Perrenoud `#1E40AF` ultra-bold + "Win" en bleu plus clair `#3B82F6` weight medium — visuellement la marque verbale est claire et énergétique, cohérente avec l'identité Perrenoud sans la copier.
- **Couleurs principales** : `#1E40AF` bleu (palette autorisée demandée) + `#16A34A` vert (accent énergie DPE)
- **Justification** : reproduction nominative neutre, citation factuelle de compatibilité
- **Création** : 2026-05-28

---

## Contraintes techniques respectées

Tous les fichiers SVG :
- viewBox normalisé (ratios 10:3 ou 11:3 wordmark)
- aucun raster embedded (pas de `<image href="data:image/png">`)
- aucune métadonnée Adobe Illustrator / Inkscape
- couleurs hex direct, pas de variables CSS (autonomes pour `<img src>`)
- texte rendu en `<text>` natif (typographie système ; pour rendu identique cross-device et accessibilité, on accepte un léger jitter inter-OS sur la fonte plutôt qu'embedder une font payante)
- optimisés (≤ 1 Ko chacun sauf Liciel officiel à 10 Ko)

---

## Pourquoi cette stratégie révisée (2026-05-28)

L'ancienne stratégie "wordmark KOVAS uniforme dark sur tous les 7" a été abandonnée car elle aplanissait visuellement la grille et faisait paraître les concurrents comme une masse indistincte. Donner à chaque logo une **couleur et un traitement propres** :

1. **Crédibilise la grille** auprès du diagnostiqueur qui reconnaît visuellement ses logiciels connus (Liciel rouge, OBBC orange, AnalysImmo bleu/orange, Argos vert)
2. **Établit KOVAS comme connaisseur du marché** — l'éditeur sait précisément qui sont ses concurrents, pas juste leur nom
3. **Renforce le message de compatibilité réelle** — un logo générique suggère un placeholder, un logo coloré suggère une compatibilité technique éprouvée
4. **Reste légalement sûr** : logos officiels reproduits fidèlement (jurisprudence CJUE BMW c/ Deenik C-63/97 + L.713-3 CPI). Wordmarks créés ex-nihilo (Im'Diag, ORIS, DPEWin) = reproduction nominative neutre sans appropriation d'éléments figuratifs propriétaires.

---

## Fichiers physiques actuels

```
apps/web/public/logos/compat/
├── MANIFEST.md           (ce fichier)
├── liciel-logo.svg       (officiel inchangé, 10 Ko)
├── analysimmo-logo.svg   (retracé)
├── windiagnostics-logo.svg (retracé OBBC)
├── gestiondiag-logo.svg  (retracé)
├── imdiag-logo.svg       (wordmark créé)
├── oris-logo.svg         (wordmark créé)
├── argos-logo.svg        (retracé)
└── dpewin-logo.svg       (wordmark créé)
```

Le composant React `apps/web/src/components/landing/CompatLogos.tsx` doit être mis à jour par Claude principal pour consommer les 7 nouveaux SVG en tant que `<img src>` à la place des composants TSX inline.

---

## Disclaimer juridique affiché in-app

Sous la grille `CompatGrid`, un disclaimer en `font-mono text-[11px]` :

> Les marques citées appartiennent à leurs propriétaires respectifs. KOVAS n'est ni affilié à, ni endossé par ces éditeurs ; la mention de compatibilité signale une interopérabilité technique.

Fondement légal :
- **Art. L.713-3 CPI** : usage informatif d'une marque tierce autorisé si conforme aux usages honnêtes
- **Droit à l'information du consommateur** : le client a le droit de savoir que KOVAS fonctionne avec son logiciel actuel
- **Jurisprudence CJUE BMW c/ Deenik (C-63/97)** : un opérateur indépendant peut citer la marque du fabricant pour indiquer une compatibilité réelle

---

## Liens sources consultés (référence)

| Logiciel | Site officiel consulté | Logo source format |
|----------|------------------------|--------------------|
| LICIEL | https://www.liciel.fr/ | SVG officiel |
| AnalysImmo | https://www.atlibitum.com/ | PNG officiel |
| WinDiagnostics | https://obbc.fr/ (windiagnostics.fr inaccessible) | PNG officiel OBBC |
| GestionDiag | https://gestiondiag.fr/ | PNG Canva officiel |
| Im'Diag | aucun site officiel identifié | n/a — wordmark créé |
| ORIS | sites multiples non univoques (oris-it.fr, oris-connect.com — pas la marque diag) | n/a — wordmark créé |
| Argos | https://argos.ithaque-renovation.fr/ | AVIF officiel |
| DPEWin | https://logicielsperrenoud.com/ | pas de wordmark autonome — wordmark créé |

---

## Risques juridiques résiduels

- **Logos officiels retracés** (AnalysImmo, OBBC/WinDiagnostics, GestionDiag, Argos) : reproduction fidèle d'éléments visuels propriétaires (icônes, couleurs, dispositions). Couvert par **L.713-3 CPI** (usage informatif) + **CJUE BMW c/ Deenik (C-63/97)** + disclaimer. **Risque résiduel faible** mais existant si un éditeur estime que le tracé porte atteinte à sa marque figurative déposée — procédure de retrait à 7 jours déjà prévue ci-dessous.
- **Wordmarks créés** (Im'Diag, ORIS, DPEWin) : reproduction nominative neutre, **aucun risque juridique**.
- **Sous-titre "WINDIAGNOSTICS" sur le logo OBBC** : l'OBBC commercialise plusieurs produits, dont WinDiagnostics. La substitution du sous-titre "DÉVELOPPEMENT" (corporate) par "WINDIAGNOSTICS" (produit) n'altère pas la marque figurative principale (triangle + BBC + couleurs), mais est techniquement une adaptation. Si l'éditeur préfère garder son logo corporate intact, on pourra basculer sur "OBBC DÉVELOPPEMENT" sans changer le nom métier "WinDiagnostics" dans le composant TSX de la grille.

---

## Si un éditeur demande retrait

Si l'un des éditeurs ci-dessus demande le retrait de sa marque de notre grille de compatibilité (réception d'une mise en demeure ou simple demande amiable), procédure :

1. Retrait immédiat de l'entrée du tableau `COMPAT_LOGOS` dans `CompatGrid.tsx`
2. Suppression du composant logo correspondant dans `CompatLogos.tsx` + suppression du fichier SVG public
3. Documentation du retrait dans ce manifest avec date et motif
4. Réponse écrite à l'éditeur confirmant le retrait sous 7 jours ouvrés
