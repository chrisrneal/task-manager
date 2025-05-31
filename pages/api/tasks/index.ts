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
  validateRequiredParams,
  checkProjectAccess
} from '@/utils/apiUtils';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const traceId = generateTraceId();
  
  logRequest(traceId, method || 'UNKNOWN', '/api/tasks');

  // Authenticate user
  const authContext = await withAuth(req, res, traceId);
  if (!authContext) return; // Response already sent by withAuth

  const { user, supabase } = authContext;

  try {
    // Handle GET request - List tasks for a project
    if (method === 'GET') {
      const { projectId } = req.query;
      
      // Validate required parameters
      const validation = validateRequiredParams({ projectId }, traceId);
      if (validation) {
        return sendApiResponse(res, 400, createApiResponse(traceId, 400, undefined, validation.message));
      }

      // Check project access
      const projectAccess = await checkProjectAccess(supabase, projectId as string, user.id, traceId);
      if (!projectAccess.hasAccess) {
        return sendApiResponse(res, 404, createApiResponse(traceId, 404, undefined, 'Project not found or access denied'));
      }

      // Fetch tasks for this project
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        logError(traceId, `Error fetching tasks: ${error.message}`);
        return sendApiResponse(res, 500, createApiResponse(traceId, 500, undefined, error.message));
      }

      logSuccess(traceId, `GET /api/tasks - Success, returned ${data.length} tasks`);
      return sendApiResponse(res, 200, createApiResponse(traceId, 200, data));
    }
    
    // Handle POST request - Create a new task
    if (method === 'POST') {
      const { name, description, project_id, task_type_id, state_id, field_values } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      
      // Validate required fields
      const validation = validateRequiredParams({ name, project_id }, traceId);
      if (validation) {
        return sendApiResponse(res, 400, createApiResponse(traceId, 400, undefined, 'Task name and project ID are required'));
      }

      // Check project access
      const projectAccess = await checkProjectAccess(supabase, project_id, user.id, traceId);
      if (!projectAccess.hasAccess) {
        return sendApiResponse(res, 404, createApiResponse(traceId, 404, undefined, 'Project not found or access denied'));
      }

      // Validate custom fields if task type is provided and field values are included
      if (task_type_id && field_values && Array.isArray(field_values)) {
        // Get required fields for this task type
        const { data: taskTypeFields, error: ttfError } = await supabase
          .from('task_type_fields')
          .select(`
            field_id,
            fields (
              id,
              name,
              is_required,
              project_id
            )
          `)
          .eq('task_type_id', task_type_id);

        if (ttfError) {
          console.error(`[${traceId}] Error fetching task type fields: ${ttfError.message}`);
          return res.status(500).json({ 
            error: 'Failed to validate task type fields',
            traceId
          });
        }

        // Validate that fields belong to the same project
        const invalidProjectFields = taskTypeFields
          .map((ttf: any) => ttf.fields)
          .filter((field: any) => field && field.project_id !== project_id);

        if (invalidProjectFields.length > 0) {
          console.log(`[${traceId}] Error: Task type fields don't belong to project`);
          return res.status(400).json({ 
            error: 'Task type fields must belong to the same project',
            traceId
          });
        }

        // Check required fields
        const requiredFields = taskTypeFields
          .map((ttf: any) => ttf.fields)
          .filter((field: any) => field && field.is_required);

        for (const requiredField of requiredFields) {
          const fieldValue = field_values.find(fv => fv.field_id === requiredField.id);
          if (!fieldValue || !fieldValue.value || fieldValue.value.trim() === '') {
            console.log(`[${traceId}] Error: Required field missing value - ${requiredField.name}`);
            return res.status(400).json({ 
              error: `Required field '${requiredField.name}' must have a value`,
              traceId
            });
          }
        }

        // Validate that all provided fields belong to the task type
        const assignedFieldIds = taskTypeFields.map((ttf: any) => ttf.field_id);
        const invalidFields = field_values.filter((fv: any) => !assignedFieldIds.includes(fv.field_id));
        
        if (invalidFields.length > 0) {
          console.log(`[${traceId}] Error: Fields not assigned to task type`);
          return res.status(400).json({ 
            error: 'All fields must be assigned to the task type',
            traceId
          });
        }
      }
      
      const insertPayload = {
        name,
        description: description || null,
        project_id,
        owner_id: user.id,
        task_type_id: task_type_id || null,
        state_id: state_id || null
      };
      
      console.log(`[${traceId}] Insert payload:`, insertPayload);

      const { data, error } = await supabase
        .from('tasks')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error creating task: ${error.message}`);
        return res.status(500).json({ 
          error: error.message,
          traceId
        });
      }

      // Insert field values if provided
      if (field_values && Array.isArray(field_values) && field_values.length > 0) {
        const fieldValuesToInsert = field_values.map(fv => ({
          task_id: data.id,
          field_id: fv.field_id,
          value: fv.value || null
        }));

        const { error: fieldValuesError } = await supabase
          .from('task_field_values')
          .insert(fieldValuesToInsert);

        if (fieldValuesError) {
          console.error(`[${traceId}] Error inserting field values: ${fieldValuesError.message}`);
          // Consider whether to rollback the task creation or continue
          // For now, we'll continue but log the error
        }
      }

      console.log(`[${traceId}] POST /api/tasks - Success, created task ${data.id}`);
      return sendApiResponse(res, 201, createApiResponse(traceId, 201, data));
    }
    
    // Handle unsupported methods
    return handleMethodNotAllowed(res, traceId, method || 'UNKNOWN', ['GET', 'POST']);
  } catch (error: any) {
    return handleUnhandledError(res, traceId, error);
  }
};

export default handler;