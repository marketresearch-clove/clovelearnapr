import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAlternativeLogin() {
  console.log('🧪 Testing alternative login credentials...\n');
  
  const testCredentials = [
    { email: 'demo@hr.com', password: 'hr@123' },
    { email: 'hr@demo.com', password: 'hr@123' }
  ];
  
  for (const creds of testCredentials) {
    console.log(`Testing: ${creds.email} / ${creds.password}`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    
    if (error) {
      console.log(`❌ Failed: ${error.message}\n`);
    } else {
      console.log('✅ SUCCESS! Login works!');
      console.log(`🎉 User: ${data.user.email}`);
      console.log(`🆔 User ID: ${data.user.id}`);
      console.log(`⏰ Session expires: ${new Date(data.session.expires_at * 1000).toLocaleString()}`);
      console.log('\n🚀 You can now use these credentials in your app!');
      return;
    }
  }
  
  console.log('❌ Both login attempts failed.');
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Go to your Supabase dashboard → Authentication → Providers → Email');
  console.log('2. Toggle OFF "Confirm email"');
  console.log('3. Save settings');
  console.log('4. Try logging in again');
}

testAlternativeLogin();