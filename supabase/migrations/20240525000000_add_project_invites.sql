-- Create enum for project invite status
CREATE TYPE project_invite_status AS ENUM ('pending', 'accepted', 'declined');

-- Create project_invites table
CREATE TABLE project_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role project_member_role NOT NULL,
  status project_invite_status DEFAULT 'pending' NOT NULL,
  token UUID DEFAULT uuid_generate_v4() NOT NULL,
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (project_id, email, status)
);

-- Enable Row Level Security
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;

-- Create index on token for quick lookups
CREATE INDEX project_invites_token_idx ON project_invites (token);

-- Policy: Project owners/admins can view invites for their project
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

-- Policy: Project owners/admins can create invites
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

-- Policy: Project owners/admins can update invites
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
    -- Allow users to update their own invitations (for accepting/declining)
    OR (
      project_invites.status = 'pending' AND
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE email = project_invites.email
        AND id = auth.uid()
      )
    )
  );

-- Policy: Project owners/admins can delete invites
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

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_project_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE TRIGGER project_invites_updated_at
  BEFORE UPDATE ON project_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_project_invites_updated_at();