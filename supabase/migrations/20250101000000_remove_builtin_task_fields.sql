-- Remove built-in Status, Priority, and Due Date fields from tasks table
-- These fields are being replaced by the custom fields system

-- First, migrate existing data to custom fields if needed
-- Create Status custom field for projects that don't have one
INSERT INTO fields (project_id, name, input_type, is_required)
SELECT DISTINCT 
  t.project_id,
  'Status' as name,
  'select' as input_type,
  false as is_required
FROM 
  tasks t
WHERE 
  t.project_id NOT IN (
    SELECT project_id FROM fields WHERE name = 'Status'
  );

-- Create Priority custom field for projects that don't have one (already exists from previous migration but ensuring completeness)
INSERT INTO fields (project_id, name, input_type, is_required)
SELECT DISTINCT 
  t.project_id,
  'Priority' as name,
  'select' as input_type,
  false as is_required
FROM 
  tasks t
WHERE 
  t.project_id NOT IN (
    SELECT project_id FROM fields WHERE name = 'Priority'
  );

-- Create Due Date custom field for projects that don't have one (already exists from previous migration but ensuring completeness)
INSERT INTO fields (project_id, name, input_type, is_required)
SELECT DISTINCT 
  t.project_id,
  'Due Date' as name,
  'date' as input_type,
  false as is_required
FROM 
  tasks t
WHERE 
  t.project_id NOT IN (
    SELECT project_id FROM fields WHERE name = 'Due Date'
  );

-- Migrate existing task data to custom field values
-- Migrate Status values
INSERT INTO task_field_values (task_id, field_id, value)
SELECT 
  t.id as task_id,
  f.id as field_id,
  t.status as value
FROM 
  tasks t
  INNER JOIN fields f ON f.project_id = t.project_id AND f.name = 'Status'
WHERE 
  t.status IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM task_field_values tfv 
    WHERE tfv.task_id = t.id AND tfv.field_id = f.id
  );

-- Migrate Priority values
INSERT INTO task_field_values (task_id, field_id, value)
SELECT 
  t.id as task_id,
  f.id as field_id,
  t.priority as value
FROM 
  tasks t
  INNER JOIN fields f ON f.project_id = t.project_id AND f.name = 'Priority'
WHERE 
  t.priority IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM task_field_values tfv 
    WHERE tfv.task_id = t.id AND tfv.field_id = f.id
  );

-- Migrate Due Date values
INSERT INTO task_field_values (task_id, field_id, value)
SELECT 
  t.id as task_id,
  f.id as field_id,
  t.due_date::text as value
FROM 
  tasks t
  INNER JOIN fields f ON f.project_id = t.project_id AND f.name = 'Due Date'
WHERE 
  t.due_date IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM task_field_values tfv 
    WHERE tfv.task_id = t.id AND tfv.field_id = f.id
  );

-- Now remove the built-in columns from the tasks table
ALTER TABLE tasks DROP COLUMN IF EXISTS status;
ALTER TABLE tasks DROP COLUMN IF EXISTS priority; 
ALTER TABLE tasks DROP COLUMN IF EXISTS due_date;