# R4 — Bundle savings (dual track sans bundle)

**Trigger code** : R4
**Target code** : `bundle_active_pro` (suggéré aux abonnés double-track séparés)
**Template slug Brevo** : `upsell-r4-bundle-savings`
**Subject** : `Économisez {{ params.savings_eur }}€/mois en passant au Bundle KOVAS`
**Product line** : bundle
**CTA path** : `/dashboard/upgrade/bundle`
**Sender** : `KOVAS <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `current_plan` (string, composite ex "Active + Annuaire Pro")
- `bundle_target` (string, ex "Bundle Active + Annuaire Pro")
- `savings_eur` (number, économie mensuelle en €)
- `savings_eur_annual` (number, économie annuelle en €)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Vous êtes actuellement abonné à <strong>{{ params.current_plan }}</strong> sous
forme de deux abonnements séparés.</p>

<p>En basculant sur le <strong>{{ params.bundle_target }}</strong>, vous obtenez
les mêmes fonctionnalités pour <strong>{{ params.savings_eur }} €/mois de moins</strong>
(soit {{ params.savings_eur_annual }} €/an) :</p>
<ul>
  <li>Facture unique mensuelle</li>
  <li>Aucune fonctionnalité retirée</li>
  <li>Bascule instantanée sans interruption de service</li>
  <li>Possibilité de revenir aux abonnements séparés à tout moment</li>
</ul>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Basculer sur le bundle</a></p>

<p>Cordialement,<br/>
L'équipe KOVAS</p>

<hr style="border:none;border-top:1px solid #E5DECB;margin:24px 0;" />

<p style="font-size:11px;color:#7E8AA4;">
NEXUS 1993 — SASU au capital de 500,00 €<br/>
66 Avenue des Champs Élysées, 75008 Paris, France<br/>
SIREN 982 786 154 — RCS Paris — TVA FR18982786154
</p>
```

## Conditions de déclenchement

- Abonnement actif sur les deux tracks (annuaire + logiciel) en plans séparés
- 3 mois consécutifs avec les deux abonnements actifs
- Aucun bundle actif
- Pas d'email R4 envoyé dans les 120 derniers jours
- `email_marketing_consent = true`
