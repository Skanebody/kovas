# Planning Sprint MVP — 14 jours intensifs

**Date** : 2026-05-18 (révisé post-Modification 18)
**Mode** : solo + Cursor + Claude Code, 12-14h/jour
**Cible** : MVP V1 (**10 features cœur** post-Modification 18) build prod PWA + onboarding 10 bêta-testeurs initiaux à J14
**Buffer polish** : jours 15-18 (4 j réserve)

> **Cohérence avec CLAUDE.md §3 + Modification 18** : MVP V1 = 10 features cœur (vocal hybride, photos géo + annotations, auto-complétion adresse, templates pièces, check-lists, upload doc propriétaire, validation cohérence, bouton "Partager 3 modes", exports multi-format, sync offline). **Croquis 2D Apple Pencil retiré V1 → V2**.
>
> Cf. [`/docs/modification-18-mvp-v1-extended.md`](../../docs/modification-18-mvp-v1-extended.md) pour le détail complet.

---

## Découpage jour par jour

| Jour | Objectif | Livrables | Tests |
|---|---|---|---|
| **J1** | Setup monorepo + Supabase + auth + design system base | pnpm workspace OK + Supabase project eu-west-3 OK + auth Email+Magic Link OK + design tokens NativeWind 4 + shadcn/ui base | login E2E |
| **J2** | Design system complet (Glassmorphism, composants, Manrope) | 30+ composants base (Card, Button, Input, Pill, Avatar, Sidebar, BlurOverlay, KPISemiCircle, Pillbox, EmptyState…) + thèmes light/dark + Manrope chargée web+mobile | Storybook + dark mode toggle |
| **J3** | CRUD missions/clients/biens + auto-complétion adresse BAN/cadastre | Tables Supabase + RLS multi-tenant + écrans iPad/Web Mission/Client/Bien + auto-complétion BAN + récup cadastre IGN + Géorisques ERP | 3 missions crées + cadastre validé |
| **J4** | Saisie terrain mobile photos + géolocalisation | Vision Camera 4 capture HEIF + EXIF GPS + storage Supabase + thumb 1024px + annotations Apple Pencil (cercle, flèche, texte) via Skia | 20 photos capturées + sync |
| **J5** | Saisie vocale + transcription Whisper | `expo-audio` capture m4a 16kHz mono + VAD trim + upload Edge Function → OpenAI `gpt-4o-mini-transcribe` + retour transcript FR | 10 clips transcrits, p95 < 5s |
| **J6** | Structuration vocale IA (Claude API) | Edge Function `structure-voice-note` Claude Haiku 4.5 + tool use Zod + diag glossary FR 200 termes en system prompt cached 1h + écriture champs mission | Précision Whisper + Claude ≥ 90% sur 30 clips test |
| **J7** | **Checkpoint mi-parcours** + démo terrain réelle | Démo terrain réelle Benjamin sur 1 mission DPE complète (vocal + photos + structuration + export) | Vidéo démo + retours notés |
| **J8** | **Templates pièces pré-remplis + check-lists DPE + Amiante** (Modification 18) | Templates standard "Maison T2/T3/T4/T5" + check-lists par type diagnostic + validation complétude pré-export | 4 templates + 2 check-lists fonctionnels |
| **J9** | **Upload documents propriétaire + Dashboard + sync Realtime** (Modification 18) | Lien public `kovas.fr/upload/{token}` pour client → uploade factures énergie/plans/anciens DPE avant visite + Dashboard web + Supabase Realtime | Upload test client → fichiers visibles diagnostiqueur sur place |
| **J10** | **Validation cohérence + Mode offline complet** (Modification 18) | Règles métier ("Surface 100m² + chaudière 5kW = peu", etc.) + Service Worker + IndexedDB Dexie + queue mutations + LWW | Avion mode → 5 missions créées → sync à reconnect sans perte |
| **J11** | Export ZIP Liciel (reverse-engineering) + tests sur 25-30 cas réels | Microservice Java/Jackcess Linux Railway génère `.mdb` Jet 4.0 + XML CII pour Imports spécifiques + assemblage ZIP via Node + tests sur fixtures Liciel | 20+ exports ZIP importés OK dans Liciel V4 |
| **J12** | **Export PDF + Word + CSV + JSON + bouton "Partager vers Liciel" 3 modes** (Modification 18) | Edge Functions exports universels + bouton principal avec 3 modes (Email auto + Google Drive auto-sync + DL direct) + paramétrage user logiciel principal | 4 missions exportées dans 4 formats + 3 modes Partager testés |
| **J13** | Stripe abonnements **3 tiers** + page pricing + widget transparence + tests E2E Playwright | Stripe Billing 3 produits (Découverte 29€ / Standard 59€ / Volume 99€) + métering missions + webhook subscription.updated + page pricing kovas.fr + widget transparence in-app + Playwright E2E full flow signup → essai 14j → conversion → dépassement | E2E full flow vert |
| **J14** | **Build prod Vercel PWA + onboarding 10 bêta-testeurs initiaux** (post-pivot PWA) | Vercel deploy production kovas.fr + manifest PWA validé + Service Worker installable + invitations 10 bêta-testeurs par URL magic-link (plus TestFlight) + KB 20 articles publiés + onboarding emails séquence ready | 10 bêta-testeurs créent leur compte + "Add to Home Screen" iPad fonctionnel |

