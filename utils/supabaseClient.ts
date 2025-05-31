/**
 * @fileoverview Supabase Client Configuration
 * 
 * This module initializes and exports the Supabase client for the task management system.
 * It provides a configured client instance that can be used throughout the application
 * for database operations, authentication, and storage interactions.
 * 
 * Configuration:
 * - Uses environment variables for URL and API key
 * - Provides fallback values for development/build environments
 * - Single client instance to ensure consistent configuration
 * 
 * Security Notes:
 * - Uses public/anon key for client-side operations
 * - Row Level Security (RLS) is enforced at the database level
 * - Authentication tokens are passed per-request for server-side operations
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Supabase project URL from environment variables
 * Falls back to example URL for build environments where env vars may not be available
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';

/**
 * Supabase anonymous/public API key from environment variables  
 * Falls back to placeholder for build environments
 * Note: This is the public key, not a secret - it's safe to expose in client-side code
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '******';

/**
 * Configured Supabase client instance
 * 
 * This client is configured with:
 * - Project URL and public API key
 * - Default configuration for authentication and RLS
 * - Shared across the application for consistency
 * 
 * Usage Notes:
 * - For server-side operations, create new clients with user tokens
 * - This client is primarily for client-side operations
 * - All database operations respect Row Level Security policies
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
