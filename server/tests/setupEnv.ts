import os from 'node:os';
import path from 'node:path';
import { testDatabaseUrl } from './testDb';

// Runs in every test worker before the app is imported (env.ts reads these; dotenv never overrides them).
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER = 'mock'; // never call Stripe from tests
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'dive-test-uploads');
process.env.BCRYPT_ROUNDS = '10';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789abcdef012345678';
process.env.MOCK_PAYMENT_WEBHOOK_SECRET ||= 'test-webhook-secret';
