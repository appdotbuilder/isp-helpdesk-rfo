import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable, commentsTable } from '../db/schema';
import { type UpdateCommentInput, type CreateUserInput, type CreateTicketInput, type CreateCommentInput } from '../schema';
import { updateComment } from '../handlers/update_comment';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  role: 'customer'
};

const testAgent: CreateUserInput = {
  name: 'Test Agent',
  email: 'agent@example.com',
  password: 'password123',
  role: 'agent'
};

const testTicket: CreateTicketInput = {
  subject: 'Test Ticket',
  description: 'A ticket for testing',
  category: 'technical_support',
  priority: 'medium',
  customer_id: 1 // Will be set after user creation
};

const testComment: CreateCommentInput = {
  ticket_id: 1, // Will be set after ticket creation
  user_id: 1, // Will be set after user creation
  content: 'Original comment content',
  is_internal: false
};

describe('updateComment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update comment content', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const ticket = await db.insert(ticketsTable)
      .values({
        subject: testTicket.subject,
        description: testTicket.description,
        category: testTicket.category,
        priority: testTicket.priority,
        customer_id: user[0].id
      })
      .returning()
      .execute();

    const comment = await db.insert(commentsTable)
      .values({
        ticket_id: ticket[0].id,
        user_id: user[0].id,
        content: testComment.content,
        is_internal: testComment.is_internal
      })
      .returning()
      .execute();

    // Update the comment
    const updateInput: UpdateCommentInput = {
      id: comment[0].id,
      content: 'Updated comment content'
    };

    const result = await updateComment(updateInput);

    // Verify the update
    expect(result.id).toEqual(comment[0].id);
    expect(result.content).toEqual('Updated comment content');
    expect(result.is_internal).toEqual(false); // Should preserve original value
    expect(result.ticket_id).toEqual(ticket[0].id);
    expect(result.user_id).toEqual(user[0].id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update is_internal flag', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const ticket = await db.insert(ticketsTable)
      .values({
        subject: testTicket.subject,
        description: testTicket.description,
        category: testTicket.category,
        priority: testTicket.priority,
        customer_id: user[0].id
      })
      .returning()
      .execute();

    const comment = await db.insert(commentsTable)
      .values({
        ticket_id: ticket[0].id,
        user_id: user[0].id,
        content: testComment.content,
        is_internal: false
      })
      .returning()
      .execute();

    // Update the internal flag
    const updateInput: UpdateCommentInput = {
      id: comment[0].id,
      is_internal: true
    };

    const result = await updateComment(updateInput);

    // Verify the update
    expect(result.id).toEqual(comment[0].id);
    expect(result.content).toEqual(testComment.content); // Should preserve original content
    expect(result.is_internal).toEqual(true); // Should be updated
    expect(result.ticket_id).toEqual(ticket[0].id);
    expect(result.user_id).toEqual(user[0].id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update both content and is_internal', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const ticket = await db.insert(ticketsTable)
      .values({
        subject: testTicket.subject,
        description: testTicket.description,
        category: testTicket.category,
        priority: testTicket.priority,
        customer_id: user[0].id
      })
      .returning()
      .execute();

    const comment = await db.insert(commentsTable)
      .values({
        ticket_id: ticket[0].id,
        user_id: user[0].id,
        content: testComment.content,
        is_internal: false
      })
      .returning()
      .execute();

    // Update both fields
    const updateInput: UpdateCommentInput = {
      id: comment[0].id,
      content: 'Updated comment with new internal status',
      is_internal: true
    };

    const result = await updateComment(updateInput);

    // Verify the update
    expect(result.id).toEqual(comment[0].id);
    expect(result.content).toEqual('Updated comment with new internal status');
    expect(result.is_internal).toEqual(true);
    expect(result.ticket_id).toEqual(ticket[0].id);
    expect(result.user_id).toEqual(user[0].id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const ticket = await db.insert(ticketsTable)
      .values({
        subject: testTicket.subject,
        description: testTicket.description,
        category: testTicket.category,
        priority: testTicket.priority,
        customer_id: user[0].id
      })
      .returning()
      .execute();

    const comment = await db.insert(commentsTable)
      .values({
        ticket_id: ticket[0].id,
        user_id: user[0].id,
        content: testComment.content,
        is_internal: false
      })
      .returning()
      .execute();

    // Update the comment
    const updateInput: UpdateCommentInput = {
      id: comment[0].id,
      content: 'Database persistence test'
    };

    await updateComment(updateInput);

    // Verify the change was persisted
    const persistedComments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, comment[0].id))
      .execute();

    expect(persistedComments).toHaveLength(1);
    expect(persistedComments[0].content).toEqual('Database persistence test');
    expect(persistedComments[0].is_internal).toEqual(false);
    expect(persistedComments[0].created_at).toBeInstanceOf(Date);
  });

  it('should return existing comment when no fields to update', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const ticket = await db.insert(ticketsTable)
      .values({
        subject: testTicket.subject,
        description: testTicket.description,
        category: testTicket.category,
        priority: testTicket.priority,
        customer_id: user[0].id
      })
      .returning()
      .execute();

    const comment = await db.insert(commentsTable)
      .values({
        ticket_id: ticket[0].id,
        user_id: user[0].id,
        content: testComment.content,
        is_internal: false
      })
      .returning()
      .execute();

    // Update with no actual changes
    const updateInput: UpdateCommentInput = {
      id: comment[0].id
    };

    const result = await updateComment(updateInput);

    // Should return the existing comment unchanged
    expect(result.id).toEqual(comment[0].id);
    expect(result.content).toEqual(testComment.content);
    expect(result.is_internal).toEqual(false);
    expect(result.ticket_id).toEqual(ticket[0].id);
    expect(result.user_id).toEqual(user[0].id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should throw error when comment does not exist', async () => {
    const updateInput: UpdateCommentInput = {
      id: 99999,
      content: 'This should fail'
    };

    expect(updateComment(updateInput)).rejects.toThrow(/Comment with id 99999 not found/i);
  });

  it('should preserve created_at timestamp', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const ticket = await db.insert(ticketsTable)
      .values({
        subject: testTicket.subject,
        description: testTicket.description,
        category: testTicket.category,
        priority: testTicket.priority,
        customer_id: user[0].id
      })
      .returning()
      .execute();

    const comment = await db.insert(commentsTable)
      .values({
        ticket_id: ticket[0].id,
        user_id: user[0].id,
        content: testComment.content,
        is_internal: false
      })
      .returning()
      .execute();

    const originalCreatedAt = comment[0].created_at;

    // Wait a small amount to ensure timestamp would be different if changed
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update the comment
    const updateInput: UpdateCommentInput = {
      id: comment[0].id,
      content: 'Updated content'
    };

    const result = await updateComment(updateInput);

    // Verify created_at is preserved
    expect(result.created_at).toEqual(originalCreatedAt);
  });
});