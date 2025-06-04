-- Create users and organizations tables
-- This migration creates the organizations entity with user membership support

-- Create users table
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text UNIQUE NOT NULL,
  display_name      text NOT NULL,
  first_name        text,
  last_name         text,
  avatar_url        text,
  phone             text,
  timezone          text DEFAULT 'UTC',
  locale            text DEFAULT 'en',
  email_verified    boolean DEFAULT false,
  is_active         boolean DEFAULT true,
  last_login_at     timestamp with time zone,
  created_at        timestamp with time zone DEFAULT now(),
  updated_at        timestamp with time zone DEFAULT now()
);

-- Create organizations table
CREATE TABLE organizations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,
  description       text,
  domain            text,
  logo_url          text,
  website_url       text,
  billing_email     text,
  phone             text,
  address_line1     text,
  address_line2     text,
  city              text,
  state_province    text,
  postal_code       text,
  country           text,
  timezone          text DEFAULT 'UTC',
  is_active         boolean DEFAULT true,
  created_at        timestamp with time zone DEFAULT now(),
  updated_at        timestamp with time zone DEFAULT now()
);

-- Create user_organizations table (many-to-many relationship)
CREATE TABLE user_organizations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role              text NOT NULL DEFAULT 'member',
  is_primary        boolean DEFAULT false,
  invited_by        uuid REFERENCES users(id),
  invited_at        timestamp with time zone,
  joined_at         timestamp with time zone DEFAULT now(),
  created_at        timestamp with time zone DEFAULT now(),
  updated_at        timestamp with time zone DEFAULT now(),
  
  UNIQUE(user_id, organization_id)
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_last_login ON users(last_login_at);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;

CREATE INDEX idx_user_organizations_user ON user_organizations(user_id);
CREATE INDEX idx_user_organizations_org ON user_organizations(organization_id);
CREATE INDEX idx_user_organizations_role ON user_organizations(role);
CREATE INDEX idx_user_organizations_primary ON user_organizations(user_id, is_primary) WHERE is_primary = true;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Users table RLS policies
CREATE POLICY users_select_policy ON users 
  FOR SELECT 
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM user_organizations uo1, user_organizations uo2
      WHERE uo1.user_id = auth.uid() 
      AND uo2.user_id = users.id
      AND uo1.organization_id = uo2.organization_id
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY users_update_policy ON users 
  FOR UPDATE 
  USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY users_insert_policy ON users 
  FOR INSERT 
  WITH CHECK (auth.uid() = id OR auth.jwt() ->> 'role' = 'admin');

-- Organizations table RLS policies
CREATE POLICY organizations_select_policy ON organizations 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY organizations_update_policy ON organizations 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY organizations_insert_policy ON organizations 
  FOR INSERT 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR true);

-- User organizations table RLS policies
CREATE POLICY user_organizations_select_policy ON user_organizations 
  FOR SELECT 
  USING (
    user_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.organization_id = user_organizations.organization_id
      AND uo.user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY user_organizations_insert_policy ON user_organizations 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE organization_id = new.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY user_organizations_update_policy ON user_organizations 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE organization_id = user_organizations.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY user_organizations_delete_policy ON user_organizations 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE organization_id = user_organizations.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_organizations_updated_at BEFORE UPDATE ON user_organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create role enum for type safety
DO $$ BEGIN
    CREATE TYPE user_organization_role AS ENUM ('owner', 'admin', 'member', 'billing', 'readonly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add comments
COMMENT ON TABLE users IS 'Application users table - tech-agnostic replacement for auth.users';
COMMENT ON TABLE organizations IS 'Organizations/companies that users can belong to';
COMMENT ON TABLE user_organizations IS 'Many-to-many relationship between users and organizations with roles';

COMMENT ON COLUMN users.email IS 'Unique email address for user authentication';
COMMENT ON COLUMN users.display_name IS 'User display name shown in interface';
COMMENT ON COLUMN users.is_active IS 'Soft delete flag - inactive users cannot log in';
COMMENT ON COLUMN users.email_verified IS 'Email verification status';

COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN organizations.domain IS 'Email domain for auto-membership (e.g., @company.com)';
COMMENT ON COLUMN organizations.is_active IS 'Soft delete flag for organizations';

COMMENT ON COLUMN user_organizations.role IS 'User role within the organization (owner, admin, member, billing, readonly)';
COMMENT ON COLUMN user_organizations.is_primary IS 'Flag indicating if this is the user primary organization';
COMMENT ON COLUMN user_organizations.invited_by IS 'User who invited this user to the organization';