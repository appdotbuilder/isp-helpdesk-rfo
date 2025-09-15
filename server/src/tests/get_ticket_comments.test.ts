import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable, commentsTable } from '../db/schema';
import { getTicketComments } from '../handlers/get_ticket_comments';

describe('getTicketComments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let customerId: number;
  let agentId: number;
  let ticketId: number;

  beforeEach(async () => {
    // Create test users
    const customerResult = await db.insert(usersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@test.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();
    customerId = customerResult[0].id;

    const agentResult = await db.insert(usersTable)
      .values({
        name: 'Test Agent',
        email: 'agent@test.com',
        password_hash: 'hashed_password',
        role: 'agent'
      })
      .returning()
      .execute();
    agentId = agentResult[0].id;

    // Create test ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Test Ticket',
        description: 'Test ticket for comments',
        category: 'technical_support',
        priority: 'medium',
        customer_id: customerId
      })
      .returning()
      .execute();
    ticketId = ticketResult[0].id;
  });

  it('should return all public comments when includeInternal is false', async () => {
    // Create public comments
    await db.insert(commentsTable)
      .values([
        {
          ticket_id: ticketId,
          user_id: customerId,
          content: 'Customer comment',
          is_internal: false
        },
        {
          ticket_id: ticketId,
          user_id: agentId,
          content: 'Agent public comment',
          is_internal: false
        },
        {
          ticket_id: ticketId,
          user_id: agentId,
          content: 'Agent internal note',
          is_internal: true
        }
      ])
      .execute();

    const comments = await getTicketComments(ticketId, false);

    expect(comments).toHaveLength(2);
    expect(comments[0].content).toBe('Customer comment');
    expect(comments[0].is_internal).toBe(false);
    expect(comments[1].content).toBe('Agent public comment');
    expect(comments[1].is_internal).toBe(false);
  });

  it('should return all comments including internal when includeInternal is true', async () => {
    // Create mix of public and internal comments
    await db.insert(commentsTable)
      .values([
        {
          ticket_id: ticketId,
          user_id: customerId,
          content: 'Customer comment',
          is_internal: false
        },
        {
          ticket_id: ticketId,
          user_id: agentId,
          content: 'Agent internal note',
          is_internal: true
        },
        {
          ticket_id: ticketId,
          user_id: agentId,
          content: 'Agent public comment',
          is_internal: false
        }
      ])
      .execute();

    const comments = await getTicketComments(ticketId, true);

    expect(comments).toHaveLength(3);
    expect(comments.some(c => c.is_internal === true)).toBe(true);
    expect(comments.some(c => c.is_internal === false)).toBe(true);
  });

  it('should return comments ordered by creation date (oldest first)', async () => {
    // Create comments with different timestamps
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await db.insert(commentsTable)
      .values([
        {
          ticket_id: ticketId,
          user_id: customerId,
          content: 'Latest comment',
          is_internal: false,
          created_at: now
        },
        {
          ticket_id: ticketId,
          user_id: agentId,
          content: 'Middle comment',
          is_internal: false,
          created_at: oneHourAgo
        },
        {
          ticket_id: ticketId,
          user_id: customerId,
          content: 'Oldest comment',
          is_internal: false,
          created_at: twoHoursAgo
        }
      ])
      .execute();

    const comments = await getTicketComments(ticketId, false);

    expect(comments).toHaveLength(3);
    expect(comments[0].content).toBe('Oldest comment');
    expect(comments[1].content).toBe('Middle comment');
    expect(comments[2].content).toBe('Latest comment');

    // Verify dates are in ascending order
    expect(comments[0].created_at <= comments[1].created_at).toBe(true);
    expect(comments[1].created_at <= comments[2].created_at).toBe(true);
  });

  it('should return empty array for ticket with no comments', async () => {
    const comments = await getTicketComments(ticketId, false);

    expect(comments).toHaveLength(0);
    expect(Array.isArray(comments)).toBe(true);
  });

  it('should return empty array for non-existent ticket', async () => {
    const comments = await getTicketComments(99999, false);

    expect(comments).toHaveLength(0);
    expect(Array.isArray(comments)).toBe(true);
  });

  it('should only return comments for the specified ticket', async () => {
    // Create another ticket
    const anotherTicketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Another Test Ticket',
        description: 'Another test ticket',
        category: 'billing_issue',
        priority: 'low',
        customer_id: customerId
      })
      .returning()
      .execute();
    const anotherTicketId = anotherTicketResult[0].id;

    // Create comments for both tickets
    await db.insert(commentsTable)
      .values([
        {
          ticket_id: ticketId,
          user_id: customerId,
          content: 'Comment for first ticket',
          is_internal: false
        },
        {
          ticket_id: anotherTicketId,
          user_id: customerId,
          content: 'Comment for second ticket',
          is_internal: false
        }
      ])
      .execute();

    const firstTicketComments = await getTicketComments(ticketId, false);
    const secondTicketComments = await getTicketComments(anotherTicketId, false);

    expect(firstTicketComments).toHaveLength(1);
    expect(firstTicketComments[0].content).toBe('Comment for first ticket');
    expect(firstTicketComments[0].ticket_id).toBe(ticketId);

    expect(secondTicketComments).toHaveLength(1);
    expect(secondTicketComments[0].content).toBe('Comment for second ticket');
    expect(secondTicketComments[0].ticket_id).toBe(anotherTicketId);
  });

  it('should return properly structured comment objects', async () => {
    await db.insert(commentsTable)
      .values({
        ticket_id: ticketId,
        user_id: customerId,
        content: 'Test comment content',
        is_internal: false
      })
      .execute();

    const comments = await getTicketComments(ticketId, false);

    expect(comments).toHaveLength(1);
    const comment = comments[0];

    expect(comment.id).toBeDefined();
    expect(typeof comment.id).toBe('number');
    expect(comment.ticket_id).toBe(ticketId);
    expect(comment.user_id).toBe(customerId);
    expect(comment.content).toBe('Test comment content');
    expect(comment.is_internal).toBe(false);
    expect(comment.created_at).toBeInstanceOf(Date);
  });
});