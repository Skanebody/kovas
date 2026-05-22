# Conformité — Module Devis &amp; Factures KOVAS 360

> **Version 1.0 — 2026-05-22**
> Source : équipe technique KOVAS — référent : Benjamin BEL (Président).
> Authority order : ce document &gt; CGV module Factures &gt; code.

Ce document recense les obligations légales applicables au module Factures et le statut
de la mise en œuvre côté KOVAS et côté Utilisateur (diagnostiqueur). Il est destiné à
deux publics :

- **L'équipe KOVAS** — référence interne pour la roadmap conformité et les audits.
- **Le diagnostiqueur client** — guide pour préparer un contrôle DGFiP.

---

## 1. Tableau récapitulatif obligations vs statut

| Obligation | Cadre légal | Statut KOVAS | Statut Utilisateur | Implémentation |
|---|---|---|---|---|
| Inaltérabilité des factures | Art. 286 I 3° bis CGI | ✅ Triggers DB | ✅ Garanti automatiquement | `tg_invoices_no_update_after_issued`, `tg_invoices_lock_reference` |
| Sécurisation (chaînage, journal) | Art. 286 I 3° bis CGI | ✅ Append-only `events` | ✅ Garanti automatiquement | Table `events` + RLS multi-tenant |
| Conservation 6 ans (fiscal) | Art. L102 B CGI | ✅ 10 ans (cap supérieur) | À conserver localement aussi | Trigger blocage hard delete |
| Conservation 10 ans (comptable) | Art. L123-22 C. commerce | ✅ Hard delete bloqué 10 ans | À conserver localement aussi | `tg_invoices_no_hard_delete_before_10y` |
| Archivage périodique horodaté | Art. 286 I 3° bis CGI | ✅ ZIP mensuel SHA-256 | À récupérer sur demande | Edge function `archive-invoices-monthly` |
| Numérotation séquentielle continue | Art. 242 nonies A 2° CGI | ✅ `next_reference()` + verrou | ✅ Garanti automatiquement | `pg_advisory_xact_lock` |
| Mention date d'émission | Art. L441-9 al. 1 | ✅ Auto | ✅ Auto | `assertInvoiceCompliant` |
| Mention date prestation | Art. 242 nonies A 6° CGI | ✅ Auto | ⚠️ À saisir | Champ `service_date` requis |
| Identité émetteur complète | Art. L441-9 al. 1 | ✅ Pré-rempli | ⚠️ Compléter « Mon entreprise » | `issuer_snapshot` JSONB |
| Identité destinataire complète | Art. 242 nonies A 5° CGI | ✅ Pré-rempli | ⚠️ À saisir | `client_snapshot` JSONB |
| Pénalités retard ≥ 3× taux légal | Art. L441-10 II C. commerce | ✅ Mention auto-générée | — | `STANDARD_MENTIONS.latePenalties` |
| Indemnité forfaitaire 40 € | Art. D441-5 C. commerce | ✅ Mention auto-générée | — | `STANDARD_MENTIONS.fixedIndemnity40` |
| Conditions d'escompte | Art. L441-9 al. 1 | ✅ Mention auto-générée | — | `STANDARD_MENTIONS.noDiscountForEarlyPayment` |
| Mention 293 B (franchise) | Art. 293 B CGI | ⚠️ Auto si flag activé | ⚠️ Cocher si auto-entrepreneur | `is_vat_exempt_293b` |
| Mention « Autoliquidation » | Art. 283-2 CGI | ⚠️ Auto si flag activé | ⚠️ Cocher si applicable | `is_reverse_charge` |
| Attestation LAFT individuelle | Art. 286 I 3° bis CGI | ✅ Générateur PDF | ✅ Téléchargeable | `/api/legal/laft-attestation/[orgId]` |
| Factur-X (B2B obligatoire 2027) | Ord. 2021-1190 | 🚧 Roadmap Q4 2026 | — | Profile EN16931 prévu |
| Transmission PDP | Ord. 2021-1190 | 🚧 Roadmap 2027 | — | Intégration Iopole ou équivalent |
| RGPD — DPA sous-traitance | Art. 28 RGPD | ✅ DPA disponible | À signer | `/legal/dpa.pdf` |

