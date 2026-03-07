/**
 * Feature: cn-web-payments
 * Tests for scene detection and resolution
 * Validates: desktop, mobile, WeChat browser detection
 */

import { describe, it, expect } from 'vitest';
import { detectScene, resolveScene } from '@/lib/payments/scene';

describe('detectScene', () => {
  it('returns desktop for standard Chrome UA', () => {
    expect(detectScene('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe('desktop');
  });

  it('returns mobile_browser for iPhone UA', () => {
    expect(detectScene('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')).toBe('mobile_browser');
  });

  it('returns mobile_browser for Android UA', () => {
    expect(detectScene('Mozilla/5.0 (Linux; Android 14) Mobile Chrome/120')).toBe('mobile_browser');
  });

  it('returns wechat_browser for MicroMessenger UA', () => {
    expect(
      detectScene('Mozilla/5.0 (iPhone) MicroMessenger/8.0.42 MiniProgramEnv')
    ).toBe('wechat_browser');
  });

  it('returns desktop for null UA', () => {
    expect(detectScene(null)).toBe('desktop');
  });

  it('returns desktop for empty UA', () => {
    expect(detectScene('')).toBe('desktop');
  });
});

describe('resolveScene', () => {
  it('uses hint when valid', () => {
    expect(resolveScene('mobile_browser', 'some desktop UA')).toBe('mobile_browser');
  });

  it('falls back to detection when hint is invalid', () => {
    expect(resolveScene('invalid', 'Mozilla/5.0 (iPhone) Safari')).toBe('mobile_browser');
  });

  it('falls back to detection when hint is undefined', () => {
    expect(resolveScene(undefined, null)).toBe('desktop');
  });
});
