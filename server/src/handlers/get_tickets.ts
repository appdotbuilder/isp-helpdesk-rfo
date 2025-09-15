import { db } from '../db';
import { ticketsTable } from '../db/schema';
import { type Ticket, type TicketQuery, type RfoDetails } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export const getTickets = async (query?: TicketQuery): Promise<Ticket[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (query) {
      if (query.customer_id !== undefined) {
        conditions.push(eq(ticketsTable.customer_id, query.customer_id));
      }

      if (query.assigned_agent_id !== undefined) {
        conditions.push(eq(ticketsTable.assigned_agent_id, query.assigned_agent_id));
      }

      if (query.status !== undefined) {
        conditions.push(eq(ticketsTable.status, query.status));
      }

      if (query.category !== undefined) {
        conditions.push(eq(ticketsTable.category, query.category));
      }

      if (query.priority !== undefined) {
        conditions.push(eq(ticketsTable.priority, query.priority));
      }
    }

    // Apply pagination - use defaults if query is not provided
    const limit = query?.limit || 10;
    const offset = query?.offset || 0;

    // Build and execute query in one go
    let results;
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      results = await db.select()
        .from(ticketsTable)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .execute();
    } else {
      results = await db.select()
        .from(ticketsTable)
        .limit(limit)
        .offset(offset)
        .execute();
    }

    // Transform results to match the Ticket type (handle RfoDetails properly)
    return results.map(row => ({
      ...row,
      rfo_details: row.rfo_details as RfoDetails
    }));
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
    throw error;
  }
};