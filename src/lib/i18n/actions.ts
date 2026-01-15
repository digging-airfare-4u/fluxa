/**
 * i18n Server Actions
 * Provides server actions for setting and getting the user's locale preference.
 * Requirements: 1.5, 6.3
 */

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { defaultLocale, locales, type Locale } from './config';

export async function setLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    return localeCookie as Locale;
  }
  
  return defaultLocale;
}
