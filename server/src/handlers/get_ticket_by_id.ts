import { db } from '../db';
import { ticketsTable } from '../db/schema';
import { type Ticket } from '../schema';
import { eq } from 'drizzle-orm';

export const getTicketById = async (id: number): Promise<Ticket | null> => {
  try {
    const results = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const ticket = results[0];
    
    // Return the ticket with proper type casting
    return {
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      customer_id: ticket.customer_id,
      assigned_agent_id: ticket.assigned_agent_id,
      rfo_details: ticket.rfo_details as any, // JSONB type requires casting
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      resolved_at: ticket.resolved_at
    };
  } catch (error) {
    console.error('Ticket retrieval failed:', error);
    throw error;
  }
};