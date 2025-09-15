import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, ticketsTable, attachmentsTable } from '../db/schema';
import { deleteAttachment } from '../handlers/delete_attachment';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Test data setup
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password_hash: 'hashed_password',
  role: 'customer' as const
};

const testAgent = {
  name: 'Test Agent',
  email: 'agent@example.com',
  password_hash: 'hashed_password',
  role: 'agent' as const
};

const testTicket = {
  subject: 'Test Ticket',
  description: 'A ticket for testing attachments',
  category: 'technical_support' as const,
  priority: 'medium' as const,
  status: 'open' as const
};

describe('deleteAttachment', () => {
  let customerId: number;
  let agentId: number;
  let ticketId: number;
  let testFilePath: string;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    customerId = userResult[0].id;

    // Create test agent
    const agentResult = await db.insert(usersTable)
      .values(testAgent)
      .returning()
      .execute();
    agentId = agentResult[0].id;

    // Create test ticket
    const ticketResult = await db.insert(ticketsTable)
      .values({
        ...testTicket,
        customer_id: customerId
      })
      .returning()
      .execute();
    ticketId = ticketResult[0].id;

    // Create a temporary test file
    testFilePath = path.join(tmpdir(), `test-file-${Date.now()}.txt`);
    await fs.writeFile(testFilePath, 'Test file content');
  });

  afterEach(async () => {
    // Clean up test file if it exists
    try {
      await fs.unlink(testFilePath);
    } catch {
      // File might already be deleted, ignore error
    }
    await resetDB();
  });

  it('should delete an existing attachment successfully', async () => {
    // Create test attachment
    const attachmentResult = await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'test-file.txt',
        file_path: testFilePath,
        file_size: 100,
        mime_type: 'text/plain',
        uploaded_by: customerId
      })
      .returning()
      .execute();

    const attachmentId = attachmentResult[0].id;

    // Delete the attachment
    const result = await deleteAttachment(attachmentId);

    // Verify deletion was successful
    expect(result).toBe(true);

    // Verify attachment is removed from database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .execute();

    expect(attachments).toHaveLength(0);

    // Verify physical file is deleted
    await expect(fs.access(testFilePath)).rejects.toThrow();
  });

  it('should return false for non-existent attachment', async () => {
    const nonExistentId = 99999;

    const result = await deleteAttachment(nonExistentId);

    expect(result).toBe(false);
  });

  it('should handle missing physical file gracefully', async () => {
    const nonExistentFilePath = path.join(tmpdir(), 'non-existent-file.txt');

    // Create test attachment with non-existent file path
    const attachmentResult = await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'missing-file.txt',
        file_path: nonExistentFilePath,
        file_size: 100,
        mime_type: 'text/plain',
        uploaded_by: customerId
      })
      .returning()
      .execute();

    const attachmentId = attachmentResult[0].id;

    // Delete the attachment - should succeed even though file doesn't exist
    const result = await deleteAttachment(attachmentId);

    // Verify deletion was successful
    expect(result).toBe(true);

    // Verify attachment is removed from database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .execute();

    expect(attachments).toHaveLength(0);
  });

  it('should handle empty file path gracefully', async () => {
    // Create test attachment with empty file path
    const attachmentResult = await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'empty-path-file.txt',
        file_path: '',
        file_size: 100,
        mime_type: 'text/plain',
        uploaded_by: customerId
      })
      .returning()
      .execute();

    const attachmentId = attachmentResult[0].id;

    // Delete the attachment - should succeed
    const result = await deleteAttachment(attachmentId);

    // Verify deletion was successful
    expect(result).toBe(true);

    // Verify attachment is removed from database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .execute();

    expect(attachments).toHaveLength(0);
  });

  it('should handle whitespace-only file path gracefully', async () => {
    // Create test attachment with whitespace-only file path
    const attachmentResult = await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'whitespace-path-file.txt',
        file_path: '   ',
        file_size: 100,
        mime_type: 'text/plain',
        uploaded_by: customerId
      })
      .returning()
      .execute();

    const attachmentId = attachmentResult[0].id;

    // Delete the attachment - should succeed
    const result = await deleteAttachment(attachmentId);

    // Verify deletion was successful
    expect(result).toBe(true);

    // Verify attachment is removed from database
    const remainingAttachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .execute();

    expect(remainingAttachments).toHaveLength(0);
  });

  it('should delete multiple attachments independently', async () => {
    // Create second test file
    const secondTestFilePath = path.join(tmpdir(), `test-file-2-${Date.now()}.txt`);
    await fs.writeFile(secondTestFilePath, 'Second test file content');

    try {
      // Create two test attachments
      const firstAttachmentResult = await db.insert(attachmentsTable)
        .values({
          ticket_id: ticketId,
          filename: 'first-file.txt',
          file_path: testFilePath,
          file_size: 100,
          mime_type: 'text/plain',
          uploaded_by: customerId
        })
        .returning()
        .execute();

      const secondAttachmentResult = await db.insert(attachmentsTable)
        .values({
          ticket_id: ticketId,
          filename: 'second-file.txt',
          file_path: secondTestFilePath,
          file_size: 200,
          mime_type: 'text/plain',
          uploaded_by: agentId
        })
        .returning()
        .execute();

      const firstAttachmentId = firstAttachmentResult[0].id;
      const secondAttachmentId = secondAttachmentResult[0].id;

      // Delete first attachment
      const firstResult = await deleteAttachment(firstAttachmentId);
      expect(firstResult).toBe(true);

      // Verify first attachment is deleted
      const firstCheck = await db.select()
        .from(attachmentsTable)
        .where(eq(attachmentsTable.id, firstAttachmentId))
        .execute();
      expect(firstCheck).toHaveLength(0);

      // Verify second attachment still exists
      const secondCheck = await db.select()
        .from(attachmentsTable)
        .where(eq(attachmentsTable.id, secondAttachmentId))
        .execute();
      expect(secondCheck).toHaveLength(1);

      // Delete second attachment
      const secondResult = await deleteAttachment(secondAttachmentId);
      expect(secondResult).toBe(true);

      // Verify second attachment is also deleted
      const finalCheck = await db.select()
        .from(attachmentsTable)
        .where(eq(attachmentsTable.id, secondAttachmentId))
        .execute();
      expect(finalCheck).toHaveLength(0);

    } finally {
      // Clean up second test file
      try {
        await fs.unlink(secondTestFilePath);
      } catch {
        // File might already be deleted, ignore error
      }
    }
  });

  it('should verify attachment metadata before deletion', async () => {
    // Create test attachment
    const attachmentResult = await db.insert(attachmentsTable)
      .values({
        ticket_id: ticketId,
        filename: 'metadata-test.txt',
        file_path: testFilePath,
        file_size: 150,
        mime_type: 'text/plain',
        uploaded_by: agentId
      })
      .returning()
      .execute();

    const attachmentId = attachmentResult[0].id;

    // Verify attachment exists with correct metadata before deletion
    const beforeDeletion = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .execute();

    expect(beforeDeletion).toHaveLength(1);
    expect(beforeDeletion[0].filename).toBe('metadata-test.txt');
    expect(beforeDeletion[0].file_size).toBe(150);
    expect(beforeDeletion[0].mime_type).toBe('text/plain');
    expect(beforeDeletion[0].uploaded_by).toBe(agentId);

    // Delete the attachment
    const result = await deleteAttachment(attachmentId);
    expect(result).toBe(true);

    // Verify complete removal
    const afterDeletion = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .execute();

    expect(afterDeletion).toHaveLength(0);
  });
});