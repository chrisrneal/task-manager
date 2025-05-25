-- Add compatibility functions for handling migrated task columns
-- This ensures existing API code continues to work after the migration

-- Start transaction
BEGIN;

-- Create a function to get a field value for a task
CREATE OR REPLACE FUNCTION get_task_field_value(task_id UUID, field_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT tfv.value INTO result
  FROM task_field_values tfv
  JOIN fields f ON tfv.field_id = f.id
  JOIN tasks t ON tfv.task_id = t.id
  WHERE 
    tfv.task_id = task_id
    AND f.name = field_name
    AND f.project_id = t.project_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a view that adds virtual columns for backward compatibility
CREATE OR REPLACE VIEW tasks_with_fields AS
SELECT 
  t.*,
  get_task_field_value(t.id, 'Status') AS status,
  get_task_field_value(t.id, 'Priority') AS priority,
  get_task_field_value(t.id, 'Due Date')::TIMESTAMP WITH TIME ZONE AS due_date
FROM 
  tasks t;

-- Create a function to set field values during task creation/update
CREATE OR REPLACE FUNCTION set_task_field_values()
RETURNS TRIGGER AS $$
DECLARE
  status_field_id UUID;
  priority_field_id UUID;
  due_date_field_id UUID;
BEGIN
  -- Only proceed if any of the migrated columns are provided
  IF TG_OP = 'INSERT' OR 
     (TG_OP = 'UPDATE' AND 
      (NEW.status IS NOT NULL OR NEW.priority IS NOT NULL OR NEW.due_date IS NOT NULL)) THEN
      
    -- Find the field IDs for the standard fields in this project
    SELECT id INTO status_field_id
    FROM fields
    WHERE project_id = NEW.project_id AND name = 'Status';

    SELECT id INTO priority_field_id
    FROM fields
    WHERE project_id = NEW.project_id AND name = 'Priority';

    SELECT id INTO due_date_field_id
    FROM fields
    WHERE project_id = NEW.project_id AND name = 'Due Date';

    -- Insert or update field values for Status
    IF NEW.status IS NOT NULL AND status_field_id IS NOT NULL THEN
      INSERT INTO task_field_values (task_id, field_id, value)
      VALUES (NEW.id, status_field_id, NEW.status)
      ON CONFLICT (task_id, field_id) 
      DO UPDATE SET value = EXCLUDED.value;
    END IF;

    -- Insert or update field values for Priority
    IF NEW.priority IS NOT NULL AND priority_field_id IS NOT NULL THEN
      INSERT INTO task_field_values (task_id, field_id, value)
      VALUES (NEW.id, priority_field_id, NEW.priority)
      ON CONFLICT (task_id, field_id) 
      DO UPDATE SET value = EXCLUDED.value;
    END IF;

    -- Insert or update field values for Due Date
    IF NEW.due_date IS NOT NULL AND due_date_field_id IS NOT NULL THEN
      INSERT INTO task_field_values (task_id, field_id, value)
      VALUES (NEW.id, due_date_field_id, NEW.due_date::text)
      ON CONFLICT (task_id, field_id) 
      DO UPDATE SET value = EXCLUDED.value;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to handle virtual columns
DROP TRIGGER IF EXISTS handle_virtual_columns ON tasks;

CREATE TRIGGER handle_virtual_columns
AFTER INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_task_field_values();

-- Commit transaction
COMMIT;