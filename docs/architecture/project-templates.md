# Project Template Schema

## Overview

The project template system provides a way to create reusable project configurations that include states, workflows, task types, and custom fields. Templates allow users to quickly set up new projects with pre-configured structures without needing to recreate common patterns.

## Core Concepts

### Template Structure

A project template consists of several interconnected components:

- **Template Metadata**: Name, description, and icon
- **States**: The workflow states tasks can be in (e.g., "To Do", "In Progress", "Done")
- **Workflows**: Define sequences of states and allowed transitions
- **Task Types**: Different types of work items (e.g., "User Story", "Bug", "Epic")
- **Custom Fields**: Additional metadata fields for tasks (e.g., "Story Points", "Priority")

### Template vs Project Data

Templates are **standalone, reusable configurations** that exist independently of any specific project. When a template is applied to a project, the template's configuration is **copied** to create project-specific entities.

```
Template (Reusable)           Project (Instance)
├── template_states     →     ├── project_states
├── template_workflows  →     ├── workflows  
├── template_task_types →     ├── task_types
└── template_fields     →     └── fields
```

## Database Schema

### Core Template Tables

#### `project_templates`
Stores template metadata.

```sql
CREATE TABLE project_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  icon        text, -- e.g., emoji or icon name
  created_at  timestamp with time zone DEFAULT now(),
  updated_at  timestamp with time zone DEFAULT now()
);
```

#### `template_states`
Defines the workflow states available in a template.

```sql
CREATE TABLE template_states (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name        text NOT NULL,
  position    int  NOT NULL -- Display order
);
```

#### `template_workflows`
Defines named workflows within a template.

```sql
CREATE TABLE template_workflows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name        text NOT NULL
);
```

#### `template_workflow_steps`
Links states to workflows in a specific order.

```sql
CREATE TABLE template_workflow_steps (
  workflow_id uuid REFERENCES template_workflows(id) ON DELETE CASCADE,
  state_id    uuid REFERENCES template_states(id) ON DELETE CASCADE,
  step_order  int  NOT NULL,
  PRIMARY KEY (workflow_id, state_id)
);
```

#### `template_workflow_transitions`
Defines allowed state transitions within workflows.

```sql
CREATE TABLE template_workflow_transitions (
  workflow_id uuid REFERENCES template_workflows(id) ON DELETE CASCADE,
  from_state  uuid REFERENCES template_states(id) ON DELETE CASCADE,
  to_state    uuid REFERENCES template_states(id) ON DELETE CASCADE,
  PRIMARY KEY (workflow_id, COALESCE(from_state, '00000000-0000-0000-0000-000000000000'), to_state)
);
```

**Note**: For "any state" transitions, use the placeholder UUID `'00000000-0000-0000-0000-000000000000'` for `from_state`.

#### `template_task_types`
Defines types of work items in a template.

```sql
CREATE TABLE template_task_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name        text NOT NULL,
  workflow_id uuid REFERENCES template_workflows(id) ON DELETE RESTRICT
);
```

#### `template_fields`
Defines custom fields available in a template.

```sql
CREATE TABLE template_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid REFERENCES project_templates(id) ON DELETE CASCADE,
  name          text NOT NULL,
  input_type    text NOT NULL, -- 'text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'
  is_required   boolean DEFAULT false,
  options       text[], -- For select/radio field options
  default_value text
);
```

#### `template_task_type_fields`
Links custom fields to task types (many-to-many relationship).

```sql
CREATE TABLE template_task_type_fields (
  task_type_id uuid REFERENCES template_task_types(id) ON DELETE CASCADE,
  field_id     uuid REFERENCES template_fields(id) ON DELETE CASCADE,
  PRIMARY KEY (task_type_id, field_id)
);
```

## TypeScript Interfaces

The template system includes comprehensive TypeScript interfaces:

```typescript
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateState {
  id: string;
  template_id: string;
  name: string;
  position: number;
}

export interface TemplateWorkflow {
  id: string;
  template_id: string;
  name: string;
}

// ... (additional interfaces for other template entities)

export interface ProjectTemplateWithDetails extends ProjectTemplate {
  states: TemplateState[];
  workflows: TemplateWorkflow[];
  task_types: TemplateTaskType[];
  fields: TemplateField[];
}
```

## Template Examples

### Basic Scrum Template

The system includes a pre-configured Basic Scrum template with:

**States:**
- Product Backlog
- Sprint Backlog
- In Progress
- In Review
- Testing
- Done

**Task Types:**
- User Story (with Story Points, Sprint, Acceptance Criteria)
- Bug (with Severity, Environment)
- Epic (simplified workflow)
- Task (general work items)
- Spike (research/investigation)

**Custom Fields:**
- Story Points (Fibonacci scale)
- Priority (Critical, High, Medium, Low)
- Sprint (text field)
- Acceptance Criteria (textarea)
- Definition of Done (checkbox)
- Epic Link (text field)
- Due Date (date field)
- Severity (for bugs)
- Environment (for bugs)

## Security and Access Control

Templates use Row-Level Security (RLS) with the following policies:

- **Read Access**: All authenticated users can read templates (enables sharing)
- **Write Access**: Only administrators can create, modify, or delete templates
- **Template Application**: Any authenticated user can apply a template to their own projects

## Future Extensions

The template system is designed for easy extension:

### Adding New Templates
New templates can be added by inserting data into the template tables. No code changes are required.

### Custom Template Types
The system can be extended to support different categories or types of templates by adding metadata fields to the `project_templates` table.

### Template Versioning
Future versions could add versioning support by adding version fields and maintaining template history.

### Template Sharing
The current design allows global template sharing. Future versions could add user-specific templates or organization-scoped templates.

### Template Import/Export
Templates could be exported as JSON for sharing between installations or imported from external sources.

## Usage Workflow

1. **Browse Templates**: Users can view available templates with their descriptions and previews
2. **Select Template**: When creating a new project, users can choose to start from a template
3. **Apply Template**: The system copies template configuration to create project-specific entities
4. **Customize**: Users can then modify the project configuration as needed

The template system maintains separation between the template definition and project instances, ensuring templates remain unchanged when projects are modified.