/**
 * i18n Configuration
 * Defines supported locales, default locale, and namespaces for the application.
 * Requirements: 1.1, 1.6, 1.7
 */

export const locales = ['zh-CN', 'en-US'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-CN';

export const localeNames: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
};

export const namespaces = [
  'common',
  'auth',
  'editor',
  'chat',
  'home',
  'points',
  'errors',
] as const;

export type Namespace = (typeof namespaces)[number];
