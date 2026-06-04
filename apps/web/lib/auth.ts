// apps/web/lib/auth.ts
// Simple authentication utilities for development/testing

// Pre-defined test user (persistent across script runs)
const TEST_USER_EMAIL = 'demo@kletron.local';
const TEST_USER_PASSWORD = 'kletron-demo';
let testUserPasswordHash: string | null = null;

export const hashPassword = async (password: string): Promise<string> => {
  // Use bcrypt if available, otherwise use a simple hash for development
  try {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 10);
  } catch {
    // Fallback to simple hash for development/testing
    let hash = '';
    for (let i = 0; i < password.length; i++) {
      hash += String.fromCharCode(password.charCodeAt(i) ^ 5);
    }
    return hash + '-dev-hash';
  }
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  // Use bcrypt if available
  try {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  } catch {
    // Fallback verification for development hash
    let computedHash = '';
    for (let i = 0; i < password.length; i++) {
      computedHash += String.fromCharCode(password.charCodeAt(i) ^ 5);
    }
    return hash === computedHash + '-dev-hash';
  }
};

// Initialize test user on first use
export const initializeTestUser = async () => {
  if (!testUserPasswordHash) {
    testUserPasswordHash = await hashPassword(TEST_USER_PASSWORD);
    console.info('✓ Test user initialized in memory');
  }
};

// Find test user by email
export const findTestUser = (email: string) => {
  if (!testUserPasswordHash) {
    return null; // Will be available after initialization
  }
  
  if (email === TEST_USER_EMAIL) {
    return { 
      email: TEST_USER_EMAIL, 
      passwordHash: testUserPasswordHash 
    };
  }
  
  return null;
};
