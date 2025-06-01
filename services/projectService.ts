/**
 * @fileoverview Project Service
 * 
 * This service provides business logic for project operations,
 * including template application and project initialization.
 * 
 * Key Features:
 * - Apply project templates to new projects
 * - Initialize project structure from templates
 * - Handle template data copying and transformation
 * - Maintain referential integrity during template application
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  ProjectTemplateWithDetails, 
  Project,
  ProjectState,
  Workflow,
  WorkflowStep,
  WorkflowTransition,
  TaskType,
  Field,
  TaskTypeField
} from '@/types/database';

/**
 * Interface for template application result
 */
export interface TemplateApplicationResult {
  success: boolean;
  project?: Project;
  error?: string;
  details?: any;
}

/**
 * Applies a project template to a newly created project
 * @param supabase - Authenticated Supabase client
 * @param project - The project to apply the template to
 * @param template - The template to apply
 * @param traceId - Trace ID for logging
 * @returns Result of the template application
 */
export async function applyTemplateToProject(
  supabase: SupabaseClient,
  project: Project,
  template: ProjectTemplateWithDetails,
  traceId: string
): Promise<TemplateApplicationResult> {
  
  console.log(`[${traceId}] Applying template ${template.id} to project ${project.id}`);

  try {
    // Step 1: Create project states from template states
    const stateIdMap = new Map<string, string>();
    if (template.states.length > 0) {
      const projectStates = template.states.map(state => ({
        project_id: project.id,
        name: state.name,
        position: state.position
      }));

      const { data: createdStates, error: statesError } = await supabase
        .from('project_states')
        .insert(projectStates)
        .select();

      if (statesError) {
        console.error(`[${traceId}] Error creating project states: ${statesError.message}`);
        return { success: false, error: 'Failed to create project states', details: statesError };
      }

      // Build mapping from template state ID to new project state ID
      for (let i = 0; i < template.states.length; i++) {
        stateIdMap.set(template.states[i].id, createdStates[i].id);
      }
      
      console.log(`[${traceId}] Created ${createdStates.length} project states`);
    }

    // Step 2: Create workflows from template workflows
    const workflowIdMap = new Map<string, string>();
    if (template.workflows.length > 0) {
      const projectWorkflows = template.workflows.map(workflow => ({
        project_id: project.id,
        name: workflow.name
      }));

      const { data: createdWorkflows, error: workflowsError } = await supabase
        .from('workflows')
        .insert(projectWorkflows)
        .select();

      if (workflowsError) {
        console.error(`[${traceId}] Error creating workflows: ${workflowsError.message}`);
        return { success: false, error: 'Failed to create workflows', details: workflowsError };
      }

      // Build mapping from template workflow ID to new workflow ID
      for (let i = 0; i < template.workflows.length; i++) {
        workflowIdMap.set(template.workflows[i].id, createdWorkflows[i].id);
      }

      console.log(`[${traceId}] Created ${createdWorkflows.length} workflows`);
    }

    // Step 3: Create workflow steps and transitions
    if (workflowIdMap.size > 0 && stateIdMap.size > 0) {
      // Fetch template workflow steps
      const { data: templateWorkflowSteps, error: stepsError } = await supabase
        .from('template_workflow_steps')
        .select('*')
        .in('workflow_id', Array.from(workflowIdMap.keys()));

      if (stepsError) {
        console.error(`[${traceId}] Error fetching template workflow steps: ${stepsError.message}`);
        return { success: false, error: 'Failed to fetch template workflow steps', details: stepsError };
      }

      if (templateWorkflowSteps && templateWorkflowSteps.length > 0) {
        const projectWorkflowSteps = templateWorkflowSteps.map(step => ({
          workflow_id: workflowIdMap.get(step.workflow_id)!,
          state_id: stateIdMap.get(step.state_id)!,
          step_order: step.step_order
        }));

        const { error: insertStepsError } = await supabase
          .from('workflow_steps')
          .insert(projectWorkflowSteps);

        if (insertStepsError) {
          console.error(`[${traceId}] Error creating workflow steps: ${insertStepsError.message}`);
          return { success: false, error: 'Failed to create workflow steps', details: insertStepsError };
        }

        console.log(`[${traceId}] Created ${projectWorkflowSteps.length} workflow steps`);
      }

      // Fetch template workflow transitions
      const { data: templateWorkflowTransitions, error: transitionsError } = await supabase
        .from('template_workflow_transitions')
        .select('*')
        .in('workflow_id', Array.from(workflowIdMap.keys()));

      if (transitionsError) {
        console.error(`[${traceId}] Error fetching template workflow transitions: ${transitionsError.message}`);
        return { success: false, error: 'Failed to fetch template workflow transitions', details: transitionsError };
      }

      if (templateWorkflowTransitions && templateWorkflowTransitions.length > 0) {
        const projectWorkflowTransitions = templateWorkflowTransitions.map(transition => ({
          workflow_id: workflowIdMap.get(transition.workflow_id)!,
          from_state: transition.from_state ? stateIdMap.get(transition.from_state)! : null,
          to_state: stateIdMap.get(transition.to_state)!
        }));

        const { error: insertTransitionsError } = await supabase
          .from('workflow_transitions')
          .insert(projectWorkflowTransitions);

        if (insertTransitionsError) {
          console.error(`[${traceId}] Error creating workflow transitions: ${insertTransitionsError.message}`);
          return { success: false, error: 'Failed to create workflow transitions', details: insertTransitionsError };
        }

        console.log(`[${traceId}] Created ${projectWorkflowTransitions.length} workflow transitions`);
      }
    }

    // Step 4: Create task types from template task types
    const taskTypeIdMap = new Map<string, string>();
    if (template.task_types.length > 0 && workflowIdMap.size > 0) {
      const projectTaskTypes = template.task_types.map(taskType => ({
        project_id: project.id,
        name: taskType.name,
        workflow_id: workflowIdMap.get(taskType.workflow_id)!
      }));

      const { data: createdTaskTypes, error: taskTypesError } = await supabase
        .from('task_types')
        .insert(projectTaskTypes)
        .select();

      if (taskTypesError) {
        console.error(`[${traceId}] Error creating task types: ${taskTypesError.message}`);
        return { success: false, error: 'Failed to create task types', details: taskTypesError };
      }

      // Build mapping from template task type ID to new task type ID
      for (let i = 0; i < template.task_types.length; i++) {
        taskTypeIdMap.set(template.task_types[i].id, createdTaskTypes[i].id);
      }

      console.log(`[${traceId}] Created ${createdTaskTypes.length} task types`);
    }

    // Step 5: Create fields from template fields
    const fieldIdMap = new Map<string, string>();
    if (template.fields.length > 0) {
      const projectFields = template.fields.map(field => ({
        project_id: project.id,
        name: field.name,
        input_type: field.input_type,
        is_required: field.is_required,
        options: field.options,
        default_value: field.default_value
      }));

      const { data: createdFields, error: fieldsError } = await supabase
        .from('fields')
        .insert(projectFields)
        .select();

      if (fieldsError) {
        console.error(`[${traceId}] Error creating fields: ${fieldsError.message}`);
        return { success: false, error: 'Failed to create fields', details: fieldsError };
      }

      // Build mapping from template field ID to new field ID
      for (let i = 0; i < template.fields.length; i++) {
        fieldIdMap.set(template.fields[i].id, createdFields[i].id);
      }

      console.log(`[${traceId}] Created ${createdFields.length} fields`);
    }

    // Step 6: Create task type field associations
    if (taskTypeIdMap.size > 0 && fieldIdMap.size > 0) {
      // Fetch template task type field associations
      const { data: templateTaskTypeFields, error: taskTypeFieldsError } = await supabase
        .from('template_task_type_fields')
        .select('*')
        .in('task_type_id', Array.from(taskTypeIdMap.keys()));

      if (taskTypeFieldsError) {
        console.error(`[${traceId}] Error fetching template task type fields: ${taskTypeFieldsError.message}`);
        return { success: false, error: 'Failed to fetch template task type fields', details: taskTypeFieldsError };
      }

      if (templateTaskTypeFields && templateTaskTypeFields.length > 0) {
        const projectTaskTypeFields = templateTaskTypeFields.map(association => ({
          task_type_id: taskTypeIdMap.get(association.task_type_id)!,
          field_id: fieldIdMap.get(association.field_id)!
        }));

        const { error: insertTaskTypeFieldsError } = await supabase
          .from('task_type_fields')
          .insert(projectTaskTypeFields);

        if (insertTaskTypeFieldsError) {
          console.error(`[${traceId}] Error creating task type fields: ${insertTaskTypeFieldsError.message}`);
          return { success: false, error: 'Failed to create task type fields', details: insertTaskTypeFieldsError };
        }

        console.log(`[${traceId}] Created ${projectTaskTypeFields.length} task type field associations`);
      }
    }

    console.log(`[${traceId}] Successfully applied template ${template.id} to project ${project.id}`);
    return { success: true, project };

  } catch (error: any) {
    console.error(`[${traceId}] Error applying template: ${error.message}`);
    return { success: false, error: 'Internal error during template application', details: error.message };
  }
}

