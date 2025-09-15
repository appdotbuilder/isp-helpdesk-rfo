import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable, commentsTable } from '../db/schema';
import { type CreateCommentInput } from '../schema';
import { createComment } from '../handlers/create_comment';
import { eq } from 'drizzle-orm';

describe('createComment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testAgentId: number;
  let testTicketId: number;

  beforeEach(async () => {
    // Create test user (customer)
    const userResult = await db.insert(usersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@test.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test agent
    const agentResult = await db.insert(usersTable)
      .values({
        name: 'Test Agent',
        email: 'agent@test.com',
        password_hash: 'hashed_password',
        role: 'agent'
      })
      .returning()
      .execute();
    testAgentId = agentResult[0].id;

    // Create test ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Test Ticket',
        description: 'Test ticket description',
        category: 'technical_support',
        priority: 'medium',
        status: 'open',
        customer_id: testUserId
      })
      .returning()
      .execute();
    testTicketId = ticketResult[0].id;
  });

  it('should create a public comment', async () => {
    const testInput: CreateCommentInput = {
      ticket_id: testTicketId,
      user_id: testUserId,
      content: 'This is a test comment',
      is_internal: false
    };

    const result = await createComment(testInput);

    expect(result.ticket_id).toEqual(testTicketId);
    expect(result.user_id).toEqual(testUserId);
    expect(result.content).toEqual('This is a test comment');
    expect(result.is_internal).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create an internal comment', async () => {
    const testInput: CreateCommentInput = {
      ticket_id: testTicketId,
      user_id: testAgentId,
      content: 'Internal agent note',
      is_internal: true
    };

    const result = await createComment(testInput);

    expect(result.ticket_id).toEqual(testTicketId);
    expect(result.user_id).toEqual(testAgentId);
    expect(result.content).toEqual('Internal agent note');
    expect(result.is_internal).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save comment to database', async () => {
    const testInput: CreateCommentInput = {
      ticket_id: testTicketId,
      user_id: testUserId,
      content: 'Database test comment',
      is_internal: false
    };

    const result = await createComment(testInput);

    // Verify comment was saved to database
    const comments = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, result.id))
      .execute();

    expect(comments).toHaveLength(1);
    expect(comments[0].ticket_id).toEqual(testTicketId);
    expect(comments[0].user_id).toEqual(testUserId);
    expect(comments[0].content).toEqual('Database test comment');
    expect(comments[0].is_internal).toEqual(false);
    expect(comments[0].created_at).toBeInstanceOf(Date);
  });

  it('should update ticket updated_at timestamp', async () => {
    // Get original ticket timestamp
    const originalTicket = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, testTicketId))
      .execute();
    const originalUpdatedAt = originalTicket[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const testInput: CreateCommentInput = {
      ticket_id: testTicketId,
      user_id: testUserId,
      content: 'Comment that should update ticket timestamp',
      is_internal: false
    };

    await createComment(testInput);

    // Verify ticket updated_at was changed
    const updatedTicket = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, testTicketId))
      .execute();

    expect(updatedTicket[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error for non-existent ticket', async () => {
    const testInput: CreateCommentInput = {
      ticket_id: 999999, // Non-existent ticket ID
      user_id: testUserId,
      content: 'Comment on non-existent ticket',
      is_internal: false
    };

    await expect(createComment(testInput)).rejects.toThrow(/ticket.*not found/i);
  });

  it('should throw error for non-existent user', async () => {
    const testInput: CreateCommentInput = {
      ticket_id: testTicketId,
      user_id: 999999, // Non-existent user ID
      content: 'Comment by non-existent user',
      is_internal: false
    };

    await expect(createComment(testInput)).rejects.toThrow(/user.*not found/i);
  });

  it('should handle is_internal default value', async () => {
    const testInput: CreateCommentInput = {
      ticket_id: testTicketId,
      user_id: testUserId,
      content: 'Comment with default is_internal',
      is_internal: false // Zod default applied
    };

    const result = await createComment(testInput);

    expect(result.is_internal).toEqual(false);
  });
});