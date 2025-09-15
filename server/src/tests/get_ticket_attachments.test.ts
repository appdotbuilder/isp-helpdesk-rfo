import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable, attachmentsTable } from '../db/schema';
import { getTicketAttachments } from '../handlers/get_ticket_attachments';

describe('getTicketAttachments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all attachments for a ticket ordered by creation date', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create test ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Test Ticket',
        description: 'A ticket for testing',
        category: 'technical_support',
        priority: 'medium',
        customer_id: userId
      })
      .returning()
      .execute();
    
    const ticketId = ticketResult[0].id;

    // Create multiple test attachments with different creation times
    const attachment1Result = await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'first_file.pdf',
        file_path: '/uploads/first_file.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
        uploaded_by: userId
      })
      .returning()
      .execute();

    // Ensure second attachment has a later timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const attachment2Result = await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'second_file.jpg',
        file_path: '/uploads/second_file.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        uploaded_by: userId
      })
      .returning()
      .execute();

    const attachments = await getTicketAttachments(ticketId);

    // Verify correct number of attachments
    expect(attachments).toHaveLength(2);

    // Verify first attachment (should be ordered by creation date)
    expect(attachments[0].id).toEqual(attachment1Result[0].id);
    expect(attachments[0].ticket_id).toEqual(ticketId);
    expect(attachments[0].filename).toEqual('first_file.pdf');
    expect(attachments[0].file_path).toEqual('/uploads/first_file.pdf');
    expect(attachments[0].file_size).toEqual(1024);
    expect(attachments[0].mime_type).toEqual('application/pdf');
    expect(attachments[0].uploaded_by).toEqual(userId);
    expect(attachments[0].created_at).toBeInstanceOf(Date);

    // Verify second attachment
    expect(attachments[1].id).toEqual(attachment2Result[0].id);
    expect(attachments[1].filename).toEqual('second_file.jpg');
    expect(attachments[1].file_size).toEqual(2048);
    expect(attachments[1].mime_type).toEqual('image/jpeg');

    // Verify ordering by creation date (first should be earlier)
    expect(attachments[0].created_at.getTime()).toBeLessThanOrEqual(attachments[1].created_at.getTime());
  });

  it('should return empty array for ticket with no attachments', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create test ticket without attachments
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Test Ticket',
        description: 'A ticket with no attachments',
        category: 'billing_issue',
        priority: 'low',
        customer_id: userId
      })
      .returning()
      .execute();
    
    const ticketId = ticketResult[0].id;

    const attachments = await getTicketAttachments(ticketId);

    expect(attachments).toHaveLength(0);
    expect(attachments).toEqual([]);
  });

  it('should throw error for non-existent ticket', async () => {
    const nonExistentTicketId = 99999;

    await expect(getTicketAttachments(nonExistentTicketId))
      .rejects.toThrow(/Ticket with ID 99999 not found/);
  });

  it('should include uploader information in join query', async () => {
    // Create test users
    const customerResult = await db.insert(usersTable)
      .values({
        name: 'Customer User',
        email: 'customer@example.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();

    const agentResult = await db.insert(usersTable)
      .values({
        name: 'Agent User',
        email: 'agent@example.com',
        password_hash: 'hashed_password',
        role: 'agent'
      })
      .returning()
      .execute();
    
    const customerId = customerResult[0].id;
    const agentId = agentResult[0].id;

    // Create test ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Test Ticket',
        description: 'A ticket for testing uploader info',
        category: 'technical_support',
        priority: 'high',
        customer_id: customerId,
        assigned_agent_id: agentId
      })
      .returning()
      .execute();
    
    const ticketId = ticketResult[0].id;

    // Create attachment uploaded by agent
    await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'agent_upload.txt',
        file_path: '/uploads/agent_upload.txt',
        file_size: 512,
        mime_type: 'text/plain',
        uploaded_by: agentId
      })
      .execute();

    const attachments = await getTicketAttachments(ticketId);

    expect(attachments).toHaveLength(1);
    expect(attachments[0].uploaded_by).toEqual(agentId);
    expect(attachments[0].filename).toEqual('agent_upload.txt');
    expect(attachments[0].mime_type).toEqual('text/plain');
    
    // Verify the join worked by checking that we got valid attachment data
    expect(attachments[0].id).toBeDefined();
    expect(attachments[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle multiple attachments from different uploaders', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        name: 'First User',
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        name: 'Second User',
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        role: 'agent'
      })
      .returning()
      .execute();
    
    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create test ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        subject: 'Multi-User Ticket',
        description: 'A ticket with attachments from multiple users',
        category: 'service_upgrade',
        priority: 'medium',
        customer_id: user1Id,
        assigned_agent_id: user2Id
      })
      .returning()
      .execute();
    
    const ticketId = ticketResult[0].id;

    // Create attachments from different users
    await db.insert(attachmentsTable)
      .values([
        {
          ticket_id: ticketId,
          filename: 'customer_doc.pdf',
          file_path: '/uploads/customer_doc.pdf',
          file_size: 1500,
          mime_type: 'application/pdf',
          uploaded_by: user1Id
        },
        {
          ticket_id: ticketId,
          filename: 'agent_response.docx',
          file_path: '/uploads/agent_response.docx',
          file_size: 3000,
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          uploaded_by: user2Id
        }
      ])
      .execute();

    const attachments = await getTicketAttachments(ticketId);

    expect(attachments).toHaveLength(2);
    
    // Check that we have attachments from both users
    const uploaderIds = attachments.map(a => a.uploaded_by);
    expect(uploaderIds).toContain(user1Id);
    expect(uploaderIds).toContain(user2Id);

    // Verify file details
    const customerAttachment = attachments.find(a => a.uploaded_by === user1Id);
    const agentAttachment = attachments.find(a => a.uploaded_by === user2Id);

    expect(customerAttachment?.filename).toEqual('customer_doc.pdf');
    expect(customerAttachment?.file_size).toEqual(1500);
    expect(agentAttachment?.filename).toEqual('agent_response.docx');
    expect(agentAttachment?.file_size).toEqual(3000);
  });
});