#!/bin/bash

# Migration test script
# This script:
# 1. Creates a test database
# 2. Applies all migrations up to the custom fields migration
# 3. Adds some test data
# 4. Runs the migration
# 5. Verifies the results

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database connection info (use parameters or defaults)
DB_HOST=${1:-"localhost"}
DB_PORT=${2:-"5432"}
DB_USER=${3:-"postgres"}
DB_PASSWORD=${4:-"postgres"}
TEST_DB_NAME="task_manager_migration_test_$(date +%s)"

echo -e "${YELLOW}Starting migration test on a clean database${NC}"
echo "Host: $DB_HOST:$DB_PORT"
echo "Test database: $TEST_DB_NAME"
echo

# Create test database
echo "Creating test database..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $TEST_DB_NAME;"

# Function to run SQL from a file
run_sql_file() {
    echo "Running SQL file: $1"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TEST_DB_NAME -f "$1"
}

# Function to run SQL command
run_sql() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TEST_DB_NAME -c "$1"
}

# Apply migrations in order
MIGRATIONS_DIR="/home/runner/work/task-manager/task-manager/supabase/migrations"
echo "Applying schema migrations..."

# Create extension (would be done by Supabase)
run_sql "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Apply migrations in the correct order
for migration in $(ls -1 $MIGRATIONS_DIR/*.sql | grep -v "20250525" | grep -v "20250526" | sort); do
    run_sql_file "$migration"
done

# Insert test data
echo "Inserting test data..."

# Create a test user
TEST_USER_ID=$(run_sql "INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test@example.com') RETURNING id;" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

# Create a test project
PROJECT_ID=$(run_sql "INSERT INTO projects (name, description, user_id) VALUES ('Test Project', 'Migration test project', '$TEST_USER_ID') RETURNING id;" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

# Create a task type
TASK_TYPE_ID=$(run_sql "INSERT INTO task_types (name, project_id) VALUES ('Bug', '$PROJECT_ID') RETURNING id;" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

# Create project states
STATE_ID=$(run_sql "INSERT INTO project_states (name, project_id, position) VALUES ('In Progress', '$PROJECT_ID', 1) RETURNING id;" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')

# Create tasks with status, priority, and due_date
run_sql "
INSERT INTO tasks (name, description, project_id, owner_id, status, priority, due_date, task_type_id, state_id) VALUES 
('Task 1', 'Test task 1', '$PROJECT_ID', '$TEST_USER_ID', 'todo', 'high', '2024-12-31', '$TASK_TYPE_ID', '$STATE_ID'),
('Task 2', 'Test task 2', '$PROJECT_ID', '$TEST_USER_ID', 'in_progress', 'medium', '2024-11-15', '$TASK_TYPE_ID', '$STATE_ID'),
('Task 3', 'Test task 3', '$PROJECT_ID', '$TEST_USER_ID', 'done', 'low', '2024-10-01', '$TASK_TYPE_ID', '$STATE_ID'),
('Task 4', 'Test task 4', '$PROJECT_ID', '$TEST_USER_ID', 'todo', NULL, NULL, '$TASK_TYPE_ID', '$STATE_ID');
"

# Check the initial data
echo -e "\n${YELLOW}Initial data before migration:${NC}"
run_sql "SELECT id, name, status, priority, due_date FROM tasks;"

# Run the migration
echo -e "\n${YELLOW}Running the custom fields migration...${NC}"
run_sql_file "$MIGRATIONS_DIR/20250525000000_migrate_task_columns_to_custom_fields.sql"

# Apply compatibility layer
echo -e "\n${YELLOW}Applying compatibility layer...${NC}"
run_sql_file "$MIGRATIONS_DIR/20250526000000_add_field_compatibility_layer.sql"

# Verify the results
echo -e "\n${YELLOW}Verifying migration results...${NC}"

# Check that columns have been dropped
COLUMNS_CHECK=$(run_sql "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN ('status', 'priority', 'due_date');
")

if [[ -z "$COLUMNS_CHECK" ]]; then
    echo -e "${GREEN}✓ Columns successfully dropped from tasks table${NC}"
else
    echo -e "${RED}✗ Columns not dropped: $COLUMNS_CHECK${NC}"
    exit 1
fi

# Check that field values were migrated
FIELD_VALUES_COUNT=$(run_sql "
SELECT COUNT(*) FROM task_field_values;
" | grep -oP '\d+' | head -1)

if [[ $FIELD_VALUES_COUNT -ge 10 ]]; then
    echo -e "${GREEN}✓ Field values successfully migrated: $FIELD_VALUES_COUNT values found${NC}"
else
    echo -e "${RED}✗ Migration may have failed. Only $FIELD_VALUES_COUNT field values found.${NC}"
    exit 1
fi

# Check compatibility view
echo -e "\n${YELLOW}Testing compatibility view:${NC}"
run_sql "SELECT id, name, status, priority, due_date FROM tasks_with_fields;"

# Clean up
echo -e "\n${YELLOW}Cleaning up test database...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE $TEST_DB_NAME;"

echo -e "\n${GREEN}Migration test completed successfully!${NC}"
echo "The migration script is ready for production use."