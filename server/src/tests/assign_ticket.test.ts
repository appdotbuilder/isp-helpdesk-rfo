import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable } from '../db/schema';
import { assignTicket } from '../handlers/assign_ticket';
import { eq } from 'drizzle-orm';

describe('assignTicket', () => {
  let customerId: number;
  let agentId: number;
  let adminId: number;
  let ticketId: number;

  beforeEach(async () => {
    await createDB();

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

    const adminResult = await db.insert(usersTable)
      .values({
        name: 'Test Admin',
        email: 'admin@test.com',
        password_hash: 'hashed_password',
        role: 'admin'
      })
      .returning()
      .execute();
    adminId = adminResult[0].id;

    // Create test ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Test Ticket',
        description: 'Test ticket for assignment',
        category: 'technical_support',
        priority: 'medium',
        status: 'open',
        customer_id: customerId,
        assigned_agent_id: null,
        rfo_details: null
      })
      .returning()
      .execute();
    ticketId = ticketResult[0].id;
  });

  afterEach(resetDB);

  it('should successfully assign ticket to agent', async () => {
    const result = await assignTicket(ticketId, agentId);

    // Verify the returned ticket has correct assignment
    expect(result.id).toEqual(ticketId);
    expect(result.assigned_agent_id).toEqual(agentId);
    expect(result.status).toEqual('in_progress'); // Should change from 'open' to 'in_progress'
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify the ticket was updated in database
    const updatedTickets = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .execute();

    expect(updatedTickets).toHaveLength(1);
    expect(updatedTickets[0].assigned_agent_id).toEqual(agentId);
    expect(updatedTickets[0].status).toEqual('in_progress');
  });

  it('should preserve existing status if not open', async () => {
    // Update ticket to 'in_progress' status first
    await db.update(ticketsTable)
      .set({ status: 'on_hold' })
      .where(eq(ticketsTable.id, ticketId))
      .execute();

    const result = await assignTicket(ticketId, agentId);

    // Status should remain 'on_hold', not change to 'in_progress'
    expect(result.status).toEqual('on_hold');
    expect(result.assigned_agent_id).toEqual(agentId);
  });

  it('should update the updated_at timestamp', async () => {
    const originalTicket = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .execute();

    const originalUpdatedAt = originalTicket[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await assignTicket(ticketId, agentId);

    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error when ticket does not exist', async () => {
    const nonExistentTicketId = 99999;

    await expect(assignTicket(nonExistentTicketId, agentId))
      .rejects
      .toThrow(/Ticket with id 99999 not found/i);
  });

  it('should throw error when agent does not exist', async () => {
    const nonExistentAgentId = 99999;

    await expect(assignTicket(ticketId, nonExistentAgentId))
      .rejects
      .toThrow(/Agent with id 99999 not found or is not an agent/i);
  });

  it('should throw error when user exists but is not an agent', async () => {
    // Try to assign to customer (wrong role)
    await expect(assignTicket(ticketId, customerId))
      .rejects
      .toThrow(/Agent with id .+ not found or is not an agent/i);

    // Try to assign to admin (wrong role)
    await expect(assignTicket(ticketId, adminId))
      .rejects
      .toThrow(/Agent with id .+ not found or is not an agent/i);
  });

  it('should allow reassigning ticket to different agent', async () => {
    // First assignment
    await assignTicket(ticketId, agentId);

    // Create another agent
    const anotherAgentResult = await db.insert(usersTable)
      .values({
        name: 'Another Agent',
        email: 'agent2@test.com',
        password_hash: 'hashed_password',
        role: 'agent'
      })
      .returning()
      .execute();
    const anotherAgentId = anotherAgentResult[0].id;

    // Reassign to different agent
    const result = await assignTicket(ticketId, anotherAgentId);

    expect(result.assigned_agent_id).toEqual(anotherAgentId);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify in database
    const updatedTickets = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .execute();

    expect(updatedTickets[0].assigned_agent_id).toEqual(anotherAgentId);
  });

  it('should preserve all other ticket fields', async () => {
    const originalTicket = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .execute();

    const result = await assignTicket(ticketId, agentId);

    // All other fields should remain unchanged
    expect(result.subject).toEqual(originalTicket[0].subject);
    expect(result.description).toEqual(originalTicket[0].description);
    expect(result.category).toEqual(originalTicket[0].category);
    expect(result.priority).toEqual(originalTicket[0].priority);
    expect(result.customer_id).toEqual(originalTicket[0].customer_id);
    expect(result.rfo_details).toEqual(originalTicket[0].rfo_details as any);
    expect(result.created_at).toEqual(originalTicket[0].created_at);
    expect(result.resolved_at).toEqual(originalTicket[0].resolved_at);
  });
});