Légende : ✅ implémenté · ⚠️ partiellement implémenté ou dépend de l'utilisateur · 🚧 en roadmap

---

## 2. Procédure de contrôle DGFiP

### 2.1. Pour KOVAS (éditeur)

En cas de demande de l'administration fiscale (DGFiP, DNEF, BCRF) :

1. **Recueillir la demande écrite** (avis de vérification, mise en demeure).
2. **Vérifier l'identité du demandeur** (carte professionnelle, ordre de mission).
3. **Préparer le dossier de conformité** :
   - copie de l'attestation LAFT générique non nominative,
   - extraits de la documentation technique (ce fichier + CGV module Factures),
   - migration SQL de référence (`20260522100000_invoice_sequence_lock.sql`,
     `20260522100100_invoice_retention_10y.sql`),
   - extrait pseudonymisé du code source pertinent (`assertInvoiceCompliant`,
     `next_reference`).
4. **Réponse sous 30 jours** (art. L13 LPF). Référent : Président Benjamin BEL.
5. **Notifier les utilisateurs concernés** dans les 48 h si la demande porte sur des
   factures spécifiques (art. 32 RGPD, transparence).

### 2.2. Pour l'Utilisateur diagnostiqueur

En cas de contrôle DGFiP de votre cabinet :

1. **Présenter l'attestation LAFT** téléchargée depuis « Mon compte → Attestations
   légales » (PDF nominatif avec votre raison sociale et SIREN).
2. **Mettre à disposition les factures** en format dématérialisé via l'export ZIP
   mensuel ou via accès lecture seule au compte KOVAS.
3. **Justifier la séquentialité** : exporter le rapport
   `audit:invoices` (commande `pnpm audit:invoices`) — il liste les factures et leur
   numérotation continue.
4. En cas de question technique, KOVAS fournit un **support contrôle DGFiP**
   prioritaire (support@kovas.fr, mention « Contrôle DGFiP »).

---

## 3. Calendrier réforme facturation électronique 2026-2027

| Date | Échéance | Concerné | Impact KOVAS |
|---|---|---|---|
| 1ᵉʳ sept. 2026 | **Réception obligatoire** au format Factur-X / UBL / CII | Toutes entreprises (grandes, ETI, PME, TPE) | Réception via PDP active dès Q2 2026 |
| 1ᵉʳ sept. 2026 | **Émission obligatoire** pour grandes entreprises et ETI | Grandes + ETI | Pas concerné directement (TPE diagnostiqueurs) |
| 1ᵉʳ sept. 2027 | **Émission obligatoire** pour PME et TPE | TPE diagnostiqueurs (notre cible) | Module Factur-X complet livré ≤ Q1 2027 |
| 1ᵉʳ sept. 2027 | **e-reporting B2B intra-UE** | TPE | Intégration PDP avec transmission e-reporting |

Roadmap KOVAS :

- **Q4 2026** : génération Factur-X profil EN16931 (PDF + XML embarqué) — déjà prévu
  dans `invoices.facturx_xml` colonne. Validation par parseur officiel DGFiP.
- **Q1 2027** : intégration d'au moins une PDP agréée (candidats : Iopole, Pennylane,
  Sage Network). Décision finale selon roadmap des PDP publiée par la DGFiP en
  octobre 2026.
- **Q2 2027** : test bêta avec 10 % du parc utilisateurs.
- **Juillet 2027** : généralisation, 2 mois avant l'obligation.

---

## 4. Risques de sanctions

### 4.1. Pour KOVAS (éditeur)

| Manquement | Sanction | Référence |
|---|---|---|
| Logiciel non attesté LAFT | **7 500 €** par logiciel + obligation de mise en conformité sous 60 j | Art. 1770 duodecies CGI |
| Absence d'attestation individuelle | **15 000 €** par fournisseur en infraction | Art. 1734 CGI (utilisation contre l'éditeur si carence prouvée) |
| Manquement à l'obligation de coopération | Pénalités proportionnelles | Art. L13 LPF |

