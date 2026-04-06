import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createCategoriesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Enable RLS
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

    -- Add RLS Policies
    DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
    CREATE POLICY "Anyone can view categories" ON public.categories
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
    CREATE POLICY "Admins can manage categories" ON public.categories
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
      );

    -- Seed initial categories
    INSERT INTO public.categories (name) 
    VALUES 
      ('Programming'), 
      ('Design'), 
      ('Marketing'), 
      ('Business'), 
      ('Sales'), 
      ('Data Science')
    ON CONFLICT (name) DO NOTHING;
  `;

  try {
    console.log('Creating categories table and seeding data...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error executing SQL:', error);
      if (error.message.includes('function "exec_sql" does not exist')) {
        console.error('The "exec_sql" function is missing in Supabase. Please create it first.');
      }
      process.exit(1);
    }

    console.log('✅ Categories table created and seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

createCategoriesTable();
