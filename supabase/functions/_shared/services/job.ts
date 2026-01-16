/**
 * Job Service Module
 * Handles job creation, status updates, and retrieval
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { JobError } from '../errors/index.ts';
import type { Job, JobStatus } from '../types/index.ts';

// Re-export types for convenience
export type { Job, JobStatus };

/**
 * Job Service
 * Manages async job creation, status tracking, and retrieval
 * Requirements: 6.1
 */
export class JobService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new job
   * Requirements: 6.2, 6.6
   * 
   * @param type - Job type (e.g., 'generate-image')
   * @param input - Job input parameters
   * @param userId - User ID who created the job
   * @param projectId - Project ID the job belongs to
   * @param documentId - Document ID the job is associated with
   * @returns Created job record
   * @throws JobError if job creation fails
   */
  async createJob(
    type: string,
    input: Record<string, unknown>,
    userId: string,
    projectId: string,
    documentId: string
  ): Promise<Job> {
    const { data, error } = await this.supabase
      .from('jobs')
      .insert({
        project_id: projectId,
        document_id: documentId,
        user_id: userId,
        type,
        status: 'queued', // Initial status is always 'queued'
        input,
      })
      .select()
      .single();

    if (error || !data) {
      throw new JobError(
        `Failed to create job: ${error?.message || 'Unknown error'}`,
        'CREATE_FAILED'
      );
    }

    return this.mapJob(data);
  }


  /**
   * Update job status
   * Requirements: 6.3, 6.5
   * 
   * @param jobId - Job ID to update
   * @param status - New status (queued, processing, done, failed)
   * @param output - Optional output data (for done status)
   * @param error - Optional error message (for failed status)
   */
  async updateStatus(
    jobId: string,
    status: JobStatus,
    output?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (output !== undefined) {
      updateData.output = output;
    }

    if (error !== undefined) {
      updateData.error = error;
    }

    const { error: updateError } = await this.supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      throw new JobError(
        `Failed to update job status: ${updateError.message}`,
        'UPDATE_FAILED'
      );
    }
  }

  /**
   * Get job by ID
   * Requirements: 6.4
   * 
   * @param jobId - Job ID to retrieve
   * @returns Job record or null if not found
   */
  async getJob(jobId: string): Promise<Job | null> {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapJob(data);
  }

  /**
   * Map database record to Job type
   * 
   * @param data - Raw database record
   * @returns Typed Job object
   */
  private mapJob(data: Record<string, unknown>): Job {
    return {
      id: data.id as string,
      projectId: data.project_id as string,
      documentId: data.document_id as string,
      userId: data.user_id as string,
      type: data.type as string,
      status: data.status as JobStatus,
      input: data.input as Record<string, unknown>,
      output: data.output as Record<string, unknown> | undefined,
      error: data.error as string | undefined,
    };
  }
}
