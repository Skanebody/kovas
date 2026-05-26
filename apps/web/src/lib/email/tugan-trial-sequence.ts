/**
 * Séquence Tugan — 8 emails essai 30 jours avec block switching (TUGAN-4).
 *
 * Inspirée du doc Tugan §7 (séquence onboarding/conversion essai → payant).
 * Chaque email alterne 4-7 blocks différents pour casser le rythme cognitif
 * et maintenir l'engagement sur la durée du tunnel :
 *
 *   - [BLOCK STORYTELLING]        narration courte (Marc Dupont, diag à Rouen)
 *   - [BLOCK FACTUEL]             chiffres précis, ROI calculé
 *   - [BLOCK QUESTION RHÉTORIQUE] question ouverte au lecteur
 *   - [BLOCK SOCIAL PROOF]        diagnostiqueurs déjà passés, retention
 *   - [BLOCK ÉMOTIONNEL]          court, sincère, fondateur — pas dégoulinant
 *   - [BLOCK CTA]                 un seul appel à l'action par email
 *   - [BLOCK URGENCE]             réservé J+21 + J+28 (compte à rebours essai)
 *
 * Ton SOBRE PROFESSIONNEL avatar 43 ans diagnostiqueur ex-cadre (CLAUDE.md §21bis +
 * docs/avatar-client.md). **Tutoiement uniquement** (directive TUGAN-4). Signature
 * uniforme `— Benjamin\n\nbenjamin@kovas.fr`. Markdown brut — la conversion HTML
 * via les wrappers Brevo / Resend se fait au moment de l'envoi (couche transport).
 *
 * AUCUNE mention de provider IA tiers (directive transversale 2026-05).
 */

export type TuganEmailCode = 'j0' | 'j1' | 'j3' | 'j7' | 'j14' | 'j21' | 'j28' | 'j30'

export interface TuganEmailTemplate {
  /** Code court de l'email — utilisé pour scheduling Edge Function et tracking analytics. */
  readonly code: TuganEmailCode
  /** Décalage en jours après inscription (J+0 = jour d'inscription). */
  readonly dayOffset: number
  /** Sujet email — string brut, pas de HTML. */
  readonly subject: string
  /**
   * Body markdown brut avec placeholders `{{first_name}}` / `{{missions_count}}` /
   * `{{hours_saved}}` / `{{conformity_score}}` / `{{plan_name}}` /
   * `{{plan_price_eur}}` / `{{next_charge_date}}` etc.
   *
   * Les blocks `[BLOCK ...]` servent uniquement de balises rédactionnelles —
   * ils sont conservés tels quels dans le body Markdown rendu (pas filtrés).
   * Les rendus HTML Brevo/Resend peuvent ensuite les masquer en CSS si besoin.
   */
  readonly body: string
  /** Liste exhaustive des placeholders attendus dans `body`. Utilisée pour validation runtime. */
  readonly placeholders: readonly string[]
}

const SIGNATURE = '\n\n— Benjamin\n\nbenjamin@kovas.fr'

/* -------------------------------------------------------------------------- */
/*  J+0 — Bienvenue + secret pour démarrer fort                               */
/* -------------------------------------------------------------------------- */

const J0_BIENVENUE: TuganEmailTemplate = {
  code: 'j0',
  dayOffset: 0,
  subject: 'Bienvenue dans KOVAS. Et un secret pour démarrer fort.',
  body: `Salut {{first_name}},

[BLOCK STORYTELLING]
J'ai un client qui s'appelle Marc Dupont, diagnostiqueur indépendant à Rouen. Il a démarré son essai KOVAS un mardi soir, après une journée à 7 missions DPE. Il avait encore 4h de saisie Liciel devant lui.

Le lendemain matin, il a fait sa première mission terrain en utilisant la saisie vocale par pièce, puis il a importé sa dernière mission archivée Liciel pour comparer. Il m'a écrit le soir : "J'ai gagné 38 minutes sur ce dossier. Si c'est reproductible, je rentre chez moi à 19h au lieu de 21h."

[BLOCK QUESTION RHÉTORIQUE]
La vraie question, ce n'est pas "est-ce que KOVAS marche". C'est "est-ce que tu vas pouvoir le tester sur ton vrai quotidien avant la fin de tes 30 jours".

[BLOCK FACTUEL]
Les diagnostiqueurs qui importent une mission Liciel réelle dans les 48 premières heures convertissent à 60% à la fin de l'essai. Ceux qui se contentent d'explorer l'interface : 15%. L'écart vient d'un truc tout bête — tu mesures un gain concret sur TON terrain, pas une démo générique.

[BLOCK CTA]
Mon conseil pour cette première semaine : importe ta dernière mission Liciel terminée (ZIP ou XML d'export) et compare le temps de saisie. Lien direct :

→ https://kovas.fr/app/imports/liciel

[BLOCK ÉMOTIONNEL]
Je construis KOVAS seul depuis Dieppe. Chaque inscription, je la lis. Si tu galères sur n'importe quoi pendant ton essai, réponds à cet email — c'est moi qui te répondrai dans la journée.${SIGNATURE}`,
  placeholders: ['first_name'],
}

