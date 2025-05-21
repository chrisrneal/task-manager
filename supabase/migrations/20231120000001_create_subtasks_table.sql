-- Create subtasks table
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- Create policies for subtasks table
-- Policy: Users can view their own subtasks or if they are an admin
CREATE POLICY subtasks_select_policy ON subtasks 
  FOR SELECT 
  USING (auth.uid() = owner_id OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Users can insert subtasks only if they are the owner
CREATE POLICY subtasks_insert_policy ON subtasks 
  FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can update their own subtasks or if they are an admin
CREATE POLICY subtasks_update_policy ON subtasks 
  FOR UPDATE 
  USING (auth.uid() = owner_id OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Users can delete their own subtasks or if they are an admin
CREATE POLICY subtasks_delete_policy ON subtasks 
  FOR DELETE 
  USING (auth.uid() = owner_id OR auth.jwt() ->> 'role' = 'admin');