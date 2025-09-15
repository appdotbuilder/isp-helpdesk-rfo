import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UserQuery } from '../schema';
import { getUsers } from '../handlers/get_users';

// Test data for creating users directly in the database
const testUsers = [
  {
    name: 'John Customer',
    email: 'john@example.com',
    password_hash: 'hashed_password_123',
    role: 'customer' as const
  },
  {
    name: 'Jane Agent', 
    email: 'jane@example.com',
    password_hash: 'hashed_password_456',
    role: 'agent' as const
  },
  {
    name: 'Bob Admin',
    email: 'bob@example.com',
    password_hash: 'hashed_password_789',
    role: 'admin' as const
  },
  {
    name: 'Alice Customer',
    email: 'alice@example.com',
    password_hash: 'hashed_password_000',
    role: 'customer' as const
  }
];

// Helper function to create test users
const createTestUsers = async () => {
  await db.insert(usersTable).values(testUsers).execute();
};

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all users when no query is provided', async () => {
    await createTestUsers();

    const result = await getUsers();

    expect(result).toHaveLength(4);
    
    // Verify all users are returned
    const emails = result.map(user => user.email).sort();
    expect(emails).toEqual([
      'alice@example.com',
      'bob@example.com', 
      'jane@example.com',
      'john@example.com'
    ]);

    // Verify password_hash is excluded (should be empty string)
    result.forEach(user => {
      expect(user.password_hash).toBe('');
      expect(user.id).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should filter users by customer role', async () => {
    await createTestUsers();

    const query: UserQuery = {
      role: 'customer',
      limit: 10,
      offset: 0
    };

    const result = await getUsers(query);

    expect(result).toHaveLength(2);
    result.forEach(user => {
      expect(user.role).toBe('customer');
    });

    const customerEmails = result.map(user => user.email).sort();
    expect(customerEmails).toEqual(['alice@example.com', 'john@example.com']);
  });

  it('should filter by agent role correctly', async () => {
    await createTestUsers();

    const query: UserQuery = {
      role: 'agent',
      limit: 10,
      offset: 0
    };

    const result = await getUsers(query);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('agent');
    expect(result[0].email).toBe('jane@example.com');
    expect(result[0].name).toBe('Jane Agent');
  });

  it('should filter by admin role correctly', async () => {
    await createTestUsers();

    const query: UserQuery = {
      role: 'admin',
      limit: 10,
      offset: 0
    };

    const result = await getUsers(query);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('admin');
    expect(result[0].email).toBe('bob@example.com');
    expect(result[0].name).toBe('Bob Admin');
  });

  it('should return empty array when filtering by role with no matches', async () => {
    // Create only customer user
    const customerUser = {
      name: 'Only Customer',
      email: 'customer@example.com',
      password_hash: 'hashed_password',
      role: 'customer' as const
    };

    await db.insert(usersTable).values([customerUser]).execute();

    const query: UserQuery = {
      role: 'admin',
      limit: 10,
      offset: 0
    };

    const result = await getUsers(query);

    expect(result).toHaveLength(0);
  });

  it('should apply default pagination limits', async () => {
    // Create more than 10 users to test default limit
    const manyUsers = Array.from({ length: 15 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      password_hash: 'hashed_password',
      role: 'customer' as const
    }));

    await db.insert(usersTable).values(manyUsers).execute();

    const result = await getUsers();

    // Should return only 10 users (default limit)
    expect(result).toHaveLength(10);
  });

  it('should respect custom limit', async () => {
    await createTestUsers();

    const query: UserQuery = {
      limit: 2,
      offset: 0
    };

    const result = await getUsers(query);

    expect(result).toHaveLength(2);
  });

  it('should respect custom offset', async () => {
    await createTestUsers();

    // Get first 2 users
    const firstBatch = await getUsers({ limit: 2, offset: 0 });
    // Get next 2 users  
    const secondBatch = await getUsers({ limit: 2, offset: 2 });

    expect(firstBatch).toHaveLength(2);
    expect(secondBatch).toHaveLength(2);

    // Should be different users
    const firstIds = firstBatch.map(u => u.id).sort();
    const secondIds = secondBatch.map(u => u.id).sort();
    expect(firstIds).not.toEqual(secondIds);
  });

  it('should combine role filtering with pagination', async () => {
    await createTestUsers();

    const query: UserQuery = {
      role: 'customer',
      limit: 1,
      offset: 0
    };

    const result = await getUsers(query);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('customer');
  });

  it('should handle large offset gracefully', async () => {
    await createTestUsers();

    const query: UserQuery = {
      limit: 10,
      offset: 100 // Much larger than available data
    };

    const result = await getUsers(query);

    expect(result).toHaveLength(0);
  });

  it('should verify password_hash is excluded from all results', async () => {
    await createTestUsers();

    const result = await getUsers();

    expect(result.length).toBeGreaterThan(0);
    result.forEach(user => {
      // password_hash should be empty string (excluded for security)
      expect(user.password_hash).toBe('');
      // But other fields should be populated
      expect(typeof user.name).toBe('string');
      expect(user.name.length).toBeGreaterThan(0);
      expect(typeof user.email).toBe('string');
      expect(user.email.includes('@')).toBe(true);
    });
  });

  it('should maintain consistent ordering across paginated requests', async () => {
    await createTestUsers();

    // Get all users to establish expected order
    const allUsers = await getUsers({ limit: 100, offset: 0 });
    
    // Get users in pages
    const page1 = await getUsers({ limit: 2, offset: 0 });
    const page2 = await getUsers({ limit: 2, offset: 2 });
    
    // Verify pages match the expected order
    expect(page1[0].id).toBe(allUsers[0].id);
    expect(page1[1].id).toBe(allUsers[1].id);
    expect(page2[0].id).toBe(allUsers[2].id);
    expect(page2[1].id).toBe(allUsers[3].id);
  });
});