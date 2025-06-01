/**
 * @fileoverview API Middleware Utilities
 * 
 * This module provides shared middleware and utility functions for API endpoints
 * to eliminate code duplication and ensure consistent handling of authentication,
 * validation, error responses, and logging across all API routes.
 * 
 * Key Features:
 * - Bearer token authentication and validation
 * - Supabase client creation with user context
 * - User session verification
 * - Consistent error response formatting
 * - Request tracing and logging
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Authenticated request context containing verified user and Supabase client
 */
export interface AuthenticatedContext {
  user: any;
  supabase: any;
  traceId: string;
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  error: string;
  traceId: string;
  details?: string;
}

/**
 * Extract and validate Bearer token from Authorization header
 * 
 * @param authHeader - Authorization header value
 * @returns Extracted token or undefined if invalid
 */
export function extractBearerToken(authHeader: string | undefined): string | undefined {
  return authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;
}

/**
 * Create authenticated Supabase client with user token
 * 
 * @param token - Bearer token for authentication
 * @returns Configured Supabase client with RLS
 */
export function createAuthenticatedSupabaseClient(token: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

/**
 * Generate unique trace ID for request tracking
 * 
 * @returns UUID for request tracing
 */
export function generateTraceId(): string {
  return uuidv4();
}

/**
 * Send standardized error response
 * 
 * @param res - Next.js response object
 * @param status - HTTP status code
 * @param message - Error message
 * @param traceId - Request trace ID
 * @param details - Optional error details
 */
export function sendErrorResponse(
  res: NextApiResponse,
  status: number,
  message: string,
  traceId: string,
  details?: string
): void {
  const response: ApiErrorResponse = {
    error: message,
    traceId,
    ...(details && { details })
  };
  
  console.log(`[${traceId}] Sending error response: ${status} - ${message}${details ? ` (${details})` : ''}`);
  
  // Check if response has already been sent
  if (res.headersSent) {
    console.error(`[${traceId}] WARNING: Attempted to send response but headers already sent`);
    return;
  }
  
  res.status(status).json(response);
}

/**
 * Middleware to authenticate requests and create user context
 * 
 * This function handles the common authentication flow:
 * 1. Generate trace ID for request tracking
 * 2. Extract and validate Bearer token
 * 3. Create authenticated Supabase client
 * 4. Verify user session
 * 5. Return authenticated context or send error response
 * 
 * @param req - Next.js request object
 * @param res - Next.js response object
 * @param endpoint - Endpoint name for logging
 * @returns Promise of authenticated context or null if authentication failed
 */
export async function authenticateRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  endpoint: string
): Promise<AuthenticatedContext | null> {
  const { method } = req;
  const traceId = generateTraceId();
  
  console.log(`[${traceId}] ${method} ${endpoint} - Request received`);

  // Extract and validate Bearer token
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    sendErrorResponse(res, 401, 'Authentication required', traceId);
    return null;
  }

  // Create authenticated Supabase client
  const supabase = createAuthenticatedSupabaseClient(token);

  // Verify user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    sendErrorResponse(res, 401, 'Invalid authentication', traceId, userError?.message);
    return null;
  }

  return { user, supabase, traceId };
}

/**
 * Validate required request parameters
 * 
 * @param params - Object with parameter values to validate
 * @param res - Next.js response object
 * @param traceId - Request trace ID
 * @returns True if all parameters are valid, false otherwise
 */
export function validateRequiredParams(
  params: Record<string, any>,
  res: NextApiResponse,
  traceId: string
): boolean {
  for (const [key, value] of Object.entries(params)) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      console.log(`[${traceId}] Validation failed: ${key} is required`);
      sendErrorResponse(res, 400, `${key} is required`, traceId);
      return false;
    }
  }
  return true;
}

/**
 * Handle Supabase not found errors with custom response
 * 
 * @param error - Supabase error object
 * @param res - Next.js response object
 * @param traceId - Request trace ID
 * @param message - Custom not found message
 * @returns True if error was handled, false otherwise
 */
export function handleNotFoundError(
  error: any,
  res: NextApiResponse,
  traceId: string,
  message: string = 'Resource not found'
): boolean {
  if (error?.code === 'PGRST116') {
    sendErrorResponse(res, 404, message, traceId);
    return true;
  }
  return false;
}

/**
 * Check if resource exists and belongs to user
 * 
 * @param supabase - Authenticated Supabase client
 * @param table - Table name
 * @param id - Resource ID
 * @param userId - User ID for ownership check
 * @param res - Next.js response object
 * @param traceId - Request trace ID
 * @param notFoundMessage - Custom not found message
 * @param userIdColumn - Column name for user ID (defaults to 'user_id')
 * @returns Resource data if found, null if not found (response already sent)
 */
export async function checkResourceOwnership(
  supabase: any,
  table: string,
  id: string,
  userId: string,
  res: NextApiResponse,
  traceId: string,
  notFoundMessage: string = 'Resource not found or access denied',
  userIdColumn: string = 'user_id'
): Promise<any | null> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .eq(userIdColumn, userId)
    .single();

  if (error) {
    if (handleNotFoundError(error, res, traceId, notFoundMessage)) {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Validation error class to distinguish from system errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public traceId?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Handle try-catch wrapper for API endpoints
 * 
 * This wrapper catches unexpected system errors while allowing validation
 * errors to be handled by the calling code for proper HTTP status codes.
 * 
 * @param operation - Async operation to execute
 * @param res - Next.js response object
 * @param traceId - Request trace ID
 * @param errorMessage - Custom error message prefix
 */
export async function handleApiOperation(
  operation: () => Promise<void>,
  res: NextApiResponse,
  traceId: string,
  errorMessage: string = 'Internal server error'
): Promise<void> {
  try {
    await operation();
    console.log(`[${traceId}] API operation completed successfully`);
  } catch (error: any) {
    console.log(`[${traceId}] handleApiOperation caught error: ${error.constructor.name}: ${error.message}`);
    console.log(`[${traceId}] Error instanceof ValidationError: ${error instanceof ValidationError}`);
    
    // Re-throw validation errors to be handled by the calling code
    if (error instanceof ValidationError) {
      console.log(`[${traceId}] Re-throwing ValidationError to calling code`);
      throw error;
    }
    
    console.log(`[${traceId}] Handling unexpected system error`);
    // Handle unexpected system errors
    sendErrorResponse(res, 500, errorMessage, traceId, error.message);
  }
}