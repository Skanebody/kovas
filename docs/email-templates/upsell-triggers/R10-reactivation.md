# R10 — Réactivation (compte gelé / inactif 30+ jours)

**Trigger code** : R10
**Target code** : `logiciel_starter` (proposition de réactivation au tarif Starter)
**Template slug Brevo** : `upsell-r10-reactivation`
**Subject** : `Votre compte KOVAS vous attend — réactivation en 1 clic`
**Product line** : logiciel
**CTA path** : `/dashboard/upgrade/reactivation`
**Sender** : `KOVAS 360 <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `days_inactive` (number, jours d'inactivité)
- `previous_plan` (string, plan actif avant la pause)
- `missions_count` (number, missions historisées)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Votre compte KOVAS 360 est en pause depuis <strong>{{ params.days_inactive }} jours</strong>.
Vous étiez précédemment abonné à <strong>{{ params.previous_plan }}</strong>.</p>

<p>Bonne nouvelle : <strong>vos données sont conservées</strong>. Au moment de la
réactivation, vous retrouvez :</p>
<ul>
  <li>{{ params.missions_count }} missions et leurs photos / saisies vocales</li>
  <li>Tous vos clients et biens</li>
  <li>Vos templates personnalisés et préférences</li>
  <li>Vos exports historiques</li>
</ul>

<p>Si vous le souhaitez, vous pouvez reprendre directement au tarif
<strong>KOVAS 360 Starter à 29 €/mois</strong> — résiliable à tout moment.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Réactiver mon compte</a></p>

<p>Si vous préférez clôturer définitivement votre compte ou récupérer vos données
au format ZIP, répondez simplement à ce mail — nous nous occupons du reste.</p>

<p>Cordialement,<br/>
L'équipe KOVAS 360</p>

<hr style="border:none;border-top:1px solid #E5DECB;margin:24px 0;" />

<p style="font-size:11px;color:#7E8AA4;">
NEXUS 1993 — SASU au capital de 500,00 €<br/>
66 Avenue des Champs Élysées, 75008 Paris, France<br/>
SIREN 982 786 154 — RCS Paris — TVA FR18982786154
</p>
```

## Conditions de déclenchement

- `subscriptions.status = 'canceled'` ou `last_active_at < now() - 30 days`
- Compte non clôturé (RGPD complet)
- Pas d'email R10 envoyé dans les 60 derniers jours
- `email_marketing_consent = true`
