# Génération de rapports diagnostic — Spec V2 (post-certification ADEME + advisor)

> **Statut : non implémenté en V1.** Cette spec cadre le périmètre Phase 2 (M10-M18) après
> certification ADEME 3CL-2021 et recrutement de l'advisor diagnostiqueur certifié
> (CLAUDE.md §18). Aucune ligne de code Part B en V1 — KOVAS Phase 1 reste **compagnon Liciel**
> (cf. CLAUDE.md §2).

## Pourquoi V2 et pas V1

Conflit dur avec CLAUDE.md §2 :
> *"KOVAS Phase 1 = PWA Next.js 15 compagnon à Liciel. KOVAS ne remplace pas Liciel en Phase 1.
> Phase 2 (M10-M18) : KOVAS Complet remplace Liciel après certification ADEME 3CL-2021."*

Risques bloquants pour une implémentation V1 :

1. **Réglementaire** — Les rapports amiante/plomb/gaz/élec/termites/Carrez-Boutin/ERP doivent
   respecter strictement NF X46-020, NF X46-030, NF P 45-500, XP C 16-600, etc. Un rapport non
   conforme expose :
   - Le diagnostiqueur : retrait de certification COFRAC, fin d'activité
   - KOVAS : action en responsabilité plateforme + résiliation Hiscox RC pro
2. **Validation 25 cas réels par type** = impossible avant bêta (M6+)
3. **Audit legal IP/Tech** (Lefèvre/Lex2B, CLAUDE.md §14 Vague 2) planifié M9-M18
4. **Advisor diagnostiqueur certifié** pas encore recruté (CLAUDE.md §18)
5. **Archivage 50 ans + dépôt SI-amiante annuel** (article R.1334-29-9 CSP)

## Effort réaliste révisé

Estimation initiale spec : 3 jours pour 7 templates. **Sous-évalué de ~5×.**

| Template | Effort réel | Norme |
|---|---|---|
| Amiante | 3-4 j | NF X46-020 (Liste A/B/C, état 1/2/3) |
| Plomb CREP | 2-3 j | NF X46-030 (classes 0-3, XRF data) |
| Gaz | 2 j | NF P 45-500 (DGI/A1/A2) |
| Électricité | 3 j | XP C 16-600 (11 domaines B1-B11) |
| Termites | 1,5 j | Arrêté préfectoral commune |
| Carrez/Boutin | 1,5 j | Calcul surface incluse/exclue |
| ERP | 1 j | API Géorisques |
| **Sous-total** | **14-17 j** | |
| Validation advisor (par type, 1j review chacun) | 7 j | |
| Tests 25 cas réels par type | 5-10 j | |
| Audit legal | extern (1,5 k€ Vague 2) | |
| **Total réaliste** | **26-34 j** | |

## Périmètre cible V2

