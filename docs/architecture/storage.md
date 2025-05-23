# File Storage Architecture

## Overview

The Task Manager application supports file uploads for task attachments such as photos 
and PDF documents. This is implemented using Supabase Storage for file storage and a 
PostgreSQL table for metadata.

## Storage Bucket

- **Name**: `task-files`
- **Public Access**: Disabled
- **Access Control**: Controlled via Row-Level Security (RLS) policies
- **File Path Pattern**: `{taskId}/{uuid}.{extension}`

## File Restrictions

- **Maximum File Size**: 10 MB
- **Allowed File Types**: 
  - Images: JPEG, PNG
  - Documents: PDF

## Metadata Storage

File metadata is stored in the `task_files` table which contains:

- `id` - UUID primary key
- `task_id` - Reference to the task (with CASCADE delete)
- `path` - Storage path in the bucket
- `mime_type` - MIME type of the file
- `size` - File size in bytes
- `created_at` - Timestamp when the file was uploaded
- `updated_at` - Timestamp when the file metadata was last updated

## Security Model

### Row-Level Security (RLS)

1. **Storage Objects**:
   - Users can only access files related to tasks they own
   - Admin users have access to all files
   - Policy is implemented in `storage.objects` to extract the task ID from the file path

2. **Task Files Metadata**:
   - Users can only view/modify file metadata related to tasks they own
   - Admin users have access to all file metadata
   - RLS policies join with the tasks table to verify ownership

### Access Control Flow

1. **Upload Process**:
   - Backend validates file size and type
   - Files are uploaded to task-specific directories
   - Metadata is stored in the `task_files` table
   - RLS ensures users can only upload to their own tasks

2. **Download Process**:
   - Files are served using signed URLs (60-minute expiry)
   - RLS ensures users can only download files from their own tasks

### Deletion Behavior

- When a task is deleted, all associated files are automatically deleted due to CASCADE behavior
- Deleting a file involves:
  - Removing the object from storage
  - Deleting the associated metadata record

## Implementation Details

### Backend Utilities

The application includes helper functions in `taskFileUtils.ts`:

- `validateFile`: Validates file size and type
- `uploadTaskFile`: Handles file upload and metadata creation
- `getTaskFileUrl`: Generates signed URLs for secure file access
- `listTaskFiles`: Retrieves all files for a task
- `deleteTaskFile`: Removes file and associated metadata

### API Endpoints

- `POST /api/tasks/[taskId]/upload`: Handles file uploads
- `GET /api/tasks/[taskId]/files`: Lists files for a task
- `DELETE /api/tasks/[taskId]/files/[fileId]`: Deletes a file

### UI Components

- Drag-and-drop file upload zone
- File preview thumbnails
- Progress indicators during upload
- Delete functionality with confirmation
