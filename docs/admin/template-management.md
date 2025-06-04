# Template Configuration Management & Admin Tools

This document describes the admin tools for managing project templates in the task manager system.

## Overview

The Template Configuration Management system provides administrators with multiple ways to manage project templates:

1. **Admin Web Interface** - `/admin/templates`
2. **CLI Tool** - `scripts/manage-templates.js`
3. **REST API** - `/api/templates` with admin-only operations
4. **JSON Templates** - `db/templates/` directory

## Authentication & Authorization

All template management operations require admin privileges. The system uses Row-Level Security (RLS) policies that check for `auth.jwt() ->> 'role' = 'admin'`.

### Setting Admin Role

Admin roles are typically set in the user's JWT claims either in:
- `app_metadata.role = 'admin'`
- `user_metadata.role = 'admin'`

## Admin Web Interface

Access the admin interface at `/admin/templates` to:

- View all existing templates
- Create new templates with a visual form
- Edit template basic information
- Delete templates with confirmation
- Validate template structure

### Features

- **Template Creation Form**: Interactive form with validation
- **Template Validation**: Real-time validation of template structure
- **Template Preview**: View template details including states, workflows, task types, and fields
- **Bulk Operations**: Future support for import/export

## CLI Tool

The CLI tool (`scripts/manage-templates.js`) provides command-line access for automation and batch operations.

### Usage

```bash
# List all templates
node scripts/manage-templates.js list

# Create template from JSON file
node scripts/manage-templates.js create db/templates/basic-scrum.json

# Export template to JSON file
node scripts/manage-templates.js export <template-id> exported-template.json

# Import template from JSON file
node scripts/manage-templates.js import template.json

# Delete template
node scripts/manage-templates.js delete <template-id>
```

### Requirements

- Node.js environment
- Supabase service role key in environment variables
- Proper `.env.local` file with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## REST API

The `/api/templates` endpoint supports full CRUD operations for admins:

### GET /api/templates
- **Access**: All authenticated users
- **Purpose**: List all templates with details
- **Response**: Array of templates with states, workflows, task types, and fields

### POST /api/templates
- **Access**: Admin only
- **Purpose**: Create new template
- **Body**: Template data with structure validation
- **Response**: Created template ID and success message

### PUT /api/templates?id=<template-id>
- **Access**: Admin only
- **Purpose**: Update existing template
- **Body**: Partial template data to update
- **Response**: Success message

### DELETE /api/templates?id=<template-id>
- **Access**: Admin only
- **Purpose**: Delete template (cascades to related data)
- **Response**: Success message

## Template Structure

Templates consist of the following components:

### Basic Information
- `name` (required): Template display name
- `description` (optional): Template description
- `icon` (optional): Emoji or icon identifier

### States
Array of workflow states with:
- `name`: State display name
- `position`: Numeric position for ordering (must be unique)

### Workflows
Array of named workflows:
- `name`: Workflow display name

### Task Types
Array of task types linked to workflows:
- `name`: Task type display name
- `workflow_id`: Reference to workflow name

### Fields
Array of custom fields with:
- `name`: Field display name
- `input_type`: One of 'text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'
- `is_required`: Boolean flag
- `options`: Array of options (required for 'select' and 'radio' types)
- `default_value`: Default field value

## Validation Rules

The system enforces these validation rules:

1. **Required Fields**: Template must have name, at least one state, and one workflow
2. **Unique State Positions**: All state positions must be unique within a template
3. **Valid Input Types**: Field input types must be from the allowed list
4. **Select/Radio Options**: Fields of type 'select' or 'radio' must have options array
5. **Workflow References**: Task types must reference valid workflow names

## Sample Templates

The system includes sample templates in `db/templates/`:

- `basic-scrum.json`: Complete Scrum template with sprints, story points, and acceptance criteria
- `kanban-board.json`: Simple Kanban workflow with complexity and component tracking

## Audit Trail

All template operations are logged with:
- User ID of the admin performing the operation
- Template ID and name
- Operation type (create, update, delete)
- Timestamp
- Trace ID for request tracking

Logs are written to the application console and can be aggregated for audit purposes.

## Version Control

Template changes are version-controlled through:

1. **JSON Files**: Templates stored as JSON files can be version-controlled in Git
2. **Database Timestamps**: Templates include `created_at` and `updated_at` timestamps
3. **Audit Logging**: All changes are logged with user and timestamp information

## Backup and Recovery

### Export Templates
Use the CLI tool to export templates for backup:

```bash
# Export all templates
node scripts/manage-templates.js list
# Then export each template individually
node scripts/manage-templates.js export <template-id> backup-<template-name>.json
```

### Import Templates
Restore templates from JSON files:

```bash
node scripts/manage-templates.js import backup-template.json
```

## Security Considerations

1. **Admin Access Control**: Only users with admin role can modify templates
2. **Input Validation**: All template data is validated before storage
3. **SQL Injection Prevention**: Supabase client handles parameterized queries
4. **Row-Level Security**: Database-level access control through RLS policies
5. **Audit Logging**: All administrative actions are logged

## Future Enhancements

Planned improvements include:

1. **Template Versioning**: Version history for templates
2. **Template Categories**: Organize templates by category or team
3. **Template Sharing**: Export/import between different installations
4. **Visual Template Designer**: Drag-and-drop template creation
5. **Template Analytics**: Usage statistics and popularity metrics
6. **Template Validation**: More sophisticated validation rules
7. **Batch Operations**: Bulk import/export operations

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure user has admin role in JWT claims
2. **Template Not Found**: Verify template ID exists and wasn't deleted
3. **Validation Errors**: Check template structure against validation rules
4. **CLI Connection Issues**: Verify Supabase environment variables

### Error Codes

- `401`: Authentication required
- `403`: Admin role required
- `404`: Template not found
- `400`: Validation failed
- `500`: Server error

### Support

For technical support or questions about template management:
1. Check the application logs for detailed error messages
2. Verify admin permissions and authentication
3. Review template structure against validation rules
4. Test with sample templates from `db/templates/`