/**
 * Fetches a template with all its details
 * @param supabase - Authenticated Supabase client
 * @param templateId - ID of the template to fetch
 * @param traceId - Trace ID for logging
 * @returns Template with details or null if not found
 */
export async function getTemplateWithDetails(
  supabase: SupabaseClient,
  templateId: string,
  traceId: string
): Promise<ProjectTemplateWithDetails | null> {
  
  console.log(`[${traceId}] Fetching template details for: ${templateId}`);

  try {
    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      console.log(`[${traceId}] Template not found: ${templateId}`);
      return null;
    }

    // Fetch template states
    const { data: states, error: statesError } = await supabase
      .from('template_states')
      .select('*')
      .eq('template_id', templateId)
      .order('position', { ascending: true });

    if (statesError) {
      console.error(`[${traceId}] Error fetching template states: ${statesError.message}`);
      throw new Error('Failed to fetch template states');
    }

    // Fetch template workflows
    const { data: workflows, error: workflowsError } = await supabase
      .from('template_workflows')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (workflowsError) {
      console.error(`[${traceId}] Error fetching template workflows: ${workflowsError.message}`);
      throw new Error('Failed to fetch template workflows');
    }

    // Fetch template task types
    const { data: taskTypes, error: taskTypesError } = await supabase
      .from('template_task_types')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (taskTypesError) {
      console.error(`[${traceId}] Error fetching template task types: ${taskTypesError.message}`);
      throw new Error('Failed to fetch template task types');
    }

    // Fetch template fields
    const { data: fields, error: fieldsError } = await supabase
      .from('template_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (fieldsError) {
      console.error(`[${traceId}] Error fetching template fields: ${fieldsError.message}`);
      throw new Error('Failed to fetch template fields');
    }

    const templateWithDetails: ProjectTemplateWithDetails = {
      ...template,
      states: states || [],
      workflows: workflows || [],
      task_types: taskTypes || [],
      fields: fields || []
    };

    console.log(`[${traceId}] Successfully fetched template details for: ${templateId}`);
    return templateWithDetails;

  } catch (error: any) {
    console.error(`[${traceId}] Error fetching template details: ${error.message}`);
    throw error;
  }
}