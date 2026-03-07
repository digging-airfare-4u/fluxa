-- Inspiration Discovery: RLS policies

BEGIN;

ALTER TABLE publication_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_views ENABLE ROW LEVEL SECURITY;

-- publication_categories
DROP POLICY IF EXISTS "Public can read categories" ON publication_categories;
CREATE POLICY "Public can read categories"
  ON publication_categories FOR SELECT
  USING (true);

-- publications
DROP POLICY IF EXISTS "Public can read published publications" ON publications;
CREATE POLICY "Public can read published publications"
  ON publications FOR SELECT
  USING (status = 'published' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can create publications" ON publications;
CREATE POLICY "Owners can create publications"
  ON publications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update publications" ON publications;
CREATE POLICY "Owners can update publications"
  ON publications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete publications" ON publications;
CREATE POLICY "Owners can delete publications"
  ON publications FOR DELETE
  USING (user_id = auth.uid());

-- publication_snapshots
DROP POLICY IF EXISTS "Public can read snapshots of published publications" ON publication_snapshots;
CREATE POLICY "Public can read snapshots of published publications"
  ON publication_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM publications p
      WHERE p.id = publication_snapshots.publication_id
        AND (p.status = 'published' OR p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can write snapshots" ON publication_snapshots;
CREATE POLICY "Owners can write snapshots"
  ON publication_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM publications p
      WHERE p.id = publication_snapshots.publication_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM publications p
      WHERE p.id = publication_snapshots.publication_id
        AND p.user_id = auth.uid()
    )
  );

-- likes
DROP POLICY IF EXISTS "Public can read likes" ON publication_likes;
CREATE POLICY "Public can read likes"
  ON publication_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert own likes" ON publication_likes;
CREATE POLICY "Authenticated can insert own likes"
  ON publication_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own likes" ON publication_likes;
CREATE POLICY "Users can delete own likes"
  ON publication_likes FOR DELETE
  USING (auth.uid() = user_id);

-- bookmarks
DROP POLICY IF EXISTS "Public can read bookmarks" ON publication_bookmarks;
CREATE POLICY "Public can read bookmarks"
  ON publication_bookmarks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert own bookmarks" ON publication_bookmarks;
CREATE POLICY "Authenticated can insert own bookmarks"
  ON publication_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON publication_bookmarks;
CREATE POLICY "Users can delete own bookmarks"
  ON publication_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- comments
DROP POLICY IF EXISTS "Public can read comments" ON publication_comments;
CREATE POLICY "Public can read comments"
  ON publication_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert own comments" ON publication_comments;
CREATE POLICY "Authenticated can insert own comments"
  ON publication_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users or publication owner can delete comments" ON publication_comments;
CREATE POLICY "Users or publication owner can delete comments"
  ON publication_comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM publications p
      WHERE p.id = publication_comments.publication_id
        AND p.user_id = auth.uid()
    )
  );

-- follows
DROP POLICY IF EXISTS "Public can read follows" ON user_follows;
CREATE POLICY "Public can read follows"
  ON user_follows FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can follow as self" ON user_follows;
CREATE POLICY "Authenticated can follow as self"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow as self" ON user_follows;
CREATE POLICY "Users can unfollow as self"
  ON user_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- publication_views
DROP POLICY IF EXISTS "No direct reads on publication views" ON publication_views;
CREATE POLICY "No direct reads on publication views"
  ON publication_views FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "Users can upsert own view rows" ON publication_views;
CREATE POLICY "Users can upsert own view rows"
  ON publication_views FOR ALL
  USING (auth.uid() = viewer_id)
  WITH CHECK (auth.uid() = viewer_id);

COMMIT;
