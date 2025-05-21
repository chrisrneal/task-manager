// Utility to initialize and export the Supabase client
import { createClient } from '@supabase/supabase-js';

// Provide default values for development/build environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '******';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
