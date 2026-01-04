/**
 * Centralized environment variable validation and access.
 * All external configuration should be accessed through this module.
 * Missing required variables throw clear, actionable error messages.
 */
import { z } from "zod";

const envSchema = z.object({
  /** Supabase project URL (e.g., https://xxx.supabase.co) */
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  /** Supabase anonymous key for client-side access */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  /** Secret for admin upload endpoint (optional for dev, required in production) */
  ADMIN_UPLOAD_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ADMIN_UPLOAD_SECRET: process.env.ADMIN_UPLOAD_SECRET,
  });

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
      .join("\n");
    throw new Error(
      `Missing or invalid environment variables:\n${errorMessages}\n\nPlease check your .env.local file or Vercel environment settings.`
    );
  }

  return result.data;
}

// Validate env on module load
export const env = loadEnv();
