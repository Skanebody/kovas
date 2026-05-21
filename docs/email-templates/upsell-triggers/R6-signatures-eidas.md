# R6 — Add-on signatures eIDAS (≥10 devis/mois)

**Trigger code** : R6
**Target code** : `addon_signatures_eidas`
**Template slug Brevo** : `upsell-r6-signatures-eidas`
**Subject** : `Signez vos devis en un clic avec l'add-on eIDAS`
**Product line** : addon
**CTA path** : `/dashboard/upgrade/addons`
**Sender** : `KOVAS 360 <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `quotes_per_month` (number, devis émis moyens)
- `current_signature_cost` (number, coût mensuel actuel à 2 €/signature)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Vous émettez en moyenne <strong>{{ params.quotes_per_month }} devis par mois</strong>
sur KOVAS 360. La signature électronique conforme accélère votre cycle de validation
et sécurise vos engagements clients.</p>

<p>L'<strong>add-on Signatures eIDAS à 19 €/mois</strong> vous offre :</p>
<ul>
  <li>Signature eIDAS Yousign illimitée (validité légale opposable)</li>
  <li>Suivi des signataires en temps réel</li>
  <li>Relances automatiques après 48 h sans signature</li>
  <li>Économie immédiate vs 2 €/signature à l'unité (actuellement ≈ {{ params.current_signature_cost }} €/mois)</li>
</ul>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Activer l'add-on Signatures</a></p>

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

- ≥10 devis émis par mois sur 2 mois consécutifs
- Add-on `addon_signatures_eidas` non actif
- Pas d'email R6 envoyé dans les 60 derniers jours
- `email_marketing_consent = true`