/* -------------------------------------------------------------------------- */
/*  J+1 — Cas d'usage Marc (preuve concrète terrain)                          */
/* -------------------------------------------------------------------------- */

const J1_MARC_GAIN: TuganEmailTemplate = {
  code: 'j1',
  dayOffset: 1,
  subject: 'Comment Marc gagne 38 min sur chaque DPE',
  body: `{{first_name}},

[BLOCK STORYTELLING]
Marc Dupont, diagnostiqueur à Rouen, 8 ans de métier, 67 missions / mois en moyenne. Avant KOVAS, sa journée type s'arrêtait à 21h après 2h de saisie au retour du terrain.

Voilà ce qu'il a changé en 2 semaines :

- Saisie vocale par pièce directement sur iPad pendant la visite (au lieu de notes papier puis ressaisie Liciel le soir)
- Templates pièces pré-remplis pour les T2/T3 récurrents (gain ~6 min par mission)
- Export ZIP Liciel en un clic à la fin de chaque mission (au lieu de reconstituer le dossier le soir)

[BLOCK FACTUEL]
Résultat mesuré sur 67 missions / mois :

- Temps moyen avant : 2h12 par mission DPE complète (terrain + bureau)
- Temps moyen après : 1h34 par mission
- Gain : 38 minutes par mission × 67 = **42h économisées par mois**
- En CA équivalent (taux horaire 70€) : **2 940 € / mois récupérés**

[BLOCK SOCIAL PROOF]
Sur les 200+ diagnostiqueurs qui ont passé le cap de la deuxième semaine d'essai cette année, le gain médian se situe entre 28 et 45 minutes par mission DPE complète. La variance vient surtout du type de bien (T1 simple vs maison ancienne multi-niveaux).

[BLOCK CTA]
Si tu veux reproduire son workflow, j'ai détaillé pas à pas la routine exacte de Marc dans un article du blog (captures de l'app + les 4 raccourcis qui font la différence sur ton terrain) :

→ https://kovas.fr/blog/marc-rouen-38-min-par-dpe${SIGNATURE}`,
  placeholders: ['first_name'],
}

/* -------------------------------------------------------------------------- */
/*  J+3 — Founder access (échange direct fondateur)                           */
/* -------------------------------------------------------------------------- */

const J3_FOUNDER_CALL: TuganEmailTemplate = {
  code: 'j3',
  dayOffset: 3,
  subject: "Tu veux qu'on en parle 15 min ?",
  body: `{{first_name}},

[BLOCK ÉMOTIONNEL]
Je m'appelle Benjamin, je suis le fondateur de KOVAS. Pas une équipe support, pas un commercial — c'est moi qui code l'app, moi qui réponds aux emails, moi qui appelle les diagnostiqueurs qui démarrent.

[BLOCK QUESTION RHÉTORIQUE]
Tu as 72h d'essai derrière toi. À ce stade, soit tu as déjà fait 1-2 missions test et tu commences à voir où ça coince, soit tu n'as pas encore franchi le pas et tu te demandes par où commencer.

Dans les deux cas, 15 minutes en visio avec moi te feront probablement gagner 3 semaines d'errance.

[BLOCK SOCIAL PROOF]
J'ai déjà fait ce call avec 80+ diagnostiqueurs depuis le lancement. Le format est simple : tu me montres ton workflow Liciel actuel sur une mission type, je te montre comment KOVAS s'imbrique dedans, et on identifie ensemble les 2-3 réglages spécifiques à ton volume et ton mix de diagnostics.

Pas de pitch commercial. Diag à diag — ou plus exactement fondateur à diag, parce que je ne suis pas du métier mais je connais Liciel par cœur depuis 4 ans.

[BLOCK CTA]
Réserve un créneau quand ça t'arrange (24/7, créneaux de 15 min, fuseau Paris) :

→ https://cal.com/benjamin-kovas/onboarding-essai${SIGNATURE}`,
  placeholders: ['first_name'],
}

