/**
 * Project Queries
 * Requirements: 5.2, 5.3, 5.5 - Project CRUD operations
 */

import { supabase } from '../client';

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

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
        thumbnailMap.set(
          asset.project_id,
          `${SUPABASE_URL}/storage/v1/object/public/assets/${asset.storage_path}`
        );
      }
    }
  }

  return data.map(p => ({
    ...p,
    thumbnail: thumbnailMap.get(p.id),
  }));
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
