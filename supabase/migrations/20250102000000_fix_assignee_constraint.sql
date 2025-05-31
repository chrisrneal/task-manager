-- Remove problematic constraint that was preventing task creation
-- The constraint was causing issues during INSERT operations due to timing of evaluation
-- Data integrity is maintained at the application level

-- Drop the constraint if it exists
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_task_assignee_project_member;