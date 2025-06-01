/**
 * @fileoverview Task Management API Endpoint
 * 
 * This API endpoint handles CRUD operations for individual tasks with comprehensive
 * support for custom fields and workflow state management. It provides secure,
 * validated operations with detailed error handling and logging.
 * 
 * Supported Operations:
 * - GET: Retrieve task details with custom field values
 * - PUT: Update task properties, custom fields, and workflow states
 * - DELETE: Remove tasks with proper authorization checks
 * 
 * Key Features:
 * - Custom field validation and enforcement
 * - Workflow state transition validation
 * - Required field enforcement for task types
 * - Row-level security with user ownership validation
 * - Comprehensive error handling with trace IDs
 * - Assignee validation within project membership
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Task ownership verification (owner_id check)
 * - Project membership validation for assignees
 * - Field assignment validation for task types
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
  checkResourceOwnership,
  ValidationError
} from '@/utils/apiMiddleware';
import { validateFieldValues } from '@/utils/customFieldUtils';

/**
 * Task API Handler
 * 
 * Handles HTTP requests for individual task operations. Supports GET, PUT, and DELETE
 * methods with comprehensive validation, security checks, and error handling.
 * 
 * @param {NextApiRequest} req - Next.js API request object
 * @param {NextApiResponse} res - Next.js API response object
 * @returns {Promise<void>} Handles response directly, no return value
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { taskId } = req.query;
  
  // Authenticate request and get user context
  const context = await authenticateRequest(req, res, `/api/tasks/${taskId}`);
  if (!context) return; // Authentication failed, response already sent

  const { user, supabase, traceId } = context;

  try {
    console.log(`[${traceId}] Starting task operation: ${method} /api/tasks/${taskId}`);
    await handleApiOperation(async () => {
      /**
       * GET /api/tasks/[taskId]
       * 
       * Retrieves a single task with its custom field values. Includes authorization
       * check to ensure user owns the task. Returns task data with populated field
       * values including field definitions for UI rendering.
       */
      if (method === 'GET') {
        // Fetch task with ownership verification (RLS ensures user can only see own tasks)
        const { data: task, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .eq('owner_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log(`[${traceId}] Error: Task not found - ${taskId}`);
            return res.status(404).json({ 
              error: 'Task not found',
              traceId
            });
          }
          throw error;
        }

        // Fetch associated custom field values with field definitions
        // This provides all data needed for field rendering in the UI
        const { data: fieldValues, error: fieldValuesError } = await supabase
          .from('task_field_values')
          .select(`
            *,
            fields (
              id,
              name,
              input_type,
              is_required
            )
          `)
          .eq('task_id', taskId);

        if (fieldValuesError) {
          console.error(`[${traceId}] Error fetching field values: ${fieldValuesError.message}`);
          // Continue without field values rather than failing the entire request
        }

        // Combine task data with field values for complete task representation
        const taskWithFieldValues = {
          ...task,
          field_values: fieldValues || []
        };
        
        console.log(`[${traceId}] GET /api/tasks/${taskId} - Success`);
        return res.status(200).json({ data: taskWithFieldValues, traceId });
      }
      
      /**
       * PUT /api/tasks/[taskId]
       * 
       * Updates a task with comprehensive validation including:
       * - Basic field validation (name required)
       * - Task ownership verification
       * - Assignee validation (must be project member)
       * - Custom field validation (type-specific, required fields)
       * - Workflow state transition validation
       * - Field assignment validation for task types
       */
      if (method === 'PUT') {
        const { name, description, status, priority, due_date, task_type_id, state_id, field_values, assignee_id } = req.body;
        
        console.log(`[${traceId}] PUT request body:`, {
          name: name,
          description: description ? 'provided' : 'not provided',
          status: status,
          priority: priority,
          due_date: due_date,
          task_type_id: task_type_id,
          state_id: state_id,
          field_values: field_values ? `array of ${field_values.length} items` : 'not provided',
          assignee_id: assignee_id
        });
        
        // Validate required fields
        console.log(`[${traceId}] Validating required fields...`);
        if (!validateRequiredParams({ name }, res, traceId)) {
          console.log(`[${traceId}] Required field validation failed, returning early`);
          return;
        }

        // Verify task exists and user has permission to modify it
        const existingTask = await checkResourceOwnership(
          supabase, 'tasks', taskId as string, user.id, res, traceId, 'Task not found or access denied', 'owner_id'
        );
        if (!existingTask) return; // Response already sent

        // Validate assignee is a member of the task's project (if assignee provided)
        if (assignee_id !== undefined && assignee_id !== null) {
          const { data: assigneeMember, error: assigneeError } = await supabase
            .from('project_members')
            .select('user_id, role, is_dummy, dummy_name')
            .eq('project_id', existingTask.project_id)
            .eq('user_id', assignee_id)
            .single();

          if (assigneeError || !assigneeMember) {
            console.log(`[${traceId}] Error: Assignee not found in project - ${assignee_id}`);
            throw new ValidationError('Assignee must be a member of the project', 400, traceId);
          }
        }

        // Custom Field Validation - comprehensive validation of field values
        // if task has a type and custom field values are provided
        const finalTaskTypeId = task_type_id !== undefined ? task_type_id : existingTask.task_type_id;
        
        if (finalTaskTypeId && field_values && Array.isArray(field_values)) {
          // Get all fields assigned to this task type with their definitions
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
            .eq('task_type_id', finalTaskTypeId);

          if (ttfError) {
            console.error(`[${traceId}] Error fetching task type fields: ${ttfError.message}`);
            throw ttfError; // Re-throw Supabase error to be handled as 500 by handleApiOperation
          }

          // Validate Required Fields - ensure all required fields have values
          const requiredFields = taskTypeFields
            .map((ttf: any) => ttf.fields)
            .filter((field: any) => field && field.is_required);

          for (const requiredField of requiredFields) {
            const fieldValue = field_values.find(fv => fv.field_id === requiredField.id);
            if (!fieldValue || !fieldValue.value || fieldValue.value.trim() === '') {
              console.log(`[${traceId}] Error: Required field missing value - ${requiredField.name}`);
              throw new ValidationError(`Required field '${requiredField.name}' must have a value`, 400, traceId);
            }
          }

          // Validate Field Assignment - ensure fields belong to the task type
          const assignedFieldIds = taskTypeFields.map((ttf: any) => ttf.field_id);
          const invalidFields = field_values.filter(fv => !assignedFieldIds.includes(fv.field_id));
          
          if (invalidFields.length > 0) {
            console.log(`[${traceId}] Error: Fields not assigned to task type`);
            throw new ValidationError('All fields must be assigned to the task type', 400, traceId);
          }
        }

        // Workflow State Transition Validation - verify state changes are allowed BEFORE updating
        if (state_id && state_id !== existingTask.state_id && finalTaskTypeId) {
          console.log(`[${traceId}] State transition validation: ${existingTask.state_id} -> ${state_id}`);
          
          // Get the workflow ID associated with the task type
          const { data: taskType, error: taskTypeError } = await supabase
            .from('task_types')
            .select('workflow_id')
            .eq('id', finalTaskTypeId)
            .single();

          if (taskTypeError) {
            console.error(`[${traceId}] Error fetching task type: ${taskTypeError.message}`);
            throw taskTypeError;
          }
          
          console.log(`[${traceId}] Task type workflow_id: ${taskType?.workflow_id}`);
          
          if (taskType?.workflow_id) {
            // Get all valid transitions for this workflow
            console.log(`[${traceId}] Fetching transitions for workflow: ${taskType.workflow_id}`);
            const { data: transitions, error: transitionsError } = await supabase
              .from('workflow_transitions')
              .select('*')
              .eq('workflow_id', taskType.workflow_id);
              
            if (transitionsError) {
              console.error(`[${traceId}] Error fetching transitions: ${transitionsError.message}`);
              throw transitionsError;
            }
            
            console.log(`[${traceId}] Found ${transitions?.length || 0} transitions:`, transitions);
            
            // If no transitions are defined, reject the state change
            if (!transitions || transitions.length === 0) {
              console.log(`[${traceId}] No transitions defined for workflow, rejecting state change`);
              throw new ValidationError('No state transitions are configured for this workflow', 400, traceId);
            }
            
            // Normalize state IDs for comparison (convert to strings and handle null/undefined)
            const fromStateStr = existingTask.state_id ? String(existingTask.state_id).trim() : null;
            const toStateStr = state_id ? String(state_id).trim() : null;
            
            console.log(`[${traceId}] Normalized state comparison: '${fromStateStr}' -> '${toStateStr}'`);
            
            // Validate the requested state transition is allowed
            const isValidTransition = transitions.some((t: any) => {
              const transitionFromState = t.from_state ? String(t.from_state).trim() : null;
              const transitionToState = t.to_state ? String(t.to_state).trim() : null;
              
              const directMatch = transitionFromState === fromStateStr && transitionToState === toStateStr;
              const universalMatch = transitionFromState === null && transitionToState === toStateStr;
              
              console.log(`[${traceId}] Checking transition: from='${transitionFromState}', to='${transitionToState}', direct=${directMatch}, universal=${universalMatch}`);
              return directMatch || universalMatch;
            });
            
            console.log(`[${traceId}] Is valid transition: ${isValidTransition}`);
            
            if (!isValidTransition) {
              console.log(`[${traceId}] Invalid state transition from '${fromStateStr}' to '${toStateStr}'`);
              
              // Provide helpful error message with available transitions
              const availableTransitions = transitions
                .filter((t: any) => t.from_state === fromStateStr || t.from_state === null)
                .map((t: any) => t.to_state)
                .filter(Boolean);
              
              const errorMessage = availableTransitions.length > 0
                ? `Invalid state transition. Available transitions from current state: ${availableTransitions.join(', ')}`
                : 'Invalid state transition. No valid transitions available from current state.';
              
              throw new ValidationError(errorMessage, 400, traceId);
            }
          } else {
            console.log(`[${traceId}] Task type has no workflow, allowing all state transitions`);
          }
        } else {
          console.log(`[${traceId}] State transition validation skipped: state_id=${state_id}, existing_state=${existingTask.state_id}, finalTaskTypeId=${finalTaskTypeId}`);
        }

        // Update the task with provided values, preserving existing values for unspecified fields
        const { data, error } = await supabase
          .from('tasks')
          .update({ 
            name, 
            description: description || null,
            assignee_id: assignee_id !== undefined ? assignee_id : existingTask.assignee_id,
            status: status || existingTask.status,
            priority: priority || existingTask.priority,
            due_date: due_date || existingTask.due_date,
            task_type_id: finalTaskTypeId,
            state_id: state_id !== undefined ? state_id : existingTask.state_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId)
          .eq('owner_id', user.id)
          .select();

        if (error) throw error;

        // Update Custom Field Values - upsert field values for the task
        if (field_values && Array.isArray(field_values) && field_values.length > 0) {
          const fieldValuesToUpsert = field_values.map(fv => ({
            task_id: taskId,
            field_id: fv.field_id,
            value: fv.value || null
          }));

          // Use upsert to handle both creation and updates of field values
          const { error: fieldValuesError } = await supabase
            .from('task_field_values')
            .upsert(fieldValuesToUpsert, {
              onConflict: 'task_id,field_id' // Handle duplicate task/field combinations
            });

          if (fieldValuesError) {
            console.error(`[${traceId}] Error updating field values: ${fieldValuesError.message}`);
            // Continue despite field values error to maintain task update success
          }
        }
        
        console.log(`[${traceId}] PUT /api/tasks/${taskId} - Success, updated task`);
        return res.status(200).json({ data: data[0], traceId });
      }
      
      /**
       * DELETE /api/tasks/[taskId]
       * 
       * Deletes a task after verifying user ownership. This operation is permanent
       * and will cascade to related field values due to database constraints.
       */
      if (method === 'DELETE') {
        // Verify task exists and user has permission to delete it
        const existingTask = await checkResourceOwnership(
          supabase, 'tasks', taskId as string, user.id, res, traceId, 'Task not found or access denied', 'owner_id'
        );
        if (!existingTask) return; // Response already sent

        // Perform deletion (cascades to field values and file references)
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('owner_id', user.id);

        if (error) throw error;
        
        console.log(`[${traceId}] DELETE /api/tasks/${taskId} - Success, deleted task`);
        return res.status(200).json({ success: true, traceId });
      }
      
      // Handle unsupported HTTP methods
      console.log(`[${traceId}] Error: Method ${method} not allowed`);
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return sendErrorResponse(res, 405, `Method ${method} not allowed`, traceId);
    }, res, traceId, 'Internal server error');
  } catch (error: any) {
    console.log(`[${traceId}] Caught error in task endpoint: ${error.constructor.name}: ${error.message}`);
    console.log(`[${traceId}] Error instanceof ValidationError: ${error instanceof ValidationError}`);
    
    // Handle validation errors with specific status codes and messages
    if (error instanceof ValidationError) {
      console.log(`[${traceId}] Handling ValidationError: ${error.statusCode} - ${error.message}`);
      console.log(`[${traceId}] ValidationError traceId: ${error.traceId}`);
      
      // Check if response has already been sent
      if (res.headersSent) {
        console.error(`[${traceId}] WARNING: Cannot send ValidationError response, headers already sent`);
        return;
      }
      
      const errorResponse = {
        error: error.message,
        traceId: error.traceId || traceId
      };
      
      console.log(`[${traceId}] Sending ValidationError response:`, errorResponse);
      
      return res.status(error.statusCode).json(errorResponse);
    }
    
    console.log(`[${traceId}] Re-throwing non-ValidationError: ${error.constructor.name}`);
    // Re-throw unexpected errors to be handled by handleApiOperation
    throw error;
  }
};

export default handler;