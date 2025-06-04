/**
 * @fileoverview Templates API Endpoint
 * 
 * This API endpoint handles project template management,
 * providing users with pre-configured project structures for quick setup.
 * 
 * Supported Operations:
 * - GET: List all available project templates with their details
 * - POST: Create a new template (admin only)
 * - PUT: Update an existing template (admin only)
 * - DELETE: Delete a template (admin only)
 * 
 * Key Features:
 * - Fetches templates with states, workflows, task types, and fields
 * - Admin-only template creation, modification, and deletion
 * - Template structure validation
 * - Row Level Security enforcement
 * - Comprehensive error handling with trace IDs
 * - Proper authentication and session validation
 * - Audit logging for template changes
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Admin role verification for write operations
 * - Row Level Security policies enforced
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ProjectTemplateWithDetails, TemplateState, TemplateWorkflow, TemplateTaskType, TemplateField } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Template validation schema
interface TemplateCreateRequest {
  name: string;
  description?: string;
  icon?: string;
  states: Omit<TemplateState, 'id' | 'template_id'>[];
  workflows: Omit<TemplateWorkflow, 'id' | 'template_id'>[];
  task_types: Omit<TemplateTaskType, 'id' | 'template_id'>[];
  fields: Omit<TemplateField, 'id' | 'template_id'>[];
}

interface TemplateUpdateRequest extends Partial<TemplateCreateRequest> {
  id: string;
}

// Validation functions
const validateTemplateStructure = (template: TemplateCreateRequest): string[] => {
  const errors: string[] = [];
  
  if (!template.name || template.name.trim().length === 0) {
    errors.push('Template name is required');
  }
  
  if (!template.states || template.states.length === 0) {
    errors.push('Template must have at least one state');
  }
  
  if (!template.workflows || template.workflows.length === 0) {
    errors.push('Template must have at least one workflow');
  }
  
  // Validate state positions are unique and sequential
  if (template.states) {
    const positions = template.states.map(s => s.position);
    const uniquePositions = new Set(positions);
    if (positions.length !== uniquePositions.size) {
      errors.push('State positions must be unique');
    }
  }
  
  // Validate field input types
  if (template.fields) {
    const validInputTypes = ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'];
    for (const field of template.fields) {
      if (!validInputTypes.includes(field.input_type)) {
        errors.push(`Invalid field input type: ${field.input_type}`);
      }
      if ((field.input_type === 'select' || field.input_type === 'radio') && (!field.options || field.options.length === 0)) {
        errors.push(`Field ${field.name} of type ${field.input_type} must have options`);
      }
    }
  }
  
  return errors;
};

// Check if user is admin
const checkAdminRole = async (supabase: any): Promise<boolean> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  
  // Get user metadata or claims to check admin role
  // This assumes the admin role is set in the JWT claims
  return user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/templates - Request received`);

  // Only allow GET, POST, PUT, DELETE requests
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method!)) {
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
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

  // For write operations, check admin role
  if (['POST', 'PUT', 'DELETE'].includes(method!)) {
    const isAdmin = await checkAdminRole(supabase);
    if (!isAdmin) {
      console.log(`[${traceId}] Error: Admin role required for ${method} operation`);
      return res.status(403).json({ 
        error: 'Admin role required for this operation',
        traceId
      });
    }
  }

  try {
    switch (method) {
      case 'GET':
        return await handleGetTemplates(req, res, supabase, traceId);
      case 'POST':
        return await handleCreateTemplate(req, res, supabase, traceId, user.id);
      case 'PUT':
        return await handleUpdateTemplate(req, res, supabase, traceId, user.id);
      case 'DELETE':
        return await handleDeleteTemplate(req, res, supabase, traceId, user.id);
      default:
        return res.status(405).json({ error: 'Method not allowed', traceId });
    }
  } catch (error: any) {
    console.error(`[${traceId}] Error: ${error.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      traceId
    });
  }
};
// Handler functions
const handleGetTemplates = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string) => {
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
};

const handleCreateTemplate = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, userId: string) => {
  const templateData: TemplateCreateRequest = req.body;
  
  // Validate template structure
  const validationErrors = validateTemplateStructure(templateData);
  if (validationErrors.length > 0) {
    console.log(`[${traceId}] Template validation failed: ${validationErrors.join(', ')}`);
    return res.status(400).json({ 
      error: 'Template validation failed',
      details: validationErrors,
      traceId
    });
  }

  // Start transaction to create template and related data
  const { data: template, error: templateError } = await supabase
    .from('project_templates')
    .insert({
      name: templateData.name,
      description: templateData.description,
      icon: templateData.icon
    })
    .select()
    .single();

  if (templateError) {
    console.error(`[${traceId}] Error creating template: ${templateError.message}`);
    return res.status(500).json({ error: templateError.message, traceId });
  }

  const templateId = template.id;
  console.log(`[${traceId}] Created template ${templateId} - ${templateData.name}`);

  try {
    // Create states
    if (templateData.states.length > 0) {
      const statesData = templateData.states.map(state => ({
        ...state,
        template_id: templateId
      }));
      
      const { error: statesError } = await supabase
        .from('template_states')
        .insert(statesData);
        
      if (statesError) throw statesError;
    }

    // Create workflows
    const workflowIds: { [name: string]: string } = {};
    if (templateData.workflows.length > 0) {
      const workflowsData = templateData.workflows.map(workflow => ({
        ...workflow,
        template_id: templateId
      }));
      
      const { data: createdWorkflows, error: workflowsError } = await supabase
        .from('template_workflows')
        .insert(workflowsData)
        .select();
        
      if (workflowsError) throw workflowsError;
      
      // Map workflow names to IDs for task types
      createdWorkflows.forEach((wf: any) => {
        workflowIds[wf.name] = wf.id;
      });
    }

    // Create task types
    if (templateData.task_types.length > 0) {
      const taskTypesData = templateData.task_types.map(taskType => ({
        ...taskType,
        template_id: templateId,
        workflow_id: workflowIds[taskType.workflow_id] || taskType.workflow_id // Handle workflow reference
      }));
      
      const { error: taskTypesError } = await supabase
        .from('template_task_types')
        .insert(taskTypesData);
        
      if (taskTypesError) throw taskTypesError;
    }

    // Create fields
    if (templateData.fields.length > 0) {
      const fieldsData = templateData.fields.map(field => ({
        ...field,
        template_id: templateId
      }));
      
      const { error: fieldsError } = await supabase
        .from('template_fields')
        .insert(fieldsData);
        
      if (fieldsError) throw fieldsError;
    }

    // Log the creation for audit trail
    console.log(`[${traceId}] Template created successfully by user ${userId}: ${templateData.name} (${templateId})`);

    return res.status(201).json({ 
      data: { id: templateId, ...template },
      message: 'Template created successfully',
      traceId
    });

  } catch (error: any) {
    // If any related data creation fails, delete the template
    console.error(`[${traceId}] Error creating template data: ${error.message}`);
    await supabase.from('project_templates').delete().eq('id', templateId);
    return res.status(500).json({ error: error.message, traceId });
  }
};

const handleUpdateTemplate = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, userId: string) => {
  const { id } = req.query;
  const updateData: Partial<TemplateCreateRequest> = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Template ID is required', traceId });
  }

  // Check if template exists
  const { data: existingTemplate, error: fetchError } = await supabase
    .from('project_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingTemplate) {
    return res.status(404).json({ error: 'Template not found', traceId });
  }

  // Validate if structure data is provided
  if (updateData.states || updateData.workflows || updateData.task_types || updateData.fields) {
    const fullTemplate = {
      name: updateData.name || existingTemplate.name,
      description: updateData.description || existingTemplate.description,
      icon: updateData.icon || existingTemplate.icon,
      states: updateData.states || [],
      workflows: updateData.workflows || [],
      task_types: updateData.task_types || [],
      fields: updateData.fields || []
    };
    
    const validationErrors = validateTemplateStructure(fullTemplate);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Template validation failed',
        details: validationErrors,
        traceId
      });
    }
  }

  // Update basic template info
  const { error: updateError } = await supabase
    .from('project_templates')
    .update({
      name: updateData.name,
      description: updateData.description,
      icon: updateData.icon,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (updateError) {
    console.error(`[${traceId}] Error updating template: ${updateError.message}`);
    return res.status(500).json({ error: updateError.message, traceId });
  }

  // Log the update for audit trail
  console.log(`[${traceId}] Template updated successfully by user ${userId}: ${id}`);

  return res.status(200).json({ 
    message: 'Template updated successfully',
    traceId
  });
};

const handleDeleteTemplate = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, userId: string) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Template ID is required', traceId });
  }

  // Check if template exists
  const { data: existingTemplate, error: fetchError } = await supabase
    .from('project_templates')
    .select('name')
    .eq('id', id)
    .single();

  if (fetchError || !existingTemplate) {
    return res.status(404).json({ error: 'Template not found', traceId });
  }

  // Delete template (cascade will handle related data)
  const { error: deleteError } = await supabase
    .from('project_templates')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error(`[${traceId}] Error deleting template: ${deleteError.message}`);
    return res.status(500).json({ error: deleteError.message, traceId });
  }

  // Log the deletion for audit trail
  console.log(`[${traceId}] Template deleted successfully by user ${userId}: ${existingTemplate.name} (${id})`);

  return res.status(200).json({ 
    message: 'Template deleted successfully',
    traceId
  });
};

export default handler;