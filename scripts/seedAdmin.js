
import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL.replace('adrielssystems_postgres', 'localhost');
const pool = new Pool({
    connectionString,
});

const seedAdmin = async () => {
    const email = 'rhectoroc@gmail.com';
    const plainPassword = '04uoC4Miq5a3';
    const role = 'ADMIN';

    try {
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Check if user exists
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (res.rows.length > 0) {
            console.log('Admin user already exists. Updating password...');
            await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);
        } else {
            console.log('Creating new admin user...');
            await pool.query(
                'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
                [email, hashedPassword, role]
            );
        }

        console.log('Admin user seeded successfully.');
    } catch (err) {
        console.error('Error seeding admin user:', err);
    } finally {
        await pool.end();
    }
};

seedAdmin();
