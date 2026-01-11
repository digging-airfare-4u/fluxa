/**
 * Jobs Realtime Subscription
 * Requirements: 14.1, 14.2, 14.3, 14.4
 * 
 * Subscribes to job status changes for real-time UI updates.
 * Handles job state transitions: queued → processing → done/failed
 */

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

/**
 * Job status enum matching database constraints
 */
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

/**
 * Job record from database
 */
export interface Job {
  id: string;
  project_id: string;
  document_id: string;
  user_id: string;
  type: 'generate-image';
  status: JobStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Callback types for job status changes
 */
export interface JobSubscriptionCallbacks {
  onProcessing?: (job: Job) => void;
  onDone?: (job: Job) => void;
  onFailed?: (job: Job) => void;
  onAnyChange?: (job: Job) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscription result with cleanup function
 */
export interface JobSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => Promise<void>;
}

/**
 * Subscribe to job status changes for a specific project
 * 
 * Requirements:
 * - 14.1: Subscribe to jobs:project_id=eq.{projectId} for job status updates
 * - 14.2: When job status changes to "processing", UI displays loading indicator
 * - 14.3: When job status changes to "done", UI removes loading and fetches new ops
 * - 14.4: When job status changes to "failed", UI displays error message
 * 
 * @param projectId - The project ID to subscribe to
 * @param callbacks - Callback functions for different job states
 * @returns Subscription object with unsubscribe function
 */
export function subscribeToJobs(
  projectId: string,
  callbacks: JobSubscriptionCallbacks
): JobSubscription {
  const channelName = `jobs:project_id=eq.${projectId}`;
  
  // Remove any existing channel with the same name first
  const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
  if (existingChannel) {
    console.log(`[Jobs] Removing existing channel: ${channelName}`);
    supabase.removeChannel(existingChannel);
  }
  
  const channel = supabase
    .channel(channelName)
    .on<Job>(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `project_id=eq.${projectId}`,
      },
      (payload: RealtimePostgresChangesPayload<Job>) => {
        handleJobChange(payload, callbacks);
      }
    )
    .on<Job>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: `project_id=eq.${projectId}`,
      },
      (payload: RealtimePostgresChangesPayload<Job>) => {
        handleJobChange(payload, callbacks);
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Jobs] Subscribed to channel: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Jobs] Subscription error:`, err);
        callbacks.onError?.(new Error(`Subscription failed: ${status}`));
      }
    });

  const unsubscribe = async () => {
    console.log(`[Jobs] Unsubscribing from channel: ${channelName}`);
    await supabase.removeChannel(channel);
  };

  return { channel, unsubscribe };
}

/**
 * Handle job change events and dispatch to appropriate callbacks
 */
function handleJobChange(
  payload: RealtimePostgresChangesPayload<Job>,
  callbacks: JobSubscriptionCallbacks
): void {
  const job = payload.new as Job;
  
  if (!job || !job.status) {
    console.warn('[Jobs] Received invalid job payload:', payload);
    return;
  }

  console.log(`[Jobs] Job ${job.id} status changed to: ${job.status}`);

  // Always call onAnyChange if provided
  callbacks.onAnyChange?.(job);

  // Call specific status callbacks
  switch (job.status) {
    case 'processing':
      callbacks.onProcessing?.(job);
      break;
    case 'done':
      callbacks.onDone?.(job);
      break;
    case 'failed':
      callbacks.onFailed?.(job);
      break;
    // 'queued' status is typically the initial state, no specific callback
  }
}

/**
 * Subscribe to a specific job by ID
 * Useful for tracking a single job's progress
 * 
 * @param jobId - The job ID to subscribe to
 * @param callbacks - Callback functions for different job states
 * @returns Subscription object with unsubscribe function
 */
export function subscribeToJob(
  jobId: string,
  callbacks: JobSubscriptionCallbacks
): JobSubscription {
  const channelName = `job:${jobId}`;
  
  const channel = supabase
    .channel(channelName)
    .on<Job>(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`,
      },
      (payload: RealtimePostgresChangesPayload<Job>) => {
        handleJobChange(payload, callbacks);
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Jobs] Subscribed to job: ${jobId}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Jobs] Job subscription error:`, err);
        callbacks.onError?.(new Error(`Job subscription failed: ${status}`));
      }
    });

  const unsubscribe = async () => {
    console.log(`[Jobs] Unsubscribing from job: ${jobId}`);
    await supabase.removeChannel(channel);
  };

  return { channel, unsubscribe };
}

/**
 * Fetch job by ID
 * Useful for getting initial job state or refreshing after reconnection
 */
export async function fetchJob(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('[Jobs] Error fetching job:', error);
    return null;
  }

  return data as Job;
}

/**
 * Fetch all active jobs for a project
 * Active jobs are those with status 'queued' or 'processing'
 */
export async function fetchActiveJobs(projectId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Jobs] Error fetching active jobs:', error);
    return [];
  }

  return data as Job[];
}
