# Logos des éditeurs logiciels métier diagnostic immobilier

Manifest des 8 logos cibles pour la grille « Compagnon de votre logiciel actuel » sur la landing KOVAS (composant `apps/web/src/components/landing/CompatGrid.tsx`).

Date de collecte : 2026-05-20

---

## État final adopté

Après évaluation des logos collectés (qualité variable, ambiguïté éditeur vs produit, formats raster basse résolution), la **stratégie hybride** suivante a été retenue :

| # | Logiciel | Source utilisée | Format | Implémentation |
|---|----------|-----------------|--------|----------------|
| 1 | **LICIEL** | SVG officiel récupéré sur liciel.fr | **SVG natif** | `<img src="/logos/compat/liciel-logo.svg" />` |
| 2 | AnalysImmo | Wordmark KOVAS | SVG inline | `<AnalysImmoLogo />` |
| 3 | WinDiagnostics | Wordmark KOVAS | SVG inline | `<WinDiagnosticsLogo />` |
| 4 | GestionDiag | Wordmark KOVAS | SVG inline | `<GestionDiagLogo />` |
| 5 | Im'Diag | Wordmark KOVAS | SVG inline | `<ImDiagLogo />` |
| 6 | ORIS | Wordmark KOVAS | SVG inline | `<OrisLogo />` |
| 7 | Argos | Wordmark KOVAS | SVG inline | `<ArgosLogo />` |
| 8 | DPEWin | Wordmark KOVAS | SVG inline | `<DpeWinLogo />` |

**Composants** : `apps/web/src/components/landing/CompatLogos.tsx`

---

## Pourquoi cette stratégie

### LICIEL : logo officiel conservé tel quel

Seul logo officiel récupérable proprement en SVG vectoriel direct (738×220, viewBox propre, fichier 10 Ko depuis `/images_fr/logo/logo_liciel.svg`). Aucune modification du logo (contrainte légale + visuelle). Couleur officielle rouge `#E84242` préservée — c'est le seul accent coloré de la grille, ce qui souligne sa position de leader marché (50%).

### 7 autres : wordmarks SVG inline en typo KOVAS

Les downloads initialement effectués pour AnalysImmo, WinDiagnostics, GestionDiag, Argos, DPEWin présentaient des défauts disqualifiants :

- **AnalysImmo** : PNG 200×48 basse résolution, pixelisation immédiate au-delà
- **WinDiagnostics** : image produit carrée 768×768 (visuel "boîte" pas wordmark)
- **GestionDiag** : PNG 500×90 raster, perte de qualité au scale
- **Argos** : logo récupéré = Ithaque (maison-mère), pas Argos lui-même
- **DPEWin** : logo récupéré = Perrenoud (maison-mère), JPG 182×138 basse résolution

**Im'Diag** et **ORIS** : aucun site éditeur public identifiable malgré recherches multiples — hypothèse distribution restreinte / nom commercial alternatif.

**Décision** : recréer ces 7 wordmarks en SVG inline avec la typographie KOVAS (Urbanist 600, dark `#0F1419`). Avantages :

1. **Uniformité visuelle** de la grille — les 8 logos respirent la même grammaire
2. **Qualité vectorielle parfaite** à toutes les résolutions
3. **Sûreté juridique** : reproduction de la marque verbale seule en typographie neutre (citation factuelle de compatibilité, art. L.713-3 CPI) — pas de reproduction d'éléments figuratifs propriétaires (couleurs spécifiques, glyphes, icônes)
4. **Cohérence design system** v5 (palette sage/dark/chartreuse, pas de couleurs externes)

---

## Fichiers physiques

```
apps/web/public/logos/compat/
├── MANIFEST.md       (ce fichier)
└── liciel-logo.svg   (logo officiel LICIEL — non modifié)
```

Les 7 autres logos sont des composants React TSX dans `apps/web/src/components/landing/CompatLogos.tsx` — pas de fichier statique requis.

---

## Disclaimer juridique affiché in-app

Sous la grille `CompatGrid`, un disclaimer apparaît en `font-mono text-[11px]` :

> Les marques citées appartiennent à leurs propriétaires respectifs. KOVAS n'est ni affilié à, ni endossé par ces éditeurs ; la mention de compatibilité signale une interopérabilité technique.

Fondement légal :
- **Art. L.713-3 CPI** : usage informatif d'une marque tierce autorisé si conforme aux usages honnêtes
- **Droit à l'information du consommateur** : le client a le droit de savoir que KOVAS fonctionne avec son logiciel actuel
- **Jurisprudence CJUE BMW c/ Deenik (C-63/97)** : un opérateur indépendant peut citer la marque du fabricant pour indiquer une compatibilité réelle

---

## Liens sources consultés (référence)

| Logiciel | Site officiel consulté |
|----------|------------------------|
| LICIEL | https://www.liciel.fr/ |
| AnalysImmo | https://www.atlibitum.com/ |
| WinDiagnostics | https://obbc.fr/ (windiagnostics.fr inaccessible) |
| GestionDiag | https://gestiondiag.fr/ |
| Im'Diag | aucun site officiel identifié |
| ORIS | aucun site officiel identifié |
| Argos | https://argos.ithaque-renovation.fr/ |
| DPEWin | https://logicielsperrenoud.com/ |

---

## Si un éditeur demande retrait

Si l'un des éditeurs ci-dessus demande le retrait de sa marque de notre grille de compatibilité (réception d'une mise en demeure ou simple demande amiable), procédure :

1. Retrait immédiat de l'entrée du tableau `COMPAT_LOGOS` dans `CompatGrid.tsx`
2. Suppression du composant logo correspondant dans `CompatLogos.tsx`
3. Documentation du retrait dans ce manifest avec date et motif
4. Réponse écrite à l'éditeur confirmant le retrait sous 7 jours ouvrés
