import { db } from '../db';
import { ticketsTable, usersTable } from '../db/schema';
import { type CreateTicketInput, type Ticket } from '../schema';
import { eq } from 'drizzle-orm';

export const createTicket = async (input: CreateTicketInput): Promise<Ticket> => {
  try {
    // Validate that customer_id exists and is a valid customer
    const customer = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.customer_id))
      .execute();

    if (customer.length === 0) {
      throw new Error(`Customer with ID ${input.customer_id} not found`);
    }

    // Verify the user is actually a customer (not agent or admin)
    if (customer[0].role !== 'customer') {
      throw new Error(`User with ID ${input.customer_id} is not a customer`);
    }

    // Insert ticket record
    const result = await db.insert(ticketsTable)
      .values({
        subject: input.subject,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: 'open', // Always start as 'open'
        customer_id: input.customer_id,
        assigned_agent_id: null, // No agent assigned initially
        rfo_details: input.rfo_details || null
      })
      .returning()
      .execute();

    const ticket = result[0];
    return {
      ...ticket,
      rfo_details: ticket.rfo_details as any // JSONB field needs type casting
    };
  } catch (error) {
    console.error('Ticket creation failed:', error);
    throw error;
  }
};