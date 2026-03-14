## 1. Database Schema & Migrations

- [x] 1.1 Create `publication_categories` table with columns (id UUID PK, name text, slug text UNIQUE, icon text, sort_order int, is_active bool default true, created_at) and seed 8 categories: 海报设计(poster-design), 社交媒体(social-media), 电商营销(ecommerce), 品牌物料(branding), 节日贺卡(holiday-card), 邀请函(invitation), 插画创意(illustration), 其他(other)
- [x] 1.2 Create `publications` table with columns (id, user_id, project_id, document_id, conversation_id, title varchar(50), description text, cover_image_url text, category_id FK, tags text[], status CHECK(published/hidden/removed), view_count, like_count, comment_count, bookmark_count, published_at, created_at, updated_at) with indexes on user_id, category_id, status+published_at, and updated_at trigger
- [x] 1.3 Create `publication_snapshots` table with columns (id UUID PK, publication_id FK UNIQUE, messages_snapshot jsonb, ops_snapshot jsonb, canvas_state_snapshot jsonb, canvas_width int, canvas_height int, created_at)
- [x] 1.4 Create `publication_likes` table with composite PK (publication_id, user_id), created_at, and trigger to increment/decrement `publications.like_count`
- [x] 1.5 Create `publication_bookmarks` table with composite PK (publication_id, user_id), created_at, and trigger to increment/decrement `publications.bookmark_count`
- [x] 1.6 Create `publication_comments` table with columns (id UUID PK, publication_id FK, user_id FK, content text CHECK(length <= 500), parent_id UUID self-ref nullable, created_at, updated_at) and trigger to increment/decrement `publications.comment_count`
- [x] 1.7 Create `user_follows` table with composite PK (follower_id, following_id), CHECK(follower_id != following_id), created_at, and triggers to increment/decrement follower_count/following_count on `user_profiles`
- [x] 1.8 Alter `user_profiles` table to add columns: display_name text, avatar_url text, bio text CHECK(length <= 200), follower_count int default 0, following_count int default 0, publication_count int default 0

## 2. RLS Policies & Security

- [x] 2.1 Enable RLS on all new tables (publication_categories, publications, publication_snapshots, publication_likes, publication_bookmarks, publication_comments, user_follows)
- [x] 2.2 Create RLS for `publication_categories`: public SELECT for all, no INSERT/UPDATE/DELETE for regular users
- [x] 2.3 Create RLS for `publications`: public SELECT where status='published', owner SELECT all own (including hidden), owner INSERT/UPDATE/DELETE where user_id=auth.uid()
- [x] 2.4 Create RLS for `publication_snapshots`: public SELECT via join to published publications, owner INSERT/UPDATE where linked publication is owned
- [x] 2.5 Create RLS for `publication_likes`: public SELECT, authenticated INSERT/DELETE where user_id=auth.uid()
- [x] 2.6 Create RLS for `publication_bookmarks`: public SELECT, authenticated INSERT/DELETE where user_id=auth.uid()
- [x] 2.7 Create RLS for `publication_comments`: public SELECT, authenticated INSERT where user_id=auth.uid(), DELETE where user_id=auth.uid() OR user is publication owner
- [x] 2.8 Create RLS for `user_follows`: public SELECT, authenticated INSERT/DELETE where follower_id=auth.uid()
- [x] 2.9 Create `public_profiles` database view exposing display_name, avatar_url, bio, follower_count, following_count, publication_count from user_profiles (public read, bypassing the private points/membership RLS)

## 3. Storage Setup

- [x] 3.1 Create `public-assets` storage bucket with public=true, 5MB limit, allowed types PNG/JPEG/WebP
- [x] 3.2 Create storage policies for `public-assets`: authenticated users can INSERT to `covers/{any}` and `avatars/{userId}.*` paths, public SELECT for all
- [x] 3.3 Create helper function to copy an asset from private `assets` bucket to `public-assets/covers/` bucket (for using conversation images as covers)

