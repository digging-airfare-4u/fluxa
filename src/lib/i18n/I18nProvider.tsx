/**
 * I18n Provider Component
 * Wraps NextIntlClientProvider with error handling and fallback configuration.
 * Requirements: 1.6, 2.4, 2.5
 */

'use client';

import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl';
import { ReactNode } from 'react';

interface I18nProviderProps {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  timeZone?: string;
  now?: Date;
}

export function I18nProvider({
  children,
  locale,
  messages,
  timeZone,
  now,
}: I18nProviderProps) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
      now={now}
      onError={(error) => {
        // Log missing translations in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('[i18n]', error.message);
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        // Return debug placeholder for missing keys
        return `__MISSING_KEY__:${namespace}.${key}`;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
