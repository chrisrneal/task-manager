-- Add constraint to ensure that task state changes follow valid transitions in the workflow

-- Function to check if a state transition is valid based on workflow_transitions
CREATE OR REPLACE FUNCTION is_valid_task_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when state is changing
  IF OLD.state_id IS NOT DISTINCT FROM NEW.state_id THEN
    RETURN NEW;
  END IF;
  
  -- If task doesn't have a task_type_id, any transition is allowed
  IF NEW.task_type_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get workflow_id for the task_type_id
  DECLARE
    workflow_id UUID;
  BEGIN
    SELECT tt.workflow_id INTO workflow_id
    FROM task_types tt
    WHERE tt.id = NEW.task_type_id;
    
    -- If workflow not found, allow the transition
    IF workflow_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- If transition exists in workflow_transitions (either from specific state or from any state)
    -- then allow the transition
    IF EXISTS (
      SELECT 1
      FROM workflow_transitions t
      WHERE t.workflow_id = workflow_id
        AND (
          -- From specific state to new state
          (t.from_state = OLD.state_id AND t.to_state = NEW.state_id)
          -- OR from ANY state to new state (using placeholder UUID)
          OR (t.from_state = '00000000-0000-0000-0000-000000000000' AND t.to_state = NEW.state_id)
        )
    ) THEN
      RETURN NEW;
    END IF;
    
    -- If we get here, the transition is not allowed
    RAISE EXCEPTION 'Invalid state transition: Transition from % to % is not allowed for this workflow', 
      OLD.state_id, NEW.state_id;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce constraint
DROP TRIGGER IF EXISTS validate_task_transition_trigger ON tasks;
CREATE TRIGGER validate_task_transition_trigger
BEFORE UPDATE OF state_id ON tasks
FOR EACH ROW
WHEN (OLD.state_id IS DISTINCT FROM NEW.state_id)
EXECUTE FUNCTION is_valid_task_transition();