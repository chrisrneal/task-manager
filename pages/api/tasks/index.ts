import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
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
    // Handle GET request - List tasks for a project
    if (method === 'GET') {
      const { projectId } = req.query;
      
      if (!projectId) {
        console.log(`[${traceId}] Error: Missing required query parameter 'projectId'`);
        return res.status(400).json({ 
          error: 'Project ID is required',
          traceId
        });
      }

      // First check if project exists and belongs to user
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

      // Fetch tasks for this project
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
    
    // Handle POST request - Create a new task
    if (method === 'POST') {
      const { name, description, project_id, task_type_id, state_id, field_values, assignee_id } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      
      if (!name || !project_id) {
        console.log(`[${traceId}] Error: Missing required fields`);
        return res.status(400).json({ 
          error: 'Task name and project ID are required',
          traceId
        });
      }

      // First check if project exists and belongs to user
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
          return res.status(400).json({ 
            error: 'Assignee must be a member of the project',
            traceId
          });
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