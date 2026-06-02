/**
 * AI Elements — vendored + Fluxa-adapted components.
 * Source: https://elements.ai-sdk.dev
 */

export { Shimmer, type TextShimmerProps } from './shimmer';
export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  type ConversationProps,
  type ConversationContentProps,
  type ConversationEmptyStateProps,
  type ConversationScrollButtonProps,
} from './conversation';
export {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
  useReasoning,
  type ReasoningProps,
  type ReasoningTriggerProps,
  type ReasoningContentProps,
} from './reasoning';
export { Response, type ResponseProps } from './response';
export {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
  AttachmentEmpty,
  getMediaCategory,
  getAttachmentLabel,
  type AttachmentData,
  type AttachmentsProps,
  type AttachmentProps,
  type AttachmentMediaCategory,
} from './attachments';