## 4. Database RPCs & Functions

- [x] 4.1 Create RPC `publish_conversation(p_conversation_id, p_title, p_description, p_cover_image_url, p_category_id, p_tags)` that: queries messages+ops+canvas_state, creates publication + snapshot in a transaction, sets published_at, increments user's publication_count, returns publication_id
- [x] 4.2 Create RPC `update_publication_snapshot(p_publication_id)` that: re-queries current messages+ops+canvas_state from original conversation, replaces the snapshot, updates publication.updated_at
- [x] 4.3 Create RPC `increment_view_count(p_publication_id, p_viewer_id)` with 10-minute deduplication per user+publication
- [x] 4.4 Create RPC `toggle_like(p_publication_id)` that inserts or deletes like record and updates count atomically
- [x] 4.5 Create RPC `toggle_bookmark(p_publication_id)` that inserts or deletes bookmark record and updates count atomically
- [x] 4.6 Create function `get_gallery_publications(p_category_slug, p_search_query, p_sort_by, p_cursor_published_at, p_cursor_id, p_limit)` as SECURITY DEFINER to efficiently query published works with filtering, search, sort, and cursor-based pagination

## 5. Share Dialog (Editor Integration)

- [x] 5.1 Create `ShareDialog` component with three-option layout: copy link, share image (disabled/coming soon), publish conversation
- [x] 5.2 Add share button to editor top toolbar (visible when conversation has >= 1 message), wired to open ShareDialog
- [x] 5.3 Create `PublishForm` modal component with: cover image selector (grid of conversation images + local upload), title input with character counter (max 50), category dropdown fetching from `publication_categories`, optional description textarea, Cancel/Publish buttons
- [x] 5.4 Implement auto-extraction of generated images from conversation messages and ops (addImage payloads) to populate cover candidates
- [x] 5.5 Implement cover image upload to `public-assets/covers/` bucket (local upload flow)
- [x] 5.6 Implement publish submission: call `publish_conversation` RPC, handle loading/success/error states, show success toast with link to published work
- [x] 5.7 Implement "already published" detection: check if current conversation has existing publication, show "更新发布" label and call `update_publication_snapshot` on submit
- [x] 5.8 Add zh-CN and en-US translations for all share dialog and publish form text

## 6. Discovery Gallery Page

- [x] 6.1 Create `/app/discover/page.tsx` with masonry grid layout (2/3/4/5 columns responsive) using CSS columns or a masonry library
- [x] 6.2 Create `PublicationCard` component showing: cover image (aspect-ratio preserved), title, author avatar + name, view count, like count, clickable to detail page
- [x] 6.3 Implement category tab bar at top of gallery: "全部" + all active categories from DB, horizontally scrollable with fade edges, URL query param sync (`?category=slug`)
- [x] 6.4 Implement search input with debounced query, URL sync (`?q=term`), and empty results state
- [x] 6.5 Implement sort toggle (最新/最热) with URL sync (`?sort=latest|popular`)
- [x] 6.6 Implement cursor-based infinite scroll using Intersection Observer: fetch 20 items per page, show skeleton cards while loading, show "已经到底了" when exhausted
- [x] 6.7 Implement gallery empty state with illustration and CTA
- [x] 6.8 Add "灵感发现" (Discover) entry to LeftSidebar with Compass icon, between Home and Projects, with active state on `/app/discover*`
- [x] 6.9 Add zh-CN and en-US translations for gallery page text

## 7. Publication Detail Page

- [x] 7.1 Create `/app/discover/[id]/page.tsx` layout with: large cover image hero, metadata section (title, category badge, author card, date, counts), conversation replay, comments, related works
- [x] 7.2 Create `ConversationReplay` component that renders snapshot messages in read-only timeline: user messages right-aligned with prompt style, assistant messages with generated images inline
- [x] 7.3 Implement view count increment on page load via `increment_view_count` RPC
- [x] 7.4 Create `AuthorCard` component with avatar, display name, bio, follower/publication counts, follow button (linked to creator profile)
- [x] 7.5 Create `RelatedWorks` section: fetch up to 4 works from same author, fallback to same category, display as horizontal scroll cards
- [x] 7.6 Handle 404 state for non-existent or hidden publications
- [x] 7.7 Add zh-CN and en-US translations for detail page text

