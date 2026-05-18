# Stripe + Factur-X + Signature électronique — Research

**Wave**: First | **Date**: 2026-05-13 | **Status**: Complete

> Note importante : Write, WebSearch et WebFetch ont tous été refusés par le sandbox dans la session du subagent. Le fichier a été persisté par le parent orchestrator. Le contenu repose sur la base de connaissances à janvier 2026. Tous les items `[VERIFY]` sont à confirmer en Phase 4 avec accès web autorisé.

## Summary

KOVAS doit gérer deux couches Factur-X distinctes : (1) facturation de ses propres abonnements SaaS via Stripe, (2) facturation par les diagnostiqueurs de leurs clients via KOVAS. La réforme française a été finalisée par la loi de finances 2024 : le PPF perd son rôle de plateforme gratuite et se limite à l'annuaire central + concentrateur de e-reporting ; **toute entreprise doit obligatoirement passer par une PDP immatriculée**. Calendrier : **réception obligatoire pour TOUS au 01/09/2026**, **émission obligatoire grandes/ETI au 01/09/2026**, **émission PME/microentreprises au 01/09/2027**. Recommandation : PDP **Iopole** (pure player API-first), profil Factur-X **EN 16931**, génération **déléguée à la PDP en Phase 1** (mustangproject Dockerisé Railway en Phase 2 si volume), **DocuSeal self-hosted Railway** par défaut (SES), option **Yousign eIDAS** à +10 EUR/mo.

## 1. Calendrier réforme facturation électronique FR

Source : Loi de finances 2024 art. 91 + ordonnance 2021-1190 modifiée. `[VERIFY contre impots.gouv.fr]`

| Date | Obligation | Périmètre |
|---|---|---|
| **01/09/2026** | Réception | **Toutes** les entreprises assujetties TVA en France |
| **01/09/2026** | Émission + e-reporting | Grandes entreprises (>5 000 salariés OU CA>1,5 Mds€) + ETI (250-4 999 sal., CA 50 M€-1,5 Mds€) |
| **01/09/2027** | Émission + e-reporting | PME (10-249 sal.) + microentreprises/TPE (<10 sal.) |

**Cas KOVAS** : SASU Nexus 1993 et diagnostiqueurs utilisateurs = tous TPE → émission obligatoire 01/09/2027 mais réception au 01/09/2026. **Recommandation business** : KOVAS doit être opérationnel émission + réception dès **01/09/2026** pour utiliser la conformité comme argument commercial.

**Sanctions** `[VERIFY]` : 15 €/facture non émise au format électronique (plafond 15 000 €/an), 250 € par transmission e-reporting manquante (plafond 45 000 €/an), doublement en récidive.

## 2. PPF post-révision 2024

Le PPF (Portail Public de Facturation) **n'est plus une plateforme gratuite**. Il se limite à :
1. Annuaire central SIREN/SIRET → PDP de destination (pour routage).
2. Concentrateur e-reporting vers DGFiP.
3. API publique d'interrogation de l'annuaire.

**Conséquence** : souscription à une PDP immatriculée **obligatoire** pour toute entreprise.

## 3. PDP — liste indicative (janv. 2026)

`[VERIFY contre impots.gouv.fr/liste-pdp]`

| PDP | Type | API | Tarif indicatif |
|---|---|---|---|
| **Iopole** | Pure player | REST | ~0,05-0,15 €/facture + abonnement |
| **Pennylane** | Compta + PDP | REST | Inclus abo compta ~30-100 €/mo |
| **Sellsy** | CRM/Facture + PDP | REST | Bundle |
| **Qonto** | Néobanque + PDP | API | Bundle banque pro `[VERIFY si effectif fin 2025]` |
| **Tiime** | Compta + PDP | API | Bundle ~50 €/mo |
| **Generix** | EDI historique | Oui | Grands comptes ~0,30 €/facture |
| **Cegid Loop / Notilus** | ERP + PDP | API | Bundle ERP |
| **Sage** | ERP + PDP | API partielle | Bundle ERP |
| **Digital Cube / b-process** | Pure player | Oui | ~0,10 €/facture |
| **Esker** | Pure player B2B | Oui | Volume-dependent |
| **Docaposte (La Poste)** | EDI + PDP | Oui | Grands comptes |

