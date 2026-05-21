# R8 — Add-on SMS rappels (≥20 RDV/mois)

**Trigger code** : R8
**Target code** : `addon_sms_reminders`
**Template slug Brevo** : `upsell-r8-sms-reminders`
**Subject** : `Réduisez vos no-shows avec les SMS rappels J-1`
**Product line** : addon
**CTA path** : `/dashboard/upgrade/addons`
**Sender** : `KOVAS 360 <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `rdv_per_month` (number, RDV moyens par mois)
- `no_show_estimated_cost` (number, coût estimé des no-shows mensuels en €)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Vous gérez en moyenne <strong>{{ params.rdv_per_month }} rendez-vous par mois</strong>
sur KOVAS 360. Les no-shows clients (absences non prévenues) représentent un coût
caché estimé à {{ params.no_show_estimated_cost }} €/mois en moyenne.</p>

<p>L'<strong>add-on SMS rappels à 9 €/mois</strong> :</p>
<ul>
  <li>SMS rappel automatique J-1 (1 000 SMS inclus/mois)</li>
  <li>Templates personnalisables (texte + signature)</li>
  <li>Confirmation client en un clic (lien dans le SMS)</li>
  <li>Réduction mesurée des no-shows : -35 % en moyenne</li>
</ul>

<p>Retour sur investissement immédiat dès 1 RDV évité par mois.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Activer les SMS rappels</a></p>

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

- ≥20 RDV par mois sur 2 mois consécutifs
- Add-on `addon_sms_reminders` non actif
- Pas d'email R8 envoyé dans les 60 derniers jours
- `email_marketing_consent = true`
