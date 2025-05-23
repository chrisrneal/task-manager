-- Create project_states table
CREATE TABLE project_states (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  position    int  NOT NULL                -- ordinal
);

-- Create workflows table
CREATE TABLE workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL
);

-- Create workflow_steps table
CREATE TABLE workflow_steps (
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  state_id    uuid REFERENCES project_states(id) ON DELETE CASCADE,
  step_order  int  NOT NULL,
  PRIMARY KEY (workflow_id, state_id)
);

-- Create task_types table
CREATE TABLE task_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  workflow_id uuid REFERENCES workflows(id) ON DELETE RESTRICT
);

-- Alter tasks table to add task_type_id and state_id
ALTER TABLE tasks
  ADD COLUMN task_type_id uuid REFERENCES task_types(id),
  ADD COLUMN state_id     uuid REFERENCES project_states(id);

-- Enable Row Level Security for new tables
ALTER TABLE project_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;

-- Create policies for project_states table
-- Policy: Users can view project states if they can view the project
CREATE POLICY project_states_select_policy ON project_states 
  FOR SELECT 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can insert project states if they own the project or are an admin
CREATE POLICY project_states_insert_policy ON project_states 
  FOR INSERT 
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can update project states if they own the project or are an admin
CREATE POLICY project_states_update_policy ON project_states 
  FOR UPDATE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can delete project states if they own the project or are an admin
CREATE POLICY project_states_delete_policy ON project_states 
  FOR DELETE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Create policies for workflows table
-- Policy: Users can view workflows if they can view the project
CREATE POLICY workflows_select_policy ON workflows 
  FOR SELECT 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can insert workflows if they own the project or are an admin
CREATE POLICY workflows_insert_policy ON workflows 
  FOR INSERT 
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can update workflows if they own the project or are an admin
CREATE POLICY workflows_update_policy ON workflows 
  FOR UPDATE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can delete workflows if they own the project or are an admin
CREATE POLICY workflows_delete_policy ON workflows 
  FOR DELETE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Create policies for workflow_steps table
-- Policy: Users can view workflow steps if they can view the associated workflow
CREATE POLICY workflow_steps_select_policy ON workflow_steps 
  FOR SELECT 
  USING (
    workflow_id IN (
      SELECT id FROM workflows 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- Policy: Users can insert workflow steps if they own the project or are an admin
CREATE POLICY workflow_steps_insert_policy ON workflow_steps 
  FOR INSERT 
  WITH CHECK (
    workflow_id IN (
      SELECT id FROM workflows 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- Policy: Users can update workflow steps if they own the project or are an admin
CREATE POLICY workflow_steps_update_policy ON workflow_steps 
  FOR UPDATE 
  USING (
    workflow_id IN (
      SELECT id FROM workflows 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- Policy: Users can delete workflow steps if they own the project or are an admin
CREATE POLICY workflow_steps_delete_policy ON workflow_steps 
  FOR DELETE 
  USING (
    workflow_id IN (
      SELECT id FROM workflows 
      WHERE project_id IN (
        SELECT id FROM projects 
        WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
      )
    )
  );

-- Create policies for task_types table
-- Policy: Users can view task types if they can view the project
CREATE POLICY task_types_select_policy ON task_types 
  FOR SELECT 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can insert task types if they own the project or are an admin
CREATE POLICY task_types_insert_policy ON task_types 
  FOR INSERT 
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can update task types if they own the project or are an admin
CREATE POLICY task_types_update_policy ON task_types 
  FOR UPDATE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Policy: Users can delete task types if they own the project or are an admin
CREATE POLICY task_types_delete_policy ON task_types 
  FOR DELETE 
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin'
    )
  );

-- Add constraint to prevent duplicate step_order values for the same workflow
CREATE UNIQUE INDEX workflow_steps_workflow_id_step_order_idx 
  ON workflow_steps (workflow_id, step_order);

-- Function and trigger to prevent deleting a state that's referenced by a task
CREATE OR REPLACE FUNCTION prevent_deleting_referenced_state()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM tasks WHERE state_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete state that is referenced by a task';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_deleting_referenced_state_trigger
BEFORE DELETE ON project_states
FOR EACH ROW
EXECUTE FUNCTION prevent_deleting_referenced_state();