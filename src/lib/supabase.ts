import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

let cachedPublicClient: SupabaseClient<Database> | null = null;
let cachedServiceClient: SupabaseClient<Database> | null = null;

function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

/**
 * Public Anonymous Supabase client (Lazy singleton)
 * Safe for client components and unprivileged reads
 */
export function getPublicSupabase(): SupabaseClient<Database> {
  if (cachedPublicClient) return cachedPublicClient;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  cachedPublicClient = createClient<Database>(normalizeSupabaseUrl(rawUrl), anonKey);
  return cachedPublicClient;
}

/**
 * Privileged Admin client using Service Role key (Lazy singleton)
 * Bypasses RLS - use strictly in server contexts (API routes, ingestion scripts)
 */
export function getServiceSupabase(): SupabaseClient<Database> {
  if (cachedServiceClient) return cachedServiceClient;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceKey) {
    // Return a dummy client during build-time page data collection if env vars are missing
    if (process.env.NODE_ENV === "production" && !rawUrl) {
      return createClient<Database>("https://placeholder.supabase.co", "placeholder-service-key", {
        auth: { persistSession: false },
      });
    }

    throw new Error(
      "Missing Supabase server configuration: Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined."
    );
  }

  cachedServiceClient = createClient<Database>(normalizeSupabaseUrl(rawUrl), serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedServiceClient;
}
