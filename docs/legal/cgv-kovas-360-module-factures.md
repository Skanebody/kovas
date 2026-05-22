# CGV — KOVAS 360, Module Devis & Factures

**Version 1.0 — applicable au 1ᵉʳ juin 2026**

Les présentes Conditions Générales de Vente (« CGV ») régissent l'utilisation du module
Devis &amp; Factures du logiciel KOVAS 360 (le « Module ») par le diagnostiqueur
immobilier client (l'« Utilisateur »). Elles complètent les CGU générales du logiciel
KOVAS 360.

Éditeur : **SASU NEXUS 1993**, capital 500,00 €, 66 Avenue des Champs Élysées, 75008 Paris
— SIREN 982 786 154 — SIRET 982 786 154 00012 — RCS Paris — TVA FR18982786154 — APE 58.29C
— Président : Benjamin BEL (« KOVAS »).

---

## 1. Objet

Le Module permet à l'Utilisateur, dans le cadre de son activité professionnelle de
diagnostiqueur immobilier, d'éditer des devis, factures et avoirs conformes au cadre
légal français, et de les conserver durant la durée légale.

Le Module est livré « en l'état », sous forme d'application accessible en ligne (SaaS),
hébergée en Union européenne (Supabase Paris, Vercel Frankfurt).

---

## 2. Périmètre de conformité couvert par KOVAS

### 2.1. Loi anti-fraude TVA (LAFT)

KOVAS atteste, en sa qualité d'éditeur, que le Module satisfait les quatre conditions
cumulatives prévues à l'article 286 I 3° bis du Code général des impôts :

1. **Inaltérabilité** — les factures émises sont figées en base par triggers PostgreSQL
   `tg_invoices_no_update_after_issued` et `tg_invoices_lock_reference_after_issued`.
   Les corrections passent obligatoirement par l'émission d'un avoir (art. 272-2 CGI).
2. **Sécurisation** — authentification Supabase Auth, journal d'événements append-only
   (table `events`), numérotation séquentielle continue garantie par
   `next_reference()` sous verrou `pg_advisory_xact_lock`.
3. **Conservation** — 10 ans à compter de l'émission, suppression définitive bloquée
   pendant cette période par trigger `tg_invoices_no_hard_delete_before_10y`.
4. **Archivage** — export ZIP horodaté mensuel (PDF + JSON + Factur-X XML) accompagné
   d'un manifeste SHA-256.

Une attestation individuelle nominative est mise à disposition de l'Utilisateur dans
son espace « Mon compte → Attestations légales ». Elle est exigible en cas de contrôle
DGFiP (BOI-CF-COM-20-30-20).

### 2.2. Mentions obligatoires des factures (L441-9 Code de commerce)

KOVAS pré-remplit et impose la présence des mentions suivantes sur chaque facture émise
via le Module :

- date d'émission, numéro séquentiel unique (FAC-YYYY-NNNNN),
- identité émetteur : raison sociale, adresse, SIREN, SIRET, RCS, TVA intracom, APE,
  capital social (si société),
- identité destinataire : nom / raison sociale + adresse + TVA intracom (si UE B2B),
- date de réalisation de la prestation,
- désignation détaillée par ligne (DPE, Amiante, Plomb, etc.) + quantité + PU HT +
  total HT + taux TVA applicable,
- montant total HT, TVA détaillée par taux, montant TTC,
- date d'échéance et conditions de règlement,
- **taux de pénalité de retard** au moins égal à 3× le taux d'intérêt légal en
  vigueur (L441-10 II),
- **mention de l'indemnité forfaitaire de 40 €** pour frais de recouvrement (D441-5),
- conditions d'escompte (par défaut : « Pas d'escompte pour règlement anticipé »).

Mentions conditionnelles ajoutées selon le statut de l'Utilisateur :

- **« TVA non applicable, art. 293 B du CGI »** si franchise en base
  (auto-entrepreneur),
- **« Autoliquidation »** si applicable (sous-traitance BTP, intracom B2B).

La validation est effectuée par la fonction `assertInvoiceCompliant()` au moment de
l'émission ; toute facture non conforme est refusée à la publication.

### 2.3. Conservation (Code commerce + CGI + LAFT)

