import { NextApiRequest, NextApiResponse } from 'next';
import { 
  generateTraceId,
  logRequest,
  logError,
  logSuccess,
  createApiResponse,
  sendApiResponse,
  withAuth,
  handleMethodNotAllowed,
  handleUnhandledError,
  validateRequiredParams
} from '@/utils/apiUtils';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const traceId = generateTraceId();
  
  logRequest(traceId, method || 'UNKNOWN', '/api/projects');

  // Authenticate user
  const authContext = await withAuth(req, res, traceId);
  if (!authContext) return; // Response already sent by withAuth

  const { user, supabase } = authContext;

  try {
    // Handle GET request - List all projects
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logError(traceId, `Error fetching projects: ${error.message}`);
        return sendApiResponse(res, 500, createApiResponse(traceId, 500, undefined, error.message));
      }

      logSuccess(traceId, `GET /api/projects - Success, returned ${data.length} projects`);
      return sendApiResponse(res, 200, createApiResponse(traceId, 200, data));
    }
    
    // Handle POST request - Create a new project
    if (method === 'POST') {
      const { name, description } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      console.log(`[${traceId}] Auth user id:`, user.id);

      // Validate required fields
      const validation = validateRequiredParams({ name }, traceId);
      if (validation) {
        return sendApiResponse(res, 400, createApiResponse(traceId, 400, undefined, validation.message));
      }

      const insertPayload = {
        name,
        description: description || null,
        user_id: user.id
      };
      console.log(`[${traceId}] Insert payload:`, insertPayload);

      const { data, error } = await supabase
        .from('projects')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        logError(traceId, 'Error inserting project', error);
        return sendApiResponse(res, 500, createApiResponse(
          traceId, 
          500, 
          undefined, 
          error.message, 
          error.details
        ));
      }

      logSuccess(traceId, `POST /api/projects - Success, created project: ${data.id}`);
      return sendApiResponse(res, 201, createApiResponse(traceId, 201, data));
    }
    
    // Handle unsupported methods
    return handleMethodNotAllowed(res, traceId, method || 'UNKNOWN', ['GET', 'POST']);
  } catch (error: any) {
    return handleUnhandledError(res, traceId, error);
  }
};

export default handler;