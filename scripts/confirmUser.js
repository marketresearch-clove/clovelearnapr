import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

// This script requires the SERVICE ROLE KEY (not anon key)
// The service role key bypasses email confirmation
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY; // You need to add this to .env.local

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing Supabase Service Role Key');
  console.log('\nTo use this script, you need to:');
  console.log('1. Go to your Supabase dashboard → Settings → API');
  console.log('2. Copy the "service_role" key (NOT the anon key)');
  console.log('3. Add it to your .env.local file as VITE_SUPABASE_SERVICE_KEY');
  console.log('\nAlternatively, disable email confirmation in your Supabase Auth settings.');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function confirmUser() {
  console.log('🔑 Using admin privileges to confirm user...');
  
  try {
    // Get the user first
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Failed to list users:', listError.message);
      return;
    }
    
    const user = users.find(u => u.email === 'hr@demo.com');
    
    if (!user) {
      console.log('❌ User hr@demo.com not found');
      return;
    }
    
    console.log('✅ Found user:', user.id);
    console.log('📧 Email confirmed:', user.email_confirmed_at !== null);
    
    if (user.email_confirmed_at === null) {
      // Update user to confirm email
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );
      
      if (updateError) {
        console.error('❌ Failed to confirm user:', updateError.message);
        return;
      }
      
      console.log('✅ User email confirmed successfully!');
    }
    
    // Now test login
    console.log('\n🧪 Testing login...');
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'hr@demo.com',
      password: 'hr@123',
    });
    
    if (loginError) {
      console.error('❌ Login still failed:', loginError.message);
    } else {
      console.log('✅ Login successful!');
      console.log('🎉 User can now login with hr@demo.com / hr@123');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

confirmUser();