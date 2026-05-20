/**
 * KOVAS — Tool definitions Claude (itération 13/N partie 2).
 *
 * Liste des tools que Claude Haiku 4.5 peut appeler pour répondre aux messages
 * NLP de l'admin via Telegram. Schémas Anthropic SDK.
 *
 * Conventions :
 *   - `get_*`  → lecture seule, exécution directe par tool-executor.
 *   - `request_*` → action destructive → PRÉPARE une confirmation (bouton),
 *     n'exécute JAMAIS directement. Le bouton confirme et déclenche
 *     l'exécution réelle (via button-handler de l'autre agent).
 *   - `add_admin_note` → action non destructive, exécution directe.
 *
 * Les schémas sont volontairement permissifs (champs optionnels par défaut)
 * pour que Claude puisse appeler le tool même avec peu d'info ; les handlers
 * tool-executor valident à l'usage.
 */

import type Anthropic from '@anthropic-ai/sdk'

// ============================================
// Tools lecture (read-only, exécution directe)
// ============================================

const TOOL_GET_DAILY_STATS: Anthropic.Tool = {
  name: 'get_daily_stats',
  description:
    "Retourne les stats journalières du jour (ou date spécifique) : signups, missions créées, coût IA, revenu estimé. Format compact. Utiliser pour 'comment ça se passe aujourd'hui ?', 'point du jour', etc.",
  input_schema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: "Date au format YYYY-MM-DD (Europe/Paris). Optionnel — défaut = aujourd'hui.",
      },
    },
  },
}

const TOOL_GET_MONTHLY_STATS: Anthropic.Tool = {
  name: 'get_monthly_stats',
  description:
    "Retourne les stats du mois en cours (ou mois spécifique) : MRR, signups, missions, coût IA, marge brute. Utiliser pour 'point du mois', 'résumé mensuel', etc.",
  input_schema: {
    type: 'object',
    properties: {
      month: {
        type: 'string',
        description: 'Mois au format YYYY-MM. Optionnel — défaut = mois en cours.',
      },
    },
  },
}

const TOOL_SEARCH_USER: Anthropic.Tool = {
  name: 'search_user',
  description:
    'Recherche un utilisateur par email, nom, prénom, ou ID. Retourne 0 à 10 candidats avec id + email + nom + plan + statut. À utiliser AVANT toute action sur un user pour désambiguïser (multiple matches → demander précision).',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Texte de recherche libre (email partiel, nom, prénom, UUID).',
      },
    },
    required: ['query'],
  },
}

const TOOL_GET_USER_DETAILS: Anthropic.Tool = {
  name: 'get_user_details',
  description:
    "Charge la fiche complète d'un user à partir de son UUID exact : profil, plan, MRR, missions, coût IA mensuel, statut suspension, derniers dossiers. Appelle TOUJOURS search_user d'abord si pas certain de l'UUID.",
  input_schema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'UUID exact du user (depuis search_user.results[].id).',
      },
    },
    required: ['user_id'],
  },
}

const TOOL_GET_TOP_IA_CONSUMERS: Anthropic.Tool = {
  name: 'get_top_ia_consumers',
  description:
    "Top N consommateurs IA du mois en cours, avec coût €, nombre d'appels, % du total. Utiliser pour 'qui consomme le plus en IA ?', 'top consommateurs', etc.",
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 25,
        description: 'Nombre de résultats (défaut 10).',
      },
    },
  },
}

const TOOL_GET_ACTIVE_ALERTS: Anthropic.Tool = {
  name: 'get_active_alerts',
  description:
    'Liste les alertes admin non résolues (alert_events.resolved=false). Format : règle + severity + actual_value + timestamp.',
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: "Nombre max d'alertes retournées (défaut 20).",
      },
    },
  },
}

const TOOL_GET_REVENUE_BREAKDOWN: Anthropic.Tool = {
  name: 'get_revenue_breakdown',
  description:
    'Décomposition du MRR actuel : total + répartition par plan (Découverte/Standard/Volume/Founder) + croissance MoM.',
  input_schema: {
    type: 'object',
    properties: {},
  },
}

const TOOL_GET_RECENT_SIGNUPS: Anthropic.Tool = {
  name: 'get_recent_signups',
  description:
    'Liste les N derniers signups (profiles), tri DESC sur created_at. Retourne email + nom + date + plan si déjà subscribed.',
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 30,
        description: 'Nombre de signups récents (défaut 10).',
      },
    },
  },
}

const TOOL_GET_MILESTONES_PROGRESS: Anthropic.Tool = {
  name: 'get_milestones_progress',
  description:
    'Progression actuelle des paliers (milestones) : MRR, users payants, missions, marge brute. Filtre par catégorie possible.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['mrr', 'users', 'missions', 'product', 'business', 'tech'],
        description: 'Filtre catégorie. Optionnel — défaut = tous.',
      },
    },
  },
}

const TOOL_GET_HEALTH_STATUS: Anthropic.Tool = {
  name: 'get_health_status',
  description:
    'État de santé général : Supabase latence, Anthropic dernier appel, Stripe, Storage, Queue. Statuses green/orange/red.',
  input_schema: {
    type: 'object',
    properties: {},
  },
}