### 4.2. Pour l'Utilisateur diagnostiqueur

| Manquement | Sanction | Référence |
|---|---|---|
| Mention obligatoire L441-9 manquante | **15 € par mention manquante** par facture (plafond 1/4 du montant facturé) | Art. 1737 II CGI |
| Mentions abusives ou omises (commercial) | **75 000 € par facture** pour personne physique, 375 000 € pour personne morale | Art. L441-9 al. 2 C. commerce |
| Défaut de facture | **50 % de la somme facturée**, ou 5 % si bonne foi | Art. 1737 I CGI |
| Conservation insuffisante | Présomption défavorable en contrôle | Art. L123-22 C. commerce |
| Logiciel non LAFT (depuis 2018) | **7 500 €** par logiciel + mise en conformité | Art. 1770 duodecies CGI |

> **Bonne pratique** : KOVAS pré-remplit toutes les mentions obligatoires et bloque
> l'émission d'une facture non conforme via `assertInvoiceCompliant()`. Le risque
> sanction de l'Utilisateur est ramené à zéro pour les mentions automatisées.

---

## 5. Liste exhaustive des mentions L441-9 (source code = vérité)

La liste authoritative est dans
[`apps/web/src/lib/legal/invoice-mentions.ts`](../apps/web/src/lib/legal/invoice-mentions.ts)
→ constante `INVOICE_MENTIONS`. Toute évolution réglementaire doit y être répercutée.

### 5.1. Mentions toujours obligatoires (`mandatory`)

1. Date d'émission de la facture
2. Numéro unique séquentiel et continu (FAC-YYYY-NNNNN)
3. Raison sociale émetteur
4. Adresse du siège émetteur
5. SIREN/SIRET émetteur
6. Mention RCS ville + n° d'inscription
7. Numéro de TVA intracommunautaire émetteur
8. Identité destinataire (nom + adresse)
9. Date de réalisation de la prestation
10. Désignation détaillée par ligne + quantité + PU HT + total HT + taux TVA
11. Montant total HT
12. Montant TVA détaillé par taux
13. Montant total TTC
14. Date d'échéance et conditions de règlement
15. Taux des pénalités exigibles (≥ 3× taux légal)
16. Mention de l'indemnité forfaitaire 40 €
17. Conditions d'escompte applicables

### 5.2. Mentions conditionnelles (`conditional`)

- Code APE émetteur (usage commercial, recommandé)
- Capital social (sociétés commerciales — R123-238)
- TVA intracom client (si B2B UE)
- Rabais, remises, ristournes acquis à la date de la facture
- **« TVA non applicable, art. 293 B du CGI »** si franchise en base
- **« Autoliquidation »** si applicable
- Référence assurance RC professionnelle (recommandé profession diagnostiqueur)

### 5.3. Exemples de mentions standardisées

**Pénalités de retard** (avec taux légal 2024 du 1er semestre = 4,22 % à titre
d'exemple — à actualiser via Banque de France) :

> En cas de retard de paiement, des pénalités seront dues, calculées au taux annuel
> de 12,66 % (soit trois fois le taux d'intérêt légal en vigueur de 4,22 %, art. L441-10
> du Code de commerce).

**Indemnité forfaitaire 40 €** :

> Tout retard de paiement entraîne, de plein droit, le versement d'une indemnité
> forfaitaire pour frais de recouvrement d'un montant de 40 € (art. D441-5 du Code de
> commerce).

**Escompte** :

> Pas d'escompte pour règlement anticipé.

**Franchise en base TVA** (auto-entrepreneur uniquement) :

> TVA non applicable, art. 293 B du CGI (franchise en base — auto-entrepreneur).

**Autoliquidation** (sous-traitance BTP, intracom B2B) :

> Autoliquidation — TVA due par le preneur (art. 283-2 du CGI).

---

## 6. Auto-attestation LAFT vs certification NF 525

