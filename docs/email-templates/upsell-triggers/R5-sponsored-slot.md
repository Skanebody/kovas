# R5 — Sponsored slot (Annuaire Visibilité 3+ mois, ville dense)

**Trigger code** : R5
**Target code** : `annuaire_sponsored`
**Template slug Brevo** : `upsell-r5-sponsored-slot`
**Subject** : `Slot sponsorisé disponible sur {{ params.city }} — priorité garantie`
**Product line** : annuaire
**CTA path** : `/dashboard/upgrade/sponsored`
**Sender** : `KOVAS <noreply@kovas.fr>`

## Variables Brevo attendues

- `first_name` (string)
- `city` (string, ville cible)
- `slot_price_eur` (number, prix mensuel du slot disponible)
- `monthly_demand_estimate` (number, estimation demandes/mois sur la zone)
- `cta_url` (string)

## Body HTML

```html
<p>Bonjour {{ params.first_name }},</p>

<p>Vous êtes abonné à <strong>Annuaire Visibilité</strong> depuis plus de trois mois
sur la zone <strong>{{ params.city }}</strong>. Cette zone présente un volume estimé
de {{ params.monthly_demand_estimate }} demandes par mois — suffisant pour rentabiliser
un slot sponsorisé.</p>

<p>Le <strong>slot sponsorisé à {{ params.slot_price_eur }} €/mois</strong> vous garantit :</p>
<ul>
  <li>Affichage prioritaire en tête des résultats de votre zone</li>
  <li>Lead routing intelligent (vous + 1 backup)</li>
  <li>Statistiques de conversion détaillées</li>
  <li>Engagement mensuel résiliable à tout moment</li>
</ul>

<p>Le slot est attribué au premier arrivé — il peut être déjà pris la semaine prochaine.</p>

<p><a href="{{ params.cta_url }}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ Voir les slots disponibles</a></p>

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

- Plan actif `annuaire_visibility` depuis ≥ 3 mois
- Densité de demandes mensuelles ≥ moyenne sur la zone (estimée par lookup interne)
- Aucun slot sponsorisé déjà attribué à l'utilisateur
- Pas d'email R5 envoyé dans les 90 derniers jours
- `email_marketing_consent = true`
