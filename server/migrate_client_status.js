
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const runMigration = async () => {
    try {
        console.log('Running migration: Adding is_active to clients table...');

        // Add is_active column if it doesn't exist
        await pool.query(`
            ALTER TABLE clients 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        `);

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        await pool.end();
    }
};

runMigration();