Le législateur (LAFT 2018) reconnaît **deux voies équivalentes** pour la conformité d'un
logiciel de caisse / facturation :

### Voie A — Attestation individuelle d'éditeur (choix KOVAS)

- **Gratuit** pour l'utilisateur ;
- L'éditeur (KOVAS) **certifie sous sa responsabilité** que le logiciel satisfait les
  4 conditions LAFT ;
- L'attestation est **nominative** et **individuelle** : un PDF par couple
  (éditeur, client utilisateur) ;
- Forme : libre, mais doit contenir l'identité éditeur + identité client + version
  logicielle + 4 conditions + signature représentant légal.

### Voie B — Certification NF 525 par organisme tiers

- Délivrée par **AFNOR Certification** ou **LNE** ;
- Coût : 5 000 à 15 000 € (audit initial + suivi annuel) ;
- Plus fort niveau d'opposabilité (validation tiers indépendant) ;
- Pertinente surtout pour les éditeurs de logiciels de caisse vendus en boîte
  (commerces, restauration).

### Choix KOVAS : Voie A

**Rationale** :

1. **Coût** : 0 € vs 5 000-15 000 € pour NF 525.
2. **Adaptabilité** : nous pouvons réémettre l'attestation à chaque évolution majeure
   du Module sans repasser une nouvelle certification tiers.
3. **Opposabilité suffisante** : l'art. 286 I 3° bis CGI met explicitement les deux
   voies sur le même plan. La jurisprudence (CE 5 juill. 2023, n° 467363) confirme.
4. **Roadmap NF 525** : si dans 24 mois le marché B2B exige NF 525 (concurrence
   Liciel certifié, demande clients grands comptes), nous engagerons la
   certification — mais ce n'est pas un blocage Phase 1.

---

## 7. Procédure interne KOVAS — émission d'attestations

1. **Trigger automatique** : à l'activation du Module Factures pour un nouveau client,
   une attestation est pré-générée et notifiée par email.
2. **Régénération** : l'utilisateur peut la régénérer à volonté (numéro stable
   `LAFT-{YYYY}-{orgId8}` pour idempotence).
3. **Évolution majeure du Module** : si une modification du Module touche un des 4
   piliers LAFT (inaltérabilité, sécurisation, conservation, archivage), une nouvelle
   attestation est émise automatiquement avec un numéro incrémenté
   (`LAFT-{YYYY}-{orgId8}-v2`).
4. **Archivage interne** : toutes les attestations émises sont conservées par KOVAS
   pendant 10 ans (bucket Supabase `archives-laft`).

---

## 8. Références légales — index

| Référence | Objet | Lien |
|---|---|---|
| Art. 286 I 3° bis CGI | LAFT — obligations logiciel de caisse | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031814661) |
| Art. L441-9 C. commerce | Mentions obligatoires facture | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414166) |
| Art. L441-10 C. commerce | Délais paiement + pénalités | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414164) |
| Art. D441-5 C. commerce | Indemnité forfaitaire 40 € | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000027550107) |
| Art. L123-22 C. commerce | Conservation 10 ans documents comptables | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000019288097) |
| Art. L102 B CGI | Conservation 6 ans documents fiscaux | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044993614) |
| Art. 242 nonies A annexe II CGI | Détail mentions facture | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000020646290) |
| Art. 289 CGI | Facturation TVA | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033789541) |
| Art. 293 B CGI | Franchise en base TVA | [legifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041464970) |
| BOI-TVA-DECLA-30-10-30 | Doctrine LAFT | [BOFiP](https://bofip.impots.gouv.fr/bofip/10691-PGP.html) |
| BOI-CF-COM-20-30-20 | Contrôle logiciels caisse | [BOFiP](https://bofip.impots.gouv.fr/bofip/11045-PGP.html) |
| Ord. 2021-1190 | Facturation électronique B2B | [legifrance](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044044176) |

---

## 9. Changelog

| Date | Version | Modification |
|---|---|---|
| 2026-05-22 | 1.0 | Document initial — module Factures KOVAS 360 V1 |
