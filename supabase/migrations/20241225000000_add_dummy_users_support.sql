-- Add support for dummy users in project_members table

-- Add new columns for dummy users
ALTER TABLE project_members 
ADD COLUMN is_dummy BOOLEAN DEFAULT FALSE,
ADD COLUMN dummy_name TEXT DEFAULT NULL;

-- Update the insert policy to allow project members (not just owners) to add dummy users
-- Drop the existing policy
DROP POLICY IF EXISTS project_members_insert_policy ON project_members;

-- Create new policy that allows:
-- 1. Project owners to add any members (real or dummy)
-- 2. Project admins and members to add dummy users only
CREATE POLICY project_members_insert_policy ON project_members 
  FOR INSERT 
  WITH CHECK (
    -- Allow admin role (system admin)
    auth.jwt() ->> 'role' = 'admin'
    OR
    -- Allow project owners to add any members
    (
      EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = new.project_id 
        AND user_id = auth.uid() 
        AND role = 'owner'
      )
    )
    OR
    -- Allow project members (admin/member) to add dummy users only
    (
      new.is_dummy = true
      AND EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = new.project_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'member')
      )
    )
  );

-- Update the select policy to handle dummy users properly
-- Drop existing select policy
DROP POLICY IF EXISTS project_members_select_policy ON project_members;

-- Create a simpler select policy that avoids recursion
-- We'll rely on the projects table policies to control access
CREATE POLICY project_members_select_policy ON project_members 
  FOR SELECT 
  USING (
    -- System admin can see everything
    auth.jwt() ->> 'role' = 'admin'
    OR
    -- Users can see their own memberships
    auth.uid() = user_id
    OR
    -- Users can see project members if the project is accessible to them
    -- (relies on projects table RLS for permission checking)
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
    )
  );

-- Add index for performance on dummy user queries
CREATE INDEX idx_project_members_is_dummy ON project_members(is_dummy) WHERE is_dummy = true;

-- Add constraint to ensure dummy users have names
ALTER TABLE project_members 
ADD CONSTRAINT check_dummy_name 
CHECK (
  (is_dummy = false AND dummy_name IS NULL) 
  OR 
  (is_dummy = true AND dummy_name IS NOT NULL AND trim(dummy_name) != '')
);
