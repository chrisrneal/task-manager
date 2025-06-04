-- Admin Users Setup Migration
-- This migration sets up the infrastructure needed for admin role management

-- Create a function to check if a user is an admin
-- This function will check user metadata for an admin role
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the user has admin role in their metadata
  -- This can be set through Supabase dashboard or through API calls
  RETURN (
    SELECT COALESCE(
      (auth.jwt() ->> 'role') = 'admin' OR
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a helper function to set admin role
-- This can be called by a service role key to promote users to admin
CREATE OR REPLACE FUNCTION set_user_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Update user metadata to include admin role
  -- This requires service role privileges
  UPDATE auth.users 
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE id = user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on these functions
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_admin TO service_role;

-- Create a view for admin users (useful for debugging)
CREATE OR REPLACE VIEW admin_users AS
SELECT 
  id,
  email,
  created_at,
  raw_app_meta_data ->> 'role' as role
FROM auth.users
WHERE raw_app_meta_data ->> 'role' = 'admin';

-- Grant access to the view
GRANT SELECT ON admin_users TO authenticated;

-- Create RLS policy for the view
ALTER VIEW admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_policy ON admin_users
  FOR SELECT
  USING (is_admin());

-- Create audit log for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY admin_audit_log_policy ON admin_audit_log
  FOR SELECT
  USING (is_admin());

-- Create a function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  action_name TEXT,
  target_type TEXT DEFAULT NULL,
  target_id UUID DEFAULT NULL,
  action_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF is_admin() THEN
    INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), action_name, target_type, target_id, action_details);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION set_user_admin IS 'Promotes a user to admin role. Must be called with service role key.';
COMMENT ON FUNCTION is_admin IS 'Checks if the current user has admin role from JWT claims or metadata.';
COMMENT ON TABLE admin_audit_log IS 'Logs all admin actions for audit purposes.';