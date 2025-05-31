// Test script to check if dummy user functionality works with current database schema
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDummyUserFlow() {
  try {
    console.log('Testing dummy user functionality...');
    
    // First, let's check the current schema of project_members table
    const { data: tableInfo, error: schemaError } = await supabase
      .from('project_members')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.log('Schema check failed:', schemaError.message);
    } else {
      console.log('Current project_members schema (sample row):', tableInfo);
    }
    
    // Check if we can query the table structure
    const { data, error } = await supabase.rpc('get_table_columns', { 
      table_name: 'project_members' 
    });
    
    if (error) {
      console.log('Could not get table structure:', error.message);
    } else {
      console.log('Table columns:', data);
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testDummyUserFlow();
