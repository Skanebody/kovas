# Task 0.3 : INPI dépôt marque KOVAS (M1)

## Objective

Déposer la marque KOVAS à l'INPI en DIY (Vague 1 du plan juridique IA-first) pour les classes 9 (logiciels) et 42 (SaaS / services informatiques). Budget total ~300€ frais INPI.

## Context

Vague 1 du plan juridique. Protège le nom "KOVAS" contre l'usage par un concurrent (notamment Enersweet/Liciel qui consolide le marché). Effectué en DIY via interface en ligne INPI grâce à Claude Max pour rédaction et recherche antériorité.

## Dependencies

- Task 0.1 (compte email pro `juridique@kovas.fr` créé)

## Blocked By

- Aucune (peut tourner en parallèle de 0.1 dès `juridique@kovas.fr` opérationnel)

## Research Findings

- De `CLAUDE.md` §14 : Vague 1 juridique = INPI DIY + 300€
- De `kovas-defense-strategy.md` §6 : marque INPI seule Phase 1, pas de brevet design (avantage = produit + IA + écosystème, pas la palette)
- De `research/liciel-format.md` §3 : SAS Institute c/ WPL = format de fichiers de données non protégé, donc pas de risque IP côté Liciel sur le nom KOVAS

## Implementation Plan

### Step 1 : Recherche antériorité préliminaire via Claude Max

Demander à Claude (modèle Opus 4.7 pour analyse approfondie) :

- Rechercher "KOVAS" + variantes (KOVAS App, KovaSaaS, etc.) sur :
  - **TMview** (base européenne EUIPO) : https://www.tmdn.org/tmview/
  - **data.inpi.fr** (marques françaises)
  - **WIPO Global Brand Database** : https://branddb.wipo.int/
- Pour chaque résultat trouvé, évaluer :
  - Classe(s) concernée(s)
  - Pays/régions
  - Date dépôt
  - Statut (actif/expiré/contesté)
  - Risque de confusion (proximité phonétique + classes overlapping)

**Résultat attendu** : rapport Claude listant 0-5 antériorités potentielles avec analyse de risque. Si 0 antériorité bloquante dans classes 9+42 en FR/EU → GO pour dépôt.

Cas d'arrêt : si une marque "KOVAS" ou très proche existe en classes 9 ou 42 active en FR ou EU → escalader à un avocat IP (~500€ consultation) avant dépôt.

### Step 2 : Préparation dossier dépôt INPI

Aller sur https://www.inpi.fr/services-en-ligne/marques :

- Choisir **Dépôt national de marque**
- **Titulaire** : SASU Nexus 1993 (SIRET, adresse Dieppe, KBis à uploader)
- **Représentant** : Benjamin Bel, président (mandat société)
- **Marque verbale** : `KOVAS`
- **Type** : marque verbale (pas de logo Phase 1 — économise un dépôt séparé)
- **Classes Nice** :
  - **Classe 9** : "Logiciels d'application téléchargeables ; logiciels mobiles ; logiciels en tant que service (SaaS) ; logiciels d'intelligence artificielle ; programmes informatiques enregistrés ; bases de données électroniques"
  - **Classe 42** : "Services informatiques, à savoir conception, développement, hébergement et maintenance de logiciels en tant que service (SaaS) ; services d'intelligence artificielle (IA) ; mise à disposition de plateformes en ligne pour la collecte de données terrain ; conception de logiciels métiers spécialisés ; services de cloud computing"
- Libellé personnalisé (rédigé par Claude Max) à valider — éviter trop large (risque opposition) ou trop étroit (couverture insuffisante)

### Step 3 : Paiement frais INPI

- **Tarif 2026** : 190€ pour 1 classe, +40€ par classe additionnelle
- Total **2 classes (9 + 42)** : 190 + 40 = **230€** + éventuelles options
- Paiement carte Qonto Nexus 1993
- Récépissé dépôt à archiver dans `docs/legal/inpi-deposit-kovas.pdf`

