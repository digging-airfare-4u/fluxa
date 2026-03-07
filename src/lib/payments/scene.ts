/**
 * Payment Scene Detection
 * Detects the checkout scene from request headers (desktop, mobile, WeChat in-app).
 */

import type { CheckoutScene } from './types';

const WECHAT_UA_PATTERN = /MicroMessenger/i;
const MOBILE_UA_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

/**
 * Detect the checkout scene from a User-Agent string.
 * Priority: WeChat browser > mobile browser > desktop.
 */
export function detectScene(userAgent: string | null | undefined): CheckoutScene {
  if (!userAgent) return 'desktop';

  if (WECHAT_UA_PATTERN.test(userAgent)) {
    return 'wechat_browser';
  }

  if (MOBILE_UA_PATTERN.test(userAgent)) {
    return 'mobile_browser';
  }

  return 'desktop';
}

/**
 * Parse a client-provided scene hint, falling back to UA detection.
 */
export function resolveScene(
  sceneHint: string | undefined,
  userAgent: string | null | undefined
): CheckoutScene {
  const validScenes: CheckoutScene[] = ['desktop', 'mobile_browser', 'wechat_browser'];
  if (sceneHint && validScenes.includes(sceneHint as CheckoutScene)) {
    return sceneHint as CheckoutScene;
  }
  return detectScene(userAgent);
}
