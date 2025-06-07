# Users and Organizations Table Design

## Overview

This document outlines a tech-agnostic table design for users and organizations that replaces the current dependency on Supabase's built-in `auth.users` table. The design maintains compatibility with existing foreign key relationships while supporting both individual users and organizational structures.

## Core Design Principles

- **Tech-agnostic**: No assumptions about specific database technology or authentication provider
- **Backward compatible**: Maintains existing `user_id` foreign key patterns
- **Flexible**: Supports users with or without organizational affiliation
- **Consistent**: Follows existing table conventions (UUIDs, timestamps, RLS patterns)

## Table Structures

### `users` Table

The primary users table stores essential user information.

```sql
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
```

#### Field Descriptions

- `id`: Primary key, UUID format for consistency with existing tables
- `email`: Unique identifier for authentication, required
- `display_name`: User's display name shown in the interface, required
- `first_name`, `last_name`: Optional personal name components
- `avatar_url`: Optional profile picture URL
- `phone`: Optional phone number for contact/verification
- `timezone`: User's timezone preference for date/time display
- `locale`: User's language/locale preference
- `email_verified`: Flag for email verification status
- `is_active`: Soft delete flag - inactive users cannot log in
- `last_login_at`: Tracking field for user activity
- `created_at`, `updated_at`: Standard audit fields

### `organizations` Table

Organizations represent companies, teams, or groups that users can belong to.

```sql
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
```

#### Field Descriptions

- `id`: Primary key, UUID format
- `name`: Organization's display name, required
- `slug`: URL-friendly unique identifier for the organization
- `description`: Optional description of the organization
- `domain`: Email domain for automatic organization membership (e.g., "@company.com")
- `logo_url`: Optional organization logo URL
- `website_url`: Optional organization website
- `billing_email`: Contact email for billing/administrative purposes
- Contact fields: `phone`, address components for organizational contact info
- `timezone`: Default timezone for organization operations
- `is_active`: Soft delete flag for organizations
- `created_at`, `updated_at`: Standard audit fields

### `user_organizations` Table

Many-to-many relationship table linking users to organizations with roles.

```sql
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
```

#### Field Descriptions

- `id`: Primary key for the relationship
- `user_id`: Reference to the user
- `organization_id`: Reference to the organization
- `role`: User's role within the organization (member, admin, owner, etc.)
- `is_primary`: Flag indicating if this is the user's primary organization
- `invited_by`: User who invited this user to the organization
- `invited_at`: When the invitation was sent
- `joined_at`: When the user accepted the invitation
- `created_at`, `updated_at`: Standard audit fields

#### Constraints

- Unique constraint on `(user_id, organization_id)` prevents duplicate memberships
- Only one primary organization per user (enforced by application logic or trigger)

## Role Definitions

### Organization Roles

- **owner**: Full control over the organization, including deleting it and managing all members
- **admin**: Can manage organization settings and members, but cannot delete the organization
- **member**: Basic membership with limited permissions
- **billing**: Can manage billing and subscription settings
- **readonly**: View-only access to organization resources

## Indexes and Performance

### Recommended Indexes

```sql
-- Performance indexes for common queries
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
```

## Row-Level Security (RLS)

Following the existing RLS patterns in the application:

### Users Table RLS

```sql
-- Users can view their own profile and profiles of users in shared organizations
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

-- Users can only update their own profile
CREATE POLICY users_update_policy ON users 
  FOR UPDATE 
  USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'admin');

-- System handles user creation (registration process)
CREATE POLICY users_insert_policy ON users 
  FOR INSERT 
  WITH CHECK (auth.uid() = id OR auth.jwt() ->> 'role' = 'admin');
```

### Organizations Table RLS

```sql
-- Users can view organizations they belong to
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

-- Organization owners/admins can update organization details
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
```

### User Organizations Table RLS

```sql
-- Users can view memberships in their organizations
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

-- Organization owners/admins can manage memberships
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
```

## Migration Considerations

### Compatibility with Existing System

This design maintains compatibility with the existing `user_id` foreign key references throughout the system:

- All existing tables that reference `auth.uid()` can reference `users.id` instead
- The UUID format remains consistent
- Existing RLS policies can be updated to use the new users table

### Migration Strategy

1. **Create new tables** alongside existing auth system
2. **Populate users table** from existing auth.users data
3. **Update foreign key references** gradually
4. **Update RLS policies** to use new users table
5. **Remove dependency** on auth.users once migration is complete

## Integration Patterns

### User Registration Flow

```sql
-- Example user creation with optional organization membership
INSERT INTO users (id, email, display_name, email_verified)
VALUES ('new-user-uuid', 'user@example.com', 'John Doe', false);

-- Auto-join organization based on email domain (if configured)
INSERT INTO user_organizations (user_id, organization_id, role)
SELECT 'new-user-uuid', id, 'member'
FROM organizations 
WHERE domain = 'example.com' AND is_active = true;
```

### Organization Management

```sql
-- Create organization and make creator the owner
WITH new_org AS (
  INSERT INTO organizations (name, slug) 
  VALUES ('Acme Corp', 'acme-corp') 
  RETURNING id
)
INSERT INTO user_organizations (user_id, organization_id, role, is_primary)
SELECT auth.uid(), new_org.id, 'owner', true
FROM new_org;
```

## Extended Features

### Additional Considerations

- **Audit trail**: Consider adding audit tables for tracking changes to user and organization data
- **Invitations**: Extend with invitation system for pending organization memberships
- **SSO integration**: Design supports integration with external authentication providers
- **API keys**: Can be extended with API key management for programmatic access
- **Billing integration**: Organization structure supports multi-tenant billing models

### Future Enhancements

- **Teams/Departments**: Sub-organizational groupings within organizations
- **Permissions**: Granular permission system beyond simple roles
- **User preferences**: Extended user settings and preferences
- **Organization hierarchies**: Parent/child organization relationships

## Related Documentation

- [User Profile Fields Analysis](./user-profile-fields.md) - Comprehensive analysis and justification of user profile fields, including privacy and functional considerations