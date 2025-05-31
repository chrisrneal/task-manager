-- Fix circular dependency between projects and project_members policies

-- Drop existing policies to rebuild them without circular dependencies
DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_update_policy ON projects;
DROP POLICY IF EXISTS projects_delete_policy ON projects;
DROP POLICY IF EXISTS project_members_select_policy ON project_members;
DROP POLICY IF EXISTS project_members_insert_policy ON project_members;

-- PROJECTS TABLE POLICIES (don't reference project_members to avoid recursion)
-- Simple approach: use projects.user_id for ownership checks

-- Projects SELECT: Users can see projects they own + system admin
CREATE POLICY projects_select_policy ON projects 
  FOR SELECT 
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR auth.uid() = user_id
  );

-- Projects UPDATE: Only owners and admins can update
CREATE POLICY projects_update_policy ON projects 
  FOR UPDATE 
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR auth.uid() = user_id
  );

-- Projects DELETE: Only owners can delete  
CREATE POLICY projects_delete_policy ON projects 
  FOR DELETE 
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR auth.uid() = user_id
  );

-- PROJECT_MEMBERS TABLE POLICIES (use projects.user_id for ownership checks)

-- Project members SELECT: Users can see members of projects they own
CREATE POLICY project_members_select_policy ON project_members 
  FOR SELECT 
  USING (
    auth.jwt() ->> 'role' = 'admin'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id 
      AND p.user_id = auth.uid()
    )
  );

-- Project members INSERT: Only project owners can add members
CREATE POLICY project_members_insert_policy ON project_members 
  FOR INSERT 
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id 
      AND p.user_id = auth.uid()
    )
  );
