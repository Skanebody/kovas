/**
 * KOVAS — Liste centrale des tools destructifs (itération 13/N partie 2).
 *
 * Référence partagée entre :
 *   - tool-definitions.ts : déclaration Anthropic.Tool[]
 *   - tool-executor.ts : refuse d'exécuter ces tools, demande confirmation
 *   - nlp-handler.ts : intercepte ces tool_use blocks et crée un
 *     pending_admin_actions au lieu d'exécuter
 *
 * Toute nouvelle action destructive DOIT être ajoutée ici ET dans
 * tool-definitions.ts (préfixe `request_`).
 */

export const DESTRUCTIVE_TOOL_NAMES: ReadonlySet<string> = new Set<string>([
  'request_user_suspension',
  'request_credit_grant',
  'request_cap_modification',
  'request_plan_upgrade',
  'request_send_email',
])
