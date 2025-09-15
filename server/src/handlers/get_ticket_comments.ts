import { db } from '../db';
import { commentsTable, usersTable } from '../db/schema';
import { type Comment } from '../schema';
import { eq, and, asc } from 'drizzle-orm';

export const getTicketComments = async (ticketId: number, includeInternal: boolean = false): Promise<Comment[]> => {
  try {
    // Build conditions array
    const conditions = [eq(commentsTable.ticket_id, ticketId)];

    // Filter out internal comments unless includeInternal is true
    if (!includeInternal) {
      conditions.push(eq(commentsTable.is_internal, false));
    }

    // Build the complete query with join, where, and order by
    const query = db.select({
      id: commentsTable.id,
      ticket_id: commentsTable.ticket_id,
      user_id: commentsTable.user_id,
      content: commentsTable.content,
      is_internal: commentsTable.is_internal,
      created_at: commentsTable.created_at,
      // Include user information for each comment
      user_name: usersTable.name,
      user_role: usersTable.role
    })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.user_id, usersTable.id))
    .where(and(...conditions))
    .orderBy(asc(commentsTable.created_at));

    const results = await query.execute();

    // Transform results to match Comment schema format
    return results.map(result => ({
      id: result.id,
      ticket_id: result.ticket_id,
      user_id: result.user_id,
      content: result.content,
      is_internal: result.is_internal,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch ticket comments:', error);
    throw error;
  }
};