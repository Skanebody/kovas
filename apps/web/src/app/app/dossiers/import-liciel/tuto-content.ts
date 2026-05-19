/**
 * Contenu du tutoriel d'export Liciel (étape 2 du wizard).
 *
 * ⚠️ TODO LICIEL — Les libellés des menus et boutons ci-dessous sont des
 * placeholders. Benjamin doit valider les vrais menus de Liciel et mettre
 * à jour ce fichier :
 *
 *   1. Capture d'écran du menu d'export (chemin exact)
 *   2. Libellés exacts des cases à cocher (clients, biens, copros, etc.)
 *   3. Liste des formats proposés par Liciel (CSV / Excel / XML / autre)
 *   4. Nom exact du bouton "Exporter" / "Télécharger"
 *
 * Stocké en TypeScript (pas MDX) pour rester simple + typé. Si besoin
 * de rich text plus tard, migrer vers content/tutos/*.mdx.
 */

export interface TutoStepContent {
  /** Numéro affiché à gauche de chaque étape ("1.", "2.", …) */
  num: number
  /** Titre court de l'étape (1 ligne) */
  title: string
  /** Description longue. Peut contenir des espaces réservés [VÉRIFIER LICIEL]. */
  body: string
  /** Slug d'illustration / capture d'écran à afficher à côté (optionnel). */
  screenshot?: string
  /** Texte affiché en footer de l'étape (warning, hint, etc.) */
  hint?: string
}

export const LICIEL_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvrez Liciel et connectez-vous à votre compte',
    body: "Lancez votre logiciel Liciel Diagnostics habituel sur votre poste de travail. Connectez-vous avec vos identifiants. Si vous utilisez la version réseau ou multi-postes, assurez-vous d'être connecté avec un compte administrateur (l'export n'est généralement accessible qu'aux comptes admin).",
    screenshot: 'liciel-step-1-login',
    hint: "Si vous n'avez pas Liciel installé sur ce poste, faites l'export depuis l'ordinateur où vous l'utilisez habituellement, puis transférez le fichier ici.",
  },
  {
    num: 2,
    title: "Ouvrez le menu d'administration",
    body: "Dans la barre de menu principale, cliquez sur **« [VÉRIFIER LICIEL : nom exact du menu — probablement « Administration », « Outils » ou « Données » ]»**. Selon votre version de Liciel, ce menu peut s'appeler différemment.",
    screenshot: 'liciel-step-2-menu',
  },
  {
    num: 3,
    title: 'Sélectionnez « Exporter mes données »',
    body: "Cliquez sur **« [VÉRIFIER LICIEL : libellé exact, ex. « Exporter mes données », « Sauvegarde », « Export base » ]»**. Liciel ouvre une nouvelle fenêtre d'options d'export.",
    screenshot: 'liciel-step-3-export-menu',
  },
  {
    num: 4,
    title: 'Cochez les éléments à exporter',
    body: 'Sélectionnez :\n\n- ☑ **Clients** (recommandé — vos coordonnées clients)\n- ☑ **Biens / Logements** (recommandé — adresses + caractéristiques)\n- ☑ **Copropriétés** (recommandé si vous en gérez)\n- ☑ **Historique des diagnostics** (recommandé — évite de re-saisir un bien déjà visité)\n- ☐ **Rapports PDF complets** (optionnel — gros volume, peut être ignoré pour gagner du temps)',
    screenshot: 'liciel-step-4-checkboxes',
    hint: "Les rapports PDF restent dans Liciel — vous devez les y conserver selon la réglementation (10 ans pour la plupart, 50 ans pour l'amiante). KOVAS ne les remplace pas.",
  },
  {
    num: 5,
    title: "Choisissez le format d'export",
    body: "Sélectionnez l'un des formats disponibles : **CSV**, **Excel (.xlsx)**, **XML**, ou **ZIP**. KOVAS accepte tous les formats Liciel courants — peu importe lequel vous choisissez, l'analyse automatique détectera la structure.",
    screenshot: 'liciel-step-5-format',
    hint: 'Si vous avez le choix : CSV est le plus rapide à analyser, XML le plus complet.',
  },
  {
    num: 6,
    title: 'Cliquez sur Exporter, téléchargez le fichier',
    body: "Cliquez sur **« [VÉRIFIER LICIEL : libellé bouton, ex. « Exporter », « Lancer l'export », « Télécharger » ]»**. Liciel prépare le fichier (peut prendre 30 secondes à 2 minutes selon le volume) et vous propose de le sauvegarder sur votre ordinateur. Notez bien l'emplacement de sauvegarde — vous en aurez besoin à l'étape suivante.",
    screenshot: 'liciel-step-6-download',
    hint: 'Le fichier exporté est en clair (non chiffré). Conservez-le dans un dossier sécurisé et supprimez-le après import dans KOVAS.',
  },
]

/**
 * Liens d'aide affichés en bas de l'étape 2.
 */
export const TUTO_HELP_LINKS = [
  {
    label: 'Tutoriel vidéo (2 min)',
    href: '#tuto-video', // TODO : URL Vimeo / YouTube quand vidéo prête
    icon: 'PlayCircle' as const,
  },
  {
    label: 'Contacter le support KOVAS',
    href: 'mailto:support@kovas.fr?subject=Aide%20import%20Liciel',
    icon: 'LifeBuoy' as const,
  },
  {
    label: 'Documentation Liciel officielle',
    href: 'https://www.liciel.fr/aide',
    icon: 'ExternalLink' as const,
  },
] as const
