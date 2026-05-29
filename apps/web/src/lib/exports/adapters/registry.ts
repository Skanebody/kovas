import { analysimmoAdapter } from './analysimmo'
import { licielAdapter } from './liciel'
import { obbcAdapter } from './obbc'
import { orisAdapter } from './oris'
import type { EditorAdapterId, EditorExportAdapter } from './types'

/**
 * Registre central des adaptateurs d'export par éditeur.
 *
 * Brancher un nouvel éditeur = créer `adapters/<id>.ts` puis l'ajouter ici.
 *
 * État des mappings :
 *  - `liciel`      → NATIF EXACT (délègue à `buildLicielZip`).
 *  - `obbc`        → fallback universel (en attente spec import OBBC).
 *  - `analysimmo`  → fallback universel (en attente spec import AnalysImmo).
 *  - `oris`        → fallback universel (en attente spec import ORIS).
 */
export const EDITOR_ADAPTERS: Record<EditorAdapterId, EditorExportAdapter> = {
  liciel: licielAdapter,
  obbc: obbcAdapter,
  analysimmo: analysimmoAdapter,
  oris: orisAdapter,
}

/** Liste des identifiants d'éditeurs supportés. */
export const EDITOR_ADAPTER_IDS = Object.keys(EDITOR_ADAPTERS) as EditorAdapterId[]

/** Vérifie qu'une chaîne arbitraire correspond à un éditeur connu. */
export function isEditorAdapterId(value: string): value is EditorAdapterId {
  return value in EDITOR_ADAPTERS
}

/**
 * Récupère l'adaptateur d'un éditeur par son identifiant.
 * Retourne `undefined` si l'identifiant est inconnu (l'appelant décide du
 * fallback, p. ex. l'export universel par défaut).
 */
export function getEditorAdapter(id: string): EditorExportAdapter | undefined {
  return isEditorAdapterId(id) ? EDITOR_ADAPTERS[id] : undefined
}
