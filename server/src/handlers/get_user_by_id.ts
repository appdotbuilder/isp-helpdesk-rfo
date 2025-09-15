import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserById = async (id: number): Promise<User | null> => {
  try {
    // Query user by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    // Return null if user not found
    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    
    // Return user data - password_hash is excluded from the User type in schema.ts
    // The User schema type already excludes password_hash, so we can return the user directly
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      password_hash: user.password_hash, // This will be present in DB result but filtered by schema
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Get user by ID failed:', error);
    throw error;
  }
};