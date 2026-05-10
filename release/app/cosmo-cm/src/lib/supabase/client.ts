import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isProduction = process.env.NODE_ENV === "production";

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.";
  
  if (isProduction) {
    console.error(`[Supabase] ERROR: ${errorMsg} Using placeholders to allow build, but database calls WILL fail at runtime.`);
  } else {
    console.warn(`[Supabase] WARNING: ${errorMsg} Using placeholder values. Database calls WILL fail.`);
  }
}

const finalUrl = supabaseUrl || "https://placeholder.supabase.co";
const finalKey = supabaseAnonKey || "placeholder-key";

export const supabase = createClient(finalUrl, finalKey);

if (!isProduction) {
  console.log(`[Supabase] Initialized in DEVELOPMENT mode.`);
}
