/**
 * KPI Metrics for Edge Functions
 * Tracks BYOK generation success/failure in Deno runtime.
 * Requirements: 8.3
 */

import { sanitize } from './logger.ts';

export type MetricEvent =
  | 'config_save_success'
  | 'config_save_failure'
  | 'test_provider_success'
  | 'test_provider_failure'
  | 'byok_generation_success'
  | 'byok_generation_failure'
  | 'allowlist_fail_closed'
  | 'provider_revalidation_timeout';

export interface MetricPayload {
  event: MetricEvent;
  user_id?: string;
  provider?: string;
  model_name?: string;
  config_id?: string;
  duration_ms?: number;
  reason?: string;
  [key: string]: unknown;
}

function defaultSink(payload: MetricPayload): void {
  const safe = {
    ...payload,
    reason: payload.reason ? sanitize(payload.reason) : undefined,
  };
  console.log(`[Metrics] ${safe.event}`, JSON.stringify(safe));
}

let sink: (payload: MetricPayload) => void = defaultSink;

export function setMetricsSink(fn: (payload: MetricPayload) => void): void {
  sink = fn;
}

export function trackMetric(payload: MetricPayload): void {
  try {
    sink(payload);
  } catch {
    // Metrics must never break the main flow
  }
}
