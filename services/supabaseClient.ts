import { createClient } from '@supabase/supabase-js';

/**
 * SUPABASE CONFIGURATION
 * 
 * Required Environment Variables:
 * 1. SUPABASE_URL: Your project URL from Settings > API.
 * 2. SUPABASE_ANON_KEY: Your anon/public key from Settings > API.
 * 
 * Local Development: 
 * Add these to a .env.local file. This file is excluded from git via .gitignore.
 * 
 * Production: 
 * Add these variables to your production environment settings.
 * 
 * SECURITY NOTICE:
 * - SUPABASE_ANON_KEY is designed for client-side use when Row Level Security (RLS) is enabled.
 * - NEVER use SUPABASE_SERVICE_ROLE_KEY in frontend code as it bypasses all security.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validation check to prevent runtime crashes if keys are not yet provided
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Graceful warning for developers - this will show in the console if keys are missing
  console.warn(
    "Supabase configuration is missing. " +
    "Document history and persistent storage will be disabled. " +
    "Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables to enable data persistence."
  );
}

/**
 * Initialize the Supabase client.
 * 
 * If isSupabaseConfigured is false, 'supabase' will be null.
 * App.tsx is architected to guard all calls with isSupabaseConfigured to prevent errors.
 */
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!) 
  : (null as any);