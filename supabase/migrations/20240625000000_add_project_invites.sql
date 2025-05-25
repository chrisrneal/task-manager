-- Create enum for project invite status
CREATE TYPE project_invite_status AS ENUM ('pending', 'accepted', 'declined');

-- Create project_invites table
CREATE TABLE project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL,
  role project_member_role NOT NULL DEFAULT 'member',
  status project_invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dummy_user BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Project members with owner/admin roles can view invites for their project
CREATE POLICY project_invites_select_policy ON project_invites 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_invites.project_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Policy: Project members with owner/admin roles can create invites
CREATE POLICY project_invites_insert_policy ON project_invites 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = new.project_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Policy: Project members with owner/admin roles can update invites
CREATE POLICY project_invites_update_policy ON project_invites 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_invites.project_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
    -- Also allow the invitee to update their own invite status when accepting or declining
    OR (
      project_invites.status = 'pending' 
      AND project_invites.email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Project members with owner/admin roles can delete invites
CREATE POLICY project_invites_delete_policy ON project_invites 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_invites.project_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Function to handle invite acceptance and create project membership
CREATE OR REPLACE FUNCTION accept_project_invite()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- For regular users (not dummy users)
    IF NOT NEW.dummy_user THEN
      -- Get user ID from email if user exists
      DECLARE
        invitee_id UUID;
      BEGIN
        SELECT id INTO invitee_id FROM auth.users WHERE email = NEW.email;
        
        -- If user exists, create a project membership
        IF invitee_id IS NOT NULL THEN
          INSERT INTO project_members (project_id, user_id, role)
          VALUES (NEW.project_id, invitee_id, NEW.role)
          ON CONFLICT (project_id, user_id) 
          DO UPDATE SET role = NEW.role;
        END IF;
      END;
    ELSE
      -- For dummy users, we don't create a regular membership
      -- The app will handle displaying them differently
      NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invite acceptance
CREATE TRIGGER project_invite_acceptance
  AFTER UPDATE ON project_invites
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION accept_project_invite();