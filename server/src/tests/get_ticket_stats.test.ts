import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable } from '../db/schema';
import { getTicketStats } from '../handlers/get_ticket_stats';

describe('getTicketStats', () => {
  let testUsers: any[] = [];
  
  beforeEach(async () => {
    await createDB();
    
    // Create test users
    testUsers = await db.insert(usersTable)
      .values([
        {
          name: 'Test Customer',
          email: 'customer@test.com',
          password_hash: 'hash1',
          role: 'customer'
        },
        {
          name: 'Test Agent 1',
          email: 'agent1@test.com',
          password_hash: 'hash2',
          role: 'agent'
        },
        {
          name: 'Test Agent 2',
          email: 'agent2@test.com',
          password_hash: 'hash3',
          role: 'agent'
        }
      ])
      .returning()
      .execute();
  });

  afterEach(resetDB);

  it('should return zero stats for no tickets', async () => {
    const stats = await getTicketStats();

    expect(stats.total).toEqual(0);
    expect(stats.open).toEqual(0);
    expect(stats.in_progress).toEqual(0);
    expect(stats.on_hold).toEqual(0);
    expect(stats.resolved).toEqual(0);
    expect(stats.closed).toEqual(0);
    expect(stats.by_category).toEqual({});
    expect(stats.by_priority).toEqual({});
  });

  it('should count all tickets correctly', async () => {
    // Create tickets with various statuses, categories, and priorities
    await db.insert(ticketsTable)
      .values([
        {
          subject: 'Open Network Issue',
          description: 'Network down',
          category: 'network_outage',
          priority: 'high',
          status: 'open',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        },
        {
          subject: 'In Progress Billing',
          description: 'Billing problem',
          category: 'billing_issue',
          priority: 'medium',
          status: 'in_progress',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        },
        {
          subject: 'On Hold Tech Support',
          description: 'Technical issue',
          category: 'technical_support',
          priority: 'low',
          status: 'on_hold',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[2].id
        },
        {
          subject: 'Resolved Service Upgrade',
          description: 'Upgrade complete',
          category: 'service_upgrade',
          priority: 'urgent',
          status: 'resolved',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        },
        {
          subject: 'Closed RFO',
          description: 'RFO completed',
          category: 'rfo',
          priority: 'high',
          status: 'closed',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[2].id
        }
      ])
      .execute();

    const stats = await getTicketStats();

    // Verify total and status counts
    expect(stats.total).toEqual(5);
    expect(stats.open).toEqual(1);
    expect(stats.in_progress).toEqual(1);
    expect(stats.on_hold).toEqual(1);
    expect(stats.resolved).toEqual(1);
    expect(stats.closed).toEqual(1);

    // Verify category counts
    expect(stats.by_category).toEqual({
      network_outage: 1,
      billing_issue: 1,
      technical_support: 1,
      service_upgrade: 1,
      rfo: 1
    });

    // Verify priority counts
    expect(stats.by_priority).toEqual({
      high: 2,
      medium: 1,
      low: 1,
      urgent: 1
    });
  });

  it('should filter tickets by agent correctly', async () => {
    // Create tickets assigned to different agents
    await db.insert(ticketsTable)
      .values([
        {
          subject: 'Agent 1 Ticket 1',
          description: 'First ticket for agent 1',
          category: 'network_outage',
          priority: 'high',
          status: 'open',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id // Agent 1
        },
        {
          subject: 'Agent 1 Ticket 2',
          description: 'Second ticket for agent 1',
          category: 'billing_issue',
          priority: 'medium',
          status: 'in_progress',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id // Agent 1
        },
        {
          subject: 'Agent 2 Ticket',
          description: 'Ticket for agent 2',
          category: 'technical_support',
          priority: 'low',
          status: 'resolved',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[2].id // Agent 2
        },
        {
          subject: 'Unassigned Ticket',
          description: 'No agent assigned',
          category: 'rfo',
          priority: 'urgent',
          status: 'open',
          customer_id: testUsers[0].id,
          assigned_agent_id: null // No agent
        }
      ])
      .execute();

    // Get stats for Agent 1
    const agent1Stats = await getTicketStats(testUsers[1].id);
    
    expect(agent1Stats.total).toEqual(2);
    expect(agent1Stats.open).toEqual(1);
    expect(agent1Stats.in_progress).toEqual(1);
    expect(agent1Stats.on_hold).toEqual(0);
    expect(agent1Stats.resolved).toEqual(0);
    expect(agent1Stats.closed).toEqual(0);
    expect(agent1Stats.by_category).toEqual({
      network_outage: 1,
      billing_issue: 1
    });
    expect(agent1Stats.by_priority).toEqual({
      high: 1,
      medium: 1
    });

    // Get stats for Agent 2
    const agent2Stats = await getTicketStats(testUsers[2].id);
    
    expect(agent2Stats.total).toEqual(1);
    expect(agent2Stats.open).toEqual(0);
    expect(agent2Stats.in_progress).toEqual(0);
    expect(agent2Stats.on_hold).toEqual(0);
    expect(agent2Stats.resolved).toEqual(1);
    expect(agent2Stats.closed).toEqual(0);
    expect(agent2Stats.by_category).toEqual({
      technical_support: 1
    });
    expect(agent2Stats.by_priority).toEqual({
      low: 1
    });
  });

  it('should handle duplicate categories and priorities correctly', async () => {
    // Create multiple tickets with same categories and priorities
    await db.insert(ticketsTable)
      .values([
        {
          subject: 'Network Issue 1',
          description: 'First network issue',
          category: 'network_outage',
          priority: 'high',
          status: 'open',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        },
        {
          subject: 'Network Issue 2',
          description: 'Second network issue',
          category: 'network_outage',
          priority: 'high',
          status: 'in_progress',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        },
        {
          subject: 'Network Issue 3',
          description: 'Third network issue',
          category: 'network_outage',
          priority: 'medium',
          status: 'resolved',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        }
      ])
      .execute();

    const stats = await getTicketStats();

    expect(stats.total).toEqual(3);
    expect(stats.open).toEqual(1);
    expect(stats.in_progress).toEqual(1);
    expect(stats.resolved).toEqual(1);
    expect(stats.by_category).toEqual({
      network_outage: 3
    });
    expect(stats.by_priority).toEqual({
      high: 2,
      medium: 1
    });
  });

  it('should return zero stats for non-existent agent', async () => {
    // Create some tickets
    await db.insert(ticketsTable)
      .values([
        {
          subject: 'Test Ticket',
          description: 'A test ticket',
          category: 'billing_issue',
          priority: 'medium',
          status: 'open',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        }
      ])
      .execute();

    // Query with non-existent agent ID
    const stats = await getTicketStats(99999);

    expect(stats.total).toEqual(0);
    expect(stats.open).toEqual(0);
    expect(stats.in_progress).toEqual(0);
    expect(stats.on_hold).toEqual(0);
    expect(stats.resolved).toEqual(0);
    expect(stats.closed).toEqual(0);
    expect(stats.by_category).toEqual({});
    expect(stats.by_priority).toEqual({});
  });

  it('should handle tickets with null assigned_agent_id when filtering', async () => {
    // Create tickets with null assigned_agent_id
    await db.insert(ticketsTable)
      .values([
        {
          subject: 'Unassigned Ticket 1',
          description: 'First unassigned ticket',
          category: 'network_outage',
          priority: 'high',
          status: 'open',
          customer_id: testUsers[0].id,
          assigned_agent_id: null
        },
        {
          subject: 'Assigned Ticket',
          description: 'Assigned ticket',
          category: 'billing_issue',
          priority: 'medium',
          status: 'in_progress',
          customer_id: testUsers[0].id,
          assigned_agent_id: testUsers[1].id
        }
      ])
      .execute();

    // Get all stats (should include both tickets)
    const allStats = await getTicketStats();
    expect(allStats.total).toEqual(2);

    // Get stats for specific agent (should only include assigned ticket)
    const agentStats = await getTicketStats(testUsers[1].id);
    expect(agentStats.total).toEqual(1);
    expect(agentStats.by_category).toEqual({
      billing_issue: 1
    });
  });
});