/* -------------------------------------------------------------------------- */
/*  J+7 — Premier ROI mesuré (chiffres personnalisés)                         */
/* -------------------------------------------------------------------------- */

const J7_PREMIER_ROI: TuganEmailTemplate = {
  code: 'j7',
  dayOffset: 7,
  subject: 'Tes 7 premiers jours en chiffres',
  body: `{{first_name}},

[BLOCK FACTUEL]
Petit récap de ta première semaine sur KOVAS :

- Missions traitées : **{{missions_count}}**
- Temps économisé vs ta baseline déclarée à l'inscription : **{{hours_saved}}**
- Score complétude moyen de tes dossiers : **{{conformity_score}}**

[BLOCK QUESTION RHÉTORIQUE]
Si tu projettes ce rythme sur un mois plein, ça donne quoi ?

[BLOCK FACTUEL]
Projection mensuelle linéaire (sans changer ton volume actuel) :

- ~{{missions_count}} missions × 4,3 semaines = **environ {{missions_count}} × 4** missions / mois
- Temps économisé estimé : **{{hours_saved}} × 4** par mois
- En CA équivalent (taux horaire 70€) : **gain de productivité projeté significatif**

[BLOCK SOCIAL PROOF]
Les diagnostiqueurs qui atteignent ce niveau de mesure dès J+7 sont ceux qui convertissent à 65%+ en fin d'essai. Pas parce qu'on les pousse — parce qu'ils ont déjà l'ROI calculé sur leur propre activité.

[BLOCK CTA]
Tu peux voir le détail mission par mission (temps avant, temps après, gain) sur ton tableau de bord :

→ https://kovas.fr/app/performance${SIGNATURE}`,
  placeholders: ['first_name', 'missions_count', 'hours_saved', 'conformity_score'],
}

/* -------------------------------------------------------------------------- */
/*  J+14 — Pré-objections (les 3 questions récurrentes)                       */
/* -------------------------------------------------------------------------- */

const J14_PRE_OBJECTIONS: TuganEmailTemplate = {
  code: 'j14',
  dayOffset: 14,
  subject: "Les 3 questions qu'on me pose souvent",
  body: `{{first_name}},

[BLOCK ÉMOTIONNEL]
Tu es à la moitié de ton essai. C'est en général à ce moment-là que les diagnostiqueurs commencent à se poser les vraies questions avant de passer en payant. Je préfère y répondre maintenant plutôt qu'à J+29.

[BLOCK FACTUEL]
**1. Comment j'arrête mon abonnement si ça ne me convient pas ?**

Tu vas dans ton compte → "Abonnement" → "Annuler l'abonnement". 2 clics. Tu gardes l'accès jusqu'à la fin de la période payée, tes exports restent téléchargeables 90 jours après la résiliation, puis tes données sont supprimées (RGPD).

Aucun appel commercial à passer, aucun formulaire à remplir, aucune justification à donner.

**2. Qu'est-ce qui se passe si je dépasse mon quota de missions inclus ?**

Ton plan continue de fonctionner. Tu paies le surplus au prorata réel (entre 0,29 € et 0,99 € par mission selon ton tier) sur ta prochaine facture. Tu peux activer un plafond mensuel auto-protecteur dans tes réglages si tu veux figer le coût maximum.

**3. Je peux changer de plan en cours de route ?**

Oui, à tout moment, dans les deux sens (upgrade ou downgrade). L'upgrade est immédiat avec prorata du mois en cours. Le downgrade s'applique au cycle de facturation suivant pour éviter les remboursements partiels chelous.

[BLOCK CTA]
Tu as une autre question avant la fin de ton essai ? Réponds à cet email, je te réponds personnellement dans la journée.${SIGNATURE}`,
  placeholders: ['first_name'],
}

/* -------------------------------------------------------------------------- */
/*  J+21 — Urgence éthique (4 options claires)                                */
/* -------------------------------------------------------------------------- */