**Auto-hébergement PDP** : non viable (>500 k€/an immatriculation + audit ISO 27001 + bilans).

## 4. Modèle 4 coins (interopérabilité PDP↔PDP)

Inspiré PEPPOL :
- Coin 1 = Émetteur → Coin 2 = PDP émettrice → Coin 3 = PDP destinataire (résolue via annuaire PPF) → Coin 4 = Destinataire.
- Protocole AS4 ou équivalent normalisé DGFiP.

## 5. Formats Factur-X et profils

**Factur-X** = PDF/A-3 hybride + XML embarqué en syntaxe **CII** (Cross Industry Invoice, UN/CEFACT) — pas UBL.
Le PPF/PDP acceptent : Factur-X (CII), UBL 2.1, CII pur. Pour KOVAS, **Factur-X** est la cible naturelle (PDF lisible pour humain + XML pour machine).

**Profils** :
| Profil | Cas d'usage |
|---|---|
| MINIMUM | Justificatif comptable simple |
| BASIC WL | PME simples sans lignes détaillées |
| BASIC | PME B2B services standard |
| **EN 16931** (ex-COMFORT) | **Standard recommandé européen** |
| EXTENDED | Grands comptes industrie/transport |

**Recommandation KOVAS** : **profil EN 16931** pour toutes les factures émises.

## 6. Génération Factur-X Node.js/TypeScript

Pas de librairie Node native mature en janv. 2026. Trois options :

- **Option A — mustangproject (Java)** dockerisé Railway, child_process spawn. Référence open source (Apache 2.0), supporte tous profils, validation native, latence ~1-2s/facture. Recommandé Phase 2.
- **Option B — XML manuel + pdf-lib + Ghostscript PDF/A-3**. Tout Node mais risque conformité élevé. Rejeté Phase 1.
- **Option C — Délégation totale à la PDP** (Iopole, Pennylane). JSON in → Factur-X out. **Recommandé Phase 1 MVP**.

**Validateurs** : FNFE-MPE https://services.fnfe-mpe.org/ (officiel), Mustang CLI `--validate`, veraPDF (PDF/A-3).

## 7. Stripe en France

### Abonnements KOVAS
**Stripe Billing** pour subscriptions 59 €/mo. **Stripe Tax** `tax_behavior=exclusive` pour TVA 20% B2B (coût 0,5%).

### SEPA Direct Debit (priorité)
**SEPA Core** :
- Frais Stripe : **0,35 € flat** (vs CB française 1,4% + 0,25 € ≈ 0,90 € sur 59 €) → économie ~0,55 €/abonné/mois → ~50 €/mois économisés à 100 abonnés.
- Pré-notification 5 jours avant (Stripe gère).
- Période dispute clawback : 8 semaines B2C.
- Mandate UX : page Stripe-hosted, IBAN + click-to-accept.

**SEPA B2B** : pas de dispute mais signature mandate en banque → friction +++. **Ne pas proposer Phase 1**.

### CB fallback
CB FR : 1,4% + 0,25 € ; UE non-FR : 1,5% + 0,25 € ; hors UE : 2,9% + 0,25 €.

### Stripe et Factur-X
**Stripe ne génère pas Factur-X nativement** `[VERIFY 2026]`. Architecture cible :
- Désactiver envoi auto PDF Stripe (`auto_advance=false`).
- Webhook `invoice.payment_succeeded` → Edge Function → POST PDP → Factur-X officiel envoyé via PDP.
- Stripe = moteur paiement + état abonnement ; PDP = source vérité fiscale.

### Stripe Payment Links (diag → client final)
URL one-shot, frais standard CB. Idéal B2C (diag → particulier 150-400 € par DPE).

## 8. Signature électronique : DocuSeal vs Yousign

### Cadre eIDAS (Règlement 910/2014, eIDAS 2 entrée en vigueur 2024)
- **SES** (Simple) : valeur probante, couvre 95% B2B/B2C. Code Civil art. 1366-1367.
- **AES** (Advanced) : lien fort signataire + détection altérations. Recommandé contrats > 5 k€.
- **QES** (Qualified) : équivalent juridique manuscrite. Obligatoire actes notariés (hors scope diag).

