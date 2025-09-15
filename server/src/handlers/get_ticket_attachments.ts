import { db } from '../db';
import { attachmentsTable, usersTable, ticketsTable } from '../db/schema';
import { type Attachment } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getTicketAttachments = async (ticketId: number): Promise<Attachment[]> => {
  try {
    // First verify the ticket exists
    const ticketExists = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .limit(1)
      .execute();

    if (ticketExists.length === 0) {
      throw new Error(`Ticket with ID ${ticketId} not found`);
    }

    // Fetch all attachments for the ticket with uploader information
    // Join with users table to include uploader details
    const results = await db.select({
      id: attachmentsTable.id,
      ticket_id: attachmentsTable.ticket_id,
      filename: attachmentsTable.filename,
      file_path: attachmentsTable.file_path,
      file_size: attachmentsTable.file_size,
      mime_type: attachmentsTable.mime_type,
      uploaded_by: attachmentsTable.uploaded_by,
      created_at: attachmentsTable.created_at,
      uploader_name: usersTable.name,
      uploader_email: usersTable.email
    })
      .from(attachmentsTable)
      .innerJoin(usersTable, eq(attachmentsTable.uploaded_by, usersTable.id))
      .where(eq(attachmentsTable.ticket_id, ticketId))
      .orderBy(asc(attachmentsTable.created_at))
      .execute();

    // Transform results to match Attachment schema
    return results.map(result => ({
      id: result.id,
      ticket_id: result.ticket_id,
      filename: result.filename,
      file_path: result.file_path,
      file_size: result.file_size,
      mime_type: result.mime_type,
      uploaded_by: result.uploaded_by,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch ticket attachments:', error);
    throw error;
  }
};