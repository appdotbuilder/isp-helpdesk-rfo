import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type CreateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Helper to create a test user
const createTestUser = async (userData: Partial<CreateUserInput> = {}): Promise<number> => {
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'customer' as const,
    ...userData
  };

  const passwordHash = await bcrypt.hash(defaultUser.password, 10);
  
  const result = await db.insert(usersTable)
    .values({
      name: defaultUser.name,
      email: defaultUser.email,
      password_hash: passwordHash,
      role: defaultUser.role
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user name', async () => {
    const userId = await createTestUser();
    
    const input: UpdateUserInput = {
      id: userId,
      name: 'Updated Name'
    };

    const result = await updateUser(input);

    expect(result.id).toEqual(userId);
    expect(result.name).toEqual('Updated Name');
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('customer');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user email', async () => {
    const userId = await createTestUser();
    
    const input: UpdateUserInput = {
      id: userId,
      email: 'newemail@example.com'
    };

    const result = await updateUser(input);

    expect(result.id).toEqual(userId);
    expect(result.name).toEqual('Test User');
    expect(result.email).toEqual('newemail@example.com');
    expect(result.role).toEqual('customer');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user role', async () => {
    const userId = await createTestUser();
    
    const input: UpdateUserInput = {
      id: userId,
      role: 'agent'
    };

    const result = await updateUser(input);

    expect(result.id).toEqual(userId);
    expect(result.name).toEqual('Test User');
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('agent');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields at once', async () => {
    const userId = await createTestUser();
    
    const input: UpdateUserInput = {
      id: userId,
      name: 'Updated Name',
      email: 'updated@example.com',
      role: 'admin'
    };

    const result = await updateUser(input);

    expect(result.id).toEqual(userId);
    expect(result.name).toEqual('Updated Name');
    expect(result.email).toEqual('updated@example.com');
    expect(result.role).toEqual('admin');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update the updated_at timestamp', async () => {
    const userId = await createTestUser();
    
    // Get original user
    const originalUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    
    const originalUpdatedAt = originalUser[0].updated_at;
    
    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const input: UpdateUserInput = {
      id: userId,
      name: 'Updated Name'
    };

    const result = await updateUser(input);

    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should save changes to database', async () => {
    const userId = await createTestUser();
    
    const input: UpdateUserInput = {
      id: userId,
      name: 'Database Updated Name',
      email: 'dbupdate@example.com'
    };

    await updateUser(input);

    // Verify changes persisted to database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].name).toEqual('Database Updated Name');
    expect(users[0].email).toEqual('dbupdate@example.com');
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const input: UpdateUserInput = {
      id: 99999, // Non-existent user ID
      name: 'Updated Name'
    };

    await expect(updateUser(input)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should handle email uniqueness constraint violation', async () => {
    // Create two users
    const userId1 = await createTestUser({ email: 'user1@example.com' });
    await createTestUser({ email: 'user2@example.com' });
    
    const input: UpdateUserInput = {
      id: userId1,
      email: 'user2@example.com' // Try to use existing email
    };

    // Should throw due to unique constraint
    await expect(updateUser(input)).rejects.toThrow();
  });

  it('should not modify fields that are not provided', async () => {
    const userId = await createTestUser({
      name: 'Original Name',
      email: 'original@example.com',
      role: 'customer'
    });
    
    const input: UpdateUserInput = {
      id: userId,
      name: 'Only Name Updated'
      // email and role not provided
    };

    const result = await updateUser(input);

    expect(result.name).toEqual('Only Name Updated');
    expect(result.email).toEqual('original@example.com'); // Unchanged
    expect(result.role).toEqual('customer'); // Unchanged
  });

  it('should handle empty update input (only id)', async () => {
    const userId = await createTestUser();
    
    const input: UpdateUserInput = {
      id: userId
      // No other fields provided
    };

    const result = await updateUser(input);

    // Should still update the updated_at timestamp
    expect(result.id).toEqual(userId);
    expect(result.name).toEqual('Test User'); // Unchanged
    expect(result.email).toEqual('test@example.com'); // Unchanged
    expect(result.role).toEqual('customer'); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});