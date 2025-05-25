#!/bin/bash

# Script to run the custom fields migration in dry-run mode
# This script will connect to the database and execute the migration without committing

# Environment variables
# Make sure these are set or passed as arguments
DB_HOST=${1:-"localhost"}
DB_PORT=${2:-"5432"}
DB_NAME=${3:-"postgres"}
DB_USER=${4:-"postgres"}
DB_PASSWORD=${5:-"postgres"}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting custom fields migration in DRY-RUN mode${NC}"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "User: $DB_USER"
echo

# Create a temporary file with the modified migration script
TEMP_SCRIPT=$(mktemp)
cat > $TEMP_SCRIPT << 'EOF'
-- Wrap everything in a transaction that we'll roll back for dry run
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
  
  -- Also output to console for dry run
  RAISE NOTICE '%: % - %', migration_name, status, message;
END;
$$ LANGUAGE plpgsql;

-- Log the start of the migration
SELECT log_migration(
  '20250525000000_migrate_task_columns_to_custom_fields', 
  'STARTED', 
  'Beginning migration of task columns to custom fields (DRY RUN)'
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

-- Determine which values would be migrated without actually inserting them

-- Count potential Priority migrations
DO $$
DECLARE
  count_to_migrate INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_to_migrate
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
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'DRY-RUN', 
    'Would migrate ' || count_to_migrate || ' priority values'
  );
END $$;

-- Count potential Status migrations
DO $$
DECLARE
  count_to_migrate INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_to_migrate
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
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'DRY-RUN', 
    'Would migrate ' || count_to_migrate || ' status values'
  );
END $$;

-- Count potential Due Date migrations
DO $$
DECLARE
  count_to_migrate INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_to_migrate
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
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'DRY-RUN', 
    'Would migrate ' || count_to_migrate || ' due date values'
  );
END $$;

-- Show what would be dropped
DO $$
DECLARE
  priority_not_null INTEGER;
  status_not_null INTEGER;
  due_date_not_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO priority_not_null FROM tasks WHERE priority IS NOT NULL;
  SELECT COUNT(*) INTO status_not_null FROM tasks WHERE status IS NOT NULL;
  SELECT COUNT(*) INTO due_date_not_null FROM tasks WHERE due_date IS NOT NULL;
  
  PERFORM log_migration(
    '20250525000000_migrate_task_columns_to_custom_fields', 
    'DRY-RUN', 
    'Would drop columns with data: priority (' || priority_not_null || ' values), ' ||
    'status (' || status_not_null || ' values), ' ||
    'due_date (' || due_date_not_null || ' values)'
  );
END $$;

-- Log completion of the dry run
SELECT log_migration(
  '20250525000000_migrate_task_columns_to_custom_fields', 
  'DRY-RUN-COMPLETED', 
  'This was a dry run. No changes were committed to the database.'
);

-- Roll back the transaction for dry run
ROLLBACK;
EOF

# Run the migration script in dry-run mode
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $TEMP_SCRIPT

# Check if the script executed successfully
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}Dry run completed successfully${NC}"
  echo "Check the output above to see what changes would be made"
  echo "To run the actual migration, use: npx supabase migration up"
else
  echo -e "\n${RED}Dry run failed${NC}"
  echo "Please check the output above for errors"
fi

# Clean up
rm $TEMP_SCRIPT

echo -e "\n${YELLOW}Migration logs will be available in the migration_logs table after the actual migration${NC}"