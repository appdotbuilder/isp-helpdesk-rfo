import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable } from '../db/schema';
import { type TicketQuery } from '../schema';
import { getTickets } from '../handlers/get_tickets';

// Test data setup
const testUsers = [
  {
    name: 'Customer User',
    email: 'customer@test.com',
    password_hash: 'hash123',
    role: 'customer' as const
  },
  {
    name: 'Agent User', 
    email: 'agent@test.com',
    password_hash: 'hash456',
    role: 'agent' as const
  },
  {
    name: 'Second Customer',
    email: 'customer2@test.com', 
    password_hash: 'hash789',
    role: 'customer' as const
  }
];

const testTickets = [
  {
    subject: 'Network Issue',
    description: 'Internet connection is down',
    category: 'network_outage' as const,
    priority: 'high' as const,
    status: 'open' as const,
    customer_id: 1,
    assigned_agent_id: 2,
    rfo_details: null
  },
  {
    subject: 'Billing Problem',
    description: 'Incorrect charge on my account',
    category: 'billing_issue' as const,
    priority: 'medium' as const,
    status: 'in_progress' as const,
    customer_id: 1,
    assigned_agent_id: null,
    rfo_details: null
  },
  {
    subject: 'Service Upgrade Request',
    description: 'Want to upgrade to premium plan',
    category: 'service_upgrade' as const,
    priority: 'low' as const,
    status: 'resolved' as const,
    customer_id: 3,
    assigned_agent_id: 2,
    rfo_details: null
  },
  {
    subject: 'RFO Notification',
    description: 'Planned maintenance outage',
    category: 'rfo' as const,
    priority: 'urgent' as const,
    status: 'closed' as const,
    customer_id: 3,
    assigned_agent_id: 2,
    rfo_details: {
      outage_type: 'planned',
      affected_areas: ['downtown', 'suburbs'],
      estimated_duration: '4 hours',
      services_affected: ['internet', 'phone'],
      root_cause: 'Equipment upgrade',
      resolution_steps: 'Replace fiber infrastructure'
    }
  }
];

describe('getTickets', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test users
    await db.insert(usersTable).values(testUsers).execute();
    
    // Create test tickets
    await db.insert(ticketsTable).values(testTickets).execute();
  });

  afterEach(resetDB);

  it('should return all tickets when no query provided', async () => {
    const result = await getTickets();

    expect(result).toHaveLength(4);
    expect(result[0].subject).toEqual('Network Issue');
    expect(result[0].customer_id).toEqual(1);
    expect(result[0].assigned_agent_id).toEqual(2);
    expect(result[0].category).toEqual('network_outage');
    expect(result[0].priority).toEqual('high');
    expect(result[0].status).toEqual('open');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return empty query with default limit and offset', async () => {
    const result = await getTickets({} as TicketQuery);

    expect(result).toHaveLength(4); // All 4 tickets should be returned with default limit of 10
  });

  it('should filter tickets by customer_id', async () => {
    const query = { customer_id: 1 } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(2);
    result.forEach(ticket => {
      expect(ticket.customer_id).toEqual(1);
    });
    
    // Verify we get the correct tickets
    const subjects = result.map(t => t.subject).sort();
    expect(subjects).toEqual(['Billing Problem', 'Network Issue']);
  });

  it('should filter tickets by assigned_agent_id', async () => {
    const query = { assigned_agent_id: 2 } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(3);
    result.forEach(ticket => {
      expect(ticket.assigned_agent_id).toEqual(2);
    });
  });

  it('should filter tickets by status', async () => {
    const query = { status: 'open' } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toEqual('Network Issue');
    expect(result[0].status).toEqual('open');
  });

  it('should filter tickets by category', async () => {
    const query = { category: 'billing_issue' } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toEqual('Billing Problem');
    expect(result[0].category).toEqual('billing_issue');
  });

  it('should filter tickets by priority', async () => {
    const query = { priority: 'high' } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toEqual('Network Issue');
    expect(result[0].priority).toEqual('high');
  });

  it('should combine multiple filters', async () => {
    const query = { 
      customer_id: 3, 
      assigned_agent_id: 2,
      status: 'resolved'
    } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toEqual('Service Upgrade Request');
    expect(result[0].customer_id).toEqual(3);
    expect(result[0].assigned_agent_id).toEqual(2);
    expect(result[0].status).toEqual('resolved');
  });

  it('should handle pagination with limit', async () => {
    const query = { limit: 2 } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(2);
  });

  it('should handle pagination with offset', async () => {
    const query = { limit: 2, offset: 2 } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(2);
    
    // Get all tickets to compare
    const allTickets = await getTickets({ limit: 10 } as TicketQuery);
    expect(result[0].id).toEqual(allTickets[2].id);
    expect(result[1].id).toEqual(allTickets[3].id);
  });

  it('should return empty array when no tickets match filters', async () => {
    const query = { customer_id: 999 } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(0);
  });

  it('should handle RFO details correctly', async () => {
    const query = { category: 'rfo' } as TicketQuery;
    const result = await getTickets(query);

    expect(result).toHaveLength(1);
    expect(result[0].rfo_details).toEqual({
      outage_type: 'planned',
      affected_areas: ['downtown', 'suburbs'],
      estimated_duration: '4 hours',
      services_affected: ['internet', 'phone'],
      root_cause: 'Equipment upgrade',
      resolution_steps: 'Replace fiber infrastructure'
    });
  });

  it('should handle tickets with null assigned_agent_id in results', async () => {
    const result = await getTickets();

    // Find tickets without assigned agents
    const unassignedTickets = result.filter(ticket => ticket.assigned_agent_id === null);
    expect(unassignedTickets).toHaveLength(1);
    expect(unassignedTickets[0].subject).toEqual('Billing Problem');
    expect(unassignedTickets[0].assigned_agent_id).toBeNull();
  });

  it('should preserve all ticket fields in response', async () => {
    const result = await getTickets({ limit: 1 } as TicketQuery);
    
    expect(result).toHaveLength(1);
    const ticket = result[0];
    
    // Verify all required fields are present
    expect(ticket.id).toBeDefined();
    expect(ticket.subject).toBeDefined();
    expect(ticket.description).toBeDefined();
    expect(ticket.category).toBeDefined();
    expect(ticket.priority).toBeDefined();
    expect(ticket.status).toBeDefined();
    expect(ticket.customer_id).toBeDefined();
    expect(ticket.created_at).toBeInstanceOf(Date);
    expect(ticket.updated_at).toBeInstanceOf(Date);
    
    // assigned_agent_id, rfo_details, and resolved_at can be null
    expect(ticket.assigned_agent_id !== undefined).toBe(true);
    expect(ticket.rfo_details !== undefined).toBe(true);
    expect(ticket.resolved_at !== undefined).toBe(true);
  });
});