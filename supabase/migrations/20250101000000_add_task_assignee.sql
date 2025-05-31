-- Add assignee_id field to tasks table
-- This allows tasks to be assigned to any project member (real or dummy user)

ALTER TABLE tasks 
ADD COLUMN assignee_id UUID DEFAULT NULL,
ADD CONSTRAINT fk_task_assignee 
  FOREIGN KEY (assignee_id) 
  REFERENCES project_members(user_id) 
  ON DELETE SET NULL;

-- Add index for performance on assignee queries
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;

-- Note: Data integrity is enforced at the application level in the API
-- The constraint below was causing issues with task creation due to timing of constraint evaluation
-- Validation occurs in the API to ensure assignee is a project member before task creation/update