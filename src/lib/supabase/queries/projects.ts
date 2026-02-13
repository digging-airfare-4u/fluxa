/**
 * Project Queries
 * Requirements: 5.2, 5.3, 5.5 - Project CRUD operations
 */

import { supabase } from '../client';
import { getAssetUrl } from './assets';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  name: string;
  canvas_state: unknown;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  document_id: string | null;
  created_at: string;
}

export interface CreateProjectResult {
  project: Project;
  document: Document;
  conversation: Conversation;
}

export interface ProjectWithThumbnail extends Project {
  thumbnail?: string;
}

interface AddImageOpRecord {
  document_id: string;
  payload: unknown;
  created_at: string;
}

interface DocumentProjectRef {
  id: string;
  project_id: string;
}

interface AddImagePayload {
  src?: string;
}

function extractImageSrc(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const src = (payload as AddImagePayload).src;
  if (typeof src !== 'string' || src.trim().length === 0) return null;
  return src.trim();
}

function normalizeThumbnailUrl(src: string): string {
  if (/^(data:|blob:)/i.test(src)) {
    return src;
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const parsed = new URL(src);

      // COS signed URLs can expire. Bucket is public-read, so strip query params.
      if (parsed.hostname.includes('.cos.') && parsed.hostname.endsWith('.myqcloud.com')) {
        return `${parsed.origin}${parsed.pathname}`;
      }

      // Supabase signed object URLs can be converted to public object URLs for public buckets.
      if (parsed.pathname.includes('/storage/v1/object/sign/assets/')) {
        return `${parsed.origin}${parsed.pathname.replace('/object/sign/assets/', '/object/public/assets/')}`;
      }

      return src;
    } catch {
      return src;
    }
  }
  return getAssetUrl(src);
}

/**
 * Fetch all projects for the current user with thumbnails
 */
export async function fetchProjects(): Promise<ProjectWithThumbnail[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Get first asset for each project as thumbnail
  const projectIds = data.map(p => p.id);
  const { data: assets } = await supabase
    .from('assets')
    .select('project_id, storage_path')
    .in('project_id', projectIds)
    .order('created_at', { ascending: true });

  // Build thumbnail map (first asset per project)
  const thumbnailMap = new Map<string, string>();
  if (assets) {
    for (const asset of assets) {
      if (!thumbnailMap.has(asset.project_id)) {
        thumbnailMap.set(asset.project_id, getAssetUrl(asset.storage_path));
      }
    }
  }

  return data.map(p => ({
    ...p,
    thumbnail: thumbnailMap.get(p.id),
  }));
}

/**
 * Fetch recent projects based on latest addImage ops.
 * Returns at most `limit` projects with thumbnail derived from op payload.src.
 */
export async function fetchRecentProjectsFromOps(limit = 4): Promise<ProjectWithThumbnail[]> {
  if (limit <= 0) return [];

  const scanLimit = Math.max(limit * 20, 50);

  const { data: opRows, error: opError } = await supabase
    .from('ops')
    .select('document_id, payload, created_at')
    .eq('op_type', 'addImage')
    .order('created_at', { ascending: false })
    .limit(scanLimit);

  if (opError) throw opError;
  if (!opRows || opRows.length === 0) return [];

  const documentIds = Array.from(
    new Set(
      (opRows as AddImageOpRecord[])
        .map(row => row.document_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  if (documentIds.length === 0) return [];

  const { data: documentRows, error: documentError } = await supabase
    .from('documents')
    .select('id, project_id')
    .in('id', documentIds);

  if (documentError) throw documentError;
  if (!documentRows || documentRows.length === 0) return [];

  const docToProject = new Map<string, string>();
  for (const row of documentRows as DocumentProjectRef[]) {
    docToProject.set(row.id, row.project_id);
  }

  const recentMap = new Map<string, { thumbnail: string; updatedAt: string }>();
  for (const row of opRows as AddImageOpRecord[]) {
    const projectId = docToProject.get(row.document_id);
    if (!projectId || recentMap.has(projectId)) continue;

    const src = extractImageSrc(row.payload);
    if (!src) continue;

    recentMap.set(projectId, {
      thumbnail: normalizeThumbnailUrl(src),
      updatedAt: row.created_at,
    });

    if (recentMap.size >= limit) break;
  }

  if (recentMap.size === 0) return [];

  const orderedProjectIds = Array.from(recentMap.keys());
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id, name, created_at, updated_at')
    .in('id', orderedProjectIds);

  if (projectError) throw projectError;
  if (!projects || projects.length === 0) return [];

  const projectMap = new Map(projects.map(project => [project.id, project]));

  const result: ProjectWithThumbnail[] = [];
  for (const projectId of orderedProjectIds) {
    const project = projectMap.get(projectId);
    const recent = recentMap.get(projectId);
    if (!project || !recent) continue;

    result.push({
      ...project,
      updated_at: recent.updatedAt,
      thumbnail: recent.thumbnail,
    });
  }

  return result;
}

/**
 * Fetch a single project by ID
 */
export async function fetchProject(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Create a new project with default document and conversation
 * Requirements: 5.3 - Project creation invariant
 * 
 * @param name - Project name (optional, defaults to 'Untitled Project')
 * @param initialPrompt - Initial prompt to store in the first message (optional)
 * @returns Created project, document, and conversation
 */
export async function createProject(
  name?: string,
  initialPrompt?: string
): Promise<CreateProjectResult> {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('User not authenticated');

  // Create project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: name || 'Untitled Project',
    })
    .select()
    .single();

  if (projectError) throw projectError;

  // Create default document (1080x1350)
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      project_id: project.id,
      name: 'Untitled',
      width: 1080,
      height: 1350,
    })
    .select()
    .single();

  if (docError) throw docError;

  // Create default conversation linked to document
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      project_id: project.id,
      document_id: document.id,
    })
    .select()
    .single();

  if (convError) throw convError;

  // If initial prompt provided, create the first user message
  if (initialPrompt) {
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: initialPrompt,
      });

    if (msgError) throw msgError;
  }

  return { project, document, conversation };
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name'>>
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a project and all related data (cascade delete)
 * Requirements: 5.5 - Cascade delete completeness
 * 
 * Note: Due to ON DELETE CASCADE constraints in the database,
 * deleting a project will automatically delete all related:
 * - documents
 * - conversations
 * - messages (via conversations)
 * - assets
 * - ops (via documents)
 * - jobs
 */
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Fetch project with its documents and conversations
 */
export async function fetchProjectWithDetails(projectId: string): Promise<{
  project: Project;
  documents: Document[];
  conversations: Conversation[];
} | null> {
  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) {
    if (projectError.code === 'PGRST116') return null;
    throw projectError;
  }

  // Fetch documents
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (docError) throw docError;

  // Fetch conversations
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (convError) throw convError;

  return {
    project,
    documents: documents || [],
    conversations: conversations || [],
  };
}

/**
 * Get project count for the current user
 */
export async function getProjectCount(): Promise<number> {
  const { count, error } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}
