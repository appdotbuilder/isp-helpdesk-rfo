import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { attachmentsTable, ticketsTable, usersTable } from '../db/schema';
import { type CreateAttachmentInput } from '../schema';
import { createAttachment } from '../handlers/create_attachment';
import { eq } from 'drizzle-orm';

describe('createAttachment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testTicketId: number;

  // Create prerequisite data before each test
  beforeEach(async () => {
    // Create a test user
    const user = await db.insert(usersTable)
      .values({
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'customer'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create a test ticket
    const ticket = await db.insert(ticketsTable)
      .values({
        subject: 'Test Ticket',
        description: 'A ticket for testing',
        category: 'technical_support',
        priority: 'medium',
        customer_id: testUserId
      })
      .returning()
      .execute();
    testTicketId = ticket[0].id;
  });

  const testInput: CreateAttachmentInput = {
    ticket_id: 0, // Will be set to testTicketId in tests
    filename: 'test_document.pdf',
    file_path: '/uploads/test_document.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    uploaded_by: 0 // Will be set to testUserId in tests
  };

  it('should create an attachment', async () => {
    const input = { ...testInput, ticket_id: testTicketId, uploaded_by: testUserId };
    const result = await createAttachment(input);

    // Verify returned attachment data
    expect(result.ticket_id).toBe(testTicketId);
    expect(result.filename).toBe('test_document.pdf');
    expect(result.file_path).toBe('/uploads/test_document.pdf');
    expect(result.file_size).toBe(1024);
    expect(result.mime_type).toBe('application/pdf');
    expect(result.uploaded_by).toBe(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save attachment to database', async () => {
    const input = { ...testInput, ticket_id: testTicketId, uploaded_by: testUserId };
    const result = await createAttachment(input);

    // Query database to verify attachment was saved
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, result.id))
      .execute();

    expect(attachments).toHaveLength(1);
    expect(attachments[0].ticket_id).toBe(testTicketId);
    expect(attachments[0].filename).toBe('test_document.pdf');
    expect(attachments[0].file_path).toBe('/uploads/test_document.pdf');
    expect(attachments[0].file_size).toBe(1024);
    expect(attachments[0].mime_type).toBe('application/pdf');
    expect(attachments[0].uploaded_by).toBe(testUserId);
    expect(attachments[0].created_at).toBeInstanceOf(Date);
  });

  it('should create attachment with different file types', async () => {
    const imageInput = {
      ...testInput,
      ticket_id: testTicketId,
      uploaded_by: testUserId,
      filename: 'screenshot.png',
      file_path: '/uploads/screenshot.png',
      file_size: 2048,
      mime_type: 'image/png'
    };

    const result = await createAttachment(imageInput);

    expect(result.filename).toBe('screenshot.png');
    expect(result.file_path).toBe('/uploads/screenshot.png');
    expect(result.file_size).toBe(2048);
    expect(result.mime_type).toBe('image/png');
  });

  it('should throw error when ticket does not exist', async () => {
    const input = { ...testInput, ticket_id: 99999, uploaded_by: testUserId };

    expect(createAttachment(input)).rejects.toThrow(/ticket.*not found/i);
  });

  it('should throw error when user does not exist', async () => {
    const input = { ...testInput, ticket_id: testTicketId, uploaded_by: 99999 };

    expect(createAttachment(input)).rejects.toThrow(/user.*not found/i);
  });

  it('should handle large file sizes', async () => {
    const largeFileInput = {
      ...testInput,
      ticket_id: testTicketId,
      uploaded_by: testUserId,
      filename: 'large_video.mp4',
      file_path: '/uploads/large_video.mp4',
      file_size: 104857600, // 100MB
      mime_type: 'video/mp4'
    };

    const result = await createAttachment(largeFileInput);

    expect(result.file_size).toBe(104857600);
    expect(result.filename).toBe('large_video.mp4');
    expect(result.mime_type).toBe('video/mp4');
  });

  it('should create multiple attachments for same ticket', async () => {
    const input1 = { ...testInput, ticket_id: testTicketId, uploaded_by: testUserId, filename: 'doc1.pdf' };
    const input2 = { ...testInput, ticket_id: testTicketId, uploaded_by: testUserId, filename: 'doc2.pdf' };

    const result1 = await createAttachment(input1);
    const result2 = await createAttachment(input2);

    expect(result1.id).not.toBe(result2.id);
    expect(result1.ticket_id).toBe(testTicketId);
    expect(result2.ticket_id).toBe(testTicketId);
    expect(result1.filename).toBe('doc1.pdf');
    expect(result2.filename).toBe('doc2.pdf');

    // Verify both attachments exist in database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.ticket_id, testTicketId))
      .execute();

    expect(attachments).toHaveLength(2);
  });
});