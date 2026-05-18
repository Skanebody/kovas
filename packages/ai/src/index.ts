// @kovas/ai — Wrappers Claude + Whisper + provider fallback
// Approche IA hybride (Modification 18) : parser custom JS 80% + Claude Haiku 20%

export * from './claude'
export * from './whisper'
export * from './voice-structurer'
export { DIAG_VOCAB_FR, vocabForMissionType } from './dictionaries/diag-fr'
