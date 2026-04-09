/**
 * Publication snapshot cache
 * Keeps recently fetched publication snapshot messages in memory so Remix flows
 * can reuse original prompts without coupling to the Supabase client at import time.
 */

export interface PublicationSnapshotMessage {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type PublicationSnapshotMessages = PublicationSnapshotMessage[];

const publicationSnapshotMessageCache = new Map<string, PublicationSnapshotMessages>();

export function cachePublicationSnapshotMessages(
  publicationId: string,
  messages: PublicationSnapshotMessages | null | undefined,
): void {
  if (!publicationId) return;

  if (!messages) {
    publicationSnapshotMessageCache.delete(publicationId);
    return;
  }

  publicationSnapshotMessageCache.set(publicationId, messages);
}

export function getCachedPublicationSnapshotMessages(
  publicationId: string,
): PublicationSnapshotMessages | null {
  return publicationSnapshotMessageCache.get(publicationId) ?? null;
}

export function clearCachedPublicationSnapshotMessages(): void {
  publicationSnapshotMessageCache.clear();
}
