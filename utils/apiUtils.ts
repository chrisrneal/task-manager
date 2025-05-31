import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  details?: string;
  message?: string;
  traceId: string;
}

export interface AuthenticatedApiContext {
  user: any;
  supabase: any;
  traceId: string;
}

/**
 * Generates a trace ID for request tracking
 */
export function generateTraceId(): string {
  return uuidv4();
}

/**
 * Logs API request with trace ID
 */
export function logRequest(traceId: string, method: string, path: string): void {
  console.log(`[${traceId}] ${method} ${path} - Request received`);
}

/**
 * Logs API error with trace ID
 */
export function logError(traceId: string, message: string, error?: any): void {
  console.error(`[${traceId}] Error: ${message}`, error ? error.message || error : '');
}

/**
 * Logs API success with trace ID
 */
export function logSuccess(traceId: string, message: string): void {
  console.log(`[${traceId}] ${message}`);
}

/**
 * Creates a standardized API response
 */
export function createApiResponse<T>(
  traceId: string,
  statusCode: number,
  data?: T,
  error?: string,
  details?: string,
  message?: string
): ApiResponse<T> {
  return {
    ...(data !== undefined && { data }),
    ...(error && { error }),
    ...(details && { details }),
    ...(message && { message }),
    traceId
  };
}

/**
 * Sends a standardized API response
 */
export function sendApiResponse<T>(
  res: NextApiResponse,
  statusCode: number,
  response: ApiResponse<T>
): void {
  res.status(statusCode).json(response);
}

/**
 * Extracts Bearer token from authorization header
 */
export function extractBearerToken(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
}

/**
 * Creates an authenticated Supabase client with user token
 */
export function createAuthenticatedSupabaseClient(token: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

/**
 * Middleware for API authentication
 * Returns null if authentication fails, otherwise returns authenticated context
 */
export async function withAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  traceId: string
): Promise<AuthenticatedApiContext | null> {
  // Extract token
  const token = extractBearerToken(req);
  
  if (!token) {
    logError(traceId, 'No authorization token provided');
    sendApiResponse(res, 401, createApiResponse(traceId, 401, undefined, 'Authentication required'));
    return null;
  }

  // Create authenticated Supabase client
  const supabase = createAuthenticatedSupabaseClient(token);

  // Verify user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    logError(traceId, 'Invalid authentication', userError);
    sendApiResponse(res, 401, createApiResponse(traceId, 401, undefined, 'Invalid authentication'));
    return null;
  }

  return { user, supabase, traceId };
}

/**
 * Middleware for handling unsupported HTTP methods
 */
export function handleMethodNotAllowed(
  res: NextApiResponse,
  traceId: string,
  method: string,
  allowedMethods: string[]
): void {
  logError(traceId, `Method ${method} not allowed`);
  res.setHeader('Allow', allowedMethods);
  sendApiResponse(res, 405, createApiResponse(traceId, 405, undefined, `Method ${method} not allowed`));
}

/**
 * Middleware for handling unhandled errors
 */
export function handleUnhandledError(
  res: NextApiResponse,
  traceId: string,
  error: any
): void {
  logError(traceId, 'Internal server error', error);
  sendApiResponse(res, 500, createApiResponse(
    traceId, 
    500, 
    undefined, 
    'Internal server error',
    error.message
  ));
}

/**
 * Validates that required parameters are present
 */
export function validateRequiredParams(
  params: Record<string, any>,
  traceId: string
): { field: string; message: string } | null {
  for (const [key, value] of Object.entries(params)) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      const message = `${key.charAt(0).toUpperCase() + key.slice(1)} is required`;
      logError(traceId, message);
      return { field: key, message };
    }
  }
  return null;
}

/**
 * Checks if user has access to a project (either owner or admin)
 */
export async function checkProjectAccess(
  supabase: any,
  projectId: string,
  userId: string,
  traceId: string
): Promise<{ hasAccess: boolean; project?: any; userRole?: string }> {
  try {
    // First check if project exists and get basic info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      logError(traceId, `Project not found or access denied - ${projectId}`);
      return { hasAccess: false };
    }

    // Check if user is project owner
    if (project.user_id === userId) {
      return { hasAccess: true, project, userRole: 'owner' };
    }

    // Check if user is a project member
    const { data: memberData, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!memberError && memberData) {
      return { hasAccess: true, project, userRole: memberData.role };
    }

    return { hasAccess: false };
  } catch (error) {
    logError(traceId, 'Error checking project access', error);
    return { hasAccess: false };
  }
}