// ============================================
// Tools actions destructives (préparent une confirmation, JAMAIS d'exécution directe)
// ============================================

const TOOL_REQUEST_USER_SUSPENSION: Anthropic.Tool = {
  name: 'request_user_suspension',
  description:
    "PRÉPARE une suspension de user — nécessite confirmation explicite par bouton inline. Toujours appeler search_user puis get_user_details d'abord pour confirmer l'identité.",
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'UUID exact du user à suspendre.' },
      reason: {
        type: 'string',
        description: 'Raison FR concise (1-2 phrases) — sera enregistrée dans audit log.',
      },
    },
    required: ['user_id', 'reason'],
  },
}

const TOOL_REQUEST_CREDIT_GRANT: Anthropic.Tool = {
  name: 'request_credit_grant',
  description:
    "PRÉPARE l'octroi d'un crédit (geste commercial / dédommagement) — nécessite confirmation.",
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'UUID exact du user.' },
      amount_eur: {
        type: 'number',
        minimum: 0,
        description: 'Montant en euros HT (positif).',
      },
      reason: { type: 'string', description: 'Raison FR concise.' },
    },
    required: ['user_id', 'amount_eur', 'reason'],
  },
}

const TOOL_REQUEST_CAP_MODIFICATION: Anthropic.Tool = {
  name: 'request_cap_modification',
  description: "PRÉPARE une modification du cap IA mensuel d'un user — nécessite confirmation.",
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'UUID exact du user (ou de son org).' },
      new_cap_eur: {
        type: 'number',
        minimum: 0,
        description: 'Nouveau cap mensuel en euros HT. 0 = retour au cap par défaut du plan.',
      },
      reason: { type: 'string', description: 'Raison FR concise.' },
    },
    required: ['user_id', 'new_cap_eur', 'reason'],
  },
}

const TOOL_REQUEST_PLAN_UPGRADE: Anthropic.Tool = {
  name: 'request_plan_upgrade',
  description:
    "PRÉPARE le changement de plan d'un user (Découverte → Standard, etc.) — nécessite confirmation. Note : cela ne crée PAS d'invoice Stripe automatiquement, c'est un override manuel admin.",
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'UUID exact du user.' },
      new_plan: {
        type: 'string',
        enum: ['discovery', 'standard', 'volume', 'founder'],
        description: 'Nouveau tier.',
      },
      reason: { type: 'string', description: 'Raison FR concise.' },
    },
    required: ['user_id', 'new_plan', 'reason'],
  },
}

const TOOL_REQUEST_SEND_EMAIL: Anthropic.Tool = {
  name: 'request_send_email',
  description:
    "PRÉPARE l'envoi d'un email custom à un user (geste commercial, support, info importante) — nécessite confirmation. Subject + body en FR, plain text simple.",
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'UUID exact du user.' },
      subject: {
        type: 'string',
        description: 'Sujet email FR (max 100 caractères).',
      },
      body: {
        type: 'string',
        description: 'Corps email FR plain text (max 2000 caractères).',
      },
    },
    required: ['user_id', 'subject', 'body'],
  },
}

// ============================================
// Tools actions non destructives (exécution directe — logguée)
// ============================================

const TOOL_ADD_ADMIN_NOTE: Anthropic.Tool = {
  name: 'add_admin_note',
  description:
    'Ajoute une note admin interne sur un user (visible côté /admin/users/:id, jamais côté user). Exécution immédiate, loggée.',
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'UUID exact du user.' },
      note: { type: 'string', description: 'Texte de la note FR (max 1000 caractères).' },
    },
    required: ['user_id', 'note'],
  },
}

// ============================================
// Export liste consolidée
// ============================================

export const ADMIN_BOT_TOOLS: Anthropic.Tool[] = [
  // Lecture
  TOOL_GET_DAILY_STATS,
  TOOL_GET_MONTHLY_STATS,
  TOOL_SEARCH_USER,
  TOOL_GET_USER_DETAILS,
  TOOL_GET_TOP_IA_CONSUMERS,
  TOOL_GET_ACTIVE_ALERTS,
  TOOL_GET_REVENUE_BREAKDOWN,
  TOOL_GET_RECENT_SIGNUPS,
  TOOL_GET_MILESTONES_PROGRESS,
  TOOL_GET_HEALTH_STATUS,
  // Actions destructives (confirmation requise)
  TOOL_REQUEST_USER_SUSPENSION,
  TOOL_REQUEST_CREDIT_GRANT,
  TOOL_REQUEST_CAP_MODIFICATION,
  TOOL_REQUEST_PLAN_UPGRADE,
  TOOL_REQUEST_SEND_EMAIL,
  // Actions non destructives (exécution directe)
  TOOL_ADD_ADMIN_NOTE,
]

/** Tous les noms de tools — utile pour validation runtime. */
export const ALL_TOOL_NAMES: ReadonlySet<string> = new Set(ADMIN_BOT_TOOLS.map((t) => t.name))
