import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEV_DB = path.join(__dirname, '../../db/pb_data');
const TEST_DB = path.join(__dirname, '.tmp/pb_data_test');
const PB_BINARY = path.join(__dirname, '../../db/pocketbase');
const PB_PORT = 8092;

let pbProcess: ChildProcess | null = null;

export async function setup() {
  console.log('🔧 Setting up test PocketBase instance...');

  // 1. Clean up any existing temp directory
  if (fs.existsSync(TEST_DB)) {
    fs.rmSync(TEST_DB, { recursive: true, force: true });
  }

  // Create .tmp directory if it doesn't exist
  const tmpDir = path.join(__dirname, '.tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 2. Copy dev database to temp location
  console.log('📋 Copying dev database...');
  const startCopy = Date.now();
  fs.cpSync(DEV_DB, TEST_DB, { recursive: true });
  const copyTime = Date.now() - startCopy;
  console.log(`   ✓ Database copied in ${copyTime}ms`);

  // 3. Start PocketBase process
  console.log('🚀 Starting PocketBase on port 8092...');
  const startSpawn = Date.now();
  pbProcess = spawn(PB_BINARY, [
    'serve',
    `--dir=${TEST_DB}`,
    `--http=127.0.0.1:${PB_PORT}`
  ], {
    detached: true,
    stdio: 'pipe'
  });

  // Store PID for cleanup
  if (pbProcess.pid) {
    const pidFile = path.join(__dirname, '.tmp/pb.pid');
    fs.writeFileSync(pidFile, pbProcess.pid.toString());
  }

  // Handle process errors
  pbProcess.on('error', (error) => {
    console.error('❌ Failed to start PocketBase:', error);
    throw error;
  });

  // 4. Wait for PocketBase to be ready
  await waitForPocketBase(`http://127.0.0.1:${PB_PORT}`);
  const spawnTime = Date.now() - startSpawn;
  console.log(`   ✓ PocketBase ready in ${spawnTime}ms`);
  console.log('✅ Test PocketBase setup complete');
}

export async function teardown() {
  console.log('🧹 Cleaning up test PocketBase...');

  // Kill PocketBase process
  if (pbProcess && pbProcess.pid) {
    try {
      // Kill the process group (negative PID)
      process.kill(-pbProcess.pid, 'SIGTERM');
      console.log('   ✓ PocketBase process terminated');
    } catch (error) {
      console.error('   ⚠️  Error killing PocketBase:', error);
    }
  }

  // Delete temp directory
  if (fs.existsSync(TEST_DB)) {
    fs.rmSync(TEST_DB, { recursive: true, force: true });
    console.log('   ✓ Temp database deleted');
  }

  console.log('✅ Cleanup complete');
}

async function waitForPocketBase(url: string, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // PocketBase not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error(`PocketBase failed to start within ${timeout}ms`);
}
