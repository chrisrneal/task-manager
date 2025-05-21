-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for tasks table
-- Policy: Users can view their own tasks or if they are an admin
CREATE POLICY tasks_select_policy ON tasks 
  FOR SELECT 
  USING (auth.uid() = owner_id OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Users can insert tasks only if they are the owner
CREATE POLICY tasks_insert_policy ON tasks 
  FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can update their own tasks or if they are an admin
CREATE POLICY tasks_update_policy ON tasks 
  FOR UPDATE 
  USING (auth.uid() = owner_id OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Users can delete their own tasks or if they are an admin
CREATE POLICY tasks_delete_policy ON tasks 
  FOR DELETE 
  USING (auth.uid() = owner_id OR auth.jwt() ->> 'role' = 'admin');