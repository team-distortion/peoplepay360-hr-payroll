import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  COMPANY_NAME: z.string().default('OXP Pvt Ltd'),
  COMPANY_CURRENCY: z.string().default('INR'),
  COMPANY_TIMEZONE: z
    .string()
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: 'COMPANY_TIMEZONE must be a valid IANA timezone string' }
    )
    .default('Asia/Kolkata'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment variables configuration');
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
