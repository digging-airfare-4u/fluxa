/**
 * Merchant Order Number Generator
 * Produces unique, sortable order numbers for payment providers.
 * Format: FX + YYYYMMDDHHmmss + 6-digit random = 22 chars
 */

import { randomBytes } from 'crypto';

export function generateOrderNo(): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14); // YYYYMMDDHHmmss
  const rand = randomBytes(3)
    .toString('hex')
    .toUpperCase()
    .slice(0, 6);
  return `FX${ts}${rand}`;
}

export function generateRefundNo(): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);
  const rand = randomBytes(3)
    .toString('hex')
    .toUpperCase()
    .slice(0, 6);
  return `RF${ts}${rand}`;
}
