/**
 * KPI Metrics for Model Config Settings
 * Tracks config save, test-provider, and BYOK generation success/failure rates.
 * Requirements: 8.3
 *
 * Events are emitted as structured console logs with a `[Metrics]` prefix.
 * In production, these can be piped to an external analytics service
 * (e.g. PostHog, Amplitude, or a custom collector) by replacing the sink.
 */

import { sanitize } from './logger';

// ============================================================================
// Event Types
// ============================================================================

export type MetricEvent =
  | 'config_save_success'
  | 'config_save_failure'
  | 'test_provider_success'
  | 'test_provider_failure'
  | 'byok_generation_success'
  | 'byok_generation_failure'
  | 'allowlist_fail_closed'
  | 'provider_revalidation_timeout'
  | 'discover_remix_click'
  | 'discover_remix_project_created';

export interface MetricPayload {
  event: MetricEvent;
  user_id?: string;
  provider?: string;
  model_name?: string;
  config_id?: string;
  /** Milliseconds elapsed (e.g. test-provider latency) */
  duration_ms?: number;
  /** Human-readable reason on failure */
  reason?: string;
  [key: string]: unknown;
}

// ============================================================================
// Sink (pluggable)
// ============================================================================

/**
 * Default sink: structured console log.
 * Replace with an HTTP POST to your analytics endpoint in production.
 */
function defaultSink(payload: MetricPayload): void {
  // Sanitize reason in case it leaks secrets from upstream errors
  const safe = {
    ...payload,
    reason: payload.reason ? sanitize(payload.reason) : undefined,
  };
  console.log(`[Metrics] ${safe.event}`, JSON.stringify(safe));
}

let sink: (payload: MetricPayload) => void = defaultSink;

/** Override the default metrics sink (useful for tests or production integrations). */
export function setMetricsSink(fn: (payload: MetricPayload) => void): void {
  sink = fn;
}

// ============================================================================
// Public API
// ============================================================================

export function trackMetric(payload: MetricPayload): void {
  try {
    sink(payload);
  } catch {
    // Metrics must never break the main flow
  }
}
