/**
 * Check if the server is running and accessible
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkServer() {
  try {
    // Try to curl the server endpoint
    const { stdout, stderr } = await execAsync('curl -s http://localhost:7622/health');
    
    if (stderr && stderr.includes('Connection refused')) {
      console.log('Server is not running on port 7622');
      return false;
    }
    
    console.log('Server is running and accessible');
    return true;
  } catch (error) {
    console.error('Error checking server:', (error as Error).message);
    return false;
  }
}

checkServer();