### Step 4 : Suivi procédure

- **Publication BOPI** : ~6 semaines post-dépôt
- **Période opposition** : 2 mois post-publication (concurrents peuvent contester)
- **Enregistrement définitif** : ~5-6 mois si pas d'opposition
- **Validité** : 10 ans renouvelables

Tâche de suivi : créer alerte calendrier `support@kovas.fr` à J+45 (publication BOPI) et J+120 (fin période opposition).

### Step 5 : Documentation interne

Créer `docs/legal/marque-strategy.md` :

```markdown
# Stratégie marque KOVAS

## Dépôt initial
- Numéro dépôt : <à compléter post-dépôt>
- Date dépôt : <date>
- Classes : 9 + 42
- Statut : en cours d'examen

## Extensions futures (déclenchées si traction)
- M12+ : extension UE via Marque de l'Union Européenne (EUIPO) si > 100 abonnés
- M18+ : extension internationale via Système de Madrid (WIPO) si lancement BE/CH/LU
- Phase 4 (M30+) : ajout classe 35 (services publicité/business management) si marketplace MAR/RGE active

## Veille concurrence
- Surveiller dépôts marques diagnostic immobilier FR (alertes TMview)
- Surveiller dépôts Enersweet/Liciel/AnalysImmo/OBBC (consolidation marché)
```

## Files to Create

- `docs/legal/inpi-deposit-kovas.pdf` (récépissé INPI archive)
- `docs/legal/marque-strategy.md` (stratégie + numéro dépôt + planning extensions)
- `docs/legal/recherche-anteriorite-kovas.md` (rapport Claude Max antériorité)

## Files to Modify

- `docs/credentials-setup.md` : ajouter section "Marque INPI" avec numéro dépôt

## Contracts

### Provides (for downstream tasks)

- **Numéro dépôt INPI marque KOVAS** (référencé dans mentions légales site web Task 0.4)
- **Statut "Marque déposée"** utilisable dans com marketing dès récépissé

## Acceptance Criteria

- [ ] Recherche antériorité Claude Max complétée : 0 antériorité bloquante classes 9+42 FR/EU
- [ ] Dépôt INPI effectué (~230€ frais INPI)
- [ ] Récépissé archivé `docs/legal/inpi-deposit-kovas.pdf`
- [ ] Stratégie marque documentée `docs/legal/marque-strategy.md`
- [ ] Alertes calendrier J+45 et J+120 créées (publication BOPI + fin période opposition)

## Testing Protocol

### Vérification dépôt

- Une semaine post-dépôt : confirmer accusé réception INPI via espace personnel
- Vérifier que dépôt apparaît dans data.inpi.fr (~3-5 jours)

### Communication

- Mentionner "Marque déposée" sur kovas.fr → mentions légales (Task 0.4)
- Optionnel : symbole ™ accolé à "KOVAS" sur site (avant enregistrement définitif)
- Symbole ® uniquement après enregistrement définitif (~M+5-6)

## Skills to Read

- `kovas-defense-strategy` (cohérence stratégie marque + IP)

## Research Files to Read

- `research/liciel-format.md` §3 (cadre juridique L122-6-1 + SAS Institute pour contexte IP général)

## Git

- Branch : `feature/0-3-inpi-marque-kovas`
- Commit message prefix : `Task 0.3:`

## Notes anti-pattern

- ⛔ Ne PAS déposer en compte Benjamin Bel personnel — toujours sous SASU Nexus 1993 (entité juridique)
- ⛔ Ne PAS skipper la recherche antériorité — un dépôt rejeté coûte 230€ pour rien
- ⛔ Ne PAS choisir un libellé classes trop large (risque opposition pour cause de "non-utilisation effective" prévue à M+5 si KOVAS pas encore actif)
- ⛔ Ne PAS oublier de mentionner "Marque déposée + numéro" sur mentions légales site
