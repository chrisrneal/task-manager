# Database Entity Relationship Diagram

## Schema Overview

The Task Manager application uses a PostgreSQL database via Supabase with the following tables and relationships:

```mermaid
erDiagram
    projects {
        uuid id PK
        string name
        string description
        timestamp created_at
        timestamp updated_at
        uuid user_id FK
    }
    
    project_states {
        uuid id PK
        uuid project_id FK
        string name
        int position
    }
    
    workflows {
        uuid id PK
        uuid project_id FK
        string name
    }
    
    workflow_steps {
        uuid workflow_id PK,FK
        uuid state_id PK,FK
        int step_order
    }
    
    task_types {
        uuid id PK
        uuid project_id FK
        string name
        uuid workflow_id FK
    }
    
    tasks {
        uuid id PK
        string name
        string description
        uuid project_id FK
        uuid owner_id
        string status
        string priority
        timestamp due_date
        timestamp created_at
        timestamp updated_at
        uuid task_type_id FK
        uuid state_id FK
    }
    
    subtasks {
        uuid id PK
        string name
        string description
        uuid task_id FK
        uuid owner_id
        string status
        timestamp created_at
        timestamp updated_at
    }
    
    task_files {
        uuid id PK
        uuid task_id FK
        string path
        string mime_type
        integer size
        timestamp created_at
        timestamp updated_at
    }
    
    projects ||--o{ tasks : "has many"
    tasks ||--o{ subtasks : "has many"
    tasks ||--o{ task_files : "has many"
    projects ||--o{ project_states : "has many"
    projects ||--o{ workflows : "has many"
    projects ||--o{ task_types : "has many"
    workflows ||--o{ workflow_steps : "has many"
    project_states ||--o{ workflow_steps : "referenced in"
    task_types }|--|| workflows : "uses"
    tasks }o--|| task_types : "is of type"
    tasks }o--|| project_states : "is in state"
```

## Relationships

- A **project** belongs to a user and can have many tasks, project states, workflows, and task types
- A **project state** belongs to a project and can be used in multiple workflow steps
- A **workflow** belongs to a project and contains multiple workflow steps
- A **workflow step** defines a state in a workflow with a specific order
- A **task type** belongs to a project and is linked to a specific workflow
- A **task** belongs to a project and a user (owner), can have many subtasks, can be of a task type, and can be in a state
- A **subtask** belongs to a task and a user (owner)
- A **task file** belongs to a task and is stored in the Supabase Storage bucket

## Row-Level Security (RLS)

All tables implement Row-Level Security with the following policies:

### Projects Table RLS

- **SELECT/UPDATE/DELETE**: Allowed when `auth.uid() = user_id` OR role = `admin`
- **INSERT**: Allowed when `auth.uid() = new.user_id`

### Tasks Table RLS

- **SELECT/UPDATE/DELETE**: Allowed when `auth.uid() = owner_id` OR role = `admin`
- **INSERT**: Allowed when `auth.uid() = new.owner_id`

### Subtasks Table RLS

- **SELECT/UPDATE/DELETE**: Allowed when `auth.uid() = owner_id` OR role = `admin`
- **INSERT**: Allowed when `auth.uid() = new.owner_id`

### Project States, Workflows, Workflow Steps, Task Types RLS

- **SELECT/UPDATE/DELETE/INSERT**: Policies inherit from the Projects table, allowing access when the user is the owner of the related project or is an admin.

### Task Files Table RLS

- **SELECT/UPDATE/DELETE**: Allowed when the user is the owner of the related task OR role = `admin`
- **INSERT**: Allowed when the user is the owner of the related task

### Storage Objects (task-files) RLS

- **SELECT/UPDATE/DELETE/INSERT**: Allowed when the user is the owner of the related task OR role = `admin`

## Cascade Behavior

- When a **project** is deleted, all associated **tasks**, **project states**, **workflows**, and **task types** are deleted (CASCADE)
- When a **workflow** is deleted, all associated **workflow steps** are deleted (CASCADE)
- When a **task** is deleted, all associated **subtasks** and **task files** are deleted (CASCADE)
- When a **state** is deleted, the deletion will fail if it's referenced by a task
- When a **workflow** is deleted, the deletion will fail if it's referenced by a task type (RESTRICT)
