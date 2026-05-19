# Dashboard KOVAS — Spec cockpit V1

> Vision complète discutée 2026-05-18. Ce doc cadre **uniquement le périmètre V1**.
> Les blocs/optimisations V1.5+ sont listés en bas pour traçabilité.

## Philosophie

Le dashboard est la première chose vue chaque matin. Cible : **cockpit business** pour avatar diagnostiqueur 43 ans (sobre, dense mais pas surchargé, mobile-first, JAMAIS gaming/lifestyle).

L'utilisateur ouvre KOVAS le matin → voit sa journée → démarre. C'est tout.

## Blocs V1 (sprint courant)

### 1. Header + identité
Existant (`apps/web/src/app/app/layout.tsx`) :
- Logo + nom user + UsageWidget + ThemeToggle + Logout
- Sticky, glassmorphism `bg-card/80 backdrop-blur-md`
- **Pas de refonte V1** : le shell actuel respecte déjà le DS §9 CLAUDE.md

### 2. Bloc "Vue du jour" (priorité #1)
Liste des dossiers `scheduled_at::date = today` (timezone Europe/Paris) :
- Heure RDV
- Référence + adresse + ville
- Badges types de diag (DPE, Amiante, …)
- Bouton **Reprendre / Démarrer** → `/app/dossiers/{id}` (ou `/#mission-{id}` pour la première mission active)

**Empty state** : "Aucune visite aujourd'hui. Profitez-en pour finaliser vos exports."

### 3. Bloc "À finaliser"
Dossiers terminés sur le terrain mais pas exportés. Critères :
- `dossiers.status IN ('back_office', 'on_site')`
- OR missions avec `status='to_review'`
- OR missions avec checklist incomplète depuis > 1 jour (post-V1, trop coûteux à calculer côté serveur en V1)

Pour chaque dossier → bouton "Compléter" → `/app/dossiers/{id}`.

**Empty state** : "Tout est à jour. Bien joué."

### 4. Bloc "Stats semaine"
Agrégats simples sur `missions.completed_at >= lundi_courant` :
- Dossiers traités
- Missions terminées
- Nouveaux clients
- Comparaison vs semaine précédente (delta % en vert/rouge sobre)

**Pas de graphes** V1 — juste des chiffres en gras.

### 5. Bloc "Activité récente"
Timeline des 10 derniers events (cross-entité), tri par `created_at desc` :
- Dossier créé
- Mission terminée
- Photo uploadée
- Document client reçu
- Note vocale transcrite

Format sobre : `Il y a 5 min · Mission DPE Dupont terminée`.

### 6. CTA principal "+ Nouveau dossier"
Déjà présent. Conserver, juste s'assurer qu'il est très visible (CTA pillule cobalt, cf. CLAUDE.md §9).

## Hors-V1 (V1.5+, à NE PAS faire maintenant)

- ❌ Météo locale (API tierce + cache + clé)
- ❌ Trajets entre missions (Mapbox €€)
- ❌ Tournée optimisée sur carte
- ❌ Pipeline commercial devis/factures (Phase 2)
- ❌ Gain Tracker permanent (planifié sprints 15-17, V1.5)
- ❌ Mode tournée plein écran (V1.5)
- ❌ Widgets PWA iOS/Android (V2)
- ❌ Drag-and-drop blocs + `user_dashboard_preferences` (V2)
- ❌ Workflow Bézier 4 colonnes connectées (overkill — `WorkflowStepper` linéaire suffit)
- ❌ Recherche universelle FTS (V1.1)

## 8 features dashboard haute valeur (révision 2026-05-18)

Ajout au scope V1/V1.5 selon ROI utilisateur estimé. Spec source : message produit
2026-05-18 ("Dashboard haute valeur + génération rapports conformes").