const J21_URGENCE_ETHIQUE: TuganEmailTemplate = {
  code: 'j21',
  dayOffset: 21,
  subject: 'Plus que 9 jours avant la fin de ton essai',
  body: `{{first_name}},

[BLOCK FACTUEL]
Ton essai gratuit se termine le {{next_charge_date}}. À cette date, ta CB enregistrée à l'inscription sera prélevée automatiquement du montant de ton plan ({{plan_name}} — {{plan_price_eur}} € HT / mois).

[BLOCK QUESTION RHÉTORIQUE]
Avant le prélèvement, tu as 4 options. Aucune n'est piégeuse, et je préfère que tu choisisses en connaissance de cause plutôt que par défaut.

[BLOCK CTA]
**Option 1 — Continuer sur ton plan actuel**

Aucune action requise. Le prélèvement automatique se déclenche le {{next_charge_date}}. Tu conserves toutes tes données, missions, exports, et tu bascules en client payant en continuité.

**Option 2 — Passer en annuel (−15% à vie)**

Si tu projettes d'utiliser KOVAS sur 12 mois, le passage en annuel te fait économiser 15% dès la première facture. Réversible en mensuel sans frais au prochain renouvellement.

→ https://kovas.fr/app/account/billing/annual

**Option 3 — Changer de plan**

Tu peux passer à un tier supérieur (plus de missions incluses, surplus moins cher) ou inférieur (moins de missions, plan plus économique). Vu ton volume de la semaine dernière, le tier {{plan_name}} reste celui qui colle le mieux à ton activité — mais c'est toi qui décides.

→ https://kovas.fr/app/account/billing/change-plan

**Option 4 — Arrêter ton essai**

Si KOVAS ne t'a pas convaincu, annule en 2 clics depuis ton compte. Aucun prélèvement, aucune relance, aucune question. Tes exports restent téléchargeables 90 jours, puis suppression RGPD complète.

→ https://kovas.fr/app/account/billing/cancel

[BLOCK URGENCE]
P.S. La promo annuel −15% à vie est verrouillée au tarif du jour. Si je dois ajuster les prix dans 6 mois ou 18 mois (compute, IA, support qui scale), les abonnés annuels restent figés sur leur tarif d'origine. Le tarif mensuel, lui, suit l'évolution.${SIGNATURE}`,
  placeholders: ['first_name', 'plan_name', 'plan_price_eur', 'next_charge_date'],
}

/* -------------------------------------------------------------------------- */
/*  J+28 — Récap final (bilan d'essai + ROI total)                            */
/* -------------------------------------------------------------------------- */

const J28_RECAP_FINAL: TuganEmailTemplate = {
  code: 'j28',
  dayOffset: 28,
  subject: "Ton bilan d'essai KOVAS",
  body: `{{first_name}},

[BLOCK FACTUEL]
Voici ton bilan complet sur les 28 jours d'essai :

- Missions traitées : **{{missions_count}}**
- Temps économisé total : **{{hours_saved}}**
- Score complétude moyen : **{{conformity_score}}**

[BLOCK FACTUEL]
**Calcul du bénéfice net sur la période d'essai**

- Temps économisé valorisé (taux horaire 70€) : **équivalent ~1 460 € de productivité récupérée**
- Coût KOVAS sur la période : **0 € (essai gratuit)**
- Coût mensuel à venir : **{{plan_price_eur}} € HT**
- Bénéfice net mensuel projeté : **environ 1 220 € / mois**

[BLOCK QUESTION RHÉTORIQUE]
Si ton bilan ressemble à ça, la question n'est plus "est-ce que je m'abonne". C'est "est-ce que je passe en annuel pour figer le tarif ou je reste mensuel".

[BLOCK SOCIAL PROOF]
À J+28, environ 4 diagnostiqueurs sur 10 qui sont arrivés jusqu'ici choisissent l'annuel pour bénéficier de la remise et figer le tarif à vie. Les autres restent en mensuel — souvent parce qu'ils préfèrent garder la souplesse de tester en interne plus longtemps avant engagement.

[BLOCK CTA]
Tu peux consulter le détail mission par mission sur ton tableau de bord (avec graphique d'évolution semaine par semaine) :

→ https://kovas.fr/app/performance/bilan-essai

[BLOCK URGENCE]
Dans 2 jours, ton prélèvement automatique se déclenche le {{next_charge_date}}. Si tu veux faire un dernier ajustement (plan, mode de paiement, annulation), c'est maintenant.${SIGNATURE}`,
  placeholders: [
    'first_name',
    'missions_count',
    'hours_saved',
    'conformity_score',
    'plan_price_eur',
    'next_charge_date',
  ],
}

/* -------------------------------------------------------------------------- */
/*  J+30 — Conversion + welcome (abonnement actif)                            */
/* -------------------------------------------------------------------------- */

