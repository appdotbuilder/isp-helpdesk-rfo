import { db } from '../db';
import { attachmentsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';

export const deleteAttachment = async (attachmentId: number): Promise<boolean> => {
  try {
    // First, get the attachment to verify it exists and get file path
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .execute();

    if (attachments.length === 0) {
      return false; // Attachment doesn't exist
    }

    const attachment = attachments[0];

    // Delete the database record first
    const deleteResult = await db.delete(attachmentsTable)
      .where(eq(attachmentsTable.id, attachmentId))
      .returning()
      .execute();

    if (deleteResult.length === 0) {
      return false; // Failed to delete from database
    }

    // Try to delete the physical file
    try {
      // Ensure file path is safe and exists
      if (attachment.file_path && attachment.file_path.trim() !== '') {
        const filePath = path.resolve(attachment.file_path);
        
        // Check if file exists before attempting deletion
        await fs.access(filePath);
        await fs.unlink(filePath);
      }
    } catch (fileError) {
      // File deletion failed, but database deletion succeeded
      // Log the error but don't fail the operation since the DB record is already deleted
      console.error('Failed to delete physical file:', fileError);
    }

    return true;
  } catch (error) {
    console.error('Attachment deletion failed:', error);
    throw error;
  }
};