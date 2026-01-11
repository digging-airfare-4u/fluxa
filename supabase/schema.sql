-- ChatCanvas Database Schema
-- This file defines the core database tables for the ChatCanvas application
-- Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table 1: projects
-- User projects containing documents and conversations
-- ============================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table 2: documents
-- Canvas documents within a project, storing canvas state
-- ============================================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Untitled',
  canvas_state JSONB,
  width INTEGER DEFAULT 1080,
  height INTEGER DEFAULT 1350,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table 3: conversations
-- Chat conversations linked to projects and optionally documents
-- ============================================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- Table 4: messages
-- Chat messages within conversations
-- ============================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table 5: assets
-- Asset files stored in Supabase Storage
-- Types: upload (user uploaded), generate (AI generated), export (exported PNG)
-- ============================================================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('upload', 'generate', 'export')),
  storage_path TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table 6: ops
-- Canvas operation logs - the core of the ops-driven architecture
-- Each op represents a single canvas operation that can be replayed
-- ============================================================================
CREATE TABLE ops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  seq BIGSERIAL,
  op_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table 7: jobs
-- Async job queue for long-running tasks like image generation
-- Status flow: queued → processing → done/failed
-- ============================================================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('generate-image')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  input JSONB NOT NULL,
  output JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- Indexes for performance optimization
-- ============================================================================

-- Projects: lookup by user
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Documents: lookup by project
CREATE INDEX idx_documents_project_id ON documents(project_id);

-- Conversations: lookup by project
CREATE INDEX idx_conversations_project_id ON conversations(project_id);

-- Messages: lookup by conversation
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- Assets: lookup by project and user
CREATE INDEX idx_assets_project_id ON assets(project_id);
CREATE INDEX idx_assets_user_id ON assets(user_id);

-- Ops: lookup by document and sequence ordering
CREATE INDEX idx_ops_document_id ON ops(document_id);
CREATE INDEX idx_ops_seq ON ops(document_id, seq);

-- Jobs: lookup by project, user, and status
CREATE INDEX idx_jobs_project_id ON jobs(project_id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- ============================================================================
-- Triggers for updated_at timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for documents
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for jobs
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
