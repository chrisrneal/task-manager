-- Quick fix for the recursion issue in project_members select policy
-- Run this directly in Supabase SQL editor

-- Drop the problematic policy
DROP POLICY IF EXISTS project_members_select_policy ON project_members;

-- Create a temporary simple policy to fix the recursion
CREATE POLICY project_members_select_policy ON project_members 
  FOR SELECT 
  USING (
    -- System admin can see everything
    auth.jwt() ->> 'role' = 'admin'
    OR
    -- Users can see their own memberships
    auth.uid() = user_id
    OR
    -- For now, allow users to see project members if the project exists
    -- This relies on projects table RLS for access control
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
    )
  );
