import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Test input data
const testInput: CreateUserInput = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  password: 'securepassword123',
  role: 'customer'
};

const agentInput: CreateUserInput = {
  name: 'Jane Agent',
  email: 'jane.agent@company.com',
  password: 'agentpassword456',
  role: 'agent'
};

const adminInput: CreateUserInput = {
  name: 'Admin User',
  email: 'admin@company.com',
  password: 'adminpassword789',
  role: 'admin'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all required fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.name).toEqual('John Doe');
    expect(result.email).toEqual('john.doe@example.com');
    expect(result.role).toEqual('customer');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('securepassword123'); // Password should be hashed
  });

  it('should hash the password securely', async () => {
    const result = await createUser(testInput);

    // Verify password is hashed (not plaintext)
    expect(result.password_hash).not.toEqual(testInput.password);
    expect(result.password_hash.length).toBeGreaterThan(20); // Bcrypt hashes are longer

    // Verify the hashed password can be validated
    const isValidPassword = await bcrypt.compare(testInput.password, result.password_hash);
    expect(isValidPassword).toBe(true);

    // Verify wrong password fails validation
    const isInvalidPassword = await bcrypt.compare('wrongpassword', result.password_hash);
    expect(isInvalidPassword).toBe(false);
  });

  it('should save user to database correctly', async () => {
    const result = await createUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].name).toEqual('John Doe');
    expect(users[0].email).toEqual('john.doe@example.com');
    expect(users[0].role).toEqual('customer');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create users with different roles', async () => {
    const customer = await createUser(testInput);
    const agent = await createUser(agentInput);
    const admin = await createUser(adminInput);

    expect(customer.role).toEqual('customer');
    expect(agent.role).toEqual('agent');
    expect(admin.role).toEqual('admin');

    // Verify all users are in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(3);

    const roles = allUsers.map(user => user.role).sort();
    expect(roles).toEqual(['admin', 'agent', 'customer']);
  });

  it('should reject duplicate email addresses', async () => {
    // Create first user
    await createUser(testInput);

    // Attempt to create second user with same email
    const duplicateInput: CreateUserInput = {
      name: 'Different Name',
      email: 'john.doe@example.com', // Same email
      password: 'differentpassword',
      role: 'agent'
    };

    // Should throw error due to unique constraint
    await expect(createUser(duplicateInput)).rejects.toThrow();
  });

  it('should create multiple users with unique emails', async () => {
    const user1 = await createUser(testInput);
    const user2 = await createUser(agentInput);
    const user3 = await createUser(adminInput);

    // All users should have different IDs
    expect(user1.id).not.toEqual(user2.id);
    expect(user2.id).not.toEqual(user3.id);
    expect(user1.id).not.toEqual(user3.id);

    // Verify all users exist in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(3);

    const emails = allUsers.map(user => user.email).sort();
    expect(emails).toEqual([
      'admin@company.com',
      'jane.agent@company.com',
      'john.doe@example.com'
    ]);
  });

  it('should set timestamps correctly', async () => {
    const beforeCreation = new Date();
    const result = await createUser(testInput);
    const afterCreation = new Date();

    // Check that timestamps are within reasonable bounds
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());

    // For new users, created_at and updated_at should be very close
    const timeDifference = Math.abs(result.updated_at.getTime() - result.created_at.getTime());
    expect(timeDifference).toBeLessThan(1000); // Less than 1 second difference
  });
});