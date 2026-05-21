# Procédure de maintenance du pack juridique KOVAS

> Document opérationnel. Tient lieu de check-list pour toute modification ultérieure des neuf (9) documents constitutifs du pack juridique.

## 1. Quand mettre à jour quel document ?

| Changement dans l'app | Documents à mettre à jour |
|---|---|
| Modification du prix d'un Forfait (Essential / Découverte / Pro / All Inclusive / Cabinet) | CGV §1.1 + Mentions légales §8 (si comparateur) |
| Ajout / retrait d'un add-on mensuel ou d'un pack | CGV §1.2.1 ou §1.2.2 |
| Modification d'un cap fair-use mission | CGV §6.2 |
| Modification d'un hard cap technique IA (Whisper ou Vision) | CGV §6.3 |
| Modification du plafond de stockage | CGV §1.1 + §6.4 |
| Ajout d'un nouveau type de cookies | Politique cookies §2 et §5 |
| Nouveau sous-traitant technique (hébergement, IA, paiement, comm.) | Politique confidentialité §4.1 + Mentions légales §5 |
| Modification de la durée d'essai (actuellement 30 jours) | CGV §3 |
| Modification du workflow de résiliation | CGV §7.2 (**doit rester conforme au décret 2023-417 du 31 mai 2023**) |
| Ajout d'un nouveau niveau de fiche (Basique / Vérifié / Premium / ...) | Conditions Annuaire §4 bis |
| Modification de la mécanique pay-to-unlock leads | Conditions Annuaire §4 bis.4 + Conditions B2C §4.4 |
| Activation effective des Slots Premium (V1.5) | Conditions Annuaire §9 (révision) + communication 30j préalable aux Diagnostiqueurs |
| Modification des finalités de traitement RGPD | Politique confidentialité §3 |
| Modification du délai de réponse Diagnostiqueur | Charte du Diagnostiqueur Référencé |
| Refonte de la juridiction / loi applicable | Tous documents : §loi applicable + §juridictions compétentes |
| Évolution du SIRET / RCS / capital / siège (post-immatriculation) | Mettre à jour `apps/web/src/lib/legal/company-identity.ts` (source unique de vérité — auto-propage dans le footer, les PDFs et les emails), puis répercuter dans Mentions légales §2 + Politique confidentialité §1 + Information préalable RGPD §1 |
| Évolution du nom commercial / des marques (KOVAS, KOVAS Annuaire, KOVAS 360) | Mettre à jour `apps/web/src/lib/legal/company-identity.ts` (champ `brands`), puis répercuter dans README §Définitions + Mentions légales §2 + CGV préambule + Charte préambule |

## 2. Process de mise à jour

