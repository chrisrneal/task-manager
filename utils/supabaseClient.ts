/**
 * @fileoverview Supabase Client Configuration
 * 
 * This module initializes and exports a configured Supabase client instance
 * for use throughout the application. It provides a centralized client that
 * can be imported by other modules for database operations.
 * 
 * The client is configured with environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: The Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: The anonymous/public API key
 * 
 * Default values are provided for development builds to prevent build failures
 * when environment variables are not set.
 * 
 * Note: For API routes that require user authentication, a separate client
 * should be created with the user's token in the Authorization header.
 */

// Utility to initialize and export the Supabase client
import { createClient } from '@supabase/supabase-js';

// Provide default values for development/build environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '******';

/**
 * Pre-configured Supabase client instance
 * 
 * This client uses the anonymous key and is suitable for:
 * - Client-side operations with Row Level Security (RLS)
 * - Public data access
 * - Operations that don't require specific user authentication
 * 
 * For server-side API routes requiring user context, create a new client
 * with the user's authentication token.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
