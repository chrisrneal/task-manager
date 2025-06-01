-- Create project templates system for reusable project configurations

-- Main project templates table
CREATE TABLE project_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  icon        text, -- e.g., emoji or icon name
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now()
);

-- Template states (standalone, not tied to specific projects)
CREATE TABLE template_states (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name        text NOT NULL,
  position    int  NOT NULL
);

-- Template workflows
CREATE TABLE template_workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name        text NOT NULL
);

-- Template workflow steps
CREATE TABLE template_workflow_steps (
  workflow_id uuid REFERENCES template_workflows(id) ON DELETE CASCADE,
  state_id    uuid REFERENCES template_states(id) ON DELETE CASCADE,
  step_order  int  NOT NULL,
  PRIMARY KEY (workflow_id, state_id)
);

-- Template workflow transitions
CREATE TABLE template_workflow_transitions (
  workflow_id uuid REFERENCES template_workflows(id) ON DELETE CASCADE,
  from_state  uuid REFERENCES template_states(id) ON DELETE CASCADE,
  to_state    uuid REFERENCES template_states(id) ON DELETE CASCADE,
  PRIMARY KEY (workflow_id, COALESCE(from_state, '00000000-0000-0000-0000-000000000000'), to_state)
);

-- Template task types
CREATE TABLE template_task_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name        text NOT NULL,
  workflow_id uuid REFERENCES template_workflows(id) ON DELETE RESTRICT
);

-- Template fields (custom fields for tasks)
CREATE TABLE template_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name          text NOT NULL,
  input_type    text NOT NULL,
  is_required   boolean DEFAULT false,
  options       text[], -- For select/radio field options
  default_value text
);

-- Template task type fields (many-to-many relationship)
CREATE TABLE template_task_type_fields (
  task_type_id uuid REFERENCES template_task_types(id) ON DELETE CASCADE,
  field_id     uuid REFERENCES template_fields(id) ON DELETE CASCADE,
  PRIMARY KEY (task_type_id, field_id)
);

-- Create indexes for better performance
CREATE INDEX template_states_template_id_idx ON template_states(template_id);
CREATE INDEX template_workflows_template_id_idx ON template_workflows(template_id);
CREATE INDEX template_task_types_template_id_idx ON template_task_types(template_id);
CREATE INDEX template_fields_template_id_idx ON template_fields(template_id);
CREATE UNIQUE INDEX template_workflow_steps_workflow_id_step_order_idx 
  ON template_workflow_steps (workflow_id, step_order);

-- Enable Row Level Security (all templates are public for now)
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_task_type_fields ENABLE ROW LEVEL SECURITY;

-- Create policies - For now, all authenticated users can read templates
-- This allows templates to be shared across all users
CREATE POLICY project_templates_select_policy ON project_templates 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY template_states_select_policy ON template_states 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY template_workflows_select_policy ON template_workflows 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY template_workflow_steps_select_policy ON template_workflow_steps 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY template_workflow_transitions_select_policy ON template_workflow_transitions 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY template_task_types_select_policy ON template_task_types 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY template_fields_select_policy ON template_fields 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY template_task_type_fields_select_policy ON template_task_type_fields 
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin-only policies for modifying templates (for future template management)
CREATE POLICY project_templates_admin_policy ON project_templates 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY template_states_admin_policy ON template_states 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY template_workflows_admin_policy ON template_workflows 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY template_workflow_steps_admin_policy ON template_workflow_steps 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY template_workflow_transitions_admin_policy ON template_workflow_transitions 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY template_task_types_admin_policy ON template_task_types 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY template_fields_admin_policy ON template_fields 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY template_task_type_fields_admin_policy ON template_task_type_fields 
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');