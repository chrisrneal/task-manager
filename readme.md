<p align="center">
	<img alt="Task Manager" src="public/images/icon-512.png" width="90">
	<h2 align="center">Task Manager</h2>
</p>

<p align="center">A modern, workflow-driven task management application</p>

<p align="center">
	<a href="https://task-manager-demo.vercel.app">Live demo</a>
</p>

<p align="center">
	<a href="https://web.dev/measure">
		<img alt="100% lighthouse scores" src="https://img.shields.io/badge/lighthouse-100%25-845EF7.svg?logo=lighthouse&logoColor=white&style=flat-square" />
	</a>
</p>

## Features

- ✨ Modern PWA using Next.js
- 🌗 Dark and light themes
- 📱 Responsive design for all devices
- 🔄 Real-time updates with Supabase
- 🔐 Secure authentication
- 📊 Customizable project dashboards
- 🚀 Dynamic task board with workflow states
- 🔄 Workflow-driven task transitions
- 📎 Secure file uploads for task attachments

## Task Management

The application allows users to:

- Create and manage projects
- Edit project names and descriptions from Project Settings (for project owners and admins)
- Add tasks with details like name, description, priority, and due date
- Organize tasks in customizable boards
- Track task progress through workflows
- Attach files (images, PDFs) to tasks with secure access control

## Task Files

### Security Features

- **Supabase Storage Integration**: Files are stored in a secure, private bucket
- **Row-Level Security**: Files inherit the same access control as their parent tasks
- **Signed URLs**: File downloads use temporary signed URLs with 60-minute expiry
- **Type Validation**: Only allowed file types (JPEG, PNG, PDF) can be uploaded
- **Size Limits**: Maximum file size of 10 MB enforced

### Implementation

Files can be uploaded to tasks using a drag-and-drop interface. Each task can have multiple file attachments, with thumbnails for previewing images and icons for PDFs. File deletion is available with confirmation to prevent accidental removal.

## Project Management

### Project Settings

Project owners and administrators can access the Project Settings page to:

- **Edit Project Details**: Update the project name and description
- **Manage Workflow States**: Configure custom states for task organization
- **Create Workflows**: Define sequences of states for different task types
- **Configure Task Types**: Set up different task types (Bug, Feature, Epic, etc.) with associated workflows

Access to project settings is restricted to project owners and users with admin privileges.

## Custom Fields

Custom fields allow project administrators to extend the standard task structure with additional, project-specific properties that capture the unique requirements of different workflows and organizations.

### Adding Custom Fields in the UI

1. **Navigate to Project Settings**: Access the project settings page for the project where you want to add custom fields.
2. **Select Fields Tab**: Choose the "Fields" tab in the project settings.
3. **Create a New Field**:
   - Enter a field label (name)
   - Select the input type (text, textarea, number, date, select, checkbox, radio)
   - Mark as required if necessary
   - Assign to specific task types within the project
4. **Save the Field**: Click "Add Field" to create the field
5. **Manage Existing Fields**: Edit, delete, or reassign fields to different task types as needed

All created fields will automatically appear in task forms when creating or editing tasks of the assigned task types.

### How Field Values Are Stored

Custom field values are stored in a structured, normalized database schema:

1. **Field Definitions**: Stored in the `fields` table with properties:
   - `id`: Unique identifier for the field
   - `project_id`: The project the field belongs to
   - `name`: Display name of the field
   - `input_type`: Type of field (text, number, etc.)
   - `is_required`: Whether the field is mandatory

2. **Field Assignments**: Stored in the `task_type_fields` junction table:
   - `task_type_id`: The task type the field is assigned to
   - `field_id`: The field being assigned

3. **Field Values**: Stored in the `task_field_values` table:
   - `task_id`: The task the value belongs to
   - `field_id`: The field this value is for
   - `value`: The actual field value (stored as text)

This structure ensures data integrity while keeping the schema flexible for adding new field types.

### Querying Field Values in Supabase SQL

#### Basic Field Value Query

```sql
-- Get all tasks with their field values
SELECT 
  t.id as task_id,
  t.name as task_name,
  f.name as field_name,
  tfv.value as field_value
FROM 
  tasks t
JOIN 
  task_field_values tfv ON t.id = tfv.task_id
JOIN 
  fields f ON tfv.field_id = f.id
WHERE 
  t.project_id = 'your-project-id';
```

#### Filter Tasks by Field Value

```sql
-- Find tasks with a specific field value
SELECT 
  t.id, 
  t.name
FROM 
  tasks t
JOIN 
  task_field_values tfv ON t.id = tfv.task_id
JOIN 
  fields f ON tfv.field_id = f.id
WHERE 
  f.name = 'Priority Level'
  AND tfv.value = 'High'
  AND t.project_id = 'your-project-id';
```

#### Pivot Field Values to Columns

```sql
-- Pivot fields into columns (using Postgres crosstab)
SELECT *
FROM crosstab(
  'SELECT 
     t.id, 
     f.name, 
     tfv.value
   FROM 
     tasks t
   JOIN 
     task_field_values tfv ON t.id = tfv.task_id
   JOIN 
     fields f ON tfv.field_id = f.id
   WHERE 
     t.project_id = ''your-project-id''
   ORDER BY 1,2',
  'SELECT name FROM fields WHERE project_id = ''your-project-id'' ORDER BY 1'
) AS (
  task_id UUID,
  "Priority" TEXT,
  "Story Points" TEXT,
  "Department" TEXT
  -- Add expected field names here
);
```

## Workflow System

### Key Features

- **Dynamic Board Columns**: Task boards render columns from workflow states instead of hardcoded statuses
- **Workflow State Transitions**: Tasks can only move to valid next states in their workflow
- **Task Type Integration**: Changing a task's type automatically updates its workflow and resets to the first state
- **Branching & Cyclical Workflows**: States can have multiple outgoing transitions, enabling complex workflow patterns
- **Any-State Transitions**: Special transitions that allow moving to a specific state from any other state
- **Interactive Workflow Editor**: Canvas-based UI for visually creating and managing workflow transitions
- **Two-layer Validation**:
  - Frontend: UI only shows valid state options based on current workflow position
  - Backend: Database constraints validate state transitions server-side

### How It Works

1. Each project can have multiple task types (e.g., Bug, Feature, Epic)
2. Task types are associated with specific workflows
3. Workflows define a graph of states with transitions between them (shown as columns on the board)
4. States can branch to multiple possible next states (e.g., "In Progress" → "Needs Review" or "Blocked")
5. Cyclical workflows allow returning to previous states
6. When creating or editing a task:
   - Selecting a task type assigns its workflow
   - Only valid state transitions are allowed
   - Changing task type resets the workflow state

### Technical Implementation

The workflow system is implemented with:

- Database schema with `workflows`, `workflow_steps`, `workflow_transitions`, `task_types`, and `project_states` tables
- Transitions with placeholder UUID (all zeros) for from_state represent "any state" transitions
- PostgreSQL trigger function to validate state transitions
- Interactive canvas-based workflow editor with SVG for transition visualization
- React components for dynamic board rendering
- Frontend logic to manage workflow state changes

## Getting started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up your Supabase environment variables
4. Run the development server with `npm run dev`
5. Visit `http://localhost:3000` to see the app

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: Vercel

## AI Automation

This repository is configured for GitHub Copilot to help maintain documentation and code consistency. When code changes are made:

- Copilot may suggest or open PRs that update documentation to reflect code changes
- All PRs will be reviewed through the normal process
- Copilot follows the existing code standards and styles in the repository
