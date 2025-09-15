import { db } from '../db';
import { attachmentsTable, ticketsTable, usersTable } from '../db/schema';
import { type CreateAttachmentInput, type Attachment } from '../schema';
import { eq } from 'drizzle-orm';

export const createAttachment = async (input: CreateAttachmentInput): Promise<Attachment> => {
  try {
    // Validate that the ticket exists
    const ticket = await db.select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, input.ticket_id))
      .limit(1)
      .execute();
    
    if (ticket.length === 0) {
      throw new Error(`Ticket with ID ${input.ticket_id} not found`);
    }

    // Validate that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.uploaded_by))
      .limit(1)
      .execute();
    
    if (user.length === 0) {
      throw new Error(`User with ID ${input.uploaded_by} not found`);
    }

    // Insert attachment record
    const result = await db.insert(attachmentsTable)
      .values({
        ticket_id: input.ticket_id,
        filename: input.filename,
        file_path: input.file_path,
        file_size: input.file_size,
        mime_type: input.mime_type,
        uploaded_by: input.uploaded_by
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Attachment creation failed:', error);
    throw error;
  }
};