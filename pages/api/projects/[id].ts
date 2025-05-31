import { NextApiRequest, NextApiResponse } from 'next';
import { 
  authenticateRequest, 
  handleApiOperation, 
  sendErrorResponse, 
  validateRequiredParams,
  handleNotFoundError,
  checkResourceOwnership
} from '@/utils/apiMiddleware';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id } = req.query;
  
  // Authenticate request and get user context
  const context = await authenticateRequest(req, res, `/api/projects/${id}`);
  if (!context) return; // Authentication failed, response already sent

  const { user, supabase, traceId } = context;

  await handleApiOperation(async () => {
    // Handle GET request - Get a single project
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (handleNotFoundError(error, res, traceId, 'Project not found')) {
          return;
        }
        throw error;
      }
      
      console.log(`[${traceId}] GET /api/projects/${id} - Success`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle PUT request - Update a project
    if (method === 'PUT') {
      const { name, description } = req.body;
      
      if (!validateRequiredParams({ name }, res, traceId)) {
        return;
      }

      // Check if project exists and belongs to user
      const existingProject = await checkResourceOwnership(
        supabase, 'projects', id as string, user.id, res, traceId
      );
      if (!existingProject) return; // Response already sent

      const { data, error } = await supabase
        .from('projects')
        .update({ 
          name, 
          description: description || null
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;
      
      console.log(`[${traceId}] PUT /api/projects/${id} - Success, updated project`);
      return res.status(200).json({ data: data[0], traceId });
    }
    
    // Handle DELETE request - Delete a project
    if (method === 'DELETE') {
      // Check if project exists and belongs to user
      const existingProject = await checkResourceOwnership(
        supabase, 'projects', id as string, user.id, res, traceId
      );
      if (!existingProject) return; // Response already sent

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      console.log(`[${traceId}] DELETE /api/projects/${id} - Success, deleted project`);
      return res.status(200).json({ success: true, traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return sendErrorResponse(res, 405, `Method ${method} not allowed`, traceId);
  }, res, traceId, 'Internal server error');
};

export default handler;