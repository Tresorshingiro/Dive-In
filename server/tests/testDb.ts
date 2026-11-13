import { config } from 'dotenv';

/**
 * Resolves the test database URL and refuses anything that could be real data:
 * it must be set explicitly (TEST_DATABASE_URL), its database name must contain "test",
 * and it must differ from DATABASE_URL.
 */
export function testDatabaseUrl(): string {
  const fromFile = config({ path: '.env', processEnv: {} }).parsed ?? {};
  const url = process.env.TEST_DATABASE_URL || fromFile.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Set TEST_DATABASE_URL (e.g. in server/.env) to a separate database such as …/dive_fitness_test. Tests wipe and reseed it.');
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName)) throw new Error(`Refusing to run tests against "${dbName}": the test database name must contain "test".`);
  const real = process.env.DATABASE_URL_REAL ?? fromFile.DATABASE_URL;
  if (real && new URL(real).pathname === new URL(url).pathname && new URL(real).host === new URL(url).host) {
    throw new Error('TEST_DATABASE_URL points at the same database as DATABASE_URL. Use a separate test database.');
  }
  return url;
}