## 8. Social Interactions (UI)

- [x] 8.1 Create `LikeButton` component with optimistic toggle, heart icon filled/unfilled, count display, login prompt for unauthenticated users; wire to `toggle_like` RPC
- [x] 8.2 Create `BookmarkButton` component with optimistic toggle, bookmark icon, count display; wire to `toggle_bookmark` RPC
- [x] 8.3 Integrate LikeButton and BookmarkButton into PublicationCard (gallery) and detail page
- [x] 8.4 Fetch user's liked and bookmarked publication IDs on gallery/detail load to show correct initial states
- [x] 8.5 Create `CommentSection` component with: comment input (1-500 chars), top-level comment list with replies grouped, load more pagination (20 per page)
- [x] 8.6 Create `CommentItem` component with: author avatar+name, content, timestamp, reply button, delete button (visible for own comments or publication owner)
- [x] 8.7 Implement reply-to-comment flow: clicking reply shows inline input prefilled with @username, submits with parent_id
- [x] 8.8 Add zh-CN and en-US translations for social interaction text

## 9. Creator Profiles & Follow System

- [x] 9.1 Create `/app/user/[userId]/page.tsx` with: profile header (avatar, display name, bio, follower/following/publication counts), follow button, published works grid
- [x] 9.2 Create `FollowButton` component with optimistic toggle, 关注/已关注 states; wire to user_follows INSERT/DELETE
- [x] 9.3 Implement profile edit functionality: display name, bio, avatar upload to `public-assets/avatars/{userId}.{ext}`, accessible from user's own profile page
- [x] 9.4 Add "我的发布" tab to existing profile page showing user's publications (published + hidden) with edit/hide/unhide actions
- [x] 9.5 Add "我的收藏" tab to existing profile page showing bookmarked publications with remove-bookmark action
- [x] 9.6 Handle 404 for non-existent user profiles
- [x] 9.7 Add zh-CN and en-US translations for creator profile text

## 10. Supabase Queries & Client Integration

- [x] 10.1 Create `src/lib/supabase/queries/publications.ts` with functions: fetchGalleryPublications, fetchPublicationDetail, fetchPublicationSnapshot, publishConversation, updatePublication, toggleLike, toggleBookmark, checkUserInteractions
- [x] 10.2 Create `src/lib/supabase/queries/comments.ts` with functions: fetchComments, createComment, deleteComment
- [x] 10.3 Create `src/lib/supabase/queries/follows.ts` with functions: followUser, unfollowUser, checkFollowStatus, fetchFollowers, fetchFollowing
- [x] 10.4 Create `src/lib/supabase/queries/profiles.ts` with functions: fetchPublicProfile, updateProfile, uploadAvatar
- [x] 10.5 Update Supabase TypeScript types (`generate_typescript_types`) to include all new tables

## 11. State Management

- [x] 11.1 Create `usePublicationStore` Zustand store for gallery state: publications list, filters (category, search, sort), pagination cursor, loading states
- [x] 11.2 Create `useInteractionStore` Zustand store for tracking current user's likes and bookmarks (set of publication IDs) to avoid per-card queries

## 12. Testing

- [x] 12.1 Write unit tests for publish RPC logic (snapshot creation, validation, error cases)
- [x] 12.2 Write unit tests for gallery query function (filtering, pagination, sort)
- [x] 12.3 Write unit tests for social interaction toggles (like/unlike, bookmark/unbookmark, count consistency)
- [x] 12.4 Write component tests for PublishForm (validation, image extraction, submission)
- [x] 12.5 Write component tests for PublicationCard (render, click, interaction states)
