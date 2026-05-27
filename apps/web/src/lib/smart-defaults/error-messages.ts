/**
 * Catalogue de messages d'erreur actionnables.
 *
 * Chaque entrée combine un message court (FR sobre, vouvoiement) et une suggestion
 * d'action concrète. Branché sur `<ActionableErrorMessage />`.
 */

export interface ActionableError {
  message: string
  suggestion: string
  /** URL externe optionnelle vers une ressource d'aide. */
  href?: string
}

export const ACTIONABLE_ERRORS = {
  // Email
  EMAIL_INVALID: {
    message: 'Cet email ne semble pas valide.',
    suggestion: "Vérifiez l'orthographe (présence d'un @ et d'un domaine).",
  },
  EMAIL_DOMAIN_UNREACHABLE: {
    message: "Le domaine de cet email n'est pas joignable.",
    suggestion: 'Essayez avec un autre email professionnel.',
  },
  EMAIL_FREE_PROVIDER: {
    message: 'Email personnel détecté (gmail, yahoo, hotmail…).',
    suggestion: 'Utilisez votre email professionnel avec votre nom de domaine.',
  },
  EMAIL_DISPOSABLE: {
    message: 'Email temporaire détecté.',
    suggestion: 'Utilisez votre email professionnel permanent.',
  },
  EMAIL_TYPO: {
    message: 'Faute de frappe probable dans le domaine.',
    suggestion: 'Avez-vous voulu écrire le domaine correctement ?',
  },

  // Téléphone
  PHONE_INVALID: {
    message: 'Numéro de téléphone invalide.',
    suggestion: 'Format attendu : 06 12 34 56 78 ou +33 6 12 34 56 78.',
  },
  PHONE_NOT_MOBILE: {
    message: "Ce numéro n'est pas un mobile.",
    suggestion: 'Préférez un mobile pour les notifications SMS.',
  },

  // SIRET
  SIRET_INVALID_FORMAT: {
    message: 'Le SIRET doit contenir 14 chiffres.',
    suggestion: 'Comptez bien : 9 chiffres SIREN + 5 chiffres NIC.',
  },
  SIRET_INVALID_CHECKSUM: {
    message: 'Ce SIRET est invalide (somme de contrôle incorrecte).',
    suggestion: 'Vérifiez votre numéro sur annuaire-entreprises.data.gouv.fr.',
    href: 'https://annuaire-entreprises.data.gouv.fr',
  },
  SIRET_NOT_FOUND: {
    message: "Ce SIRET n'a pas été trouvé dans la base INSEE.",
    suggestion: "Vérifiez le numéro ou contactez-nous si l'entreprise est récente.",
  },

  // Géolocalisation
  GEOLOCATION_DENIED: {
    message: 'Géolocalisation refusée.',
    suggestion:
      "Saisissez votre adresse manuellement, ou autorisez l'accès dans les réglages du navigateur.",
  },
  GEOLOCATION_UNAVAILABLE: {
    message: 'Position indisponible pour le moment.',
    suggestion: "Vérifiez votre connexion ou saisissez l'adresse manuellement.",
  },
  GEOLOCATION_TIMEOUT: {
    message: 'Géolocalisation expirée.',
    suggestion: 'Réessayez ou saisissez votre adresse manuellement.',
  },
  GEOLOCATION_UNSUPPORTED: {
    message: 'Géolocalisation non supportée par votre navigateur.',
    suggestion: 'Saisissez votre adresse manuellement.',
  },

  // Adresse / Code postal
  POSTAL_CODE_INVALID: {
    message: 'Code postal invalide.',
    suggestion: 'Saisissez 5 chiffres (ex. 75001).',
  },
  ADDRESS_NOT_FOUND: {
    message: 'Adresse introuvable dans la base nationale.',
    suggestion: "Vérifiez l'orthographe ou complétez manuellement.",
  },

  // Année construction
  YEAR_BUILT_INVALID: {
    message: 'Année invalide.',
    suggestion: "Saisissez une année entre 1000 et l'année en cours.",
  },
  YEAR_BUILT_PLOMB_REQUIRED: {
    message: 'Bâti antérieur à 1949.',
    suggestion: 'Un diagnostic Plomb CREP sera requis pour la vente ou la location.',
  },
  YEAR_BUILT_AMIANTE_REQUIRED: {
    message: 'Bâti antérieur à 1997.',
    suggestion: 'Un diagnostic Amiante sera requis pour la vente.',
  },

  // Réseau / serveur
  NETWORK_ERROR: {
    message: 'Connexion impossible.',
    suggestion: 'Vérifiez votre accès internet et réessayez.',
  },
  SERVER_ERROR: {
    message: 'Une erreur serveur est survenue.',
    suggestion: 'Réessayez dans quelques instants.',
  },
  RATE_LIMITED: {
    message: 'Trop de requêtes en peu de temps.',
    suggestion: 'Patientez quelques secondes avant de réessayer.',
  },
} as const satisfies Record<string, ActionableError>

export type ActionableErrorKey = keyof typeof ACTIONABLE_ERRORS
