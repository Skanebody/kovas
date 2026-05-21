# R7 — Add-on Pennylane sync (≥10 factures/mois)

**Trigger code** : R7
**Target code** : `addon_pennylane_sync`
**Template slug Brevo** : `upsell-r7-pennylane-sync`
**Subject** : `Synchronisez votre facturation avec Pennylane (9 €/mois)`
**Product line** : addon
**CTA path** : `/dashboard/upgrade/addons`
**Sender** : `KOVAS 360 <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `invoices_per_month` (number, factures émises moyennes)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Vous émettez en moyenne <strong>{{ params.invoices_per_month }} factures par mois</strong>
sur KOVAS 360. Synchroniser votre facturation avec Pennylane vous fait gagner
plusieurs heures de saisie comptable chaque mois.</p>

<p>L'<strong>add-on Pennylane à 9 €/mois</strong> :</p>
<ul>
  <li>Synchronisation factures + devis automatique (toutes les 15 min)</li>
  <li>Encaissements pré-rapprochés</li>
  <li>TVA prête pour votre comptable / expert-comptable</li>
  <li>Configuration en 3 minutes (token Pennylane uniquement)</li>
</ul>

<p>Aucun risque : si Pennylane n'est pas votre solution comptable, vous pouvez
désactiver l'add-on en un clic.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Connecter Pennylane</a></p>

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

- ≥10 factures émises par mois sur 2 mois consécutifs
- Add-on `addon_pennylane_sync` non actif
- Plan logiciel actif (pas pertinent pour annuaire-only)
- Pas d'email R7 envoyé dans les 60 derniers jours
- `email_marketing_consent = true`