- **Code commerce L123-22** : 10 ans pour les documents comptables, à compter de la
  clôture de l'exercice.
- **CGI L102 B** : 6 ans pour les pièces justificatives à l'appui de la déclaration
  fiscale.
- **CGI 286 I 3° bis** : conservation et archivage LAFT.

KOVAS conserve toutes les factures de l'Utilisateur pendant 10 ans à compter de leur
émission, y compris en cas de résiliation du contrat (voir §8).

### 2.4. Roadmap Factur-X / PDP 2027

À compter du 1ᵉʳ septembre 2026 (réception) et du 1ᵉʳ septembre 2027 (émission pour
les TPE), la facturation électronique B2B devient obligatoire en France
(ordonnance n° 2021-1190). KOVAS s'engage à supporter, sans surcoût pour l'Utilisateur :

- la **génération Factur-X** profil EN16931 (PDF + XML embarqué),
- l'**intégration d'au moins une PDP** (Plateforme de Dématérialisation Partenaire)
  agréée par la DGFiP au moins 3 mois avant l'échéance applicable à l'Utilisateur,
- la **transmission au PPF** (Portail Public de Facturation) lorsque celui-ci sera
  disponible pour les TPE.

---

## 3. Responsabilités de l'Utilisateur

L'Utilisateur reste seul responsable :

1. de la **véracité et de l'exactitude** des données saisies (identité client, montants,
   dates de prestation, désignations) ;
2. de la **fiscalité applicable à son cabinet** : régime TVA (franchise 293 B, normal,
   réel simplifié), choix du taux de TVA (20 % par défaut), application éventuelle de
   l'autoliquidation ; ce paramétrage est défini dans « Mon entreprise » ;
3. de ses **déclarations fiscales** (CA3, CA12, liasse) — KOVAS fournit l'export FEC
   et l'export comptable mais n'effectue aucune télédéclaration ;
4. de la **conservation locale** des attestations LAFT et factures (recommandé en
   complément de la conservation KOVAS) ;
5. de la **mise à jour** de ses informations légales (SIRET, adresse, RCS) dans le
   Module — KOVAS snapshotte ces informations à chaque émission de facture.

L'Utilisateur reconnaît que toute modification de ses informations légales postérieure
à l'émission d'une facture n'affecte pas la facture déjà émise (snapshot
`issuer_snapshot`), conformément au principe d'inaltérabilité LAFT.

---

## 4. Engagements de KOVAS

KOVAS s'engage à :

