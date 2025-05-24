-- Create enum for project member roles
CREATE TYPE project_member_role AS ENUM ('owner', 'admin', 'member');

-- Create project_members table
CREATE TABLE project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role project_member_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own memberships
CREATE POLICY project_members_select_policy ON project_members 
  FOR SELECT 
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- Policy: Project owners can insert new members
CREATE POLICY project_members_insert_policy ON project_members 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = new.project_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Policy: Project owners can update member roles
CREATE POLICY project_members_update_policy ON project_members 
  FOR UPDATE 
  USING (
    -- Only owners can update memberships
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_members.project_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Policy: Project owners can delete members
CREATE POLICY project_members_delete_policy ON project_members 
  FOR DELETE 
  USING (
    -- Only owners can delete memberships
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_members.project_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Constraints: Each project must have exactly one owner
CREATE OR REPLACE FUNCTION check_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is an update that's trying to change the owner role
  IF (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner') THEN
    -- Count how many owners would remain
    IF (SELECT COUNT(*) FROM project_members 
        WHERE project_id = NEW.project_id 
        AND role = 'owner' 
        AND user_id != OLD.user_id) = 0 THEN
      RAISE EXCEPTION 'Cannot change the role of the only owner';
    END IF;
  END IF;

  -- Check if this is a delete that's trying to remove the owner
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') THEN
    -- Count how many owners would remain
    IF (SELECT COUNT(*) FROM project_members 
        WHERE project_id = OLD.project_id 
        AND role = 'owner' 
        AND user_id != OLD.user_id) = 0 THEN
      RAISE EXCEPTION 'Cannot delete the only owner';
    END IF;
  END IF;

  -- For delete operations, return OLD to allow the delete to proceed
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce owner constraints
CREATE TRIGGER project_owner_constraint
  BEFORE UPDATE OR DELETE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION check_project_owner();

-- Migrate existing projects to project_members table
INSERT INTO project_members (project_id, user_id, role)
SELECT id, user_id, 'owner'::project_member_role
FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Update Projects table RLS to use membership instead of direct user_id
-- First drop the existing policy
DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_insert_policy ON projects;
DROP POLICY IF EXISTS projects_update_policy ON projects;
DROP POLICY IF EXISTS projects_delete_policy ON projects;

-- Create new policies that check project_members table
-- Policy: Users can view projects they are members of
CREATE POLICY projects_select_policy ON projects 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = projects.id
      AND user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Policy: Users can insert projects (they automatically become the owner)
CREATE POLICY projects_insert_policy ON projects 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update projects they own or admin
CREATE POLICY projects_update_policy ON projects 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = projects.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Policy: Only owners can delete projects
CREATE POLICY projects_delete_policy ON projects 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = projects.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Add a trigger to automatically create a membership when a project is created
CREATE OR REPLACE FUNCTION create_project_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_owner_membership
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_owner_membership();