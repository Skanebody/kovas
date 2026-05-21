# R1 — Plan upgrade (3 mois soft cap dépassé)

**Trigger code** : R1
**Target code** : `logiciel_active` (suggéré à user `logiciel_starter`)
**Template slug Brevo** : `upsell-r1-plan-upgrade`
**Subject** : `Vous économisez {{ params.savings_eur }}€/mois en passant à {{ params.target_plan }}`
**Product line** : logiciel
**CTA path** : `/dashboard/upgrade/logiciel`
**Sender** : `KOVAS 360 <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `current_plan` (string, ex "Starter 29€")
- `target_plan` (string, ex "Active 59€")
- `usage_avg_3mo` (number, missions moyennes 3 derniers mois)
- `cap_threshold` (number, soft cap du plan actuel)
- `savings_eur` (number, économie estimée annuelle)
- `cta_url` (string, ex "https://kovas.fr/dashboard/upgrade/logiciel?ref=upsell-r1&sid=...")

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Nous avons remarqué que votre activité sur KOVAS 360 dépasse régulièrement
le plafond de votre forfait <strong>{{ params.current_plan }}</strong> :
{{ params.usage_avg_3mo }} missions/mois sur les 3 derniers mois (plafond
souple à {{ params.cap_threshold }}).</p>

<p>En passant au forfait <strong>{{ params.target_plan }}</strong>, vous
bénéficiez de :</p>
<ul>
  <li>150 missions / mois (vs 60)</li>
  <li>IA Vision reconnaissance équipement</li>
  <li>Recommandations post-DPE F/G automatiques</li>
  <li>Support prioritaire sous 4 h</li>
</ul>

<p>Économie estimée par rapport au surplus actuel : <strong>{{ params.savings_eur }} €/an</strong>.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Découvrir Active 59€</a></p>

<p>Cordialement,<br/>
L'équipe KOVAS 360</p>

<hr style="border:none;border-top:1px solid #E5DECB;margin:24px 0;" />

<p style="font-size:11px;color:#7E8AA4;">
NEXUS 1993 — SASU au capital de 500,00 €<br/>
66 Avenue des Champs Élysées, 75008 Paris, France<br/>
SIREN 982 786 154 — RCS Paris — TVA FR18982786154
</p>
```

## Conditions de déclenchement (cf. `behavioral-triggers.ts` R1)

- 3 mois consécutifs au-dessus du soft cap missions (60 pour Starter)
- Plan actuel = `logiciel_starter` ou `logiciel_active`
- Pas d'email R1 envoyé dans les 90 derniers jours
- User a `email_marketing_consent = true`
