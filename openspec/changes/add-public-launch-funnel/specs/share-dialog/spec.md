## MODIFIED Requirements

### Requirement: Share dialog with three options
The system SHALL display a share dialog with three sharing modes when the share button is clicked, and the link-copy flow SHALL resolve to the real public publication URL when available.

#### Scenario: Open share dialog
- **WHEN** user clicks the share button
- **THEN** a dialog opens showing the conversation title and three action buttons: "复制对话链接" (Copy Link), "分享对话图片" (Share as Image), "发布对话" (Publish Conversation)

#### Scenario: Copy published conversation link
- **WHEN** user clicks "复制对话链接" for a conversation that already has a publication
- **THEN** the system copies the real public publication URL to the clipboard and shows success feedback

#### Scenario: Copy link before publication exists
- **WHEN** user clicks "复制对话链接" for a conversation that has not been published yet
- **THEN** the system does not copy a fake public URL and instead shows actionable guidance to publish first

#### Scenario: Share as image
- **WHEN** user clicks "分享对话图片"
- **THEN** a preview of the conversation as a shareable image card is generated and downloadable (Note: this is a Phase 3 feature; for now, the button is shown but disabled with a "coming soon" tooltip)

## ADDED Requirements

### Requirement: Share dialog SHALL surface the current publication state
The system SHALL make it clear in the share dialog whether the current conversation is already publicly available and where that public page lives.

#### Scenario: Conversation already published
- **WHEN** user opens the share dialog for a conversation that has an existing publication
- **THEN** the dialog indicates the conversation is public and offers a navigable entry to the corresponding public detail page

#### Scenario: Conversation not yet published
- **WHEN** user opens the share dialog for a conversation that has no publication
- **THEN** the dialog indicates that no public page exists yet and guides the user toward publishing

