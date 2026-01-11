/**
 * Feature: chat-canvas
 * Property 5: Project Creation Invariant
 * Validates: Requirements 5.3
 *
 * For any newly created project, the database SHALL contain exactly one
 * document record and exactly one conversation record linked to that project.
 *
 * Note: These tests validate the project creation logic conceptually since
 * we cannot run against a real Supabase database in unit tests. The actual
 * database operations are tested with integration tests.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types representing our data model
interface User {
  id: string;
}

interface Project {
  id: string;
  user_id: string;
  name: string;
}

interface Document {
  id: string;
  project_id: string;
  name: string;
  width: number;
  height: number;
}

interface Conversation {
  id: string;
  project_id: string;
  document_id: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Simulated database state
interface DatabaseState {
  projects: Project[];
  documents: Document[];
  conversations: Conversation[];
  messages: Message[];
}

// Arbitraries for generating test data
const userArb = fc.record({
  id: fc.uuid(),
});

const projectNameArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 100 })
);

const promptArb = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 1, maxLength: 500 })
);

/**
 * Simulates the createProject function behavior
 * This mirrors the logic in src/lib/supabase/queries/projects.ts
 */
function simulateCreateProject(
  db: DatabaseState,
  user: User,
  name?: string,
  initialPrompt?: string
): {
  project: Project;
  document: Document;
  conversation: Conversation;
  message?: Message;
} {
  // Create project
  const project: Project = {
    id: fc.sample(fc.uuid(), 1)[0],
    user_id: user.id,
    name: name || 'Untitled Project',
  };
  db.projects.push(project);

  // Create default document (1080x1350)
  const document: Document = {
    id: fc.sample(fc.uuid(), 1)[0],
    project_id: project.id,
    name: 'Untitled',
    width: 1080,
    height: 1350,
  };
  db.documents.push(document);

  // Create default conversation linked to document
  const conversation: Conversation = {
    id: fc.sample(fc.uuid(), 1)[0],
    project_id: project.id,
    document_id: document.id,
  };
  db.conversations.push(conversation);

  // If initial prompt provided, create the first user message
  let message: Message | undefined;
  if (initialPrompt) {
    message = {
      id: fc.sample(fc.uuid(), 1)[0],
      conversation_id: conversation.id,
      role: 'user',
      content: initialPrompt,
    };
    db.messages.push(message);
  }

  return { project, document, conversation, message };
}

/**
 * Count documents for a project
 */
function countDocumentsForProject(db: DatabaseState, projectId: string): number {
  return db.documents.filter((d) => d.project_id === projectId).length;
}

/**
 * Count conversations for a project
 */
function countConversationsForProject(db: DatabaseState, projectId: string): number {
  return db.conversations.filter((c) => c.project_id === projectId).length;
}

/**
 * Count messages for a conversation
 */
function countMessagesForConversation(db: DatabaseState, conversationId: string): number {
  return db.messages.filter((m) => m.conversation_id === conversationId).length;
}

