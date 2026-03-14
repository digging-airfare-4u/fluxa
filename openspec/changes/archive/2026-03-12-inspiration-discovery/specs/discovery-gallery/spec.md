## ADDED Requirements

### Requirement: Gallery page with masonry layout
The system SHALL display published works in a responsive masonry (waterfall) grid layout at `/app/discover`.

#### Scenario: Gallery renders with publications
- **WHEN** a user navigates to `/app/discover` and there are 20 published works
- **THEN** the page renders a masonry grid showing publication cards with cover images, titles, author avatars, author names, view counts, and like counts

#### Scenario: Responsive column count
- **WHEN** the viewport width changes
- **THEN** the grid adjusts: 2 columns on mobile (< 768px), 3 columns on tablet (768-1024px), 4 columns on desktop (1024-1440px), 5 columns on wide screens (> 1440px)

#### Scenario: Empty state
- **WHEN** no published works exist (or none match the current filter)
- **THEN** the page displays an empty state illustration with a message encouraging the user to create and share their first design

### Requirement: Category tab filtering
The system SHALL display category tabs at the top of the gallery page, allowing users to filter publications by category.

#### Scenario: All categories tab
- **WHEN** user is on the gallery page without selecting a specific category
- **THEN** the "全部" (All) tab is active and all published works are displayed

#### Scenario: Filter by category
- **WHEN** user clicks a category tab (e.g., "海报设计")
- **THEN** only publications belonging to that category are displayed, the tab becomes active, and the URL updates with a query parameter `?category=poster-design`

#### Scenario: Category tabs are scrollable
- **WHEN** the number of categories exceeds the viewport width
- **THEN** the category bar is horizontally scrollable with subtle fade edges

### Requirement: Search publications
The system SHALL allow users to search publications by title and tags using a search input on the gallery page.

#### Scenario: Search by title
- **WHEN** user types "新年海报" in the search input and submits
- **THEN** the gallery displays only publications whose title contains "新年海报" (case-insensitive, supports partial match)

#### Scenario: Search by tag
- **WHEN** user searches for "branding"
- **THEN** the gallery displays publications that have "branding" in their tags array

#### Scenario: Search with no results
- **WHEN** search returns zero results
- **THEN** the page shows a "no results" message with suggestion to try different keywords

#### Scenario: Clear search
- **WHEN** user clears the search input
- **THEN** the gallery returns to showing all publications (respecting active category filter)

### Requirement: Sort publications
The system SHALL support sorting gallery publications by different criteria.

#### Scenario: Default sort — latest
- **WHEN** user loads the gallery page without specifying a sort order
- **THEN** publications are sorted by `published_at` descending (newest first)

#### Scenario: Sort by popularity
- **WHEN** user selects "最热" (Most Popular) sort option
- **THEN** publications are sorted by `like_count` descending, with `published_at` as tiebreaker

#### Scenario: Sort persists with filters
- **WHEN** user has "最热" sort active and then selects a category filter
- **THEN** the sort order is preserved, only the filtered subset is displayed

### Requirement: Infinite scroll pagination
The system SHALL load gallery publications in pages using cursor-based pagination triggered by scroll.

#### Scenario: Initial page load
- **WHEN** user navigates to the gallery
- **THEN** the first 20 publications are loaded and displayed

#### Scenario: Scroll to load more
- **WHEN** user scrolls to the bottom of the current content (Intersection Observer triggers)
- **THEN** the next 20 publications are fetched using a cursor (last item's `published_at` + `id`) and appended to the grid

#### Scenario: All content loaded
- **WHEN** there are no more publications to load
- **THEN** a "已经到底了" (No more content) indicator is shown, and no further requests are made

#### Scenario: Loading state
- **WHEN** a new page is being fetched
- **THEN** skeleton cards are shown at the bottom of the grid

### Requirement: Gallery navigation entry
The system SHALL add a "灵感发现" (Discover) entry to the left sidebar navigation, positioned between Home and Projects.

#### Scenario: Sidebar shows discover icon
- **WHEN** any `/app/*` page is rendered
- **THEN** the left sidebar displays a Compass icon for "灵感发现" between the Home and Projects icons

#### Scenario: Active state
- **WHEN** user is on `/app/discover` or `/app/discover/*`
- **THEN** the Compass icon is highlighted as active
