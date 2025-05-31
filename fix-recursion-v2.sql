-- Simple fix for recursion - allow all project members to see and manage project members

-- Drop the problematic policies
DROP POLICY IF EXISTS project_members_insert_policy ON project_members;
DROP POLICY IF EXISTS project_members_select_policy ON project_members;

-- Simple INSERT policy: only project owners can add members
CREATE POLICY project_members_insert_policy ON project_members 
  FOR INSERT 
  WITH CHECK (
    -- Allow system admin
    auth.jwt() ->> 'role' = 'admin'
    OR
    -- Allow project owners (check via projects table to avoid recursion)
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id 
      AND p.user_id = auth.uid()
    )
  );

-- Simple SELECT policy: all project members can see all project members
CREATE POLICY project_members_select_policy ON project_members 
  FOR SELECT 
  USING (
    -- System admin can see everything
    auth.jwt() ->> 'role' = 'admin'
    OR
    -- Users can see their own memberships
    auth.uid() = user_id
    OR
    -- Users can see project members if they own the project (via projects table)
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id 
      AND p.user_id = auth.uid()
    )
  );