| # | Feature | Statut | Effort | ROI util. |
|---|---|---|---|---|
| F1 | **Mission imminente** — card auto T-30/T-15/T+0/T+60 | V1.5 (Edge cron) | 1 j | 50 €/mois |
| F2 | **Clients récents** — top 5 derniers clients dashboard | ✅ V1 | 0,5 j | 120 €/mois |
| F3 | **Indicateur sync** — badge online/syncing/offline | V1.5 (queue offline incomplète) | 1 j | NPS +10 |
| F4 | **Badges docs manquants** — sur cards mission + bouton Relancer | ✅ V1 | 0,5 j | 200 €/mois |
| F5 | **Actions rapides** — tel / SMS / GPS / Démarrer | ✅ V1 | 0,5 j | 100 €/mois |
| F6 | **Quick Add Mission vocal** — Whisper + Claude Haiku parsing | V1.5 (BAN+géocodage) | 1,5 j | 150 €/mois |
| F7 | **Compteur DPE 1000/an** — protection certif | V1.5 (champ certif manquant) | 0,5 j | protection cert. |
| F8 | **Micro-feedback Sonner** — toasts standardisés | ✅ V1 | 1 j | NPS +10 |

**Livrable V1 courant** : F2 + F4 + F5 + F8 (~2,5 j) — ROI ~520 €/mois utilisateur sans nouveau
risque infrastructure.

### F2 Clients récents — détail

5 derniers clients avec dossier le plus récent. Sur tap, ouvre fiche client.

```sql
select c.id, c.display_name, c.email, c.phone,
       max(d.created_at) as last_dossier_at,
       (select count(*) from dossiers d2
        where d2.client_id = c.id
          and d2.organization_id = c.organization_id
          and d2.deleted_at is null) as total_dossiers
from clients c
left join dossiers d on d.client_id = c.id and d.deleted_at is null
where c.organization_id = $1 and c.deleted_at is null
group by c.id
order by last_dossier_at desc nulls last
limit 5;
```

### F4 Badges docs manquants — détail

Sur chaque mission de la TodayBlock, afficher les docs propriétaire requis non encore reçus
(check `owner_documents` + types attendus par type de diagnostic). Bouton "Relancer client"
ouvre lien public upload existant.

Check par type :
- DPE : facture énergie, plan, ancien DPE, année construction
- Amiante : permis construire, anciens diag
- Plomb CREP : année construction
- Gaz/Élec : justificatif compteur

### F5 Actions rapides — détail

4 boutons sur chaque card mission de la TodayBlock :
- 📞 Appeler : `tel:{phone}`
- 🗺️ GPS : iOS `maps:?daddr=...`, Android `geo:0,0?q=...`, desktop Google Maps fallback
- 💬 SMS : `sms:{phone}?body={template}`
- ▶️ Démarrer : route vers la mission active du dossier

### F8 Toasts Sonner — détail

Sonner installé (~5 kb). Helper `toast()` exposé :
- `toast.success("Mission démarrée à 11:08")` — vert 2,5 s
- `toast.error("Erreur upload")` — rouge 5 s
- `toast.warning("Connexion perdue, mode offline")` — orange 5 s
- `toast.info("...")` — neutre

Skeleton loaders et haptic feedback (Web Vibration API) reportés V1.5.

## Génération de rapports conformes

**Hors-scope V1.** Cf. [docs/report-templates.md](report-templates.md) — Phase 2 (M10-M18) après
certification ADEME 3CL-2021 + recrutement advisor diagnostiqueur certifié + audit legal
(CLAUDE.md §14 Vague 2). Conflit dur avec CLAUDE.md §2 si tenté en V1.

## Performance

- **Promise.all** sur les queries de chaque bloc → 1 round-trip côté server component
- Cible TTI : < 800 ms (mesurer post-implémentation)
- Pas de skeleton V1 (Server Components → page rendue prête)

## Design tokens

Hérite intégralement de CLAUDE.md §9 — palette crème + cobalt + butter (Ron Design Lab × Tectra), typo Outfit + Instrument Serif italic, glassmorphism léger, ombres neutres. **Aucune redéfinition** ici.
