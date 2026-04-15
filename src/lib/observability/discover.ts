import { trackMetric, type MetricEvent } from './metrics';

export type DiscoverRemixEntry = 'card' | 'detail' | 'dialog';

export type DiscoverRemixEvent = Extract<
  MetricEvent,
  'discover_remix_click' | 'discover_remix_project_created'
>;

interface DiscoverRemixPayload {
  entry: DiscoverRemixEntry;
  publicationId: string;
  projectId?: string;
}

export function trackDiscoverRemixEvent(
  event: DiscoverRemixEvent,
  payload: DiscoverRemixPayload,
): void {
  trackMetric({
    event,
    entry: payload.entry,
    publication_id: payload.publicationId,
    project_id: payload.projectId,
  });
}
