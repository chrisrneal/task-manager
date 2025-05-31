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

-- Add a constraint to ensure assignee is a member of the task's project
-- This constraint ensures data integrity - assignee must be a member of the project
ALTER TABLE tasks 
ADD CONSTRAINT check_task_assignee_project_member 
CHECK (
  assignee_id IS NULL 
  OR 
  EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.user_id = assignee_id 
    AND pm.project_id = tasks.project_id
  )
);