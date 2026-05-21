/**
 * Smart defaults — facade re-export.
 */
export { useGeolocation } from './use-geolocation'
export type {
  GeoPosition,
  UseGeolocationOptions,
  UseGeolocationResult,
} from './use-geolocation'

export { reverseGeocodeBAN } from './reverse-geocode-ban'
export type { ReverseGeocodeResult } from './reverse-geocode-ban'

export { validateEmailMx, suggestDomainCorrection } from './validate-email-mx'
export type { EmailMxValidationResult } from './validate-email-mx'

export { useDebouncedValidation } from './use-debounced-validation'
export type {
  ValidationResult,
  ValidationState,
  UseDebouncedValidationResult,
} from './use-debounced-validation'

export {
  computeRequiredDiagnostics,
  getRequiredDiagnosticTypes,
  DIAGNOSTIC_LABELS,
} from './required-diagnostics'
export type {
  PropertyType,
  Situation,
  PropertyContext,
  DiagnosticType,
  DiagnosticSuggestion,
} from './required-diagnostics'

export { ACTIONABLE_ERRORS } from './error-messages'
export type { ActionableError, ActionableErrorKey } from './error-messages'

export {
  formatSiretLive,
  formatPhoneLive,
  toE164,
  isValidFrenchPostalCode,
} from './format-helpers'