7 templates conformes (le DPE reste géré par Liciel jusqu'à certification ADEME) :

- Amiante (NF X46-020)
- Plomb CREP (NF X46-030)
- Gaz (NF P 45-500)
- Électricité (XP C 16-600)
- Termites
- Carrez / Boutin
- ERP (data Géorisques)

## Structure commune

1. Page de garde (logo KOVAS, identité diag, référence mission, date, adresse)
2. Identification (certification COFRAC + n°, RC pro, donneur ordre, propriétaire, bien)
3. Cadre réglementaire (textes applicables, périmètre, limites, réserves)
4. Données techniques (variable selon type)
5. Conclusions
6. Recommandations
7. Annexes (photos numérotées légendées, plans, documents complémentaires)
8. Signature électronique (eIDAS Advanced via Yousign — 2€/sig, cf. CLAUDE.md §4)

## Sections par template

### Amiante (NF X46-020)

- Liste A : matériaux à risque incident (état 1/2/3, photo, conclusion)
- Liste B : matériaux à risque après usure
- Liste C : matériaux à risque travaux
- Conclusion globale (synthèse + recommandations surveillance/MAJ/retrait)
- Annexes : rapports labo COFRAC, photos zones, plans annotés
- Obligations : validité illimitée si absence, **conservation 50 ans**, dépôt SI-amiante annuel

### Plomb CREP (NF X46-030)

- Date construction (< 1949 requis)
- Matériel XRF (marque, modèle, n° série, étalonnage)
- Tableau mesures par UD (concentration mg/cm², classe 0-3, état)
- Conclusion + travaux requis (classes 1, 2, 3)
- Validité : 1 an avec plomb, illimitée sans, 6 ans pour location

### Gaz (NF P 45-500)

- Caractéristiques (date install, énergie, type appareils)
- Éléments contrôlés (tuyauteries, raccordements, ventilation, combustion)
- Anomalies (DGI / A1 / A2)
- Validité : 3 ans (vente) / 6 ans (location)

### Électricité (XP C 16-600)

- Caractéristiques (compteur, puissance, ancienneté, protection)
- 11 domaines B1-B11 contrôlés
- Anomalies par domaine
- Validité : 3 ans (vente) / 6 ans (location)

### Termites

- Zone géographique + arrêté préfectoral
- Sondages effectués
- Constatations par zone (indices, présence oui/non/présomption)
- Validité : 6 mois

### Carrez / Boutin

- Loi appliquée (Carrez vente ou Boutin location)
- Tableau mesurage par pièce (surface, hauteur sous plafond, inclus oui/non)
- Surface totale + plan annoté

### ERP

- Risques naturels (inondation, sismique, mouvement terrain)
- Risques miniers / technologiques / pollution sols
- PPR applicable + carte zonage
- Info acquéreur/locataire à signer
- Validité : 6 mois

## Architecture technique V2 (proposée)

```
apps/web/src/components/reports/
├── ReportTemplate.tsx (base commune)
├── ReportHeader.tsx
├── ReportIdentification.tsx
├── ReportSignature.tsx
├── templates/
│   ├── AmianteReport.tsx
│   ├── PlombReport.tsx
│   ├── GazReport.tsx
│   ├── ElectriciteReport.tsx
│   ├── TermitesReport.tsx
│   ├── CarrezBoutinReport.tsx
│   └── ERPReport.tsx
└── shared/
    ├── PhotoGrid.tsx
    ├── AnomalyTable.tsx
    ├── ZoneTable.tsx
    └── RegulatoryFooter.tsx
```

Stack candidat :
- **Génération PDF** : `react-pdf` (renderer natif) ou Puppeteer + HTML/CSS. Décision V2 selon
  fidélité typo + perf.
- **Stockage** : Supabase Storage bucket `reports/` avec ACL stricte (signed URLs)
- **Signature** : Yousign (eIDAS Advanced, 2€/sig, CLAUDE.md §4)
- **Tracking email** : Resend webhooks (ouverture / clic / téléchargement / bounce)

## Tables SQL V2 (proposées)

```sql
CREATE TABLE report_templates (
  id            UUID PRIMARY KEY,
  diagnostic_type TEXT NOT NULL,
  version       TEXT NOT NULL,
  regulatory_norm TEXT NOT NULL,
  html_template TEXT,
  css_styles    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mission_reports (
  id          UUID PRIMARY KEY,
  mission_id  UUID REFERENCES missions(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  status      TEXT NOT NULL, -- 'draft' | 'signed' | 'sent' | 'archived'
  pdf_url     TEXT,
  generated_at TIMESTAMPTZ,
  signed_at   TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ,
  archive_until DATE,         -- 50 ans pour amiante
  organization_id UUID NOT NULL REFERENCES organizations(id)
);

CREATE TABLE email_tracking (
  id         UUID PRIMARY KEY,
  report_id  UUID REFERENCES mission_reports(id),
  event_type TEXT NOT NULL, -- 'sent' | 'opened' | 'clicked' | 'bounced'
  event_at   TIMESTAMPTZ DEFAULT now(),
  metadata   JSONB
);
```

## Workflow V1 actuel (rappel — pas de génération KOVAS)

1. Mission terrain terminée dans KOVAS
2. Export ZIP vers Liciel (bouton existant)
3. Liciel : calcul + ADEME + PDF officiel (côté utilisateur)
4. Le diagnostiqueur envoie le PDF Liciel au client par ses moyens habituels

V2 ajoutera :
- Drag-and-drop PDF Liciel dans la mission KOVAS
- Bouton "Envoyer au client" 1 clic + tracking
- Puis génération KOVAS native pour les 7 non-DPE
