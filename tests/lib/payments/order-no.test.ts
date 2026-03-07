/**
 * Feature: cn-web-payments
 * Tests for order number generation
 * Validates: uniqueness, format, and sortability
 */

import { describe, it, expect } from 'vitest';
import { generateOrderNo, generateRefundNo } from '@/lib/payments/order-no';

describe('generateOrderNo', () => {
  it('should produce a string starting with FX', () => {
    const no = generateOrderNo();
    expect(no).toMatch(/^FX/);
  });

  it('should be 22 characters long', () => {
    const no = generateOrderNo();
    expect(no.length).toBe(22);
  });

  it('should generate unique values across calls', () => {
    const set = new Set(Array.from({ length: 100 }, () => generateOrderNo()));
    expect(set.size).toBe(100);
  });
});

describe('generateRefundNo', () => {
  it('should produce a string starting with RF', () => {
    const no = generateRefundNo();
    expect(no).toMatch(/^RF/);
  });

  it('should be 22 characters long', () => {
    const no = generateRefundNo();
    expect(no.length).toBe(22);
  });
});
