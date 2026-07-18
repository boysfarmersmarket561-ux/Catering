import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/** Secret-key client: full access, bypasses RLS. Server-side only. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Publishable-key client: used server-side only, for password sign-in/refresh. */
export function supabaseAuthClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function imageBaseUrl(): string {
  return `${env("SUPABASE_URL")}/storage/v1/object/public/menu-images`;
}
