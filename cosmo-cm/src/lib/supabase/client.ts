import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isProduction = process.env.NODE_ENV === "production";

// Hardened validation
if (isProduction && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error("FATAL: Supabase environment variables are missing in production environment.");
}

// Fallback for local development or demo mode
const finalUrl = supabaseUrl || "https://placeholder.supabase.co";
const finalKey = supabaseAnonKey || "placeholder-key";

export const supabase = createClient(finalUrl, finalKey);

console.log(`[Supabase] Initialized in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT/DEMO'} mode.`);
