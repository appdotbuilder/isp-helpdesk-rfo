import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { randomBytes, pbkdf2Sync } from 'crypto';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { loginUser } from '../handlers/login_user';

// Helper function to hash passwords (matching the handler's implementation)
const hashPassword = (password: string): string => {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
};

// Test data
const testPassword = 'testPassword123';
const hashedPassword = hashPassword(testPassword);

const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password_hash: hashedPassword,
  role: 'customer' as const
};

const validLoginInput: LoginInput = {
  email: 'test@example.com',
  password: testPassword
};

const invalidEmailInput: LoginInput = {
  email: 'nonexistent@example.com',
  password: testPassword
};

const invalidPasswordInput: LoginInput = {
  email: 'test@example.com',
  password: 'wrongPassword'
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully authenticate with valid credentials', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(validLoginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toEqual('test@example.com');
    expect(result!.name).toEqual('Test User');
    expect(result!.role).toEqual('customer');
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    
    // Ensure password_hash is not included in response
    expect((result as any).password_hash).toBeUndefined();
  });

  it('should return null for non-existent email', async () => {
    // Create test user but attempt login with different email
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(invalidEmailInput);

    expect(result).toBeNull();
  });

  it('should return null for invalid password', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(invalidPasswordInput);

    expect(result).toBeNull();
  });

  it('should return null when no users exist in database', async () => {
    const result = await loginUser(validLoginInput);

    expect(result).toBeNull();
  });

  it('should handle different user roles correctly', async () => {
    const agentPassword = 'agentPassword456';
    const adminPassword = 'adminPassword789';

    const agentUser = {
      name: 'Agent User',
      email: 'agent@example.com',
      password_hash: hashPassword(agentPassword),
      role: 'agent' as const
    };

    const adminUser = {
      name: 'Admin User',
      email: 'admin@example.com',
      password_hash: hashPassword(adminPassword),
      role: 'admin' as const
    };

    // Create users with different roles
    await db.insert(usersTable)
      .values([agentUser, adminUser])
      .execute();

    // Test agent login
    const agentResult = await loginUser({
      email: 'agent@example.com',
      password: agentPassword
    });

    expect(agentResult).not.toBeNull();
    expect(agentResult!.role).toEqual('agent');
    expect(agentResult!.email).toEqual('agent@example.com');

    // Test admin login
    const adminResult = await loginUser({
      email: 'admin@example.com',
      password: adminPassword
    });

    expect(adminResult).not.toBeNull();
    expect(adminResult!.role).toEqual('admin');
    expect(adminResult!.email).toEqual('admin@example.com');
  });

  it('should handle case sensitivity in email correctly', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Test with different email case
    const uppercaseEmailInput: LoginInput = {
      email: 'TEST@EXAMPLE.COM',
      password: testPassword
    };

    const result = await loginUser(uppercaseEmailInput);

    // Should return null as email comparison is case-sensitive
    expect(result).toBeNull();
  });

  it('should verify password hash comparison works correctly', async () => {
    const differentPassword = 'differentPassword456';
    const userWithDifferentPassword = {
      name: 'Different User',
      email: 'different@example.com',
      password_hash: hashPassword(differentPassword),
      role: 'customer' as const
    };

    // Create user with different password
    await db.insert(usersTable)
      .values(userWithDifferentPassword)
      .execute();

    // Try to login with original test password
    const result = await loginUser({
      email: 'different@example.com',
      password: testPassword
    });

    expect(result).toBeNull();

    // Now try with correct password
    const correctResult = await loginUser({
      email: 'different@example.com',
      password: differentPassword
    });

    expect(correctResult).not.toBeNull();
    expect(correctResult!.email).toEqual('different@example.com');
  });

  it('should handle empty password correctly', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const emptyPasswordInput: LoginInput = {
      email: 'test@example.com',
      password: ''
    };

    const result = await loginUser(emptyPasswordInput);

    expect(result).toBeNull();
  });

  it('should handle malformed password hash correctly', async () => {
    const userWithBadHash = {
      name: 'Bad Hash User',
      email: 'badhash@example.com',
      password_hash: 'invalid-hash-format',
      role: 'customer' as const
    };

    // Create user with malformed hash
    await db.insert(usersTable)
      .values(userWithBadHash)
      .execute();

    const result = await loginUser({
      email: 'badhash@example.com',
      password: testPassword
    });

    expect(result).toBeNull();
  });
});