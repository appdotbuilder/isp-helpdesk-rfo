import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable } from '../db/schema';
import { type CreateUserInput, type CreateTicketInput } from '../schema';
import { getTicketById } from '../handlers/get_ticket_by_id';

// Test user inputs
const testCustomer: CreateUserInput = {
  name: 'Test Customer',
  email: 'customer@test.com',
  password: 'testpass123',
  role: 'customer'
};

const testAgent: CreateUserInput = {
  name: 'Test Agent',
  email: 'agent@test.com',
  password: 'testpass123',
  role: 'agent'
};

describe('getTicketById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return ticket by id', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        password_hash: 'hashed_password_123',
        role: testCustomer.role
      })
      .returning()
      .execute();

    const customerId = userResult[0].id;

    // Create test ticket
    const testTicketInput: CreateTicketInput = {
      subject: 'Test Ticket',
      description: 'This is a test ticket',
      category: 'technical_support',
      priority: 'medium',
      customer_id: customerId,
      rfo_details: null
    };

    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: testTicketInput.subject,
        description: testTicketInput.description,
        category: testTicketInput.category,
        priority: testTicketInput.priority,
        customer_id: testTicketInput.customer_id,
        rfo_details: testTicketInput.rfo_details
      })
      .returning()
      .execute();

    const ticketId = ticketResult[0].id;

    // Get ticket by id
    const result = await getTicketById(ticketId);

    // Verify ticket data
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(ticketId);
    expect(result!.subject).toEqual('Test Ticket');
    expect(result!.description).toEqual('This is a test ticket');
    expect(result!.category).toEqual('technical_support');
    expect(result!.priority).toEqual('medium');
    expect(result!.status).toEqual('open'); // Default status
    expect(result!.customer_id).toEqual(customerId);
    expect(result!.assigned_agent_id).toBeNull();
    expect(result!.rfo_details).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.resolved_at).toBeNull();
  });

  it('should return ticket with assigned agent', async () => {
    // Create test customer
    const customerResult = await db.insert(usersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        password_hash: 'hashed_customer_password',
        role: testCustomer.role
      })
      .returning()
      .execute();

    const customerId = customerResult[0].id;

    // Create test agent
    const agentResult = await db.insert(usersTable)
      .values({
        name: testAgent.name,
        email: testAgent.email,
        password_hash: 'hashed_agent_password',
        role: testAgent.role
      })
      .returning()
      .execute();

    const agentId = agentResult[0].id;

    // Create test ticket with assigned agent
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Assigned Ticket',
        description: 'Ticket with assigned agent',
        category: 'billing_issue',
        priority: 'high',
        status: 'in_progress',
        customer_id: customerId,
        assigned_agent_id: agentId,
        rfo_details: null
      })
      .returning()
      .execute();

    const ticketId = ticketResult[0].id;

    // Get ticket by id
    const result = await getTicketById(ticketId);

    // Verify ticket data including assigned agent
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(ticketId);
    expect(result!.subject).toEqual('Assigned Ticket');
    expect(result!.status).toEqual('in_progress');
    expect(result!.customer_id).toEqual(customerId);
    expect(result!.assigned_agent_id).toEqual(agentId);
  });

  it('should return ticket with RFO details', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        password_hash: 'hashed_password_123',
        role: testCustomer.role
      })
      .returning()
      .execute();

    const customerId = userResult[0].id;

    // RFO details for testing
    const rfoDetails = {
      outage_type: 'unplanned' as const,
      affected_areas: ['Zone A', 'Zone B'],
      estimated_duration: '4 hours',
      services_affected: ['Internet', 'Phone'],
      root_cause: 'Power outage',
      resolution_steps: 'Restore power and check connections'
    };

    // Create RFO ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Network Outage - RFO',
        description: 'Major network outage affecting multiple areas',
        category: 'rfo',
        priority: 'urgent',
        customer_id: customerId,
        rfo_details: rfoDetails
      })
      .returning()
      .execute();

    const ticketId = ticketResult[0].id;

    // Get ticket by id
    const result = await getTicketById(ticketId);

    // Verify RFO details
    expect(result).not.toBeNull();
    expect(result!.category).toEqual('rfo');
    expect(result!.priority).toEqual('urgent');
    expect(result!.rfo_details).toEqual(rfoDetails);
  });

  it('should return null for non-existent ticket', async () => {
    const result = await getTicketById(999999);
    expect(result).toBeNull();
  });

  it('should return ticket with resolved status and timestamp', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        password_hash: 'hashed_password_123',
        role: testCustomer.role
      })
      .returning()
      .execute();

    const customerId = userResult[0].id;

    // Create resolved ticket
    const resolvedAt = new Date();
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Resolved Ticket',
        description: 'This ticket has been resolved',
        category: 'technical_support',
        priority: 'low',
        status: 'resolved',
        customer_id: customerId,
        resolved_at: resolvedAt,
        rfo_details: null
      })
      .returning()
      .execute();

    const ticketId = ticketResult[0].id;

    // Get ticket by id
    const result = await getTicketById(ticketId);

    // Verify resolved ticket data
    expect(result).not.toBeNull();
    expect(result!.status).toEqual('resolved');
    expect(result!.resolved_at).toBeInstanceOf(Date);
    expect(result!.resolved_at!.getTime()).toBeCloseTo(resolvedAt.getTime(), -3); // Within 1 second
  });

  it('should handle different ticket categories correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        password_hash: 'hashed_password_123',
        role: testCustomer.role
      })
      .returning()
      .execute();

    const customerId = userResult[0].id;

    // Test different categories
    const categories = ['network_outage', 'billing_issue', 'technical_support', 'service_upgrade', 'rfo'] as const;
    
    for (const category of categories) {
      const ticketResult = await db.insert(ticketsTable)
        .values({
          subject: `Test ${category} Ticket`,
          description: `Testing ${category} category`,
          category: category,
          priority: 'medium',
          customer_id: customerId,
          rfo_details: null
        })
        .returning()
        .execute();

      const result = await getTicketById(ticketResult[0].id);
      
      expect(result).not.toBeNull();
      expect(result!.category).toEqual(category);
      expect(result!.subject).toEqual(`Test ${category} Ticket`);
    }
  });
});