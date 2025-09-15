import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User, type UserQuery } from '../schema';
import { eq } from 'drizzle-orm';

export const getUsers = async (query?: UserQuery): Promise<User[]> => {
  try {
    // Build the complete query in one go to avoid TypeScript inference issues
    const baseSelect = db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      created_at: usersTable.created_at,
      updated_at: usersTable.updated_at
    }).from(usersTable);

    // Apply pagination defaults
    const limit = query?.limit || 10;
    const offset = query?.offset || 0;

    // Build query based on whether we have role filter or not
    const results = query?.role 
      ? await baseSelect
          .where(eq(usersTable.role, query.role))
          .limit(limit)
          .offset(offset)
          .execute()
      : await baseSelect
          .limit(limit)
          .offset(offset)
          .execute();

    // Transform results to match User schema (add empty password_hash)
    return results.map(user => ({
      ...user,
      password_hash: '' // Required by User schema but excluded for security
    }));

  } catch (error) {
    console.error('Get users failed:', error);
    throw error;
  }
};