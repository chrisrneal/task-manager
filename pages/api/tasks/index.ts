/**
 * @fileoverview Tasks Collection API - Task Listing and Creation
 * 
 * This API endpoint manages task collections within projects, enabling:
 * - Listing all tasks for a specific project
 * - Creating new tasks with custom field values
 * - Validating custom field requirements during task creation
 * - Ensuring project access permissions for all operations
 * 
 * The endpoint integrates with the custom fields system to support
 * structured data capture during task creation.
 * 
 * @route GET  /api/tasks?projectId={id} - List all tasks for a project
 * @route POST /api/tasks - Create a new task with optional field values
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Tasks Collection API Handler - Manages task listing and creation
 * 
 * Handles GET and POST operations for task collections with comprehensive
 * validation including project access, custom fields, and required field constraints.
 * 
 * @param req - Next.js API request object
 * @param req.query.projectId - Project ID for listing tasks (GET requests)
 * @param req.body.name - Task name (required for POST requests)
 * @param req.body.description - Task description (optional)
 * @param req.body.project_id - Project ID for the new task (required for POST)
 * @param req.body.task_type_id - Task type ID for field validation (optional)
 * @param req.body.state_id - Initial state ID for the task (optional)
 * @param req.body.field_values - Array of custom field values (optional)
 * @param res - Next.js API response object
 * @returns JSON response with task data, validation errors, or operation status
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/tasks - Request received`);

  // Extract user token from request
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  if (!token) {
    console.log(`[${traceId}] Error: No authorization token provided`);
    return res.status(401).json({ 
      error: 'Authentication required',
      traceId
    });
  }

  // Create a Supabase client with the user's token for RLS
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Verify the user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log(`[${traceId}] Error: Invalid authentication - ${userError?.message}`);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  try {
    // Handle GET request - List all tasks for a project
    if (method === 'GET') {
      const { projectId } = req.query;
      
      if (!projectId) {
        console.log(`[${traceId}] Error: Missing required query parameter 'projectId'`);
        return res.status(400).json({ 
          error: 'Project ID is required',
          traceId
        });
      }

      // Verify user has access to the project before listing tasks
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (projectError) {
        if (projectError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Project not found or access denied - ${projectId}`);
          return res.status(404).json({ 
            error: 'Project not found or access denied',
            traceId
          });
        }
        throw projectError;
      }

      // Retrieve all tasks for the project ordered by creation date (newest first)
      // Note: This endpoint returns basic task data without field values for performance
      // Use GET /api/tasks/[taskId] to get a task with its field values
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[${traceId}] Error fetching tasks: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] GET /api/tasks - Success, returned ${data.length} tasks`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new task with optional custom field values
    if (method === 'POST') {
      const { name, description, project_id, task_type_id, state_id, field_values } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      
      if (!name || !project_id) {
        console.log(`[${traceId}] Error: Missing required fields`);
        return res.status(400).json({ 
          error: 'Task name and project ID are required',
          traceId
        });
      }

      // Verify user has access to the project before creating tasks
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .eq('user_id', user.id)
        .single();

      if (projectError) {
        if (projectError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Project not found or access denied - ${project_id}`);
          return res.status(404).json({ 
            error: 'Project not found or access denied',
            traceId
          });
        }
        throw projectError;
      }

      // Validate custom fields if task type and field values are provided
      // This ensures proper field validation during task creation
      if (task_type_id && field_values && Array.isArray(field_values)) {
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
          .eq('task_type_id', task_type_id);

        if (ttfError) {
          console.error(`[${traceId}] Error fetching task type fields: ${ttfError.message}`);
          return res.status(500).json({ 
            error: 'Failed to validate task type fields',
            traceId
          });
        }

        // Validate that all fields belong to the same project as the task
        // This ensures project scope integrity for field assignments
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

        // Validate required fields have values
        // All required fields must have non-empty values during task creation
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

        // Validate that all provided fields are assigned to the task type
        // This prevents setting values for fields not configured for this task type
        const assignedFieldIds = taskTypeFields.map(ttf => ttf.field_id);
        const invalidFields = field_values.filter(fv => !assignedFieldIds.includes(fv.field_id));
        
        if (invalidFields.length > 0) {
          console.log(`[${traceId}] Error: Fields not assigned to task type`);
          return res.status(400).json({ 
            error: 'All fields must be assigned to the task type',
            traceId
          });
        }
      }
      
      // Prepare task data for insertion
      const insertPayload = {
        name,
        description: description || null,
        project_id,
        owner_id: user.id,
        task_type_id: task_type_id || null,
        state_id: state_id || null
      };
      
      console.log(`[${traceId}] Insert payload:`, insertPayload);

      // Create the new task in the database
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

      // Insert custom field values if provided
      // This happens after task creation to ensure referential integrity
      if (field_values && Array.isArray(field_values) && field_values.length > 0) {
        // Prepare field values for insertion with the new task ID
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
          // For now, we'll continue but log the error to allow task creation
          // even if field values fail (graceful degradation)
        }
      }

      console.log(`[${traceId}] POST /api/tasks - Success, created task ${data.id}`);
      return res.status(201).json({ data, traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  } catch (error: any) {
    console.error(`[${traceId}] Error: ${error.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      traceId
    });
  }
};

export default handler;