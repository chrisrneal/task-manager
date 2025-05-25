import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Field, FieldInputType } from '@/types/database';
import { isValidFieldInputType, validateFieldName } from '../../../../utils/customFieldUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId } = req.query;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects/${projectId}/fields - Request received`);

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

  if (!projectId || typeof projectId !== 'string') {
    console.log(`[${traceId}] Error: Invalid project ID`);
    return res.status(400).json({ 
      error: 'Project ID is required',
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
    // Handle GET request - List all fields for a project
    if (method === 'GET') {
      // First verify user has access to the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.log(`[${traceId}] Error: Project not found or access denied - ${projectId}`);
        return res.status(404).json({ 
          error: 'Project not found or access denied',
          traceId
        });
      }

      const { data: fields, error } = await supabase
        .from('fields')
        .select(`
          *,
          task_type_fields (
            task_type_id
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[${traceId}] Error fetching fields: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to fetch fields',
          traceId
        });
      }

      // Transform the data to include task_type_ids array
      const fieldsWithAssignments = fields.map(field => ({
        ...field,
        task_type_ids: field.task_type_fields?.map((ttf: any) => ttf.task_type_id) || []
      }));

      console.log(`[${traceId}] GET /api/projects/${projectId}/fields - Success: ${fields.length} fields`);
      return res.status(200).json({ 
        data: fieldsWithAssignments,
        traceId
      });
    }

    // Handle POST request - Create a new field
    if (method === 'POST') {
      const { name, input_type, is_required, options, default_value } = req.body;

      if (!name || !input_type) {
        console.log(`[${traceId}] Error: Missing required fields`);
        return res.status(400).json({ 
          error: 'Name and input_type are required',
          traceId
        });
      }

      // Validate field name
      const nameValidationError = validateFieldName(name);
      if (nameValidationError) {
        console.log(`[${traceId}] Error: Invalid field name - ${nameValidationError}`);
        return res.status(400).json({ 
          error: nameValidationError,
          traceId
        });
      }

      // Validate input_type
      if (!isValidFieldInputType(input_type)) {
        console.log(`[${traceId}] Error: Invalid input_type - ${input_type}`);
        return res.status(400).json({ 
          error: 'Invalid input_type. Must be one of: text, textarea, number, date, select, checkbox, radio',
          traceId
        });
      }

      // First verify user has access to the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.log(`[${traceId}] Error: Project not found or access denied - ${projectId}`);
        return res.status(404).json({ 
          error: 'Project not found or access denied',
          traceId
        });
      }

      // Check for duplicate field names in the project
      const { data: existingFields, error: duplicateError } = await supabase
        .from('fields')
        .select('id, name')
        .eq('project_id', projectId)
        .ilike('name', name.trim());

      if (duplicateError) {
        console.error(`[${traceId}] Error checking for duplicate fields: ${duplicateError.message}`);
        return res.status(500).json({ 
          error: 'Failed to validate field name',
          traceId
        });
      }

      if (existingFields && existingFields.length > 0) {
        console.log(`[${traceId}] Error: Field name already exists - ${name}`);
        return res.status(409).json({ 
          error: 'A field with this name already exists in the project',
          traceId
        });
      }

      const { data: field, error } = await supabase
        .from('fields')
        .insert([{
          project_id: projectId,
          name: name.trim(),
          input_type,
          is_required: Boolean(is_required),
          // Note: options and default_value would need additional columns in the DB schema
          // For now, we'll store them as JSON in a text field if needed
        }])
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error creating field: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to create field',
          traceId
        });
      }

      console.log(`[${traceId}] POST /api/projects/${projectId}/fields - Success: ${field.id}`);
      return res.status(201).json({ 
        data: field,
        traceId
      });
    }

    // Method not allowed
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    return res.status(405).json({ 
      error: 'Method not allowed',
      traceId
    });

  } catch (err: any) {
    console.error(`[${traceId}] Unexpected error: ${err.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

export default handler;
