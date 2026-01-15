/**
 * i18n Module Exports
 * Barrel export for all i18n-related utilities and components.
 */

export { I18nProvider } from './I18nProvider';
export { setLocale, getLocale } from './actions';
export {
  locales,
  defaultLocale,
  localeNames,
  namespaces,
  type Locale,
  type Namespace,
} from './config';
export { useT, useCommonT, useI18nFormatter } from './hooks';
export {
  useErrorMessages,
  hasErrorCode,
  getErrorCode,
  type ApiErrorCode,
  type NetworkErrorType,
  type ValidationErrorType,
} from './errorMessages';
