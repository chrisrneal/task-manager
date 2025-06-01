#!/usr/bin/env node

/**
 * @fileoverview Template Management CLI Tool
 * 
 * Command-line interface for managing project templates.
 * Provides admin users with tools to create, update, list, and delete templates
 * from the command line for automation and batch operations.
 * 
 * Usage:
 *   node scripts/manage-templates.js list
 *   node scripts/manage-templates.js create template.json
 *   node scripts/manage-templates.js delete <template-id>
 *   node scripts/manage-templates.js export <template-id> output.json
 *   node scripts/manage-templates.js import template.json
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
try {
  require('dotenv').config({ path: '.env.local' });
} catch (error) {
  console.warn('⚠️  dotenv not available, make sure environment variables are set');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client with service role key for admin operations
let supabase;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  
  return supabase;
}

// Template validation functions
const validateTemplateStructure = (template) => {
  const errors = [];
  
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

// Command handlers
const commands = {
  async list() {
    console.log('📋 Listing all templates...\n');
    
    try {
      const supabase = getSupabaseClient();
      const { data: templates, error } = await supabase
        .from('project_templates')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      if (!templates || templates.length === 0) {
        console.log('No templates found.');
        return;
      }
      
      console.log(`Found ${templates.length} template(s):\n`);
      
      for (const template of templates) {
        console.log(`📌 ${template.name} (${template.id})`);
        console.log(`   Description: ${template.description || 'No description'}`);
        console.log(`   Icon: ${template.icon || 'None'}`);
        console.log(`   Created: ${new Date(template.created_at).toLocaleDateString()}`);
        console.log(`   Updated: ${new Date(template.updated_at).toLocaleDateString()}`);
        console.log('');
      }
    } catch (error) {
      console.error('❌ Error listing templates:', error.message);
      process.exit(1);
    }
  },

  async create(templateFile) {
    if (!templateFile) {
      console.error('❌ Template file path is required');
      console.error('Usage: node scripts/manage-templates.js create template.json');
      process.exit(1);
    }
    
    console.log(`📝 Creating template from ${templateFile}...`);
    
    try {
      // Read and parse template file
      const templatePath = path.resolve(templateFile);
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }
      
      const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      
      // Validate template structure
      const validationErrors = validateTemplateStructure(templateData);
      if (validationErrors.length > 0) {
        console.error('❌ Template validation failed:');
        validationErrors.forEach(error => console.error(`   - ${error}`));
        process.exit(1);
      }
      
      // Create template
      const supabase = getSupabaseClient();
      const { data: template, error: templateError } = await supabase
        .from('project_templates')
        .insert({
          name: templateData.name,
          description: templateData.description,
          icon: templateData.icon
        })
        .select()
        .single();
      
      if (templateError) throw templateError;
      
      const templateId = template.id;
      console.log(`✅ Created template: ${templateData.name} (${templateId})`);
      
      // Create related data
      if (templateData.states && templateData.states.length > 0) {
        const statesData = templateData.states.map(state => ({
          ...state,
          template_id: templateId
        }));
        
        const { error: statesError } = await supabase
          .from('template_states')
          .insert(statesData);
          
        if (statesError) throw statesError;
        console.log(`   ✅ Created ${templateData.states.length} states`);
      }
      
      // Create workflows and get IDs for task types
      const workflowIds = {};
      if (templateData.workflows && templateData.workflows.length > 0) {
        const workflowsData = templateData.workflows.map(workflow => ({
          ...workflow,
          template_id: templateId
        }));
        
        const { data: createdWorkflows, error: workflowsError } = await supabase
          .from('template_workflows')
          .insert(workflowsData)
          .select();
          
        if (workflowsError) throw workflowsError;
        
        createdWorkflows.forEach(wf => {
          workflowIds[wf.name] = wf.id;
        });
        
        console.log(`   ✅ Created ${templateData.workflows.length} workflows`);
      }
      
      // Create task types
      if (templateData.task_types && templateData.task_types.length > 0) {
        const taskTypesData = templateData.task_types.map(taskType => ({
          ...taskType,
          template_id: templateId,
          workflow_id: workflowIds[taskType.workflow_id] || taskType.workflow_id
        }));
        
        const { error: taskTypesError } = await supabase
          .from('template_task_types')
          .insert(taskTypesData);
          
        if (taskTypesError) throw taskTypesError;
        console.log(`   ✅ Created ${templateData.task_types.length} task types`);
      }
      
      // Create fields
      if (templateData.fields && templateData.fields.length > 0) {
        const fieldsData = templateData.fields.map(field => ({
          ...field,
          template_id: templateId
        }));
        
        const { error: fieldsError } = await supabase
          .from('template_fields')
          .insert(fieldsData);
          
        if (fieldsError) throw fieldsError;
        console.log(`   ✅ Created ${templateData.fields.length} fields`);
      }
      
      console.log(`\n🎉 Template '${templateData.name}' created successfully!`);
      
    } catch (error) {
      console.error('❌ Error creating template:', error.message);
      process.exit(1);
    }
  },

  async delete(templateId) {
    if (!templateId) {
      console.error('❌ Template ID is required');
      console.error('Usage: node scripts/manage-templates.js delete <template-id>');
      process.exit(1);
    }
    
    console.log(`🗑️  Deleting template ${templateId}...`);
    
    try {
      const supabase = getSupabaseClient();
      // Check if template exists
      const { data: template, error: fetchError } = await supabase
        .from('project_templates')
        .select('name')
        .eq('id', templateId)
        .single();
      
      if (fetchError || !template) {
        throw new Error('Template not found');
      }
      
      // Delete template (cascade will handle related data)
      const { error: deleteError } = await supabase
        .from('project_templates')
        .delete()
        .eq('id', templateId);
      
      if (deleteError) throw deleteError;
      
      console.log(`✅ Template '${template.name}' deleted successfully!`);
      
    } catch (error) {
      console.error('❌ Error deleting template:', error.message);
      process.exit(1);
    }
  },

  async export(templateId, outputFile) {
    if (!templateId || !outputFile) {
      console.error('❌ Template ID and output file are required');
      console.error('Usage: node scripts/manage-templates.js export <template-id> output.json');
      process.exit(1);
    }
    
    console.log(`📤 Exporting template ${templateId}...`);
    
    try {
      const supabase = getSupabaseClient();
      // Fetch template with all related data
      const { data: template, error: templateError } = await supabase
        .from('project_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (templateError || !template) {
        throw new Error('Template not found');
      }
      
      // Fetch related data
      const [statesResult, workflowsResult, taskTypesResult, fieldsResult] = await Promise.all([
        supabase.from('template_states').select('*').eq('template_id', templateId).order('position'),
        supabase.from('template_workflows').select('*').eq('template_id', templateId).order('name'),
        supabase.from('template_task_types').select('*').eq('template_id', templateId).order('name'),
        supabase.from('template_fields').select('*').eq('template_id', templateId).order('name')
      ]);
      
      if (statesResult.error) throw statesResult.error;
      if (workflowsResult.error) throw workflowsResult.error;
      if (taskTypesResult.error) throw taskTypesResult.error;
      if (fieldsResult.error) throw fieldsResult.error;
      
      // Build export object
      const exportData = {
        name: template.name,
        description: template.description,
        icon: template.icon,
        states: statesResult.data?.map(({ id, template_id, ...state }) => state) || [],
        workflows: workflowsResult.data?.map(({ id, template_id, ...workflow }) => workflow) || [],
        task_types: taskTypesResult.data?.map(({ id, template_id, ...taskType }) => taskType) || [],
        fields: fieldsResult.data?.map(({ id, template_id, ...field }) => field) || []
      };
      
      // Write to file
      const outputPath = path.resolve(outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      
      console.log(`✅ Template '${template.name}' exported to ${outputPath}`);
      
    } catch (error) {
      console.error('❌ Error exporting template:', error.message);
      process.exit(1);
    }
  },

  async import(templateFile) {
    console.log(`📥 Importing template from ${templateFile}...`);
    return await commands.create(templateFile);
  }
};

// Main CLI handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || !commands[command]) {
    console.log('🛠️  Template Management CLI\n');
    console.log('Available commands:');
    console.log('  list                     - List all templates');
    console.log('  create <file.json>       - Create template from JSON file');
    console.log('  delete <template-id>     - Delete template by ID');
    console.log('  export <id> <file.json>  - Export template to JSON file');
    console.log('  import <file.json>       - Import template from JSON file');
    console.log('\nExample template file format:');
    console.log(JSON.stringify({
      name: "Basic Scrum Template",
      description: "A basic scrum project template",
      icon: "🏃‍♂️",
      states: [
        { name: "Backlog", position: 1 },
        { name: "In Progress", position: 2 },
        { name: "Done", position: 3 }
      ],
      workflows: [
        { name: "Scrum Workflow" }
      ],
      task_types: [
        { name: "User Story", workflow_id: "Scrum Workflow" }
      ],
      fields: [
        {
          name: "Story Points",
          input_type: "select",
          is_required: false,
          options: ["1", "2", "3", "5", "8"],
          default_value: "3"
        }
      ]
    }, null, 2));
    process.exit(1);
  }
  
  await commands[command](...args.slice(1));
}

// Run the CLI
main().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});