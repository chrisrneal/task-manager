# Admin User Setup Guide

The admin template management interface requires users to have admin privileges. This guide explains how to set up admin users.

## Quick Setup

1. **Register a user account** through the normal app registration process
2. **Run the admin setup script** with the user's email:
   ```bash
   node scripts/setup-admin.js admin@example.com
   ```
3. **Have the user log out and log back in** for the role to take effect
4. **Access the admin interface** at `/admin/templates`

## Admin Setup Script Usage

The `scripts/setup-admin.js` script provides several commands:

### Promote a user to admin
```bash
node scripts/setup-admin.js user@example.com
```

### List current admin users
```bash
node scripts/setup-admin.js --list
```

### Show help
```bash
node scripts/setup-admin.js --help
```

## Manual Setup (Alternative)

If you prefer to set up admin users manually through the Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Users
3. Find the user you want to promote
4. Click on the user to edit
5. In the "Raw App Meta Data" section, add:
   ```json
   {
     "role": "admin"
   }
   ```
6. Save the changes
7. Have the user log out and log back in

## Admin Features

Once a user has admin privileges, they will see:

- **Admin link in navigation** (both desktop and mobile)
- **Admin Templates page** at `/admin/templates` with abilities to:
  - View all project templates
  - Create new templates
  - Edit existing templates  
  - Delete templates
  - Template validation and error reporting

## Security Notes

- Admin privileges are stored in JWT claims via app_metadata
- All admin operations are logged in the `admin_audit_log` table
- Admin-only API endpoints are protected by role checks
- Users must log out/in after role changes for JWT to update

## Troubleshooting

### "Can't see the UI" 
- Ensure the user has been promoted to admin using the setup script
- Verify the user has logged out and back in after promotion
- Check that environment variables are properly set in `.env.local`

### "Access denied" errors
- Confirm the user's app_metadata includes `"role": "admin"`
- Verify SUPABASE_SERVICE_ROLE_KEY is correctly set
- Check that the admin migration has been applied

### Script errors
- Ensure `.env.local` contains both:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Verify the user exists in the authentication system first

## Environment Variables Required

Add these to your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The service role key is required for admin user management and can be found in your Supabase project settings under API keys.