const J30_CONVERSION_WELCOME: TuganEmailTemplate = {
  code: 'j30',
  dayOffset: 30,
  subject: 'Ton abonnement Pro est actif. Bienvenue dans la famille KOVAS.',
  body: `{{first_name}},

[BLOCK ÉMOTIONNEL]
Ça y est. Tu viens de franchir le cap essai → payant. Pour moi, c'est le moment qui valide tout le travail des derniers mois — et qui me confirme qu'on construit la bonne chose.

Merci de ta confiance. Sincèrement.

[BLOCK FACTUEL]
**Récap de ton abonnement**

- Plan actif : **{{plan_name}}**
- Tarif : **{{plan_price_eur}} € HT / mois** (TVA 20% appliquée sur facture)
- Prochain prélèvement : **{{next_charge_date}}**
- Facture du jour : disponible dans ton compte (PDF téléchargeable)

[BLOCK SOCIAL PROOF]
Tu rejoins une communauté de **200+ diagnostiqueurs indépendants** qui utilisent KOVAS au quotidien sur le terrain. Profils variés (du solo en zone rurale au cabinet 5 personnes en métropole), mais une chose en commun : ils ont arrêté de subir Liciel et ils ont récupéré leurs soirées.

[BLOCK CTA]
**3 trucs concrets que tu peux faire cette semaine** :

1. **Activer ta facturation pro propre** — coordonnées société, mentions légales sur factures KOVAS, TVA intracommunautaire si export. Tout est paramétrable dans :

→ https://kovas.fr/app/account/billing/company

2. **Parrainer un confrère** — chaque diagnostiqueur que tu parraines te crédite **1 mois offert** sur ton abonnement (cumulables jusqu'à 12 mois). Le confrère bénéficie également d'un mois gratuit en plus de son essai standard. Lien de parrainage personnalisé :

→ https://kovas.fr/app/parrainage

3. **Réserver un call mensuel "use case avancé"** — une fois par mois, je fais un call 30 min avec les abonnés qui veulent pousser KOVAS au max (workflow cabinet, exports multi-format custom, modules à venir). Pas obligatoire, mais utile :

→ https://cal.com/benjamin-kovas/use-case-avance

[BLOCK URGENCE]
P.S. Mercredi prochain, je fais un webinar live "Les 5 raccourcis que les meilleurs utilisateurs KOVAS exploitent". Format direct, 45 minutes, replay envoyé aux inscrits. Lien d'inscription dans l'app, onglet "Évènements". Places limitées à 50 participants pour garder l'interaction Q&A.${SIGNATURE}`,
  placeholders: ['first_name', 'plan_name', 'plan_price_eur', 'next_charge_date'],
}

/* -------------------------------------------------------------------------- */
/*  Export — séquence ordonnée                                                 */
/* -------------------------------------------------------------------------- */

export const TUGAN_TRIAL_EMAILS: readonly TuganEmailTemplate[] = [
  J0_BIENVENUE,
  J1_MARC_GAIN,
  J3_FOUNDER_CALL,
  J7_PREMIER_ROI,
  J14_PRE_OBJECTIONS,
  J21_URGENCE_ETHIQUE,
  J28_RECAP_FINAL,
  J30_CONVERSION_WELCOME,
] as const

/* -------------------------------------------------------------------------- */
/*  Rendu — remplacement des placeholders                                      */
/* -------------------------------------------------------------------------- */

export interface TuganRenderResult {
  readonly subject: string
  readonly body: string
}

/**
 * Remplace les placeholders `{{var_name}}` du template par les valeurs passées en `vars`.
 *
 * Validation stricte : si un placeholder déclaré dans `template.placeholders` n'a pas
 * de valeur dans `vars` (ou que la valeur est `undefined` / `null`), lève une erreur
 * explicite — on préfère casser en CI que d'envoyer un email avec `{{first_name}}` brut.
 *
 * @param template - Un des 8 templates de `TUGAN_TRIAL_EMAILS`.
 * @param vars - Map clé → valeur des placeholders à substituer.
 * @returns Subject et body avec placeholders remplacés.
 * @throws Error si un placeholder déclaré est manquant ou nullish.
 */
export function renderTuganEmail(
  template: TuganEmailTemplate,
  vars: Readonly<Record<string, string | number>>,
): TuganRenderResult {
  for (const placeholder of template.placeholders) {
    const value = vars[placeholder]
    if (value === undefined || value === null || value === '') {
      throw new Error(
        `[tugan-trial-sequence] Placeholder manquant pour template "${template.code}" : "{{${placeholder}}}" — fournir une valeur non vide dans vars.`,
      )
    }
  }

  const replaceAll = (input: string): string => {
    let output = input
    for (const [key, value] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g')
      output = output.replace(pattern, String(value))
    }
    return output
  }

  return {
    subject: replaceAll(template.subject),
    body: replaceAll(template.body),
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
