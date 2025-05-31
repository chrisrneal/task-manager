// Script to apply the dummy users migration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrationSQL = `
-- Add support for dummy users in project_members table

-- Add new columns for dummy users
ALTER TABLE project_members 
ADD COLUMN IF NOT EXISTS is_dummy BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dummy_name TEXT DEFAULT NULL;

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

-- Create new select policy that allows viewing:
-- 1. Your own memberships
-- 2. All members (including dummy) of projects you're a member of
-- 3. System admins can see everything
CREATE POLICY project_members_select_policy ON project_members 
  FOR SELECT 
  USING (
    -- System admin can see everything
    auth.jwt() ->> 'role' = 'admin'
    OR
    -- Users can see their own memberships
    auth.uid() = user_id
    OR
    -- Users can see all members (including dummy) of projects they belong to
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()
    )
  );

-- Add constraint to ensure dummy users have names
DO $$
BEGIN
  ALTER TABLE project_members 
  ADD CONSTRAINT check_dummy_name 
  CHECK (
    (is_dummy = false AND dummy_name IS NULL) 
    OR 
    (is_dummy = true AND dummy_name IS NOT NULL AND trim(dummy_name) != '')
  );
EXCEPTION 
  WHEN duplicate_object THEN 
    -- Constraint already exists, skip
    NULL;
END $$;
`;

async function applyMigration() {
  try {
    console.log('Applying dummy users migration...');
    
    const { error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  }
}

applyMigration();