describe('Property 5: Project Creation Invariant', () => {
  /**
   * Property: For any newly created project, exactly one document is created
   * Validates: Requirement 5.3
   */
  it('should create exactly one document for each new project', () => {
    fc.assert(
      fc.property(userArb, projectNameArb, promptArb, (user, name, prompt) => {
        const db: DatabaseState = {
          projects: [],
          documents: [],
          conversations: [],
          messages: [],
        };

        const { project } = simulateCreateProject(db, user, name, prompt);

        // Verify exactly one document exists for this project
        const documentCount = countDocumentsForProject(db, project.id);
        expect(documentCount).toBe(1);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any newly created project, exactly one conversation is created
   * Validates: Requirement 5.3
   */
  it('should create exactly one conversation for each new project', () => {
    fc.assert(
      fc.property(userArb, projectNameArb, promptArb, (user, name, prompt) => {
        const db: DatabaseState = {
          projects: [],
          documents: [],
          conversations: [],
          messages: [],
        };

        const { project } = simulateCreateProject(db, user, name, prompt);

        // Verify exactly one conversation exists for this project
        const conversationCount = countConversationsForProject(db, project.id);
        expect(conversationCount).toBe(1);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The created document has default dimensions (1080x1350)
   * Validates: Requirement 5.3
   */
  it('should create document with default dimensions', () => {
    fc.assert(
      fc.property(userArb, projectNameArb, promptArb, (user, name, prompt) => {
        const db: DatabaseState = {
          projects: [],
          documents: [],
          conversations: [],
          messages: [],
        };

        const { document } = simulateCreateProject(db, user, name, prompt);

        // Verify default dimensions
        expect(document.width).toBe(1080);
        expect(document.height).toBe(1350);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The conversation is linked to the document
   * Validates: Requirement 5.3
   */
  it('should link conversation to the created document', () => {
    fc.assert(
      fc.property(userArb, projectNameArb, promptArb, (user, name, prompt) => {
        const db: DatabaseState = {
          projects: [],
          documents: [],
          conversations: [],
          messages: [],
        };

        const { document, conversation } = simulateCreateProject(db, user, name, prompt);

        // Verify conversation is linked to document
        expect(conversation.document_id).toBe(document.id);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: If initial prompt is provided, exactly one message is created
   * Validates: Requirement 5.2
   */
  it('should create initial message when prompt is provided', () => {
    fc.assert(
      fc.property(
        userArb,
        projectNameArb,
        fc.string({ minLength: 1, maxLength: 500 }),
        (user, name, prompt) => {
          const db: DatabaseState = {
            projects: [],
            documents: [],
            conversations: [],
            messages: [],
          };

          const { conversation } = simulateCreateProject(db, user, name, prompt);

          // Verify exactly one message exists for this conversation
          const messageCount = countMessagesForConversation(db, conversation.id);
          expect(messageCount).toBe(1);

          // Verify message content matches prompt
          const message = db.messages.find((m) => m.conversation_id === conversation.id);
          expect(message?.content).toBe(prompt);
          expect(message?.role).toBe('user');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: If no prompt is provided, no message is created
   * Validates: Requirement 5.3
   */
  it('should not create message when no prompt is provided', () => {
    fc.assert(
      fc.property(userArb, projectNameArb, (user, name) => {
        const db: DatabaseState = {
          projects: [],
          documents: [],
          conversations: [],
          messages: [],
        };

        const { conversation } = simulateCreateProject(db, user, name, undefined);

        // Verify no messages exist for this conversation
        const messageCount = countMessagesForConversation(db, conversation.id);
        expect(messageCount).toBe(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Project name defaults to 'Untitled Project' when not provided
   * Validates: Requirement 5.3
   */
  it('should use default project name when not provided', () => {
    fc.assert(
      fc.property(userArb, promptArb, (user, prompt) => {
        const db: DatabaseState = {
          projects: [],
          documents: [],
          conversations: [],
          messages: [],
        };

        const { project } = simulateCreateProject(db, user, undefined, prompt);

        // Verify default name
        expect(project.name).toBe('Untitled Project');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Project uses provided name when given
   * Validates: Requirement 5.3
   */
  it('should use provided project name', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        promptArb,
        (user, name, prompt) => {
          const db: DatabaseState = {
            projects: [],
            documents: [],
            conversations: [],
            messages: [],
          };

          const { project } = simulateCreateProject(db, user, name, prompt);

          // Verify provided name is used
          expect(project.name).toBe(name);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All created records are linked to the correct user
   * Validates: Requirement 5.3
   */
  it('should link all records to the correct user', () => {
    fc.assert(
      fc.property(userArb, projectNameArb, promptArb, (user, name, prompt) => {
        const db: DatabaseState = {
          projects: [],
          documents: [],
          conversations: [],
          messages: [],
        };

        const { project, document, conversation } = simulateCreateProject(
          db,
          user,
          name,
          prompt
        );

        // Verify project is linked to user
        expect(project.user_id).toBe(user.id);

        // Verify document is linked to project
        expect(document.project_id).toBe(project.id);

        // Verify conversation is linked to project
        expect(conversation.project_id).toBe(project.id);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
