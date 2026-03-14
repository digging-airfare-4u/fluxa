## Purpose

TBD

## Requirements

### Requirement: Share button in editor toolbar
The system SHALL add a share button to the editor's top toolbar, visible when a conversation has at least one message.

#### Scenario: Share button visible
- **WHEN** user is in the editor with an active conversation that has at least one message
- **THEN** a share icon button (Share2 or Upload icon) appears in the top toolbar area

#### Scenario: Share button hidden for empty conversation
- **WHEN** the conversation has no messages yet
- **THEN** the share button is not displayed

### Requirement: Share dialog with three options
The system SHALL display a share dialog with three sharing modes when the share button is clicked.

#### Scenario: Open share dialog
- **WHEN** user clicks the share button
- **THEN** a dialog opens showing the conversation title and three action buttons: "复制对话链接" (Copy Link), "分享对话图片" (Share as Image), "发布对话" (Publish Conversation)

#### Scenario: Copy conversation link
- **WHEN** user clicks "复制对话链接"
- **THEN** a shareable URL is copied to clipboard and a success toast is shown (Note: the actual shared link viewing page is a Phase 3 feature; for now, the link format is reserved)

#### Scenario: Share as image
- **WHEN** user clicks "分享对话图片"
- **THEN** a preview of the conversation as a shareable image card is generated and downloadable (Note: this is a Phase 3 feature; for now, the button is shown but disabled with a "coming soon" tooltip)

### Requirement: Publish conversation form
The system SHALL display a publish form when user selects "发布对话", allowing them to configure and submit the publication.

#### Scenario: Form layout
- **WHEN** user clicks "发布对话"
- **THEN** a modal opens showing: a header explaining "包含对话中所有提示词及设计输出", cover image selection area, title input, category selector, optional description textarea, and Cancel/Publish buttons

#### Scenario: Auto-extract conversation images as cover candidates
- **WHEN** the publish form opens
- **THEN** the system extracts all generated images from the conversation (from message metadata and ops with `addImage`) and displays them as selectable cover options in a thumbnail grid

#### Scenario: Select cover from conversation images
- **WHEN** user clicks on one of the extracted conversation images
- **THEN** that image is selected as the cover, shown with a selected border highlight

#### Scenario: Upload local cover
- **WHEN** user clicks "本地上传" (Local Upload) in the cover area
- **THEN** a file picker opens accepting PNG/JPEG/WebP images up to 5MB; on selection, the image is previewed as the cover

#### Scenario: Title input
- **WHEN** user types in the title field
- **THEN** the input shows a character counter (e.g., "12/50"), enforcing a maximum of 50 characters

#### Scenario: Category selection
- **WHEN** user interacts with the category selector
- **THEN** a dropdown or radio group shows all active categories from `publication_categories`, and user MUST select one before publishing

#### Scenario: Submit publish
- **WHEN** user clicks "发布" with all required fields filled (cover, title, category)
- **THEN** the form enters a loading state, calls the publish RPC, and on success closes the modal with a success toast and optionally offers to view the published work

#### Scenario: Publish validation error
- **WHEN** user clicks "发布" with missing required fields
- **THEN** the missing fields are highlighted with error messages and submission is blocked

#### Scenario: Publish failure
- **WHEN** the publish RPC returns an error
- **THEN** an error toast is shown with the error message, the form remains open for retry

### Requirement: Already published indicator
The system SHALL indicate when the current conversation has already been published, and offer to update.

#### Scenario: Conversation already published
- **WHEN** user opens the share dialog for a conversation that has an existing publication
- **THEN** the "发布对话" button label changes to "更新发布" (Update Publication), and a note indicates the work is already public with a link to view it

#### Scenario: Update existing publication
- **WHEN** user submits the publish form for an already-published conversation
- **THEN** the system updates the existing publication's snapshot, cover, and metadata instead of creating a new publication record

### Requirement: i18n for share dialog
All text in the share dialog and publish form SHALL be internationalized with zh-CN and en-US translations.

#### Scenario: Language switch
- **WHEN** user's locale is set to en-US
- **THEN** all labels, buttons, placeholders, and messages in the share dialog and publish form are displayed in English
