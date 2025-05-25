-- Create project_invites table
CREATE TABLE project_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE,
  role project_member_role NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by UUID NOT NULL,
  dummy_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Project owners and admins can view their project's invitations
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

-- Policy: Project owners and admins can create invitations
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

-- Policy: Project owners and admins can update invitation status
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
    OR (
      -- Allow any user to accept an invitation to their own email
      project_invites.email = auth.email()
      AND NOT project_invites.dummy_user
      AND new.status IN ('accepted', 'declined')
    )
  );

-- Policy: Project owners and admins can delete invitations
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

-- Trigger to add user to project when invitation is accepted
CREATE OR REPLACE FUNCTION handle_invitation_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NOT NEW.dummy_user THEN
    -- Find the user with matching email
    DECLARE
      user_id UUID;
    BEGIN
      SELECT id INTO user_id FROM auth.users WHERE email = NEW.email;
      
      IF user_id IS NOT NULL THEN
        -- Add the user to the project with the specified role
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (NEW.project_id, user_id, NEW.role)
        ON CONFLICT (project_id, user_id) DO NOTHING;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_invitation_accepted
  AFTER UPDATE ON project_invites
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_invitation_accepted();