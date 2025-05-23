-- Create workflow_transitions table
CREATE TABLE workflow_transitions (
  workflow_id  uuid REFERENCES workflows(id) ON DELETE CASCADE,
  from_state   uuid REFERENCES project_states(id) ON DELETE CASCADE NULL,
  to_state     uuid REFERENCES project_states(id) ON DELETE CASCADE NOT NULL,
  -- Remove from_state from PRIMARY KEY to allow NULL values
  -- Create a compound primary key for workflow_id and to_state when from_state is NULL
  -- For non-NULL from_state, create a different constraint
  PRIMARY KEY (workflow_id, COALESCE(from_state, '00000000-0000-0000-0000-000000000000'), to_state)
);

-- Enable Row Level Security
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;

-- Create policies for workflow_transitions table using the same pattern as workflow_steps
-- Policy: Users can view workflow transitions if they can view the associated workflow
CREATE POLICY workflow_transitions_select_policy ON workflow_transitions 
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

-- Policy: Users can insert workflow transitions if they own the project or are an admin
CREATE POLICY workflow_transitions_insert_policy ON workflow_transitions 
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

-- Policy: Users can update workflow transitions if they own the project or are an admin
CREATE POLICY workflow_transitions_update_policy ON workflow_transitions 
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

-- Policy: Users can delete workflow transitions if they own the project or are an admin
CREATE POLICY workflow_transitions_delete_policy ON workflow_transitions 
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

-- Seed data: For each workflow, add linear transitions based on existing workflow_steps
INSERT INTO workflow_transitions (workflow_id, from_state, to_state)
SELECT 
  w1.workflow_id,
  w1.state_id AS from_state,
  w2.state_id AS to_state
FROM 
  workflow_steps w1
JOIN 
  workflow_steps w2 
ON 
  w1.workflow_id = w2.workflow_id AND w1.step_order + 1 = w2.step_order;

-- Create "any state to cancelled" transitions by finding appropriate states
-- First, we need to identify "Cancelled" states for each workflow
WITH cancelled_states AS (
  SELECT ps.id AS state_id, w.id AS workflow_id
  FROM project_states ps
  JOIN workflows w ON ps.project_id = w.project_id
  WHERE LOWER(ps.name) = 'cancelled'
)
-- Then insert transitions from any state (NULL from_state) to the cancelled state
INSERT INTO workflow_transitions (workflow_id, from_state, to_state)
SELECT 
  cs.workflow_id,
  NULL AS from_state,
  cs.state_id AS to_state
FROM 
  cancelled_states cs
ON CONFLICT DO NOTHING;