1. **Disponibilité** : taux de service mensuel ≥ 99,5 % (hors maintenances annoncées
   48 h à l'avance).
2. **Sécurité** : RLS multi-tenant Supabase, chiffrement TLS 1.3 en transit et AES-256
   au repos, hébergement EU (Paris + Frankfurt), pas de transfert hors UE.
3. **Mises à jour réglementaires** : adaptation du Module aux évolutions législatives
   (taux d'intérêt légal, format Factur-X, mentions obligatoires) sans surcoût.
4. **Attestation LAFT nominative** : génération à la demande dans « Mon compte →
   Attestations légales » ; réémission automatique à chaque évolution majeure du
   Module susceptible d'affecter la conformité.
5. **Support PDP 2027** : intégration d'au moins une Plateforme de Dématérialisation
   Partenaire au moins 3 mois avant l'échéance applicable à l'Utilisateur.
6. **Notifications** : en cas d'incident affectant l'inaltérabilité ou la
   conservation, KOVAS notifie l'Utilisateur sous 48 h et fournit un plan de
   remédiation.

---

## 5. Numérotation et identifiants

- **Numérotation continue per-organisation** : KOVAS génère les numéros via
  `next_reference()` (préfixe FAC + année + numéro 5 chiffres minimum). Aucun gap
  n'est possible ; toute facture supprimée avant émission n'affecte pas la séquence.
- **Snapshot émetteur et client** : chaque facture archive les informations légales
  en JSONB (`issuer_snapshot`, `client_snapshot`) pour survivre à toute modification
  ultérieure ou suppression RGPD côté client.
- **Identifiant interne** : UUID Supabase, jamais affiché à l'utilisateur final.

---

## 6. Avoirs et corrections

Conformément au principe d'inaltérabilité (art. 286 I 3° bis CGI) :

- les **factures émises ne peuvent plus être modifiées** ;
- toute correction passe par l'émission d'un **avoir** (préfixe AVO-YYYY-NNNNN),
  référencé sur la facture corrigée ;
- les avoirs partiels sont autorisés (montant ≠ facture initiale) ;
- en cas d'annulation totale, un avoir total est émis et la facture initiale reste
  consultable avec un badge « Annulée par AVO-… ».

---

## 7. Tarifs et facturation du Module

Le Module est inclus dans les tiers payants KOVAS 360 à compter du tier Découverte
(19 €/mois HT). Aucun surcoût n'est appliqué pour les volumes de factures ; la
limite fair-use est celle du tier souscrit (voir Pricing).

Options ponctuelles :

- **Signature eIDAS Yousign** : 2 €/signature HT (sur devis et factures > 10 000 €).
- **Rapport bilingue FR/EN** : 5 €/rapport HT.

---

## 8. Résiliation et conservation post-résiliation

En cas de résiliation à l'initiative de l'Utilisateur ou de KOVAS, l'Utilisateur :

1. **conserve un accès en lecture seule** à toutes ses factures pendant **10 ans à
   compter de l'émission** de chaque facture, via l'application KOVAS 360 (compte gelé
   en lecture, accessible sur demande sans frais — clause RLS dédiée
   `members read invoices 10y after termination`) ;
2. peut **exporter à tout moment** l'intégralité de ses factures au format ZIP horodaté
   (PDF + JSON + Factur-X XML + manifeste SHA-256), gratuitement, pendant ces 10 ans ;
3. au-delà de 10 ans, KOVAS se réserve le droit de supprimer définitivement les
   factures après notification 60 jours à l'avance par email.

KOVAS conserve les factures sur support sécurisé (Supabase EU + sauvegarde S3 EU
chiffrée) pendant toute la durée légale.

---

## 9. Limitations de responsabilité

KOVAS s'engage à fournir un Module conforme aux exigences légales en vigueur à la date
de la version. La responsabilité de KOVAS ne saurait être engagée :

- en cas d'**erreur de saisie** par l'Utilisateur (mauvais SIRET client, mauvais taux
  TVA, montant incorrect) ;
- en cas d'**usage non conforme** du Module (modification manuelle de la base, accès
  via une API non documentée, contournement des mécanismes d'inaltérabilité) ;
- en cas de **changement réglementaire** survenu après l'émission d'une facture (la
  facture émise reste conforme au droit en vigueur à sa date d'émission, l'Utilisateur
  doit régulariser via avoir si nécessaire).

La responsabilité de KOVAS, toutes causes confondues, est limitée au montant des
sommes effectivement versées par l'Utilisateur au titre des 12 derniers mois
d'abonnement KOVAS 360 (clause type SaaS B2B).

KOVAS dispose d'une assurance Responsabilité Civile Professionnelle Hiscox couvrant
les erreurs IA / éditeur (plafond 500 k€/sinistre — 1 M€/an, Phase 1).

---

## 10. Données personnelles et RGPD

L'Utilisateur est responsable de traitement des données de ses clients ; KOVAS est
sous-traitant au sens de l'art. 28 RGPD. Un DPA (Data Processing Agreement) distinct
formalise cette relation.

En cas de demande de droit à l'effacement émanant d'un client de l'Utilisateur, KOVAS
applique un **soft delete** sur le `clients.deleted_at` mais conserve les factures
émises (obligation légale L123-22 > droit à l'effacement, art. 17-3-b RGPD). Le
snapshot client (`client_snapshot`) reste figé sur la facture.

DPO : dpo@kovas.fr.

---

## 11. Droit applicable et juridiction

Les présentes CGV sont régies par le droit français. Tout litige relatif à leur
exécution ou interprétation relève de la compétence exclusive du **Tribunal de
commerce de Paris** ou, en appel, de la **Cour d'appel de Paris**.

---

## 12. Acceptation

L'activation du Module dans le tier souscrit vaut acceptation pleine et entière des
présentes CGV. Toute modification ultérieure sera notifiée par email 30 jours avant
prise d'effet ; l'Utilisateur dispose d'un droit de résiliation sans pénalité durant
ce délai.

---

*KOVAS — Module Devis & Factures — CGV v1.0 — 2026-05-22*
