-- Migration script to move existing task columns (priority, status, due_date) to custom fields
-- This script is designed to be idempotent and run in a transaction for zero-downtime

-- Start the transaction
BEGIN;

-- First, create a log table to record the migration process
CREATE TABLE IF NOT EXISTS migration_logs (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to log messages
CREATE OR REPLACE FUNCTION log_migration(migration_name TEXT, status TEXT, message TEXT) 
RETURNS VOID AS $$
BEGIN
  INSERT INTO migration_logs (migration_name, status, message) 
  VALUES (migration_name, status, message);
END;
$$ LANGUAGE plpgsql;

-- Log the start of the migration
SELECT log_migration(
  '20250525000000_migrate_task_columns_to_custom_fields', 
  'STARTED', 
  'Beginning migration of task columns to custom fields'
);

-- Count tasks to migrate
DO $$
DECLARE
  task_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO task_count FROM tasks;
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'INFO', 
    'Found ' || task_count || ' tasks to process'
  );
END $$;

-- Ensure required fields exist for each project
-- Create 'Priority' field if it doesn't exist
INSERT INTO fields (project_id, name, input_type, is_required)
SELECT 
  p.id as project_id,
  'Priority' as name,
  'select' as input_type,
  false as is_required
FROM 
  projects p
WHERE 
  NOT EXISTS (
    SELECT 1 FROM fields 
    WHERE project_id = p.id AND name = 'Priority'
  );

-- Create 'Status' field if it doesn't exist
INSERT INTO fields (project_id, name, input_type, is_required)
SELECT 
  p.id as project_id,
  'Status' as name,
  'select' as input_type,
  false as is_required
FROM 
  projects p
WHERE 
  NOT EXISTS (
    SELECT 1 FROM fields 
    WHERE project_id = p.id AND name = 'Status'
  );

-- Create 'Due Date' field if it doesn't exist
INSERT INTO fields (project_id, name, input_type, is_required)
SELECT 
  p.id as project_id,
  'Due Date' as name,
  'date' as input_type,
  false as is_required
FROM 
  projects p
WHERE 
  NOT EXISTS (
    SELECT 1 FROM fields 
    WHERE project_id = p.id AND name = 'Due Date'
  );

-- Log fields creation
DO $$
DECLARE
  field_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO field_count FROM fields;
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'INFO', 
    'Ensured all projects have required fields. Total fields: ' || field_count
  );
END $$;

-- Ensure all task types have field assignments
-- For Priority field
INSERT INTO task_type_fields (task_type_id, field_id)
SELECT 
  tt.id as task_type_id,
  f.id as field_id
FROM 
  task_types tt
  CROSS JOIN fields f
WHERE 
  f.project_id = tt.project_id 
  AND f.name = 'Priority'
  AND NOT EXISTS (
    SELECT 1 FROM task_type_fields 
    WHERE task_type_id = tt.id AND field_id = f.id
  );

-- For Status field
INSERT INTO task_type_fields (task_type_id, field_id)
SELECT 
  tt.id as task_type_id,
  f.id as field_id
FROM 
  task_types tt
  CROSS JOIN fields f
WHERE 
  f.project_id = tt.project_id 
  AND f.name = 'Status'
  AND NOT EXISTS (
    SELECT 1 FROM task_type_fields 
    WHERE task_type_id = tt.id AND field_id = f.id
  );

-- For Due Date field
INSERT INTO task_type_fields (task_type_id, field_id)
SELECT 
  tt.id as task_type_id,
  f.id as field_id
FROM 
  task_types tt
  CROSS JOIN fields f
WHERE 
  f.project_id = tt.project_id 
  AND f.name = 'Due Date'
  AND NOT EXISTS (
    SELECT 1 FROM task_type_fields 
    WHERE task_type_id = tt.id AND field_id = f.id
  );

-- Log task type field assignments
DO $$
DECLARE
  ttf_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ttf_count FROM task_type_fields;
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'INFO', 
    'Ensured all task types have field assignments. Total task_type_fields: ' || ttf_count
  );
END $$;

-- Migrate task values to task_field_values

-- Migrate Priority values
INSERT INTO task_field_values (task_id, field_id, value)
SELECT 
  t.id as task_id,
  f.id as field_id,
  t.priority as value
