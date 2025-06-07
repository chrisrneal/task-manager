/**
 * @fileoverview Profile API Endpoint
 * 
 * This API endpoint handles user profile operations for the authenticated user,
 * allowing users to view and update their own profile information.
 * 
 * Supported Operations:
 * - GET: Retrieve current user's profile
 * - PUT: Update current user's profile
 * 
 * Key Features:
 * - User profile retrieval and updates
 * - Authentication required
 * - Input validation and sanitization
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Users can only access/modify their own profile
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface ProfileUpdateData {
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  timezone?: string;
  locale?: string;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/profile - Request received`);

  // Only allow GET and PUT requests
  if (!['GET', 'PUT'].includes(method as string)) {
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  }

  // Initialize Supabase client
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log(`[${traceId}] Error: Missing Supabase configuration`);
    return res.status(500).json({ 
      error: 'Server configuration error',
      traceId
    });
  }

  // Get auth header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[${traceId}] Error: Missing or invalid authorization header`);
    return res.status(401).json({ 
      error: 'Authorization header required',
      traceId
    });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Verify user session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.log(`[${traceId}] Error: Invalid user session:`, authError?.message);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  try {
    if (method === 'GET') {
      return await handleGetProfile(req, res, supabase, user.id, traceId);
    } else if (method === 'PUT') {
      return await handleUpdateProfile(req, res, supabase, user.id, traceId);
    }
  } catch (error) {
    console.error(`[${traceId}] Unhandled error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleGetProfile = async (req: NextApiRequest, res: NextApiResponse, supabase: any, userId: string, traceId: string) => {
  console.log(`[${traceId}] Getting profile for user ${userId}`);

  try {
    // First try to get from users table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, display_name, first_name, last_name, avatar_url, phone, timezone, locale, email_verified, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.log(`[${traceId}] Error fetching user profile:`, error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch profile',
        details: error.message,
        traceId
      });
    }

    // If user exists in users table, return it
    if (user) {
      console.log(`[${traceId}] Successfully fetched profile from users table`);
      return res.status(200).json({
        profile: user,
        traceId
      });
    }

    // Fallback to auth.users if not in users table yet
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      console.log(`[${traceId}] Error fetching auth user:`, authError?.message);
      return res.status(404).json({ 
        error: 'Profile not found',
        traceId
      });
    }

    // Return auth user data in expected format
    const profileData = {
      id: authUser.id,
      email: authUser.email,
      display_name: authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || '',
      first_name: authUser.user_metadata?.first_name || '',
      last_name: authUser.user_metadata?.last_name || '',
      avatar_url: authUser.user_metadata?.avatar_url || '',
      phone: authUser.user_metadata?.phone || '',
      timezone: 'UTC',
      locale: 'en',
      email_verified: authUser.email_confirmed_at ? true : false,
      created_at: authUser.created_at,
      updated_at: authUser.updated_at
    };

    console.log(`[${traceId}] Successfully fetched profile from auth.users`);
    return res.status(200).json({
      profile: profileData,
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleGetProfile:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleUpdateProfile = async (req: NextApiRequest, res: NextApiResponse, supabase: any, userId: string, traceId: string) => {
  console.log(`[${traceId}] Updating profile for user ${userId}`);

  try {
    const updates: ProfileUpdateData = req.body;

    // Validate input
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid request body',
        traceId
      });
    }

    // Sanitize and validate fields
    const allowedFields = ['display_name', 'first_name', 'last_name', 'avatar_url', 'phone', 'timezone', 'locale'];
    const sanitizedUpdates: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (typeof value === 'string') {
          sanitizedUpdates[key] = value.trim();
        } else {
          sanitizedUpdates[key] = value;
        }
      }
    }

    // Validate required fields
    if (sanitizedUpdates.display_name !== undefined && !sanitizedUpdates.display_name) {
      return res.status(400).json({ 
        error: 'Display name cannot be empty',
        traceId
      });
    }

    // Check if user exists in users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.log(`[${traceId}] Error checking user existence:`, checkError.message);
      return res.status(500).json({ 
        error: 'Failed to update profile',
        details: checkError.message,
        traceId
      });
    }

    if (!existingUser) {
      // Create user record if it doesn't exist
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.log(`[${traceId}] Error fetching auth user for creation:`, authError?.message);
        return res.status(500).json({ 
          error: 'Failed to create user profile',
          traceId
        });
      }

      const newUserData = {
        id: userId,
        email: authUser.email,
        display_name: sanitizedUpdates.display_name || authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || '',
        first_name: sanitizedUpdates.first_name || authUser.user_metadata?.first_name || '',
        last_name: sanitizedUpdates.last_name || authUser.user_metadata?.last_name || '',
        avatar_url: sanitizedUpdates.avatar_url || authUser.user_metadata?.avatar_url || '',
        phone: sanitizedUpdates.phone || authUser.user_metadata?.phone || '',
        timezone: sanitizedUpdates.timezone || 'UTC',
        locale: sanitizedUpdates.locale || 'en',
        email_verified: authUser.email_confirmed_at ? true : false,
        is_active: true
      };

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([newUserData])
        .select()
        .single();

      if (insertError) {
        console.log(`[${traceId}] Error creating user:`, insertError.message);
        return res.status(500).json({ 
          error: 'Failed to create user profile',
          details: insertError.message,
          traceId
        });
      }

      console.log(`[${traceId}] Successfully created and updated user profile`);
      return res.status(200).json({
        profile: newUser,
        traceId
      });
    }

    // Update existing user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(sanitizedUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.log(`[${traceId}] Error updating user:`, updateError.message);
      return res.status(500).json({ 
        error: 'Failed to update profile',
        details: updateError.message,
        traceId
      });
    }

    console.log(`[${traceId}] Successfully updated user profile`);
    return res.status(200).json({
      profile: updatedUser,
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleUpdateProfile:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

export default handler;