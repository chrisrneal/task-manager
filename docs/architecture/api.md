# API Documentation

## Task Management

### GET /api/tasks

- **Description**: Retrieves tasks for the current user
- **Authentication**: Required
- **Response**: Array of task objects

### GET /api/tasks/[taskId]

- **Description**: Retrieves a specific task by ID
- **Authentication**: Required
- **Authorization**: User must be the task owner or an admin
- **Response**: Task object

### POST /api/tasks

- **Description**: Creates a new task
- **Authentication**: Required
- **Request Body**:

```json
{
  "name": "string",
  "description": "string",
  "project_id": "uuid",
  "priority": "string",
  "due_date": "date"
}
```

- **Response**: Created task object

### PUT /api/tasks/[taskId]

- **Description**: Updates a task by ID
- **Authentication**: Required
- **Authorization**: User must be the task owner or an admin
- **Request Body**: Task fields to update
- **Response**: Updated task object

### DELETE /api/tasks/[taskId]

- **Description**: Deletes a task by ID
- **Authentication**: Required
- **Authorization**: User must be the task owner or an admin
- **Response**: Success message

## Task Files API

### POST /api/tasks/[taskId]/upload

- **Description**: Uploads a file to a task
- **Authentication**: Required
- **Authorization**: User must be the task owner
- **Request Body**: FormData containing the file
- **Constraints**:
  - Maximum file size: 10 MB
  - Allowed file types: JPEG, PNG, PDF
- **Response**:

```json
{
  "filePath": "string"
}
```

### GET /api/tasks/[taskId]/files

- **Description**: Lists all files associated with a task
- **Authentication**: Required
- **Authorization**: User must be the task owner or an admin
- **Response**: Array of file metadata objects including:

```json
[
  {
    "id": "uuid",
    "task_id": "uuid",
    "path": "string",
    "mime_type": "string",
    "size": "number",
    "created_at": "timestamp",
    "url": "string" // Signed URL with 60-minute expiry
  }
]
```

### DELETE /api/tasks/[taskId]/files/[fileId]

- **Description**: Deletes a file by ID
- **Authentication**: Required
- **Authorization**: User must be the task owner or an admin
- **Response**: Success message

## Error Responses

All API endpoints return standard HTTP status codes:

- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Authenticated user doesn't have access
- **404 Not Found**: Resource not found
- **413 Payload Too Large**: File exceeds size limit
- **415 Unsupported Media Type**: Invalid file type
- **500 Internal Server Error**: Server-side error
