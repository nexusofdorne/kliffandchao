import 'server-only';
import { z } from 'zod';

// Keeping every var required (not .optional()) is what makes this "fail the
// build, not a guest" (docs/BUILD_PLAN.md, App source). Optional infra below
// is grouped separately because it genuinely isn't needed for the site to run.
const envSchema = z.object({
  // Standard Next.js/Node var — included so nothing reads process.env directly.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Gate
  SITE_PASSWORD_HASH: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_EPOCH: z.coerce.number().int(),
  // Database
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),
  // Admin auth
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  ADMIN_EMAILS: z.string().min(1),
  // Sheets
  GOOGLE_SA_KEY_B64: z.string().min(1),
  GOOGLE_SHEET_ID: z.string().min(1),
  SYNC_WEBHOOK_SECRET: z.string().min(1),
  // RSVP
  RSVP_DEADLINE: z.iso.datetime(),
  IP_HASH_SALT: z.string().min(1),
  // Email
  RESEND_API_KEY: z.string().min(1),
  COUPLE_NOTIFY_EMAIL: z.email(),
  // Optional
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
