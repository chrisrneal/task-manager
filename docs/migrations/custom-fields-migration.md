# Custom Fields Migration Guide

This document outlines the process of migrating existing task data from the original columns (`status`, `priority`, `due_date`) to the new custom fields system.

## Migration Overview

The migration performs the following steps:

1. Creates custom fields for each project that match the original columns (if they don't exist already)
2. Assigns these fields to all task types in each project
3. Copies values from the original columns to the new custom fields structure
4. Verifies that all data has been migrated correctly
5. Removes the deprecated columns

## Migration Script

The migration is handled by the Supabase migration file: `20250525000000_migrate_task_columns_to_custom_fields.sql`

Key features of the migration:
- **Idempotent**: The script can be run multiple times safely without duplicating data
- **Zero-downtime**: The entire migration is wrapped in a transaction
- **Verification**: The script includes verification steps to ensure data integrity
- **Logging**: The migration creates detailed logs in the `migration_logs` table

## Running the Migration

### Dry Run

Before applying the migration to your production database, you can run it in dry-run mode to see what changes would be made:

```bash
# Basic usage (with default connection params)
./scripts/dry-run-migration.sh

# With custom connection parameters
./scripts/dry-run-migration.sh host port database username password
```

The dry run will:
- Show how many fields would be created
- Count how many values would be migrated
- Simulate the entire migration process without committing any changes

### Production Migration

To run the actual migration:

```bash
npx supabase migration up
```

## Verification

After running the migration, you can verify it was successful by:

1. Checking the `migration_logs` table for the status of each step
2. Querying the `task_field_values` table to ensure values were migrated correctly
3. Confirming that the deprecated columns have been removed from the `tasks` table

## Troubleshooting

If you encounter issues during the migration:

1. Check the `migration_logs` table for error messages
2. Verify database permissions for the user running the migration
3. Ensure there's enough disk space and resources for the transaction

## Post-Migration Checklist

- [x] Ensure API endpoints handle the new custom fields structure
- [x] Update frontend components to use custom fields
- [x] Verify that all task data can be accessed and edited
- [x] Check that search and filtering functionality works with custom fields
- [x] Update documentation to reflect the new data structure