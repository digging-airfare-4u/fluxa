-- ChatCanvas Row Level Security (RLS) Policies
-- This file defines security policies to ensure data isolation between users
-- Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9

-- ============================================================================
-- Enable RLS on all tables (Requirement 3.1)
-- ============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper function to check project ownership
-- ============================================================================
CREATE OR REPLACE FUNCTION is_project_owner(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Projects RLS Policies (Requirement 3.2)
-- Users can only access their own projects
-- ============================================================================

-- SELECT: Users can only see their own projects
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can only create projects for themselves
CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can only update their own projects
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can only delete their own projects
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================================
-- Documents RLS Policies (Requirement 3.3)
-- Users can only access documents in their own projects
-- ============================================================================

-- SELECT: Users can only see documents in their projects
CREATE POLICY "Users can view documents in own projects"
  ON documents FOR SELECT
  USING (is_project_owner(project_id));

-- INSERT: Users can only create documents in their projects
CREATE POLICY "Users can create documents in own projects"
  ON documents FOR INSERT
  WITH CHECK (is_project_owner(project_id));

-- UPDATE: Users can only update documents in their projects
CREATE POLICY "Users can update documents in own projects"
  ON documents FOR UPDATE
  USING (is_project_owner(project_id))
  WITH CHECK (is_project_owner(project_id));

-- DELETE: Users can only delete documents in their projects
CREATE POLICY "Users can delete documents in own projects"
  ON documents FOR DELETE
  USING (is_project_owner(project_id));

-- ============================================================================
-- Conversations RLS Policies (Requirement 3.4)
-- Users can only access conversations in their own projects
-- ============================================================================

-- SELECT: Users can only see conversations in their projects
CREATE POLICY "Users can view conversations in own projects"
  ON conversations FOR SELECT
  USING (is_project_owner(project_id));

-- INSERT: Users can only create conversations in their projects
CREATE POLICY "Users can create conversations in own projects"
  ON conversations FOR INSERT
  WITH CHECK (is_project_owner(project_id));

-- UPDATE: Users can only update conversations in their projects
CREATE POLICY "Users can update conversations in own projects"
  ON conversations FOR UPDATE
  USING (is_project_owner(project_id))
  WITH CHECK (is_project_owner(project_id));

-- DELETE: Users can only delete conversations in their projects
CREATE POLICY "Users can delete conversations in own projects"
  ON conversations FOR DELETE
  USING (is_project_owner(project_id));


-- ============================================================================
-- Messages RLS Policies (Requirement 3.5)
-- Users can only access messages in conversations they own
-- ============================================================================

-- Helper function to check conversation ownership
CREATE OR REPLACE FUNCTION is_conversation_owner(conversation_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversations c
    JOIN projects p ON c.project_id = p.id
    WHERE c.id = conversation_uuid AND p.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SELECT: Users can only see messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (is_conversation_owner(conversation_id));

-- INSERT: Users can only create messages in their conversations
CREATE POLICY "Users can create messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (is_conversation_owner(conversation_id));

-- UPDATE: Users can only update messages in their conversations
CREATE POLICY "Users can update messages in own conversations"
  ON messages FOR UPDATE
  USING (is_conversation_owner(conversation_id))
  WITH CHECK (is_conversation_owner(conversation_id));

-- DELETE: Users can only delete messages in their conversations
CREATE POLICY "Users can delete messages in own conversations"
  ON messages FOR DELETE
  USING (is_conversation_owner(conversation_id));

-- ============================================================================
-- Assets RLS Policies (Requirement 3.6)
-- Users can only access their own assets
-- ============================================================================

-- SELECT: Users can only see their own assets
CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can only create assets for themselves in their projects
CREATE POLICY "Users can create own assets"
  ON assets FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_project_owner(project_id));

-- UPDATE: Users can only update their own assets
CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can only delete their own assets
CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================================
-- Ops RLS Policies (Requirement 3.7)
-- Users can only access ops in documents they own
-- ============================================================================

-- Helper function to check document ownership
CREATE OR REPLACE FUNCTION is_document_owner(document_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM documents d
    JOIN projects p ON d.project_id = p.id
    WHERE d.id = document_uuid AND p.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SELECT: Users can only see ops in their documents
CREATE POLICY "Users can view ops in own documents"
  ON ops FOR SELECT
  USING (is_document_owner(document_id));

-- INSERT: Users can only create ops in their documents
CREATE POLICY "Users can create ops in own documents"
  ON ops FOR INSERT
  WITH CHECK (is_document_owner(document_id));

-- UPDATE: Users can only update ops in their documents
CREATE POLICY "Users can update ops in own documents"
  ON ops FOR UPDATE
  USING (is_document_owner(document_id))
  WITH CHECK (is_document_owner(document_id));

-- DELETE: Users can only delete ops in their documents
CREATE POLICY "Users can delete ops in own documents"
  ON ops FOR DELETE
  USING (is_document_owner(document_id));

-- ============================================================================
-- Jobs RLS Policies (Requirement 3.8)
-- Users can only access their own jobs
-- ============================================================================

-- SELECT: Users can only see their own jobs
CREATE POLICY "Users can view own jobs"
  ON jobs FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can only create jobs for themselves in their projects
CREATE POLICY "Users can create own jobs"
  ON jobs FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_project_owner(project_id));

-- UPDATE: Users can only update their own jobs
CREATE POLICY "Users can update own jobs"
  ON jobs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can only delete their own jobs
CREATE POLICY "Users can delete own jobs"
  ON jobs FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Service Role Bypass (Requirement 3.10)
-- Edge Functions use service_role key which bypasses RLS automatically
-- No additional configuration needed - service_role has full access
-- ============================================================================