**Cas KOVAS** :
- Devis diag → client (< 1 k€) : **SES DocuSeal** suffit.
- Devis cabinet → grand compte : **AES Yousign** recommandé.

### DocuSeal (open source)
- Repo : https://github.com/docusealco/docuseal — Licence **AGPL-3.0** (OK en mode SaaS pur).
- Hébergement Railway Dockerfile officiel : ~5 €/mo instance + ~1 €/mo storage.
- Niveau : SES + AES (audit trail, horodatage, IP, géoloc dans le PDF).
- API REST complète, webhooks (signed/declined/viewed).
- Limites : pas de QES eIDAS qualifié.

### Yousign (FR, eIDAS QTSP qualifié)
- Société française (Caen), hébergement EU.
- Niveaux : SES, AES, QES.
- Pricing 2025-2026 `[VERIFY]` : PAYG ~3-5 € SES, ~5-7 € AES, ~15-25 € QES. Plan Business ~25 €/mo + 1-2 €/sig.

## 9. Workflow facturation utilisateur KOVAS (diag → client)

```
1. DEVIS
   Diag remplit devis -> KOVAS genere PDF (pdf-lib)
   -> "Envoyer pour signature"
      |-- SES par defaut : DocuSeal API -> enveloppe -> client signe -> webhook
      `-- AES/QES (+10 EUR plan) : Yousign API -> idem

2. MISSION
   Diag execute la mission DPE -> rapport genere
   Mission completee -> trigger facturation

3. FACTURE
   KOVAS construit JSON {client, lignes, TVA, total}
   -> POST PDP Iopole
      |-- PDP genere Factur-X EN 16931 (PDF/A-3 + XML CII)
      |-- PDP route via annuaire PPF (SIRET destinataire)
      |   |-- B2B : transmission PDP->PDP modele 4 coins
      |   `-- B2C : PDF par email + e-reporting agrege PPF
      `-- Webhook KOVAS : URL PDF Factur-X + statut

4. PAIEMENT
   KOVAS cree Stripe Payment Link (montant TTC) -> insere dans email
   Client paye CB (B2C) ou virement SEPA (B2B)
   Webhook payment_intent.succeeded -> KOVAS : facture payee

5. RELANCES
   J+7  : email relance 1 courtois (Resend)
   J+15 : email relance 2 + SMS option
   J+30 : email relance 3 (mise en demeure legere) + notif diag
   J+45 : escalade humaine

6. ARCHIVAGE
   PDP : copie probante 10 ans
   Supabase Storage : copie acces rapide
   OVHcloud Object Storage Strasbourg : backup hebdo 6 ans min
```

## 10. Workflow facturation KOVAS lui-même (KOVAS → diag abonné)

```
1. SOUSCRIPTION
   Stripe Checkout : CB tokenisee ou SEPA mandate (page Stripe-hosted)

2. PREMIER PAIEMENT (J0 ou J30 si trial)
   Stripe charge -> webhook invoice.payment_succeeded
   -> Edge Function KOVAS -> POST PDP Iopole
      Emetteur : SASU Nexus 1993 (SIRET, TVA intracom)
      Destinataire : diag (SIRET, raison sociale, adresse)
      Ligne : "Abonnement KOVAS Compagnon mois M" 59 EUR HT
      TVA 20% : 11,80 EUR / TTC : 70,80 EUR
   -> PDP genere Factur-X EN 16931 + route via reseau PDP

3. RENOUVELLEMENTS MENSUELS automatique
   SEPA fail -> Stripe Smart Retries (3 tentatives sur 2 semaines)
   Echec total -> email + bandeau app + downgrade J+30
