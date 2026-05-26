/**
 * Point d'entrée public du wrapper Mes Aides Réno (France Rénov').
 */
export { simulateAides, clearCache } from './client'
export {
  type AideInput,
  type AideResult,
  type AideCode,
  type DpeClass,
  type LogementType,
  type Occupation,
  MesAidesRenoError,
} from './types'
