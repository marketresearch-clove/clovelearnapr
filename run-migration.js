#!/usr/bin/env node
/**
 * Run SQL migration: Add expiry_date column to user_skill_achievements
 * Usage: node run-migration.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('ERROR: Missing environment variables');
    console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
    try {
        console.log('Running migration: Add expiry_date to user_skill_achievements...\n');

        const migration = `
      ALTER TABLE user_skill_achievements
      ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;

      CREATE INDEX IF NOT EXISTS idx_user_skill_achievements_expiry_date 
      ON user_skill_achievements(expiry_date);

      COMMENT ON COLUMN user_skill_achievements.expiry_date 
      IS 'Optional expiry date for the acquired skill. Set by admin. NULL means no expiry.';
    `;

        const { data, error } = await supabase.rpc('exec_sql', { sql: migration });

        if (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }

        console.log('✅ Migration completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Restart npm run dev');
        console.log('2. Try setting expiry dates on acquired skills via admin panel');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration:', err);
        process.exit(1);
    }
}

runMigration();