```

## 11. Export comptable

**FEC standard** (arrêté 29 juillet 2013) suffit Phase 1. Couvre 100% besoins légaux + accepté par tous experts-comptables. TXT pipe-separated UTF-8, 18 colonnes.

Formats spécifiques Sage/EBP/Quadra/Ciel : préférer FEC pour import. Ne pas développer N intégrations avant demande explicite >10 utilisateurs.

## 12. TVA et fiscalité

- B2B FR : TVA 20% collectée par diag, récupérable côté client assujetti.
- B2C FR : TVA 20% non récupérable, e-reporting agrégé via PDP.
- **Franchise base TVA** (microentrepreneurs < 37 500 €/an services 2026) : pas de TVA collectée + mention obligatoire "TVA non applicable, art. 293 B du CGI" dans `IncludedNote` XML.

## 13. Archivage et conservation

| Pièce | Durée | Format |
|---|---|---|
| Facture (Code com. L123-22) | 10 ans | PDF/A-3 + XML |
| Rapport DPE | 10 ans | PDF |
| Devis signé | 10 ans (rattaché facture) | PDF/A signé |
| FEC | 6 ans (10 si contrôle) | TXT |

**Architecture** : Supabase Storage EU primaire + OVHcloud Object Storage Strasbourg ~0,005 €/Go/mo backup hebdo + PDP conservation probante 10 ans incluse.

## 14. UX clients B2C (particuliers)

- Factur-X PDF lisible normalement par destinataire humain. XML invisible. C'est l'intérêt vs UBL pur.
- E-reporting B2C : pas de PDP destinataire, agrégé par PDP émettrice vers PPF.
- Paiement B2C : Stripe Payment Link CB (Apple Pay/Google Pay possibles).

## 15. Pitfalls

- **Validation XSD stricte** : montants string 2 décimales, dates `YYYY-MM-DD`, ISO 3166/4217. Mitigation : librairie validée (mustangproject ou PDP).
- **PDF/A-3 strict** : polices embarquées full subset, ICC obligatoire, XMP `pdfaid:part=3 conformance=B`.
- **SEPA mandate revocation** : webhook `mandate.updated status=inactive` → désactiver auto-renewal.
- **Stripe webhook idempotency** : table `stripe_webhook_events(event_id UNIQUE)` + `ON CONFLICT DO NOTHING`.
- **SEPA 8-week chargeback** : risque cash-flow B2C, accepté Phase 1 (volume bas).
- **PDP outage** : SLA Iopole annoncé 99,9% ; Phase 2 contracter PDP secondaire failover.
- **Annuaire PPF lookup** : cache local SIRET→PDP destinataire TTL 24h max.
- **Microentreprise sans TVA** : flag `vat_exempt`, mention 293 B CGI dans IncludedNote.
- **Numérotation factures** : séquence continue annuelle sans saut, atomique Postgres.
- **Mentions légales** : 15 mentions CGI art. 242 nonies A obligatoires, validation pré-émission.
- **Stripe Invoice PDF auto** : désactiver `auto_advance=false` pour éviter double facture incohérente avec PDP.

## Recommended Approach (décisions clés)

1. **PDP : Iopole** Phase 1 (pure player API-first, ~0,10 €/facture). Fallback Pennylane. `[D703]`
2. **Génération Factur-X : déléguée à la PDP** Phase 1 ; mustangproject Dockerisé Railway en Phase 2 si volume >10 k factures/mois.
3. **Profil Factur-X : EN 16931** systématique.
4. **Stripe Billing** abonnements KOVAS, **SEPA priorité + CB fallback**, Stripe Tax activé, PDF Stripe désactivé.
5. **Stripe Payment Link** pour facturation client final des diagnostiqueurs.
6. **DocuSeal self-hosted Railway** par défaut (SES), **Yousign eIDAS AES** option +10 €/mo. `[D602]`
7. **Archivage** : Supabase Storage primaire + OVHcloud Strasbourg backup, 10 ans.
8. **Export comptable** : FEC standard Phase 1, intégrations spécifiques sur demande.

### Decision tree : DocuSeal SES vs Yousign eIDAS

```
Document à signer
   |
   v
Montant ?
   |
   +-- < 5 k EUR --> Devis simple / mission DPE -> SES DocuSeal (cas par defaut 95%)
   |
   `-- >= 5 k EUR --> Client final ?
                       |-- Notaire / acte authentique -> QES Yousign Qualifie (hors scope)
                       |-- Grand compte exigeant      -> AES Yousign (+10 EUR plan)
                       `-- Standard                    -> SES DocuSeal acceptable, AES preferable
