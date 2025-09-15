import { db } from '../db';
import { ticketsTable, usersTable } from '../db/schema';
import { type UpdateTicketInput, type Ticket } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateTicket = async (input: UpdateTicketInput): Promise<Ticket> => {
  try {
    // First, check if the ticket exists
    const existingTickets = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, input.id))
      .execute();

    if (existingTickets.length === 0) {
      throw new Error(`Ticket with id ${input.id} not found`);
    }

    // If assigned_agent_id is provided, validate that the user exists and is an agent
    if (input.assigned_agent_id !== undefined && input.assigned_agent_id !== null) {
      const agents = await db.select()
        .from(usersTable)
        .where(and(
          eq(usersTable.id, input.assigned_agent_id),
          eq(usersTable.role, 'agent')
        ))
        .execute();

      if (agents.length === 0) {
        throw new Error(`User with id ${input.assigned_agent_id} is not an agent or does not exist`);
      }
    }

    // Prepare update values, including automatic fields
    const updateValues: any = {
      updated_at: new Date()
    };

    // Add provided fields to update
    if (input.subject !== undefined) {
      updateValues.subject = input.subject;
    }
    if (input.description !== undefined) {
      updateValues.description = input.description;
    }
    if (input.category !== undefined) {
      updateValues.category = input.category;
    }
    if (input.priority !== undefined) {
      updateValues.priority = input.priority;
    }
    if (input.status !== undefined) {
      updateValues.status = input.status;
      // Set resolved_at when status changes to 'resolved'
      if (input.status === 'resolved') {
        updateValues.resolved_at = new Date();
      }
    }
    if (input.assigned_agent_id !== undefined) {
      updateValues.assigned_agent_id = input.assigned_agent_id;
    }
    if (input.rfo_details !== undefined) {
      updateValues.rfo_details = input.rfo_details;
    }

    // Update the ticket
    const result = await db.update(ticketsTable)
      .set(updateValues)
      .where(eq(ticketsTable.id, input.id))
      .returning()
      .execute();

    // Return the result with proper type casting for rfo_details
    const updatedTicket = result[0];
    return {
      ...updatedTicket,
      rfo_details: updatedTicket.rfo_details as any
    };
  } catch (error) {
    console.error('Ticket update failed:', error);
    throw error;
  }
};