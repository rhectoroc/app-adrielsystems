import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query } from './db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticateToken, authorizeRole } from './middleware/auth.js';
import { rateLimiter, loginRateLimiter, clearLoginAttempts } from './middleware/rateLimiter.js';

// Configuration
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Apply general rate limiting to all routes
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));

// API Routes
app.get('/api/health', async (req, res) => {
    try {
        const result = await query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        console.error('Database connection error', err);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});

// Auth Routes (Real Implementation)
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login attempt for: ${email}`);

    try {
        // Check if user exists
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Clear failed login attempts on successful login
        const ip = req.ip || req.connection.remoteAddress;
        clearLoginAttempts(email, ip);

        // Generate Token
        const secret = process.env.AUTH_SECRET || 'dev_secret';
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            secret,
            { expiresIn: '24h' }
        );

        // Fetch additional info if client?
        let extraInfo = {};
        if (user.role === 'CLIENT') {
            // Future: fetch client details
        }

        // Send warning message if applicable
        const response = {
            token,
            role: user.role,
            user: {
                id: user.id,
                email: user.email,
                name: user.email.split('@')[0], // Fallback name
            }
        };

        if (res.locals.warningMessage) {
            response.warning = res.locals.warningMessage;
        }

        res.json(response);

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Client Management Routes (Protected)
app.get('/api/clients', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            SELECT c.*, u.email as user_email, u.role, 
                   s.name as service_name, s.cost, s.currency, s.status as service_status
            FROM clients c
            LEFT JOIN users u ON u.client_id = c.id
            LEFT JOIN services s ON s.client_id = c.id
            ORDER BY c.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching clients:', err);
        res.status(500).json({ message: 'Error fetching clients' });
    }
});

app.post('/api/clients', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { name, company_name, email, phone, domain, country, notes, password, service_name, cost, currency } = req.body;

    try {
        await query('BEGIN');

        // 1. Create Client
        const clientResult = await query(
            `INSERT INTO clients (name, company_name, email, phone, domain, country, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [name, company_name, email, phone, domain, country, notes]
        );
        const clientId = clientResult.rows[0].id;

        // 2. Create User (if email provided)
        if (email && password) {
            const saltRounds = 10;
            const hash = await bcrypt.hash(password, saltRounds);
            await query(
                'INSERT INTO users (email, password_hash, role, client_id) VALUES ($1, $2, $3, $4)',
                [email, hash, 'CLIENT', clientId]
            );
        }

        // 3. Create Service from Plan Schema
        if (service_name) {
            await query(
                `INSERT INTO services (client_id, name, cost, currency, status, renewal_day) 
                 VALUES ($1, $2, $3, $4, 'ACTIVE', 1)`,
                [clientId, service_name, cost || 0, currency || 'USD']
            );
        }

        await query('COMMIT');
        res.status(201).json({ message: 'Client created successfully', clientId });
    } catch (err) {
        await query('ROLLBACK');
        console.error('Error creating client:', err);
        if (err.constraint === 'users_email_key' || err.constraint === 'clients_email_key') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Error creating client' });
    }
});

app.put('/api/clients/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    const { name, company_name, email, phone, domain, country, notes, service_name, cost, currency } = req.body;

    try {
        await query('BEGIN');

        // Update client info
        await query(
            `UPDATE clients 
             SET name = $1, company_name = $2, email = $3, phone = $4, domain = $5, country = $6, notes = $7
             WHERE id = $8`,
            [name, company_name, email, phone, domain, country, notes, id]
        );

        // Update or create service if plan is provided
        if (service_name) {
            // Check if service exists for this client
            const existingService = await query(
                'SELECT id FROM services WHERE client_id = $1',
                [id]
            );

            if (existingService.rows.length > 0) {
                // Update existing service
                await query(
                    `UPDATE services 
                     SET name = $1, cost = $2, currency = $3
                     WHERE client_id = $4`,
                    [service_name, cost || 0, currency || 'USD', id]
                );
            } else {
                // Create new service
                await query(
                    `INSERT INTO services (client_id, name, cost, currency, status, renewal_day) 
                     VALUES ($1, $2, $3, $4, 'ACTIVE', 1)`,
                    [id, service_name, cost || 0, currency || 'USD']
                );
            }
        }

        await query('COMMIT');
        res.json({ message: 'Client updated successfully' });
    } catch (err) {
        await query('ROLLBACK');
        console.error('Error updating client:', err);
        res.status(500).json({ message: 'Error updating client' });
    }
});

// Plans Management Routes (Protected)
app.get('/api/plans', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query('SELECT * FROM plans ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching plans:', err);
        res.status(500).json({ message: 'Error fetching plans' });
    }
});

app.post('/api/plans', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { name, description, cost, currency, billing_cycle } = req.body;
    try {
        const result = await query(
            'INSERT INTO plans (name, description, cost, currency, billing_cycle) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, description, cost, currency, billing_cycle]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating plan:', err);
        res.status(500).json({ message: 'Error creating plan' });
    }
});

app.put('/api/plans/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    const { name, description, cost, currency, billing_cycle } = req.body;
    try {
        await query(
            `UPDATE plans 
             SET name = $1, description = $2, cost = $3, currency = $4, billing_cycle = $5
             WHERE id = $6`,
            [name, description, cost, currency, billing_cycle, id]
        );
        res.json({ message: 'Plan updated successfully' });
    } catch (err) {
        console.error('Error updating plan:', err);
        res.status(500).json({ message: 'Error updating plan' });
    }
});

// Payment Management Routes (Protected)
app.get('/api/payments', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            SELECT p.*, c.name as client_name, c.company_name, c.email as client_email
            FROM payments p
            JOIN clients c ON p.client_id = c.id
            ORDER BY p.payment_date DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching payments:', err);
        res.status(500).json({ message: 'Error fetching payments' });
    }
});

// Serve Static Files (Production)
// In production, we serve the 'dist' folder generated by Vite
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for SPA routing
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        // 404 for API routes
        return res.status(404).json({ message: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