1. **Modifier le fichier `.md`** dans `docs/legal/` (édition directe, jamais via copier-coller depuis Word).
2. **Incrémenter la version** dans l'en-tête : v1.1 → v1.2 → v1.3, etc.
3. **Mettre à jour la date d'édition** : « Édition au [JJ mois AAAA] — Version v1.X ».
4. **Mettre à jour le changelog** en bas du document (section `## CHANGELOG`) avec la liste des sections modifiées.
5. **Archiver la version précédente** dans `docs/legal/_archive/v1.X/` avant de procéder à la modification, afin de conserver une traçabilité documentaire en cas de contestation.
6. **Pour les modifications substantielles** (CGU, CGV, politique de confidentialité, conditions particulières) : notification individuelle aux Utilisateurs inscrits par courrier électronique, **30 jours minimum** avant entrée en vigueur (CGV art. 11.2 et CGU art. 2.2). Les Utilisateurs disposent d'un droit de résiliation sans frais pendant ce délai.
7. **Pour les modifications mineures non substantielles** (toilettage rédactionnel, correction typo, mise à jour d'un lien externe) : pas de notification individuelle requise, mais mention au changelog.
8. **Build et déploiement** : `pnpm build && pnpm typecheck` puis commit + déploiement Vercel. Les pages publiques `/cgu`, `/cgv`, etc. rechargent automatiquement le contenu depuis le filesystem au moment du build (server components).

## 3. Versioning et archivage

- Versions précédentes conservées dans `docs/legal/_archive/vX.Y/`.
- Conservation minimale recommandée : **5 ans après la date d'effet** (alignement sur la prescription quinquennale de droit commun, art. 2224 C. civ.).
- Si une stipulation a été supprimée d'une version à une autre, la version archivée demeure la pièce probatoire opposable pour les contrats conclus avant la date de modification.

## 4. Validation finale avant publication

Avant toute publication d'une nouvelle version v1.X ou supérieure :

1. **Auto-revue interne** : relecture par le fondateur (rédactionnel, factuel, cohérence inter-documents).
2. **Audit avocat IP/Tech** déclenché lorsque MRR atteint 5k€ (cf. CLAUDE.md §14 — Vague 2) :
   - Cabinet pressenti : Lefèvre Avocats ou Lex2B (boutiques IP/Tech)
   - Budget M9-M18 : 1 000 - 1 500 €
   - Sujets prioritaires : mémorandum reverse-engineering Liciel + CGU spécifiques métier diagnostic + clauses limitatives de responsabilité.
3. **Pour toute modification touchant le RGPD ou la mise en relation B2C** : revue spécifique avocat IP/Tech avant publication.

## 5. Liens entre documents (à ne jamais casser)

Le pack juridique forme un ensemble articulé. Toute modification doit vérifier que les renvois croisés restent cohérents :

| Renvoi | Source → Cible |
|---|---|
| CGU art. 1.2 | renvoie aux 6 autres docs |
| CGV art. 13.3 | renvoie aux CGU + Politique confidentialité |
| Conditions Annuaire art. 4.5 | renvoie aux CGV |
| Conditions Annuaire art. 4 bis | renvoie aux CGV (Forfaits) et au Document 7 (B2C) |
| Conditions B2C art. 4.4 | renvoie au Document 6 art. 4 bis |
| Conditions B2C art. 6 | renvoie à la Politique confidentialité |
| Charte Diagnostiqueur | renvoie aux CGU + Mentions légales |
| Information préalable RGPD | renvoie à la Politique confidentialité + Conditions Annuaire |

## 6. Zones grises persistantes au 21 mai 2026 (post-v1.2)

Les éléments d'identification de la société NEXUS 1993 (SIREN, SIRET, numéro RCS, capital social définitif, adresse exacte du siège social, code APE, numéro TVA intracommunautaire, convention collective) ont été intégrés à compter de la version v1.2 du présent pack le 21 mai 2026. Source unique de vérité : [`apps/web/src/lib/legal/company-identity.ts`](../../apps/web/src/lib/legal/company-identity.ts).

Zones grises résiduelles persistant à la v1.2 :

- **Mentions légales art. 9** : médiateur de la consommation, à désigner après adhésion effective de NEXUS 1993 à un dispositif de médiation référencé sur la plateforme economie.gouv.fr.
- **Conditions B2C art. 10.1** : médiateur de la consommation (idem).
- **Mentions légales art. 2** : numéro de téléphone — facultatif au sens LCEN art. 6-III dès lors qu'un point de contact électronique direct est offert.

Ces zones grises seront traitées dans le cadre d'une mise à jour v1.3 dès accomplissement des formalités correspondantes.

## 7. Cohérence code ↔ documents juridiques

Une vérification de cohérence est exécutée automatiquement par le module `apps/web/src/lib/legal/load-document.ts`. Toute divergence entre les tarifs définis dans `apps/web/src/lib/pricing-plans.ts` (ou équivalent) et les tarifs énoncés dans CGV §1.1 doit être réconciliée. Le build émet un avertissement en cas de divergence détectée.

---

**Version du présent document de procédure** : v1.1 — 21 mai 2026 (mise à jour post-immatriculation NEXUS 1993, intégration de la source unique de vérité `apps/web/src/lib/legal/company-identity.ts` et mise à jour de la matrice des dépendances).
