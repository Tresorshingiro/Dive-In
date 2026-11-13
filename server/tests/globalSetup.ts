import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './testDb';

/** Once per run: apply migrations to the test database (it is created if missing). */
export default function setup() {
  const url = testDatabaseUrl();
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
