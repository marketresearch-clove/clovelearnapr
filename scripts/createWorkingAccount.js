import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createWorkingAccount() {
  console.log('🎯 Creating a working test account...\n');
  
  // Create a user with a more realistic email that might bypass some filters
  const testEmail = 'test.user.skillspire@gmail.com';
  const testPassword = 'Test@123456';
  
  console.log(`Creating user: ${testEmail}`);
  console.log(`Password: ${testPassword}\n`);
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) {
    console.error('❌ Sign up failed:', signUpError.message);
    return;
  }
  
  console.log('✅ User created successfully!');
  console.log('User ID:', signUpData.user?.id);
  
  if (signUpData.session) {
    console.log('🎉 SUCCESS! User can login immediately!');
    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    console.log('\n🚀 Use these credentials in your app!');
  } else {
    console.log('📧 Confirmation email sent to:', testEmail);
    console.log('\n⚠️  This user needs email confirmation.');
    console.log('\n🔧 TO USE THIS ACCOUNT:');
    console.log('1. Check the email inbox for confirmation');
    console.log('2. Click the confirmation link');
    console.log('3. Then login with the credentials above');
    console.log('\n💡 OR: Disable email confirmation in Supabase settings');
  }
  
  // Also create a simple demo account that might work
  console.log('\n' + '='.repeat(50));
  console.log('🔄 Trying alternative account...\n');
  
  const simpleEmail = 'demo@skillspire.app';
  const simplePassword = 'demo123';
  
  const { data: simpleData, error: simpleError } = await supabase.auth.signUp({
    email: simpleEmail,
    password: simplePassword,
  });

  if (!simpleError) {
    console.log('✅ Alternative account created:');
    console.log(`Email: ${simpleEmail}`);
    console.log(`Password: ${simplePassword}`);
    
    if (simpleData.session) {
      console.log('🎉 This account can login immediately!');
    }
  }
}

createWorkingAccount();