```

## Cost forecast (cible 100 abonnés M12)

### Coûts KOVAS facturation abonnements (100 factures/mois)

| Poste | Coût |
|---|---|
| Stripe Billing (mix 70% SEPA / 30% CB) | ~57 €/mo |
| Stripe Tax 0,5% | ~30 €/mo |
| PDP Iopole (100 factures KOVAS) | ~10 €/mo |
| **Total abonnements** | **~97 €/mo (~0,97 €/abonné)** |

### Coûts utilisateurs (100 diags × 20 factures/mo = 2 000 factures/mo)

| Poste | Coût |
|---|---|
| PDP Iopole (2 000 factures diag) | ~200 €/mo |
| DocuSeal Railway (partagé) | ~6 €/mo |
| Yousign (10% diags premium × 5 sigs) | ~250 €/mo (couvert par option +10 € = neutre) |
| Stripe Payment Links | payés par diag, **pas par KOVAS** |
| **Total côté KOVAS** | **~460 €/mo = ~4,60 €/diag/mo** |

### Récap unitaire par abonné/mois

| Service | Coût |
|---|---|
| PDP Iopole (1 fact KOVAS + 20 fact diag) | ~2,10 € |
| Stripe fees KOVAS | ~0,57 € |
| DocuSeal partagé | ~0,06 € |
| Stripe Tax | ~0,30 € |
| **Total facturation/signature** | **~3,00-3,30 €/abonné/mo** |

Cohérent avec marge brute 60-65% PRD §12.5.

## Alternatives Considered

| Option | Verdict |
|---|---|
| PDP Iopole | **Recommandé Phase 1** |
| PDP Pennylane | Fallback |
| PDP Sellsy | Rejeté (redondance CRM) |
| PDP Generix | Rejeté (grand compte) |
| PDP self-hostée | Rejeté (>500 k€/an immatriculation) |
| Génération Factur-X Node pur | Rejeté Phase 1 (risque conformité) |
| mustangproject Java dockerisé | Reporté Phase 2 |
| facturx-php microservice | Rejeté (stack hétérogène) |
| **DocuSeal self-hosted** | **Recommandé SES** |
| **Yousign** | **Recommandé option premium** |
| Universign | Alternative Yousign |
| DocuSign | Rejeté (US, prix élevé) |
| Stripe Billing + PDF Stripe seul | Insuffisant post-09/2026 |
| PEPPOL direct sans PDP FR | Rejeté (non valide réforme FR) |

## Items à valider Phase 4 (Second Wave)

1. Tarification Iopole et Pennylane 2026 exacte par volume.
2. Liste officielle PDP immatriculées DGFiP au 01/09/2026.
3. Confirmer Stripe ne génère pas Factur-X nativement 2026.
4. Yousign pricing 2026 PAYG vs Business.
5. Iopole API doc : exemples requêtes/réponses, schéma webhook.
6. DocuSeal Railway Dockerfile à jour + ressources minimales.
7. PDP qui acceptent microentrepreneurs sans TVA (mention 293 B) — tests.
8. Validation avocat mentions légales obligatoires sur facture Nexus 1993.
9. Annuaire PPF API : doc accès (token, rate limit).
10. eIDAS 2 : impact sur SES/AES (révision 2024).
11. Sanctions : confirmer montants amendes 2026.
12. Qonto PDP : effective fin 2025 ou repoussée ?

## References

- DGFiP — https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique
- FNFE-MPE — https://fnfe-mpe.org/
- Validateur Factur-X — https://services.fnfe-mpe.org/
- mustangproject — https://github.com/ZUGFeRD/mustangproject
- DocuSeal — https://github.com/docusealco/docuseal
- Yousign API — https://developers.yousign.com/
- Stripe Billing FR — https://stripe.com/fr/billing
- Stripe SEPA — https://stripe.com/docs/payments/sepa-debit
- Iopole — https://iopole.fr
- Pennylane — https://docs.pennylane.com/
- EN 16931 — https://www.cen.eu/work/areas/ict/eBusiness/Pages/EN-16931.aspx
- Règlement eIDAS 910/2014 + eIDAS 2 (2024) — EUR-Lex
- Code Civil art. 1366-1367
- Loi de finances 2024 art. 91
- Arrêté 29 juillet 2013 (FEC)
