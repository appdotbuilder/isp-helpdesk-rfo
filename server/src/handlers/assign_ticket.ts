import { db } from '../db';
import { ticketsTable, usersTable } from '../db/schema';
import { type Ticket } from '../schema';
import { eq, and } from 'drizzle-orm';

export const assignTicket = async (ticketId: number, agentId: number): Promise<Ticket> => {
  try {
    // Validate that the agent exists and has the correct role
    const agent = await db.select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, agentId),
          eq(usersTable.role, 'agent')
        )
      )
      .execute();

    if (agent.length === 0) {
      throw new Error(`Agent with id ${agentId} not found or is not an agent`);
    }

    // Get the current ticket to check if it exists
    const existingTicket = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .execute();

    if (existingTicket.length === 0) {
      throw new Error(`Ticket with id ${ticketId} not found`);
    }

    const currentTicket = existingTicket[0];

    // Determine new status - change to 'in_progress' if currently 'open'
    const newStatus = currentTicket.status === 'open' ? 'in_progress' : currentTicket.status;

    // Update the ticket with the assigned agent and new status
    const result = await db.update(ticketsTable)
      .set({
        assigned_agent_id: agentId,
        status: newStatus,
        updated_at: new Date()
      })
      .where(eq(ticketsTable.id, ticketId))
      .returning()
      .execute();

    const ticket = result[0];
    return {
      ...ticket,
      rfo_details: ticket.rfo_details as any // Cast JSONB field to match schema type
    };
  } catch (error) {
    console.error('Ticket assignment failed:', error);
    throw error;
  }
};