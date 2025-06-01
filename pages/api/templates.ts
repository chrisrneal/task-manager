/**
 * @fileoverview Templates API Endpoint
 * 
 * This API endpoint handles fetching available project templates,
 * providing users with pre-configured project structures for quick setup.
 * 
 * Supported Operations:
 * - GET: List all available project templates with their details
 * 
 * Key Features:
 * - Fetches templates with states, workflows, task types, and fields
 * - Row Level Security enforcement
 * - Comprehensive error handling with trace IDs
 * - Proper authentication and session validation
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Row Level Security policies enforced
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ProjectTemplateWithDetails } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/templates - Request received`);

  // Only allow GET requests
  if (method !== 'GET') {
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  }

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
    // Fetch all project templates
    const { data: templates, error: templatesError } = await supabase
      .from('project_templates')
      .select('*')
      .order('name', { ascending: true });

    if (templatesError) {
      console.error(`[${traceId}] Error fetching templates: ${templatesError.message}`);
      return res.status(500).json({ error: templatesError.message, traceId });
    }

    if (!templates || templates.length === 0) {
      console.log(`[${traceId}] No templates found`);
      return res.status(200).json({ data: [], traceId });
    }

    // For each template, fetch its related data
    const templatesWithDetails: ProjectTemplateWithDetails[] = [];

    for (const template of templates) {
      console.log(`[${traceId}] Fetching details for template: ${template.id}`);

      // Fetch template states
      const { data: states, error: statesError } = await supabase
        .from('template_states')
        .select('*')
        .eq('template_id', template.id)
        .order('position', { ascending: true });

      if (statesError) {
        console.error(`[${traceId}] Error fetching states for template ${template.id}: ${statesError.message}`);
        return res.status(500).json({ error: statesError.message, traceId });
      }

      // Fetch template workflows
      const { data: workflows, error: workflowsError } = await supabase
        .from('template_workflows')
        .select('*')
        .eq('template_id', template.id)
        .order('name', { ascending: true });

      if (workflowsError) {
        console.error(`[${traceId}] Error fetching workflows for template ${template.id}: ${workflowsError.message}`);
        return res.status(500).json({ error: workflowsError.message, traceId });
      }

      // Fetch template task types
      const { data: taskTypes, error: taskTypesError } = await supabase
        .from('template_task_types')
        .select('*')
        .eq('template_id', template.id)
        .order('name', { ascending: true });

      if (taskTypesError) {
        console.error(`[${traceId}] Error fetching task types for template ${template.id}: ${taskTypesError.message}`);
        return res.status(500).json({ error: taskTypesError.message, traceId });
      }

      // Fetch template fields
      const { data: fields, error: fieldsError } = await supabase
        .from('template_fields')
        .select('*')
        .eq('template_id', template.id)
        .order('name', { ascending: true });

      if (fieldsError) {
        console.error(`[${traceId}] Error fetching fields for template ${template.id}: ${fieldsError.message}`);
        return res.status(500).json({ error: fieldsError.message, traceId });
      }

      // Combine template with its details
      const templateWithDetails: ProjectTemplateWithDetails = {
        ...template,
        states: states || [],
        workflows: workflows || [],
        task_types: taskTypes || [],
        fields: fields || []
      };

      templatesWithDetails.push(templateWithDetails);
    }

    console.log(`[${traceId}] GET /api/templates - Success, returned ${templatesWithDetails.length} templates`);
    return res.status(200).json({ data: templatesWithDetails, traceId });

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