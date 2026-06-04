// apps/web/scripts/create-test-user.ts
// Script to initialize test user for authentication testing
import { initializeTestUser } from '../lib/auth';

async function main() {
  try {
    console.log('Initializing test user...');
    await initializeTestUser();
    console.log('✓ Test user initialization completed successfully!');
    console.log('  Email: demo@kletron.local');
    console.log('  Password: kletron-demo');
    console.log('\nYou can now use this test user to log in to the application.');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error initializing test user:', error);
    process.exit(1);
  }
}

void main();
