-- Inspiration Discovery: RPCs/functions

BEGIN;

DROP FUNCTION IF EXISTS publish_conversation(UUID, TEXT, TEXT, TEXT, UUID, TEXT[]);
DROP FUNCTION IF EXISTS update_publication_snapshot(UUID);
DROP FUNCTION IF EXISTS increment_view_count(UUID, UUID);
DROP FUNCTION IF EXISTS toggle_like(UUID);
DROP FUNCTION IF EXISTS toggle_bookmark(UUID);
DROP FUNCTION IF EXISTS get_gallery_publications(TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER);

CREATE OR REPLACE FUNCTION publish_conversation(
  p_conversation_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_cover_image_url TEXT,
  p_category_id UUID,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
  v_document_id UUID;
  v_publication_id UUID;
  v_messages JSONB;
  v_ops JSONB;
  v_canvas_state JSONB;
  v_width INTEGER;
  v_height INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.project_id, c.document_id
  INTO v_project_id, v_document_id
  FROM conversations c
  JOIN projects p ON p.id = c.project_id
  WHERE c.id = p_conversation_id
    AND p.user_id = v_user_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Conversation not found or not owned';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'role', m.role,
      'content', m.content,
      'metadata', m.metadata,
      'created_at', m.created_at
    ) ORDER BY m.created_at ASC
  ), '[]'::jsonb)
  INTO v_messages
  FROM messages m
  WHERE m.conversation_id = p_conversation_id;

  IF v_document_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'op_type', o.op_type,
        'payload', o.payload,
        'seq', o.seq,
        'created_at', o.created_at
      ) ORDER BY o.seq ASC
    ), '[]'::jsonb)
    INTO v_ops
    FROM ops o
    WHERE o.document_id = v_document_id;

    SELECT d.canvas_state, d.width, d.height
    INTO v_canvas_state, v_width, v_height
    FROM documents d
    WHERE d.id = v_document_id;
  ELSE
    v_ops := '[]'::jsonb;
    v_canvas_state := NULL;
    v_width := NULL;
    v_height := NULL;
  END IF;

  INSERT INTO publications (
    user_id,
    project_id,
    document_id,
    conversation_id,
    title,
    description,
    cover_image_url,
    category_id,
    tags,
    status,
    published_at
  ) VALUES (
    v_user_id,
    v_project_id,
    v_document_id,
    p_conversation_id,
    LEFT(COALESCE(TRIM(p_title), ''), 50),
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    p_cover_image_url,
    p_category_id,
    COALESCE(p_tags, ARRAY[]::TEXT[]),
    'published',
    NOW()
  )
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    cover_image_url = EXCLUDED.cover_image_url,
    category_id = EXCLUDED.category_id,
    tags = EXCLUDED.tags,
    status = 'published',
    published_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_publication_id;

  INSERT INTO publication_snapshots (
    publication_id,
    messages_snapshot,
    ops_snapshot,
    canvas_state_snapshot,
    canvas_width,
    canvas_height
  ) VALUES (
    v_publication_id,
    v_messages,
    v_ops,
    v_canvas_state,
    v_width,
    v_height
  )
  ON CONFLICT (publication_id)
  DO UPDATE SET
    messages_snapshot = EXCLUDED.messages_snapshot,
    ops_snapshot = EXCLUDED.ops_snapshot,
    canvas_state_snapshot = EXCLUDED.canvas_state_snapshot,
    canvas_width = EXCLUDED.canvas_width,
    canvas_height = EXCLUDED.canvas_height,
    created_at = NOW();

  RETURN v_publication_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_publication_snapshot(
  p_publication_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_publication RECORD;
  v_messages JSONB;
  v_ops JSONB;
  v_canvas_state JSONB;
  v_width INTEGER;
  v_height INTEGER;
BEGIN
  SELECT * INTO v_publication
  FROM publications
  WHERE id = p_publication_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publication not found or not owned';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'role', m.role,
      'content', m.content,
      'metadata', m.metadata,
      'created_at', m.created_at
    ) ORDER BY m.created_at ASC
  ), '[]'::jsonb)
  INTO v_messages
  FROM messages m
  WHERE m.conversation_id = v_publication.conversation_id;

  IF v_publication.document_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'op_type', o.op_type,
        'payload', o.payload,
        'seq', o.seq,
        'created_at', o.created_at
      ) ORDER BY o.seq ASC
    ), '[]'::jsonb)
    INTO v_ops
    FROM ops o
    WHERE o.document_id = v_publication.document_id;

    SELECT d.canvas_state, d.width, d.height
    INTO v_canvas_state, v_width, v_height
    FROM documents d
    WHERE d.id = v_publication.document_id;
  ELSE
    v_ops := '[]'::jsonb;
    v_canvas_state := NULL;
    v_width := NULL;
    v_height := NULL;
  END IF;

  INSERT INTO publication_snapshots (
    publication_id,
    messages_snapshot,
    ops_snapshot,
    canvas_state_snapshot,
    canvas_width,
    canvas_height
  ) VALUES (
    p_publication_id,
    v_messages,
    v_ops,
    v_canvas_state,
    v_width,
    v_height
  )
  ON CONFLICT (publication_id)
  DO UPDATE SET
    messages_snapshot = EXCLUDED.messages_snapshot,
    ops_snapshot = EXCLUDED.ops_snapshot,
    canvas_state_snapshot = EXCLUDED.canvas_state_snapshot,
    canvas_width = EXCLUDED.canvas_width,
    canvas_height = EXCLUDED.canvas_height,
    created_at = NOW();

  UPDATE publications
    SET updated_at = NOW()
    WHERE id = p_publication_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_view_count(
  p_publication_id UUID,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_last TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM publications p
    WHERE p.id = p_publication_id
      AND p.status = 'published'
  ) THEN
    RETURN;
  END IF;

  v_viewer_id := COALESCE(p_viewer_id, auth.uid());

  IF v_viewer_id IS NULL THEN
    UPDATE publications
      SET view_count = view_count + 1
      WHERE id = p_publication_id;
    RETURN;
  END IF;

  SELECT last_viewed_at
  INTO v_last
  FROM publication_views
  WHERE publication_id = p_publication_id
    AND viewer_id = v_viewer_id;

  IF v_last IS NULL OR v_now - v_last > INTERVAL '10 minutes' THEN
    INSERT INTO publication_views (publication_id, viewer_id, last_viewed_at)
    VALUES (p_publication_id, v_viewer_id, v_now)
    ON CONFLICT (publication_id, viewer_id)
    DO UPDATE SET last_viewed_at = EXCLUDED.last_viewed_at;

    UPDATE publications
      SET view_count = view_count + 1
      WHERE id = p_publication_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION toggle_like(
  p_publication_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM publication_likes
    WHERE publication_id = p_publication_id
      AND user_id = v_user_id
  ) THEN
    DELETE FROM publication_likes
    WHERE publication_id = p_publication_id
      AND user_id = v_user_id;
    RETURN false;
  END IF;

  INSERT INTO publication_likes (publication_id, user_id)
  VALUES (p_publication_id, v_user_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION toggle_bookmark(
  p_publication_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM publication_bookmarks
    WHERE publication_id = p_publication_id
      AND user_id = v_user_id
  ) THEN
    DELETE FROM publication_bookmarks
    WHERE publication_id = p_publication_id
      AND user_id = v_user_id;
    RETURN false;
  END IF;

  INSERT INTO publication_bookmarks (publication_id, user_id)
  VALUES (p_publication_id, v_user_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION get_gallery_publications(
  p_category_slug TEXT DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'latest',
  p_cursor_published_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  cover_image_url TEXT,
  category_slug TEXT,
  category_name TEXT,
  tags TEXT[],
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  bookmark_count INTEGER,
  published_at TIMESTAMPTZ,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      p.id,
      p.title::TEXT,
      p.description,
      p.cover_image_url,
      c.slug AS category_slug,
      c.name AS category_name,
      p.tags,
      p.view_count,
      p.like_count,
      p.comment_count,
      p.bookmark_count,
      p.published_at,
      p.user_id,
      up.display_name,
      up.avatar_url
    FROM publications p
    JOIN publication_categories c ON c.id = p.category_id
    LEFT JOIN user_profiles up ON up.id = p.user_id
    WHERE p.status = 'published'
      AND (p_category_slug IS NULL OR c.slug = p_category_slug)
      AND (
        p_search_query IS NULL
        OR p.title ILIKE '%' || p_search_query || '%'
        OR COALESCE(p.description, '') ILIKE '%' || p_search_query || '%'
      )
  )
  SELECT *
  FROM base b
  WHERE (
    p_cursor_published_at IS NULL
    OR (b.published_at, b.id) < (p_cursor_published_at, p_cursor_id)
  )
  ORDER BY
    CASE WHEN p_sort_by = 'popular' THEN b.like_count END DESC,
    b.published_at DESC,
    b.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
$$;

COMMIT;
