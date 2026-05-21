# R2 — Découverte Annuaire (utilisateur logiciel-only sans présence Annuaire)

**Trigger code** : R2
**Target code** : `annuaire_pro` (suggéré aux abonnés KOVAS 360 sans fiche Annuaire active)
**Template slug Brevo** : `upsell-r2-annuaire-discovery`
**Subject** : `Activez votre fiche Annuaire Pro et captez vos premiers leads`
**Product line** : annuaire
**CTA path** : `/dashboard/upgrade/annuaire`
**Sender** : `KOVAS <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `current_plan` (string, ex "KOVAS 360 Active")
- `days_without_lead` (number, jours sans leads B2C)
- `city` (string, ville principale du diagnostiqueur)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Vous êtes abonné à <strong>{{ params.current_plan }}</strong> mais votre cabinet
n'apparaît pas encore sur <strong>KOVAS Annuaire</strong> — l'annuaire public utilisé
par les particuliers de votre zone pour trouver un diagnostiqueur.</p>

<p>En activant l'<strong>Annuaire Pro à 19 €/mois</strong>, vous bénéficiez de :</p>
<ul>
  <li>Fiche professionnelle enrichie (photos, zone de chalandise, certifications)</li>
  <li>Leads particuliers illimités</li>
  <li>Statistiques de visibilité hebdomadaires</li>
  <li>Badge "Vérifié" sous 48 h</li>
</ul>

<p>Les diagnostiqueurs Annuaire Pro reçoivent en moyenne 4 à 8 leads qualifiés par mois.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Activer l'Annuaire Pro</a></p>

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

- Plan actif sur le track logiciel uniquement (`logiciel_starter` / `logiciel_active` / `logiciel_cabinet`)
- 0 leads B2C captés depuis 60 jours (ou jamais)
- Pas d'email R2 envoyé dans les 90 derniers jours
- `email_marketing_consent = true`
