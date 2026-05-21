# R9 — Add-on Communauté Pro (6+ mois actif sans engagement social)

**Trigger code** : R9
**Target code** : `addon_community_pro`
**Template slug Brevo** : `upsell-r9-community-pro`
**Subject** : `Rejoignez la Communauté Pro KOVAS (9 €/mois)`
**Product line** : addon
**CTA path** : `/dashboard/upgrade/addons`
**Sender** : `KOVAS 360 <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `months_active` (number, mois actifs sur KOVAS)
- `next_masterclass_topic` (string, ex "DPE 3CL-2021 — pièges et corrections")
- `next_masterclass_date` (string, ex "27 juin 2026, 18 h")
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Vous utilisez KOVAS depuis <strong>{{ params.months_active }} mois</strong> —
vous faites partie des diagnostiqueurs expérimentés sur notre plateforme.</p>

<p>La <strong>Communauté Pro KOVAS à 9 €/mois</strong> vous donne accès à un espace
d'échange entre diagnostiqueurs métier :</p>
<ul>
  <li>Forum privé entre diagnostiqueurs KOVAS (vérifiés)</li>
  <li>Masterclass mensuelles (DPE, amiante, plomb, gaz, électricité, termites)</li>
  <li>Entraide réglementaire en direct (questions/réponses entre pros)</li>
  <li>Replays disponibles à vie</li>
</ul>

<p>Prochaine masterclass : <strong>{{ params.next_masterclass_topic }}</strong>
le {{ params.next_masterclass_date }}.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Rejoindre la Communauté Pro</a></p>

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

- Compte actif depuis ≥ 6 mois (basé sur `subscriptions.created_at`)
- Add-on `addon_community_pro` non actif
- Pas d'email R9 envoyé dans les 180 derniers jours
- `email_marketing_consent = true`