---

## Buffer polish (J15-J18, optionnel)

| Jour | Si glissement |
|---|---|
| J15 | Bug bash + perf optimization (cold start <2s) |
| J16 | Sentry + PostHog instrumentation complète + funnel signup |
| J17 | KB 20 articles relus + vidéo tour 60s tournée |
| J18 | TestFlight rollout 30-50 bêta-testeurs (cohorte complète) |

---

## Activités parallèles M0-M5 (avant sprint MVP, depuis M0)

### M0 (semaine 1-2, en parallèle setup)

- Création comptes services (cf. CLAUDE.md §19) : Anthropic, OpenAI, Stripe, Supabase, GitHub, Resend, Vercel, Expo EAS, Railway, Cloudflare, Google Workspace, D-U-N-S
- Setup repo `kovas-discovery-log` GPG signing
- Rédaction runbook bascule d'urgence Liciel
- Rédaction 3 assets com de crise (page Pourquoi KOVAS, FAQ technique, communiqué presse)

### M1

- Apple Developer enrollment (post D-U-N-S)
- Google Play Developer ($25 lifetime)
- INPI dépôt marque KOVAS (classes 9 + 42)
- LinkedIn Premium Business
- Achat licence Liciel 1 mois (~150€)
- Recrutement diagnostiqueurs partenaires fixtures (3 personnes, NDA + 100-200€/personne)

### M1-M5 (5 mois)

- **50 entretiens découverte** LinkedIn (Playwright agent + annuaire ADEME public scrapé)
- **Recrutement advisor diagnostiqueur** (poser la question à 3-5 candidats M3-M4)
- **Préparation 20 articles KB** (Claude génération + relecture)
- **Construction corpus 25-50 cas Liciel** (étape 1 démo + étape 2 diagnostiqueurs + étape 3 licence conditionnelle)
- Rédaction CGU/CGV/RGPD/cookies/mentions légales/DPA/charte bêta-testeurs via Claude Max

### M5 (avant bêta)

- Hiscox RC Pro + Cyber + extension PI souscrite (~900€/an)
- Banner cookies custom React déployé
- Page `/status` opérationnelle (custom Supabase + Resend)
- Canal `juridique@kovas.fr` opérationnel

### M6 — Lancement bêta privée (Phase A gratuite)

40-50 bêta-testeurs onboardés. Tarif 0€ pendant 1 mois (Phase A).

### M7 — Bascule bêta payante (Phase B)

Bêta-testeurs passent à tier Découverte 29€/mo. Validation économique.

### M9 — Lancement public

Bêta-testeurs migrent au tarif Founder à vie (Standard 49€). Ouverture inscription publique 3 tiers (29€/59€/99€).

---

## Métriques de succès Sprint 14j

| KPI | Cible J14 |
|---|---|
| Build production déployé (Vercel + iOS TestFlight) | ✅ Oui |
| Tests Vitest passing | ≥ 80% couverture |
| Tests E2E Playwright passing | 100% flux critiques |
| Crash-free rate mobile (sur 10 bêta-testeurs initiaux) | > 99% |
| Latence vocal p95 (capture → texte structuré) | < 5s |
| ZIP Liciel importable dans Liciel V4 (sur 25-30 fixtures) | ≥ 95% |
| 10 bêta-testeurs initiaux onboardés | ✅ Comptes créés |
| KB 20 articles publiés | ✅ Oui |
| Sentry + PostHog instrumentation | ✅ Events principaux trackés |

---

## Risques & mitigations sprint

| Risque | Probabilité | Mitigation |
|---|---|---|
| Vision Camera 4 + Skia perf insuffisante sur iPad ancien | MEDIUM | Test J4-J8 sur iPad Pro 2018 (A12), fallback Vision Camera 3 si besoin |
| Whisper latence > 5s sur 4G dégradé | MEDIUM | VAD trim + chunked + fallback Deepgram Frankfurt |
| Liciel n'accepte pas le ZIP généré Jackcess J12 | HIGH | Pivot immédiat Piste A (Imports spécifiques XML/Excel) — déjà testé J11 |
| Stripe Webhook idempotency bugs J13 | MEDIUM | Table `stripe_webhook_events(event_id UNIQUE)` + `ON CONFLICT DO NOTHING` |
| Sleep deprivation J7+ | HIGH | Checkpoint J7 = pause 12h obligatoire, démo terrain pour énergie |
| Bug bloquant J13 retarde build prod J14 | MEDIUM | Buffer J15-J18 utilisé pour rattraper |

---

## Anti-patterns à éviter

- ⛔ Ajouter des features hors MVP (Vision IA, croquis IA, recos F/G, etc. — toutes V2/V3)
- ⛔ Over-engineer le sync layer (LWW simple suffit Phase 1, pas de CRDT)
- ⛔ Cycler entre design web et design mobile (figer J2, ne plus toucher)
- ⛔ Tester Apple Developer enrollment dans le sprint (à faire M1, pas pendant les 14 jours)
- ⛔ Optimiser cold start avant J15 (priorité fonctionnel > perf)
- ⛔ Ajouter un test par fonction (≥ 80% couverture suffit, focus E2E)
