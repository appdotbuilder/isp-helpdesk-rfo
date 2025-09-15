import { db } from '../db';
import { commentsTable, ticketsTable, usersTable } from '../db/schema';
import { type CreateCommentInput, type Comment } from '../schema';
import { eq } from 'drizzle-orm';

export const createComment = async (input: CreateCommentInput): Promise<Comment> => {
  try {
    // Validate that the ticket exists
    const existingTicket = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, input.ticket_id))
      .execute();

    if (existingTicket.length === 0) {
      throw new Error(`Ticket with id ${input.ticket_id} not found`);
    }

    // Validate that the user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Insert the comment
    const result = await db.insert(commentsTable)
      .values({
        ticket_id: input.ticket_id,
        user_id: input.user_id,
        content: input.content,
        is_internal: input.is_internal
      })
      .returning()
      .execute();

    // Update the ticket's updated_at timestamp
    await db.update(ticketsTable)
      .set({ updated_at: new Date() })
      .where(eq(ticketsTable.id, input.ticket_id))
      .execute();

    return result[0];
  } catch (error) {
    console.error('Comment creation failed:', error);
    throw error;
  }
};