-- Add constraint to ensure a task's state belongs to the workflow associated with its task type
-- First, add a function to check if state is valid for the task's workflow
CREATE OR REPLACE FUNCTION is_valid_task_state()
RETURNS TRIGGER AS $$
BEGIN
  -- If task_type_id is NULL, any state is allowed
  IF NEW.task_type_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- If state_id is NULL, that's always valid
  IF NEW.state_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- If state_id is not associated with workflow of task_type_id, raise an error
  IF NOT EXISTS (
    SELECT 1 FROM workflow_steps ws
    JOIN task_types tt ON tt.workflow_id = ws.workflow_id
    WHERE tt.id = NEW.task_type_id
    AND ws.state_id = NEW.state_id
  ) THEN
    RAISE EXCEPTION 'Invalid state for task workflow: The state must be part of the workflow associated with the task type';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce constraint
DROP TRIGGER IF EXISTS validate_task_state_trigger ON tasks;
CREATE TRIGGER validate_task_state_trigger
BEFORE INSERT OR UPDATE OF task_type_id, state_id ON tasks
FOR EACH ROW
EXECUTE FUNCTION is_valid_task_state();