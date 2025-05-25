# ADR 2025-05: Project-Scoped Custom Fields

## Status

Accepted

## Context

When implementing custom fields for tasks in our task management system, we needed to decide whether custom fields should be:

1. **Global** - Available across all projects in the system
2. **Project-scoped** - Defined at the project level and only available within their respective projects

Custom fields allow users to extend the standard task structure with additional properties like priority levels, story points, custom status indicators, department assignments, and more. These fields need to be integrated with task types, field validation, and querying capabilities.

## Decision

We decided to implement **project-scoped custom fields** rather than global custom fields. This means:

1. Fields are defined at the project level with a mandatory `project_id` foreign key
2. Fields can only be assigned to task types within the same project
3. Each project maintains its own set of custom fields
4. Field definitions, validations, and values are isolated between projects

Implementation details:
- The `fields` table includes a non-nullable `project_id` foreign key
- Field names must be unique within a project (but the same field name can exist in different projects)
- Field assignments are limited to task types belonging to the same project
- Security policies validate project membership for all field operations

## Consequences

### Advantages

1. **Project Isolation**: Projects have independent customization without affecting other projects
2. **Reduced Complexity**: Field configurations don't need cross-project compatibility
3. **Enhanced Security**: Project-level permissions naturally extend to field management
4. **Naming Freedom**: Teams can use natural field names without worrying about conflicts with other projects
5. **Tailored Workflows**: Each project can have fields that match its specific workflow needs
6. **Simpler UI**: Field management UI only shows relevant fields for the current project
7. **Better Performance**: Queries are scoped to project, reducing the result set size

### Disadvantages

1. **No Cross-Project Standardization**: Cannot enforce consistent fields across projects
2. **Duplication**: Similar fields must be recreated in each project
3. **Reporting Challenges**: Cross-project reporting on custom fields requires additional mapping logic
4. **Migration Complexity**: Moving tasks between projects requires field value transformation

## Alternatives Considered

### Global Fields

We considered implementing global fields that would be available across all projects but decided against it for the following reasons:

1. **Naming Conflicts**: Increased risk of naming conflicts across different teams and projects
2. **Permission Complexity**: Would require additional permission layers beyond project membership
3. **UI Clutter**: All fields would appear in dropdown menus, making selection more complex
4. **Dependency Challenges**: Projects would depend on fields they don't control

### Hybrid Approach

We also considered a hybrid approach with both global and project-specific fields, but the added complexity in implementation, UI, and permission management outweighed the benefits for our current use case.

## Future Considerations

While we've chosen project-scoped fields for now, we may revisit this decision in the future to address:

1. **Field Templates**: Allow copying field configurations between projects
2. **Field Export/Import**: Enable exporting and importing field definitions
3. **Organization-Level Fields**: Introduce a middle ground with organization-wide fields
4. **Cross-Project Reporting**: Develop tools for mapping similar fields across projects for reporting