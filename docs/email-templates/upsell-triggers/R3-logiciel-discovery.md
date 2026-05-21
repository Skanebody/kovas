# R3 — Découverte KOVAS 360 (utilisateur annuaire-only avec leads actifs)

**Trigger code** : R3
**Target code** : `logiciel_starter` (suggéré aux abonnés Annuaire Pro/Visibilité/Sponsored sans logiciel)
**Template slug Brevo** : `upsell-r3-logiciel-discovery`
**Subject** : `Vos leads méritent un logiciel métier — découvrez KOVAS 360 Starter`
**Product line** : logiciel
**CTA path** : `/dashboard/upgrade/logiciel`
**Sender** : `KOVAS 360 <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `current_plan` (string, ex "Annuaire Pro")
- `leads_accepted_per_month` (number, leads acceptés moyens)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Votre fiche <strong>{{ params.current_plan }}</strong> capte régulièrement des
leads — vous acceptez en moyenne {{ params.leads_accepted_per_month }} missions par mois
via KOVAS Annuaire.</p>

<p>Pour transformer ces leads en chiffre d'affaires sans perdre de temps administratif,
<strong>KOVAS 360 Starter à 29 €/mois</strong> vous accompagne sur toute la production :</p>
<ul>
  <li>Saisie vocale terrain (gain de 1 h 30 par DPE)</li>
  <li>Export multi-format (PDF, ZIP Liciel, Word, CSV)</li>
  <li>4 diagnostics inclus (DPE, Amiante, Carrez, ERP)</li>
  <li>Essai 14 jours sans carte bancaire</li>
</ul>

<p>L'essai n'engage à rien — vous repassez en Annuaire seul si l'outil ne vous convient pas.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Essayer KOVAS 360 Starter</a></p>

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

- Plan actif uniquement track annuaire (`annuaire_pro` / `annuaire_visibility` / `annuaire_sponsored`)
- ≥5 leads acceptés/mois sur 2 mois consécutifs
- Pas d'email R3 envoyé dans les 90 derniers jours
- `email_marketing_consent = true`
