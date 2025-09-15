import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUserById } from '../handlers/get_user_by_id';
import { eq } from 'drizzle-orm';

// Test user data
const testUser: CreateUserInput = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  password: 'securepassword123',
  role: 'customer'
};

const testAgent: CreateUserInput = {
  name: 'Jane Agent',
  email: 'jane.agent@example.com',
  password: 'agentpassword456',
  role: 'agent'
};

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user when found', async () => {
    // Create a test user first
    const insertResult = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_' + testUser.password,
        role: testUser.role
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];
    
    // Get the user by ID
    const result = await getUserById(createdUser.id);

    // Verify user data
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdUser.id);
    expect(result!.name).toEqual('John Doe');
    expect(result!.email).toEqual('john.doe@example.com');
    expect(result!.role).toEqual('customer');
    expect(result!.password_hash).toEqual('hashed_securepassword123');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when user not found', async () => {
    // Try to get a user that doesn't exist
    const result = await getUserById(999);

    expect(result).toBeNull();
  });

  it('should return correct user data for different roles', async () => {
    // Create users with different roles
    const customerResult = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_' + testUser.password,
        role: testUser.role
      })
      .returning()
      .execute();

    const agentResult = await db.insert(usersTable)
      .values({
        name: testAgent.name,
        email: testAgent.email,
        password_hash: 'hashed_' + testAgent.password,
        role: testAgent.role
      })
      .returning()
      .execute();

    const customer = customerResult[0];
    const agent = agentResult[0];

    // Get both users
    const customerUser = await getUserById(customer.id);
    const agentUser = await getUserById(agent.id);

    // Verify customer
    expect(customerUser).not.toBeNull();
    expect(customerUser!.role).toEqual('customer');
    expect(customerUser!.name).toEqual('John Doe');

    // Verify agent
    expect(agentUser).not.toBeNull();
    expect(agentUser!.role).toEqual('agent');
    expect(agentUser!.name).toEqual('Jane Agent');
  });

  it('should handle database errors gracefully', async () => {
    // Test with invalid ID type (negative number)
    await expect(getUserById(-1)).resolves.toBeNull();
  });

  it('should verify user exists in database after retrieval', async () => {
    // Create a test user
    const insertResult = await db.insert(usersTable)
      .values({
        name: testUser.name,
        email: testUser.email,
        password_hash: 'hashed_' + testUser.password,
        role: testUser.role
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];
    
    // Get the user via handler
    const handlerResult = await getUserById(createdUser.id);

    // Verify user exists in database by direct query
    const dbUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, createdUser.id))
      .execute();

    expect(dbUsers).toHaveLength(1);
    expect(handlerResult).not.toBeNull();
    expect(handlerResult!.id).toEqual(dbUsers[0].id);
    expect(handlerResult!.email).toEqual(dbUsers[0].email);
  });

  it('should return all required user fields', async () => {
    // Create a test user with admin role
    const insertResult = await db.insert(usersTable)
      .values({
        name: 'Admin User',
        email: 'admin@example.com',
        password_hash: 'hashed_adminpassword',
        role: 'admin'
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];
    
    // Get the user
    const result = await getUserById(createdUser.id);

    // Verify all required fields are present
    expect(result).not.toBeNull();
    expect(typeof result!.id).toBe('number');
    expect(typeof result!.name).toBe('string');
    expect(typeof result!.email).toBe('string');
    expect(typeof result!.password_hash).toBe('string');
    expect(['customer', 'agent', 'admin']).toContain(result!.role);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });
});