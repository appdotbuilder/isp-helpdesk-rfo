import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { ticketsTable, usersTable } from '../db/schema';
import { type CreateTicketInput } from '../schema';
import { createTicket } from '../handlers/create_ticket';
import { eq } from 'drizzle-orm';

describe('createTicket', () => {
  let customerId: number;
  let agentId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite users
    const customerResult = await db.insert(usersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@test.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();
    
    const agentResult = await db.insert(usersTable)
      .values({
        name: 'Test Agent',
        email: 'agent@test.com',
        password_hash: 'hashed_password',
        role: 'agent'
      })
      .returning()
      .execute();
    
    customerId = customerResult[0].id;
    agentId = agentResult[0].id;
  });

  afterEach(resetDB);

  const basicTicketInput: CreateTicketInput = {
    subject: 'Network connectivity issue',
    description: 'Unable to connect to the internet from office location',
    category: 'network_outage',
    priority: 'high',
    customer_id: 0 // Will be set in tests
  };

  it('should create a basic ticket successfully', async () => {
    const input = { ...basicTicketInput, customer_id: customerId };
    
    const result = await createTicket(input);

    // Verify returned ticket structure
    expect(result.id).toBeDefined();
    expect(result.subject).toBe('Network connectivity issue');
    expect(result.description).toBe('Unable to connect to the internet from office location');
    expect(result.category).toBe('network_outage');
    expect(result.priority).toBe('high');
    expect(result.status).toBe('open');
    expect(result.customer_id).toBe(customerId);
    expect(result.assigned_agent_id).toBeNull();
    expect(result.rfo_details).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.resolved_at).toBeNull();
  });

  it('should save ticket to database correctly', async () => {
    const input = { ...basicTicketInput, customer_id: customerId };
    
    const result = await createTicket(input);

    // Query database to verify persistence
    const tickets = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, result.id))
      .execute();

    expect(tickets).toHaveLength(1);
    const ticket = tickets[0];
    
    expect(ticket.subject).toBe('Network connectivity issue');
    expect(ticket.description).toBe('Unable to connect to the internet from office location');
    expect(ticket.category).toBe('network_outage');
    expect(ticket.priority).toBe('high');
    expect(ticket.status).toBe('open');
    expect(ticket.customer_id).toBe(customerId);
    expect(ticket.assigned_agent_id).toBeNull();
    expect(ticket.rfo_details).toBeNull();
    expect(ticket.created_at).toBeInstanceOf(Date);
    expect(ticket.updated_at).toBeInstanceOf(Date);
    expect(ticket.resolved_at).toBeNull();
  });

  it('should create RFO ticket with details', async () => {
    const rfoInput: CreateTicketInput = {
      subject: 'Planned maintenance outage',
      description: 'Scheduled maintenance affecting multiple services',
      category: 'rfo',
      priority: 'urgent',
      customer_id: customerId,
      rfo_details: {
        outage_type: 'planned',
        affected_areas: ['Downtown', 'Business District'],
        estimated_duration: '4 hours',
        services_affected: ['Internet', 'Phone'],
        root_cause: 'Infrastructure upgrade',
        resolution_steps: 'Complete hardware replacement'
      }
    };

    const result = await createTicket(rfoInput);

    expect(result.category).toBe('rfo');
    expect(result.rfo_details).toEqual({
      outage_type: 'planned',
      affected_areas: ['Downtown', 'Business District'],
      estimated_duration: '4 hours',
      services_affected: ['Internet', 'Phone'],
      root_cause: 'Infrastructure upgrade',
      resolution_steps: 'Complete hardware replacement'
    });

    // Verify in database
    const tickets = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, result.id))
      .execute();

    expect(tickets[0].rfo_details).toEqual(result.rfo_details);
  });

  it('should handle different ticket priorities and categories', async () => {
    const testCases = [
      { priority: 'low' as const, category: 'billing_issue' as const },
      { priority: 'medium' as const, category: 'technical_support' as const },
      { priority: 'urgent' as const, category: 'service_upgrade' as const }
    ];

    for (const testCase of testCases) {
      const input: CreateTicketInput = {
        subject: `Test ${testCase.category} ticket`,
        description: 'Test description',
        category: testCase.category,
        priority: testCase.priority,
        customer_id: customerId
      };

      const result = await createTicket(input);
      
      expect(result.priority).toBe(testCase.priority);
      expect(result.category).toBe(testCase.category);
      expect(result.status).toBe('open');
    }
  });

  it('should throw error when customer_id does not exist', async () => {
    const input = { ...basicTicketInput, customer_id: 99999 };

    await expect(createTicket(input)).rejects.toThrow(/Customer with ID 99999 not found/i);
  });

  it('should throw error when user is not a customer', async () => {
    const input = { ...basicTicketInput, customer_id: agentId };

    await expect(createTicket(input)).rejects.toThrow(/User with ID \d+ is not a customer/i);
  });

  it('should handle null rfo_details gracefully', async () => {
    const input: CreateTicketInput = {
      subject: 'Regular support ticket',
      description: 'Non-RFO ticket description',
      category: 'technical_support',
      priority: 'medium',
      customer_id: customerId,
      rfo_details: null
    };

    const result = await createTicket(input);

    expect(result.rfo_details).toBeNull();
    expect(result.category).toBe('technical_support');
  });

  it('should create multiple tickets for same customer', async () => {
    const input1 = { ...basicTicketInput, customer_id: customerId, subject: 'First ticket' };
    const input2 = { ...basicTicketInput, customer_id: customerId, subject: 'Second ticket' };

    const result1 = await createTicket(input1);
    const result2 = await createTicket(input2);

    expect(result1.id).not.toBe(result2.id);
    expect(result1.subject).toBe('First ticket');
    expect(result2.subject).toBe('Second ticket');
    expect(result1.customer_id).toBe(customerId);
    expect(result2.customer_id).toBe(customerId);

    // Verify both tickets exist in database
    const tickets = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.customer_id, customerId))
      .execute();

    expect(tickets).toHaveLength(2);
  });
});