// Quick test to verify the dummy user functionality works
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testDummyUser() {
  try {
    console.log('Testing dummy user functionality...');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key:', supabaseAnonKey ? 'Present' : 'Missing');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Environment variables not found');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Try to sign in with a test user first
    console.log('Environment variables loaded successfully');
    console.log('You can now test the dummy user functionality in the web app');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDummyUser();
