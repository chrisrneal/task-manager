-- Create task-files bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create task_files table for file metadata
CREATE TABLE IF NOT EXISTS task_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on task_files
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_files table
-- Policy: Users can view their own files or if they are an admin
CREATE POLICY task_files_select_policy ON task_files
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_files.task_id 
      AND (tasks.owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
    )
  );

-- Policy: Users can insert task files only if they own the related task
CREATE POLICY task_files_insert_policy ON task_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_files.task_id 
      AND tasks.owner_id = auth.uid()
    )
  );

-- Policy: Users can update their own task files or if they are an admin
CREATE POLICY task_files_update_policy ON task_files
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_files.task_id 
      AND (tasks.owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
    )
  );

-- Policy: Users can delete their own task files or if they are an admin
CREATE POLICY task_files_delete_policy ON task_files
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_files.task_id 
      AND (tasks.owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
    )
  );

-- Add RLS policies for storage.objects
CREATE POLICY "Task owner can manage their files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'task-files' AND 
    (
      -- Extract task_id from the path (assuming format is: taskId/filename)
      EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id::text = SPLIT_PART(storage.objects.name, '/', 1)
        AND (tasks.owner_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
      )
    )
  );