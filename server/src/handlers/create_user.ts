import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import bcrypt from 'bcrypt';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Hash the password with a salt rounds of 12
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(input.password, saltRounds);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        name: input.name,
        email: input.email,
        password_hash,
        role: input.role
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};