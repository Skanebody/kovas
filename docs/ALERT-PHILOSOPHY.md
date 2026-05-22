# Philosophie des alertes KOVAS

> Document de référence transverse — toute fonctionnalité qui présente un signal
> au diagnostiqueur (warning, suggestion, validation, notification) DOIT respecter
> ces 7 principes.

## 7 principes directeurs

1. **Le diagnostiqueur a toujours raison.** Aucune alerte n’est bloquante.
2. **Marges de tolérance larges.** On préfère manquer un faux positif que noyer le diagnostiqueur.
3. **Maximum 3 alertes par mission.** Plafond strict, appliqué par `consolidator.ts`.
4. **Maximum 1 suggestion proactive par jour.** Plafond strict, appliqué par `proactive-suggester.ts`.
5. **Ton aidant, jamais accusateur.** « Vous pouvez… » et non « Vous devez… ».
6. **Apprentissage par ignorance.** 5 ignorances consécutives → auto-désactivation silencieuse.
7. **Pas de "vous devriez".** Le vouvoiement est sobre, jamais culpabilisant.

## Banque de formulations

### À bannir
`Anomalie`, `Erreur`, `Non conforme`, `Risque grave`, `Vous devez`, `Il est obligatoire`,
`Attention`, `Alerte`, `Problème`, `Échec`, `incohérent`, `critique`.

### À privilégier
- « J’ai vu un petit écart… »
- « Tu peux jeter un œil… »
- « Petit point… »
- « Bon à savoir… »
- « Pour info… »
- « Vous pouvez vérifier… »
- « Un point à regarder… »

Le filtre est automatique via `filterTone(text)` dans
[`apps/web/src/lib/alerts/formulations.ts`](../apps/web/src/lib/alerts/formulations.ts).

## Architecture

```
apps/web/src/
├── components/shared/
│   └── AlertManager.tsx              ← UI centrale, applique les 3 alertes max
└── lib/alerts/
    ├── types.ts                      ← Finding, AlertPreferences, constantes
    ├── formulations.ts               ← filterTone(), banque OK/banned
    ├── severity-scorer.ts            ← scoreSeverity(finding, ctx)
    ├── consolidator.ts               ← consolidateFindings(findings, maxN=3)
    ├── user-preferences.ts           ← get/update préférences org
    └── learning-engine.ts            ← recordDismissal, shouldAutoDisable
```

## Tables DB

| Table | Rôle |
|---|---|
| `alert_preferences`   | 1 ligne / org, toutes les préférences user |
| `alert_dismissals`    | Audit + apprentissage (chaque dismiss = 1 ligne) |
| `alert_auto_disabled` | État courant des types auto-désactivés |

Toutes RLS `is_member_of(organization_id)`.

## Cycle de vie d’une alerte

1. Un checker métier (coherence, pre-export, fraud detection) produit un `Finding`.
2. `AlertManager` reçoit la liste et applique :
   - filtrage des types auto-désactivés (depuis `alert_auto_disabled`)
   - `consolidateFindings(maxN=3)` → fusion + plafond
   - `filterTone` sur chaque message
3. Le diagnostiqueur peut **ignorer** chaque alerte (X cliquable).
4. Le dismiss insère une ligne dans `alert_dismissals`.
5. L’Edge Function `recalibrate-alerts-for-user` (hebdomadaire) scanne les
   dismissals des 30 derniers jours. À 5+ ignorances → upsert
   `alert_auto_disabled`.
6. Après auto-disable, l’alerte ne se présente plus jamais (sauf réactivation
   manuelle depuis la page préférences).

## Suggestions proactives

`proactive-suggester.ts` garantit :
- Compteur en mémoire keyé `(userId, YYYY-MM-DD)` Europe/Paris.
- Plafond : **1 suggestion / jour / utilisateur**.
- Respect des modes : `disabled`, `checkout_only`, `in_mission`.

## Modules recalibrés

| Module | Changement |
|---|---|
| `lib/coherence-validation.ts` | `filterTone` appliqué + helper `coherenceWarningToFinding` |
| `app/.../coherence-warnings.tsx` | Délègue à `AlertManager` (plafond 3) |
| `lib/pre-export/orchestrator.ts` | Nouveau — pipeline pré-export avec maxN=3 |
| `lib/local-ai/proactive-suggester.ts` | Nouveau — rate-limit 1/jour |
| `lib/email/send.ts` | Reformulation des tonalités DPE quota |
| `app/.../owner-documents-list.tsx` | `Échec analyse` → `À reprendre` |

## Page utilisateur

`/app/account/preferences/alertes` — switches sobres avec descriptions claires :
- Détection d’incohérences DPE (sensibilité 3 niveaux)
- Pré-vérification avant export (standard / permissif)
- Suggestions pendant la mission (disabled / checkout / in-mission)
- Coach IA (off / hebdo / mensuel / trimestriel)
- Notifications de leads (plage calme + week-end)
- Reconnaissance professionnelle (statuts sobres, jamais « Hero/Légende »)

## Règles pour les nouvelles features

Quand vous ajoutez un signal au diagnostiqueur :

1. **Ne créez pas votre propre UI d’alerte.** Utilisez `<AlertManager>` ou produisez des `Finding[]`.
2. **N’écrivez jamais les mots bannis.** Pas même dans une string template. Si vous avez besoin d’une formulation, passez par `filterTone()`.
3. **Pensez "ignorance".** Toute alerte doit pouvoir être ignorée et apprise.
4. **Préférez un Finding `info` à un Finding `warning`** quand le doute est permis.
5. **Pas plus de 1 push notification / jour.** Sauf événement réglementaire majeur.

— Dernière mise à jour 2026-05-22.
