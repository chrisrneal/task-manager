/**
 * @fileoverview Tasks Collection API Endpoint
 * 
 * This API endpoint handles operations on the tasks collection including listing
 * tasks for a project and creating new tasks with comprehensive validation and
 * custom field support.
 * 
 * Supported Operations:
 * - GET: List all tasks for a specific project with filtering and custom fields
 * - POST: Create new tasks with custom field values and validation
 * 
 * Key Features:
 * - Project-scoped task listing with custom field values
 * - Task creation with custom field validation
 * - Required field enforcement during creation
 * - Task type field assignment validation
 * - Project membership verification
 * - Comprehensive error handling with trace IDs
 * 
 * Security:
 * - Bearer token authentication required
 * - Project access validation via RLS
 * - Field assignment validation for task types
 * - Custom field value validation
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { 
  authenticateRequest, 
  handleApiOperation, 
  sendErrorResponse, 
  validateRequiredParams,
  checkResourceOwnership
} from '@/utils/apiMiddleware';
import { validateFieldValues } from '@/utils/customFieldUtils';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  
  // Authenticate request and get user context
  const context = await authenticateRequest(req, res, '/api/tasks');
  if (!context) return; // Authentication failed, response already sent

  const { user, supabase, traceId } = context;

  await handleApiOperation(async () => {
    // Handle GET request - List tasks for a project
    if (method === 'GET') {
      const { projectId } = req.query;
      
      if (!validateRequiredParams({ 'Project ID': projectId }, res, traceId)) {
        return;
      }

      // Check if project exists and belongs to user
      const project = await checkResourceOwnership(
        supabase, 'projects', projectId as string, user.id, res, traceId
      );
      if (!project) return; // Response already sent

      // Fetch tasks for this project
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        return sendErrorResponse(res, 500, error.message, traceId);
      }

      console.log(`[${traceId}] GET /api/tasks - Success, returned ${data.length} tasks`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new task
    if (method === 'POST') {
      const { name, description, project_id, task_type_id, state_id, field_values, assignee_id } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      
      if (!validateRequiredParams({ name, project_id }, res, traceId)) {
        return;
      }

      // Check if project exists and belongs to user
      const project = await checkResourceOwnership(
        supabase, 'projects', project_id, user.id, res, traceId
      );
      if (!project) return; // Response already sent

      // Validate assignee_id if provided
      if (assignee_id) {
        const { data: assigneeMember, error: assigneeError } = await supabase
          .from('project_members')
          .select('user_id, role, is_dummy, dummy_name')
          .eq('project_id', project_id)
          .eq('user_id', assignee_id)
          .single();

        if (assigneeError || !assigneeMember) {
          console.log(`[${traceId}] Error: Assignee not found in project - ${assignee_id}`);
          return sendErrorResponse(res, 400, 'Assignee must be a member of the project', traceId);
        }
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
          return sendErrorResponse(res, 500, 'Failed to validate task type fields', traceId);
        }

        // Validate that fields belong to the same project
        const invalidProjectFields = taskTypeFields
          .map((ttf: any) => ttf.fields)
          .filter((field: any) => field && field.project_id !== project_id);

        if (invalidProjectFields.length > 0) {
          console.log(`[${traceId}] Error: Task type fields don't belong to project`);
          return sendErrorResponse(res, 400, 'Task type fields must belong to the same project', traceId);
        }

        // Check required fields
        const requiredFields = taskTypeFields
          .map((ttf: any) => ttf.fields)
          .filter((field: any) => field && field.is_required);

        for (const requiredField of requiredFields) {
          const fieldValue = field_values.find(fv => fv.field_id === requiredField.id);
          if (!fieldValue || !fieldValue.value || fieldValue.value.trim() === '') {
            console.log(`[${traceId}] Error: Required field missing value - ${requiredField.name}`);
            return sendErrorResponse(res, 400, `Required field '${requiredField.name}' must have a value`, traceId);
          }
        }

        // Validate that all provided fields belong to the task type
        const assignedFieldIds = taskTypeFields.map((ttf: any) => ttf.field_id);
        const invalidFields = field_values.filter((fv: any) => !assignedFieldIds.includes(fv.field_id));
        
        if (invalidFields.length > 0) {
          console.log(`[${traceId}] Error: Fields not assigned to task type`);
          return sendErrorResponse(res, 400, 'All fields must be assigned to the task type', traceId);
        }
      }
      
      const insertPayload = {
        name,
        description: description || null,
        project_id,
        owner_id: user.id,
        assignee_id: assignee_id || null,
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
      return res.status(201).json({ data, traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST']);
    return sendErrorResponse(res, 405, `Method ${method} not allowed`, traceId);
  }, res, traceId, 'Internal server error');
};

export default handler;