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
    
    projects ||--o{ tasks : "has many"
    tasks ||--o{ subtasks : "has many"
```

## Relationships

- A **project** belongs to a user and can have many tasks
- A **task** belongs to a project and a user (owner), and can have many subtasks
- A **subtask** belongs to a task and a user (owner)

## Row-Level Security (RLS)

All tables implement Row-Level Security with the following policies:

### Tasks Table RLS

- **SELECT/UPDATE/DELETE**: Allowed when `auth.uid() = owner_id` OR role = `admin`
- **INSERT**: Allowed when `auth.uid() = new.owner_id`

### Subtasks Table RLS

- **SELECT/UPDATE/DELETE**: Allowed when `auth.uid() = owner_id` OR role = `admin`
- **INSERT**: Allowed when `auth.uid() = new.owner_id`

## Cascade Behavior

- When a **project** is deleted, all associated **tasks** are deleted
- When a **task** is deleted, all associated **subtasks** are deleted