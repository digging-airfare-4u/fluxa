/**
 * i18n Request Configuration
 * Configures next-intl for server-side rendering with locale detection from cookies.
 * Requirements: 1.1, 1.6, 1.7
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  // Get locale from cookie or use default
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = (locales.includes(localeCookie as Locale)
    ? localeCookie
    : defaultLocale) as Locale;

  // Load all namespace messages
  const messages = {
    common: (await import(`@/locales/${locale}/common.json`)).default,
    auth: (await import(`@/locales/${locale}/auth.json`)).default,
    editor: (await import(`@/locales/${locale}/editor.json`)).default,
    chat: (await import(`@/locales/${locale}/chat.json`)).default,
    home: (await import(`@/locales/${locale}/home.json`)).default,
    points: (await import(`@/locales/${locale}/points.json`)).default,
    errors: (await import(`@/locales/${locale}/errors.json`)).default,
    providerConfig: (await import(`@/locales/${locale}/providerConfig.json`)).default,
  };

  return {
    locale,
    messages,
    timeZone: 'Asia/Shanghai',
    now: new Date(),
  };
});
