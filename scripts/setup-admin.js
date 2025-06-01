#!/usr/bin/env node

/**
 * Admin User Setup Script
 * 
 * This script helps set up admin users for the task manager application.
 * It can promote existing users to admin or create instructions for manual setup.
 * 
 * Usage:
 *   node scripts/setup-admin.js <email>
 *   node scripts/setup-admin.js --list
 *   node scripts/setup-admin.js --help
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAdminUsers() {
  try {
    console.log('📋 Listing current admin users...\n');
    
    const { data, error } = await supabase
      .from('admin_users')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching admin users:', error.message);
      return;
    }
    
    if (data.length === 0) {
      console.log('🔍 No admin users found.');
    } else {
      console.log('👑 Current admin users:');
      data.forEach(user => {
        console.log(`   - ${user.email} (created: ${new Date(user.created_at).toLocaleDateString()})`);
      });
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

async function promoteUserToAdmin(email) {
  try {
    console.log(`🔄 Promoting ${email} to admin...`);
    
    // First check if user exists
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError.message);
      return;
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User with email ${email} not found.`);
      console.log('\n💡 To create an admin user:');
      console.log('   1. Have the user sign up through the normal registration process');
      console.log(`   2. Run: node scripts/setup-admin.js ${email}`);
      return;
    }
    
    // Update user metadata to include admin role
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          ...user.app_metadata,
          role: 'admin'
        }
      }
    );
    
    if (updateError) {
      console.error('❌ Error promoting user to admin:', updateError.message);
      return;
    }
    
    console.log(`✅ Successfully promoted ${email} to admin!`);
    console.log('\n📝 Next steps:');
    console.log('   1. The user needs to log out and log back in for role to take effect');
    console.log('   2. They can then access the admin interface at /admin/templates');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

function showHelp() {
  console.log(`
🛠️  Admin User Setup Script

USAGE:
  node scripts/setup-admin.js <email>     Promote user to admin
  node scripts/setup-admin.js --list      List current admin users  
  node scripts/setup-admin.js --help      Show this help

EXAMPLES:
  node scripts/setup-admin.js admin@example.com
  node scripts/setup-admin.js --list

REQUIREMENTS:
  - NEXT_PUBLIC_SUPABASE_URL in .env.local
  - SUPABASE_SERVICE_ROLE_KEY in .env.local
  - User must already be registered in the system

NOTES:
  - Users must log out and back in after promotion
  - Admin users can access /admin/templates
  - This script requires service role permissions
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }
  
  if (args[0] === '--list' || args[0] === '-l') {
    await listAdminUsers();
    return;
  }
  
  const email = args[0];
  
  if (!email || !email.includes('@')) {
    console.error('❌ Please provide a valid email address');
    console.log('Usage: node scripts/setup-admin.js <email>');
    process.exit(1);
  }
  
  await promoteUserToAdmin(email);
}

main().catch(console.error);