-- Create fields table
CREATE TABLE fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  input_type  text NOT NULL,
  is_required boolean DEFAULT false,
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now()
);

-- Create task_type_fields table (many-to-many relationship)
CREATE TABLE task_type_fields (
  task_type_id uuid REFERENCES task_types(id) ON DELETE CASCADE,
  field_id     uuid REFERENCES fields(id) ON DELETE CASCADE,
  PRIMARY KEY (task_type_id, field_id)
);

-- Create task_field_values table
CREATE TABLE task_field_values (
  task_id   uuid REFERENCES tasks(id) ON DELETE CASCADE,
  field_id  uuid REFERENCES fields(id) ON DELETE CASCADE,
  value     text,
  PRIMARY KEY (task_id, field_id)
);

-- Enable Row Level Security for new tables
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_type_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fields table
-- Policy: Users can view fields if they can view the project
CREATE POLICY fields_select_policy ON fields 
  FOR SELECT 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can insert fields if they own the project or are an admin
CREATE POLICY fields_insert_policy ON fields 
  FOR INSERT 
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can update fields if they own the project or are an admin
CREATE POLICY fields_update_policy ON fields 
  FOR UPDATE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can delete fields if they own the project or are an admin
CREATE POLICY fields_delete_policy ON fields 
  FOR DELETE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- RLS Policies for task_type_fields table
-- Policy: Users can view task_type_fields if they can view the related task_type
CREATE POLICY task_type_fields_select_policy ON task_type_fields 
  FOR SELECT 
  USING (
    task_type_id IN (
      SELECT id FROM task_types 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- Policy: Users can insert task_type_fields if they own the project or are an admin
CREATE POLICY task_type_fields_insert_policy ON task_type_fields 
  FOR INSERT 
  WITH CHECK (
    task_type_id IN (
      SELECT id FROM task_types 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- Policy: Users can update task_type_fields if they own the project or are an admin
CREATE POLICY task_type_fields_update_policy ON task_type_fields 
  FOR UPDATE 
  USING (
    task_type_id IN (
      SELECT id FROM task_types 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- Policy: Users can delete task_type_fields if they own the project or are an admin
CREATE POLICY task_type_fields_delete_policy ON task_type_fields 
  FOR DELETE 
  USING (
    task_type_id IN (
      SELECT id FROM task_types 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- RLS Policies for task_field_values table
-- Policy: Users can view task_field_values if they can view the related task
CREATE POLICY task_field_values_select_policy ON task_field_values 
  FOR SELECT 
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can insert task_field_values if they own the task or are an admin
CREATE POLICY task_field_values_insert_policy ON task_field_values 
  FOR INSERT 
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks 
      WHERE owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can update task_field_values if they own the task or are an admin
CREATE POLICY task_field_values_update_policy ON task_field_values 
  FOR UPDATE 
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can delete task_field_values if they own the task or are an admin
CREATE POLICY task_field_values_delete_policy ON task_field_values 
  FOR DELETE 
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Seed default fields for existing projects
-- This will add default fields to any existing projects
INSERT INTO fields (project_id, name, input_type, is_required)
SELECT 
  id as project_id,
  'Priority' as name,
  'select' as input_type,
  false as is_required
FROM 
  projects
WHERE 
  id NOT IN (SELECT project_id FROM fields WHERE name = 'Priority');

INSERT INTO fields (project_id, name, input_type, is_required)
SELECT 
  id as project_id,
  'Due Date' as name,
  'date' as input_type,
  false as is_required
FROM 
  projects
WHERE 
  id NOT IN (SELECT project_id FROM fields WHERE name = 'Due Date');