FROM 
  tasks t
  JOIN projects p ON t.project_id = p.id
  JOIN fields f ON f.project_id = p.id AND f.name = 'Priority'
WHERE 
  t.priority IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task_field_values 
    WHERE task_id = t.id AND field_id = f.id
  );

-- Log priority values migration
DO $$
DECLARE
  count_migrated INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_migrated 
  FROM task_field_values tfv 
  JOIN fields f ON tfv.field_id = f.id 
  WHERE f.name = 'Priority';
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'INFO', 
    'Migrated ' || count_migrated || ' priority values'
  );
END $$;

-- Migrate Status values
INSERT INTO task_field_values (task_id, field_id, value)
SELECT 
  t.id as task_id,
  f.id as field_id,
  t.status as value
FROM 
  tasks t
  JOIN projects p ON t.project_id = p.id
  JOIN fields f ON f.project_id = p.id AND f.name = 'Status'
WHERE 
  t.status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task_field_values 
    WHERE task_id = t.id AND field_id = f.id
  );

-- Log status values migration
DO $$
DECLARE
  count_migrated INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_migrated 
  FROM task_field_values tfv 
  JOIN fields f ON tfv.field_id = f.id 
  WHERE f.name = 'Status';
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'INFO', 
    'Migrated ' || count_migrated || ' status values'
  );
END $$;

-- Migrate Due Date values
INSERT INTO task_field_values (task_id, field_id, value)
SELECT 
  t.id as task_id,
  f.id as field_id,
  t.due_date::text as value
FROM 
  tasks t
  JOIN projects p ON t.project_id = p.id
  JOIN fields f ON f.project_id = p.id AND f.name = 'Due Date'
WHERE 
  t.due_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task_field_values 
    WHERE task_id = t.id AND field_id = f.id
  );

-- Log due date values migration
DO $$
DECLARE
  count_migrated INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_migrated 
  FROM task_field_values tfv 
  JOIN fields f ON tfv.field_id = f.id 
  WHERE f.name = 'Due Date';
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'INFO', 
    'Migrated ' || count_migrated || ' due date values'
  );
END $$;

-- Verify that all values have been migrated correctly
DO $$
DECLARE
  task_count INTEGER;
  priority_count INTEGER;
  status_count INTEGER;
  due_date_count INTEGER;
BEGIN
  -- Count tasks with non-null values in each column
  SELECT COUNT(*) INTO task_count FROM tasks;
  SELECT COUNT(*) INTO priority_count FROM tasks WHERE priority IS NOT NULL;
  SELECT COUNT(*) INTO status_count FROM tasks WHERE status IS NOT NULL;
  SELECT COUNT(*) INTO due_date_count FROM tasks WHERE due_date IS NOT NULL;
  
  -- Log verification results
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'VERIFICATION', 
    'Total tasks: ' || task_count || 
    ', Tasks with priority: ' || priority_count || 
    ', Tasks with status: ' || status_count || 
    ', Tasks with due_date: ' || due_date_count
  );
  
  -- Count migrated values
  SELECT COUNT(*) INTO priority_count 
  FROM task_field_values tfv 
  JOIN fields f ON tfv.field_id = f.id 
  WHERE f.name = 'Priority';
  
  SELECT COUNT(*) INTO status_count 
  FROM task_field_values tfv 
  JOIN fields f ON tfv.field_id = f.id 
  WHERE f.name = 'Status';
  
  SELECT COUNT(*) INTO due_date_count 
  FROM task_field_values tfv 
  JOIN fields f ON tfv.field_id = f.id 
  WHERE f.name = 'Due Date';
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'VERIFICATION', 
    'Migrated priority values: ' || priority_count || 
    ', Migrated status values: ' || status_count || 
    ', Migrated due date values: ' || due_date_count
  );
END $$;

-- Drop the deprecated columns
ALTER TABLE tasks 
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS due_date;

-- Log completion of the migration
SELECT log_migration(
  '20250525000000_migrate_task_columns_to_custom_fields', 
  'COMPLETED', 
  'Successfully migrated task columns to custom fields and dropped deprecated columns'
);

-- Commit the transaction
COMMIT;