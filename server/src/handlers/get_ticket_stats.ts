import { db } from '../db';
import { ticketsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  on_hold: number;
  resolved: number;
  closed: number;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
}

export const getTicketStats = async (agentId?: number): Promise<TicketStats> => {
  try {
    // Fetch tickets with optional agent filter
    const tickets = agentId !== undefined
      ? await db.select({
          status: ticketsTable.status,
          category: ticketsTable.category,
          priority: ticketsTable.priority
        }).from(ticketsTable)
        .where(eq(ticketsTable.assigned_agent_id, agentId))
        .execute()
      : await db.select({
          status: ticketsTable.status,
          category: ticketsTable.category,
          priority: ticketsTable.priority
        }).from(ticketsTable)
        .execute();

    // Initialize counters
    const stats: TicketStats = {
      total: tickets.length,
      open: 0,
      in_progress: 0,
      on_hold: 0,
      resolved: 0,
      closed: 0,
      by_category: {},
      by_priority: {}
    };

    // Count tickets by status, category, and priority
    for (const ticket of tickets) {
      // Count by status
      switch (ticket.status) {
        case 'open':
          stats.open++;
          break;
        case 'in_progress':
          stats.in_progress++;
          break;
        case 'on_hold':
          stats.on_hold++;
          break;
        case 'resolved':
          stats.resolved++;
          break;
        case 'closed':
          stats.closed++;
          break;
      }

      // Count by category
      stats.by_category[ticket.category] = (stats.by_category[ticket.category] || 0) + 1;

      // Count by priority
      stats.by_priority[ticket.priority] = (stats.by_priority[ticket.priority] || 0) + 1;
    }

    return stats;
  } catch (error) {
    console.error('Get ticket stats failed:', error);
    throw error;
  }
};