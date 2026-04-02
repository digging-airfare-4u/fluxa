/**
 * Feature: theme
 * Property 1: Initial theme defaults to light
 * Validates: Manual dark mode opt-in requirement
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeContext';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function ThemeProbe() {
  const { theme } = useTheme();
  return React.createElement('span', null, theme);
}

function renderTheme(options: { storedTheme?: string | null; systemPrefersDark?: boolean } = {}) {
  const storage = {
    getItem: (key: string) => {
      if (key !== 'theme') {
        return null;
      }
      return options.storedTheme ?? null;
    },
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  } as Storage;

  const windowMock = {
    localStorage: storage,
    matchMedia: (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? Boolean(options.systemPrefersDark) : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  } as unknown as Window & typeof globalThis;

  Object.defineProperty(globalThis, 'window', {
    value: windowMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });

  return renderToString(
    React.createElement(ThemeProvider, null, React.createElement(ThemeProbe))
  );
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }

  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

describe('ThemeProvider', () => {
  it('should default to light when the browser prefers dark mode', () => {
    expect(renderTheme({ systemPrefersDark: true })).toContain('light');
  });

  it('should default to light even when dark mode was previously stored', () => {
    expect(
      renderTheme({
        storedTheme: 'dark',
        systemPrefersDark: true,
      })
    ).toContain('light');
  });
});
