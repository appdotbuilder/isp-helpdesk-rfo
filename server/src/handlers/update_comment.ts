import { db } from '../db';
import { commentsTable } from '../db/schema';
import { type UpdateCommentInput, type Comment } from '../schema';
import { eq } from 'drizzle-orm';

export const updateComment = async (input: UpdateCommentInput): Promise<Comment> => {
  try {
    // First, check if the comment exists
    const existingComment = await db.select()
      .from(commentsTable)
      .where(eq(commentsTable.id, input.id))
      .execute();

    if (existingComment.length === 0) {
      throw new Error(`Comment with id ${input.id} not found`);
    }

    // Build the update object with only provided fields
    const updateData: Partial<typeof commentsTable.$inferInsert> = {};
    
    if (input.content !== undefined) {
      updateData.content = input.content;
    }
    
    if (input.is_internal !== undefined) {
      updateData.is_internal = input.is_internal;
    }

    // If no fields to update, return the existing comment
    if (Object.keys(updateData).length === 0) {
      return existingComment[0];
    }

    // Update the comment
    const result = await db.update(commentsTable)
      .set(updateData)
      .where(eq(commentsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Comment update failed:', error);
    throw error;
  }
};