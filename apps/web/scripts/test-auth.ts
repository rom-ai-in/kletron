// apps/web/scripts/test-auth.ts
// Script to test authentication with the test user
import { findTestUser, verifyPassword } from '../lib/auth';

async function main() {
  try {
    console.log('Testing authentication...');
    
    // Test finding the user
    const email = 'demo@kletron.local';
    const testUser = findTestUser(email);
    
    if (!testUser) {
      console.error('✗ Test user not found!');
      process.exit(1);
    }
    
    console.log('✓ Found test user:', email);
    
    // Test password verification
    const correctPassword = 'kletron-demo';
    const wrongPassword = 'wrongpassword';
    
    const isCorrectValid = await verifyPassword(correctPassword, testUser.passwordHash);
    const isWrongValid = await verifyPassword(wrongPassword, testUser.passwordHash);
    
    console.log('✓ Correct password verification:', isCorrectValid ? 'PASS' : 'FAIL');
    console.log('✓ Wrong password verification:', !isWrongValid ? 'PASS' : 'FAIL');
    
    if (isCorrectValid && !isWrongValid) {
      console.log('\n✓ Authentication test passed!');
      console.log('The test user is ready for use in the application.');
      process.exit(0);
    } else {
      console.error('\n✗ Authentication test failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error during authentication test:', error);
    process.exit(1);
  }
}

void main();
