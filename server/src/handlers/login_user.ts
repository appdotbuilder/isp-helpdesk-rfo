import { createHash, pbkdf2Sync } from 'crypto';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type LoginInput, type User } from '../schema';

// Simple password verification using Node.js crypto
const verifyPassword = (plaintext: string, hash: string): boolean => {
  try {
    // For this implementation, we'll assume passwords are hashed with a simple approach
    // In production, you'd use bcrypt or similar
    const [salt, hashedPassword] = hash.split(':');
    if (!salt || !hashedPassword) {
      return false;
    }
    
    const derivedHash = pbkdf2Sync(plaintext, salt, 10000, 64, 'sha256').toString('hex');
    return derivedHash === hashedPassword;
  } catch {
    return false;
  }
};

export const loginUser = async (input: LoginInput): Promise<User | null> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // Compare provided password with stored hash
    const isPasswordValid = verifyPassword(input.password, user.password_hash);

    if (!isPasswordValid) {
      return null; // Invalid password
    }

    // Return user without password_hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
};