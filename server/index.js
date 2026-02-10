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
app.use(express.urlencoded({ extended: true }));

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
const loginHandler = async (req, res) => {
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
            {
                id: user.id,
                email: user.email,
                role: user.role,
                client_id: user.client_id
            },
            secret,
            { expiresIn: '24h' }
        );

        // Fetch additional info if client?
        let clientData = null;
        if (user.client_id) {
            const clientResult = await query('SELECT name FROM clients WHERE id = $1', [user.client_id]);
            if (clientResult.rows.length > 0) {
                clientData = clientResult.rows[0];
            }
        }

        // Send response
        const responseData = {
            token,
            role: user.role,
            user: {
                id: user.id,
                email: user.email,
                name: clientData ? clientData.name : user.email.split('@')[0],
                client_id: user.client_id
            }
        };

        if (res.locals.warningMessage) {
            responseData.warning = res.locals.warningMessage;
        }

        res.json(responseData);

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

app.post('/api/auth/login', loginRateLimiter, loginHandler);
app.post('/api/login', loginRateLimiter, loginHandler);

// Debug route to check if endpoint is reachable via GET
app.get('/api/login', (req, res) => {
    res.json({ message: 'Login endpoint active. Please use POST to authenticate.' });
});

// Dashboard Stats Route
app.get('/api/stats', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const stats = {
            totalClients: 0,
            activeServices: 0,
            pendingPayments: 0,
            pendingAmount: 0,
            monthlyIncome: 0
        };

        // 1. Total Clients
        const clientsRes = await query('SELECT COUNT(*) FROM clients');
        stats.totalClients = parseInt(clientsRes.rows[0].count);

        // 2. Overdue Amount (Actual Morosos)
        // Includes:
        // - Services expired > 7 days ago
        // - OR services expired AND not covered by the "Pending" logic (to fill gaps)
        const overdueRes = await query(`
            SELECT COALESCE(SUM(COALESCE(special_price, cost)), 0) as total 
            FROM services 
            WHERE status = 'ACTIVE' 
            AND (
                expiration_date IS NULL 
                OR 
                (expiration_date + INTERVAL '7 days') < CURRENT_DATE
            )
        `);
        stats.overdueAmount = parseFloat(overdueRes.rows[0].total);

        // 3. Pending Amount (Upcoming + Grace Period)
        // Includes:
        // - Services expired but within grace period (Expiration < Today <= Expiration + 7)
        // - Services expiring soon (Today <= Expiration <= Today + 3 days)
        const pendingRes = await query(`
            SELECT COALESCE(SUM(COALESCE(special_price, cost)), 0) as total 
            FROM services 
            WHERE status = 'ACTIVE' 
            AND (
                -- Grace period case
                (expiration_date < CURRENT_DATE AND (expiration_date + INTERVAL '7 days') >= CURRENT_DATE)
                OR
                -- Upcoming case (next 3 days)
                (expiration_date >= CURRENT_DATE AND expiration_date <= (CURRENT_DATE + INTERVAL '3 days'))
            )
        `);
        stats.pendingAmount = parseFloat(pendingRes.rows[0].total);

        // 4. Monthly Income (Paid payments in current month)
        const incomeRes = await query(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM payments 
            WHERE status IN ('PAGADO', 'PAID') 
            AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)
        `);
        stats.monthlyIncome = parseFloat(incomeRes.rows[0].total);

        res.json(stats);
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

// Client Management Routes (Protected)
app.get('/api/clients', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            SELECT c.*, u.email as user_email, u.role,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', s.id,
                        'name', s.name,
                        'cost', s.cost,
                        'special_price', s.special_price,
                        'currency', s.currency,
                        'status', s.status,
                        'expiration_date', s.expiration_date,
                                   -- OVERDUE: Expired and past grace period (7 days)
                                   WHEN s.expiration_date IS NULL OR (s.expiration_date + INTERVAL '7 days') < CURRENT_DATE THEN 'OVERDUE'
                                   -- UPCOMING: Expired within grace period OR expiring in next 3 days
                                   WHEN (
                                       ((s.expiration_date + INTERVAL '7 days') >= CURRENT_DATE AND s.expiration_date < CURRENT_DATE)
                                       OR
                                       (s.expiration_date >= CURRENT_DATE AND s.expiration_date <= (CURRENT_DATE + INTERVAL '3 days'))
                                   ) THEN 'UPCOMING'
                                   ELSE 'PAID'
                               END
                    )
                ) FILTER(WHERE s.id IS NOT NULL),
                '[]'
            ) as services,
            COALESCE(SUM(COALESCE(s.special_price, s.cost)) FILTER(WHERE s.status = 'ACTIVE'), 0) as total_monthly,
            --Backward compatibility: string of service names
        COALESCE(string_agg(s.name, ', ') FILTER(WHERE s.status = 'ACTIVE'), 'Sin Servicio') as service_name,
            --General status: worst status among services(OVERDUE > UPCOMING > PAID)
        COALESCE(
            (SELECT 
                           CASE 
                               -- OVERDUE check
                               WHEN EXISTS(SELECT 1 FROM services s2 WHERE s2.client_id = c.id AND (s2.expiration_date IS NULL OR (s2.expiration_date + INTERVAL '7 days') < CURRENT_DATE)) THEN 'OVERDUE'
                               -- UPCOMING check (Grace period OR Next 3 days)
                               WHEN EXISTS(SELECT 1 FROM services s2 WHERE s2.client_id = c.id AND (
                                   ((s2.expiration_date + INTERVAL '7 days') >= CURRENT_DATE AND s2.expiration_date < CURRENT_DATE)
                                   OR
                                   (s2.expiration_date >= CURRENT_DATE AND s2.expiration_date <= (CURRENT_DATE + INTERVAL '3 days'))
                               )) THEN 'UPCOMING'
                               ELSE 'PAID'
                           END
        ), 'PAID'
                   ) as payment_status
            FROM clients c
            LEFT JOIN users u ON u.client_id = c.id
            LEFT JOIN services s ON s.client_id = c.id
            GROUP BY c.id, u.email, u.role
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
            `INSERT INTO clients(name, company_name, email, phone, domain, country, notes)
VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
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

        // 3. Create Services
        const services = req.body.services || [];
        if (services.length > 0) {
            for (const service of services) {
                await query(
                    `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed)
VALUES($1, $2, $3, $4, 'ACTIVE', 30, $5, (DATE_TRUNC('month', CURRENT_DATE) + (LEAST(30, EXTRACT(DAY FROM(DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')):: int) - 1) * INTERVAL '1 day'):: DATE, 30)`,
                    [clientId, service.name, service.cost || 0, service.currency || 'USD', service.special_price || null]
                );
            }
        } else if (service_name) {
            // Backward compatibility for single service
            await query(
                `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed)
VALUES($1, $2, $3, $4, 'ACTIVE', 30, $5, (DATE_TRUNC('month', CURRENT_DATE) + (LEAST(30, EXTRACT(DAY FROM(DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')):: int) - 1) * INTERVAL '1 day'):: DATE, 30)`,
                [clientId, service_name, cost || 0, currency || 'USD', req.body.special_price || null]
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

// Get services for a specific client (Secured)
app.get('/api/clients/:id/services', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Security check: Clients can only access their own services
    if (req.user.role === 'CLIENT' && parseInt(req.user.client_id) !== parseInt(id)) {
        return res.status(403).json({ message: 'Access denied' });
    }

    try {
        const result = await query('SELECT *, special_price FROM services WHERE client_id = $1', [id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching client services:', err);
        res.status(500).json({ message: 'Error fetching client services' });
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

        // Update or create services from array
        const services = req.body.services || [];

        // 1. Get existing service IDs
        const existingServicesResult = await query('SELECT id FROM services WHERE client_id = $1', [id]);
        const existingServiceIds = existingServicesResult.rows.map(row => row.id);

        // 2. Identify services to delete (present in DB but not in request)
        const incomingServiceIds = services.filter(s => s.id).map(s => s.id);
        const servicesToDelete = existingServiceIds.filter(id => !incomingServiceIds.includes(id));

        if (servicesToDelete.length > 0) {
            await query('DELETE FROM services WHERE id = ANY($1)', [servicesToDelete]);
        }

        // 3. Update or Insert services
        if (services.length > 0) {
            for (const service of services) {
                if (service.id) {
                    // Update existing service
                    await query(
                        `UPDATE services 
                         SET name = $1, cost = $2, currency = $3, special_price = $4
                         WHERE id = $5 AND client_id = $6`,
                        [service.name, service.cost || 0, service.currency || 'USD', service.special_price || null, service.id, id]
                    );
                } else {
                    // Create new service
                    await query(
                        `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed)
VALUES($1, $2, $3, $4, 'ACTIVE', 30, $5, (DATE_TRUNC('month', CURRENT_DATE) + (LEAST(30, EXTRACT(DAY FROM(DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')):: int) - 1) * INTERVAL '1 day'):: DATE, 30)`,
                        [id, service.name, service.cost || 0, service.currency || 'USD', service.special_price || null]
                    );
                }
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
// DELETE /api/clients/:id - Delete client and all related data
app.delete('/api/clients/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;

    try {
        await query('BEGIN');

        // 1. Delete associated payments
        await query('DELETE FROM payments WHERE client_id = $1', [id]);

        // 2. Delete associated services
        await query('DELETE FROM services WHERE client_id = $1', [id]);

        // 3. Delete associated users (login credentials)
        await query('DELETE FROM users WHERE client_id = $1', [id]);

        // 4. Delete the client record
        const result = await query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

        if (result.rowCount === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ message: 'Client not found' });
        }

        await query('COMMIT');

        console.log(`Client ${id} and all related data deleted successfully`);
        res.json({ message: 'Client deleted successfully' });

    } catch (err) {
        await query('ROLLBACK');
        console.error('Error deleting client:', err);
        res.status(500).json({ message: 'Error deleting client' });
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
SELECT
p.*,
    c.name as client_name,
    c.company_name,
    c.email as client_email,
    COALESCE(s.name, (SELECT name FROM services WHERE client_id = p.client_id ORDER BY id DESC LIMIT 1)) as service_name,
        COALESCE(s.cost, (SELECT cost FROM services WHERE client_id = p.client_id ORDER BY id DESC LIMIT 1)) as service_cost,
            COALESCE(s.currency, (SELECT currency FROM services WHERE client_id = p.client_id ORDER BY id DESC LIMIT 1)) as service_currency
            FROM payments p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN services s ON p.service_id = s.id
            ORDER BY p.payment_date DESC
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching payments:', err);
        res.status(500).json({ message: 'Error fetching payments' });
    }
});



// ============================================
// PAYMENT TRACKING ROUTES (Protected)
// ============================================

// Get payment summary for dashboard
app.get('/api/payments/summary', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
SELECT
COUNT(CASE WHEN status = 'VENCIDO' THEN 1 END) as overdue_count,
    COALESCE(SUM(CASE WHEN status = 'VENCIDO' THEN amount ELSE 0 END), 0) as overdue_amount,
    COUNT(CASE WHEN status = 'PENDIENTE' THEN 1 END) as pending_count,
    COALESCE(SUM(CASE WHEN status = 'PENDIENTE' THEN amount ELSE 0 END), 0) as pending_amount,
    COUNT(CASE WHEN status = 'PENDIENTE' AND due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as upcoming_count,
    COALESCE(SUM(CASE WHEN status = 'PENDIENTE' AND due_date <= CURRENT_DATE + INTERVAL '7 days' THEN amount ELSE 0 END), 0) as upcoming_amount
            FROM payments
    `);

        res.json({
            overdue: {
                count: parseInt(result.rows[0].overdue_count) || 0,
                totalAmount: parseFloat(result.rows[0].overdue_amount) || 0
            },
            pending: {
                count: parseInt(result.rows[0].pending_count) || 0,
                totalAmount: parseFloat(result.rows[0].pending_amount) || 0
            },
            upcoming: {
                count: parseInt(result.rows[0].upcoming_count) || 0,
                totalAmount: parseFloat(result.rows[0].upcoming_amount) || 0
            }
        });
    } catch (err) {
        console.error('Error fetching payment summary:', err);
        res.status(500).json({ message: 'Error fetching payment summary' });
    }
});

// Get overdue clients
app.get('/api/payments/overdue', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
SELECT
p.id as payment_id,
    p.amount,
    p.currency,
    p.due_date,
    p.status,
    CURRENT_DATE - p.due_date as days_overdue,
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.phone as client_phone,
    s.name as service_name
            FROM payments p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN services s ON p.service_id = s.id
            WHERE p.status = 'VENCIDO'
            ORDER BY p.due_date ASC
    `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching overdue payments:', err);
        res.status(500).json({ message: 'Error fetching overdue payments' });
    }
});

// Get upcoming payments (within specified days, default 7)
app.get('/api/payments/upcoming', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const days = parseInt(req.query.days) || 7;

    try {
        const result = await query(`
SELECT
p.id as payment_id,
    p.amount,
    p.currency,
    p.due_date,
    p.status,
    CAST(p.due_date - CURRENT_DATE AS INTEGER) as days_until_due,
    c.id as client_id,
    c.name as client_name,
    c.email as client_email,
    c.phone as client_phone,
    s.name as service_name
            FROM payments p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN services s ON p.service_id = s.id
            WHERE p.status = 'PENDIENTE' 
            AND p.due_date <= CURRENT_DATE + INTERVAL '${days} days'
            ORDER BY p.due_date ASC
    `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching upcoming payments:', err);
        res.status(500).json({ message: 'Error fetching upcoming payments' });
    }
});

// Get payment history for a specific client (Secured)
app.get('/api/payments/client/:clientId', authenticateToken, async (req, res) => {
    const { clientId } = req.params;

    // Security check: Clients can only access their own payments
    if (req.user.role === 'CLIENT' && parseInt(req.user.client_id) !== parseInt(clientId)) {
        return res.status(403).json({ message: 'Access denied' });
    }

    try {
        const result = await query(`
SELECT
p.*,
    s.name as service_name
            FROM payments p
            LEFT JOIN services s ON p.service_id = s.id
            WHERE p.client_id = $1
            ORDER BY p.payment_date DESC, p.due_date DESC
    `, [clientId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching client payments:', err);
        res.status(500).json({ message: 'Error fetching client payments' });
    }
});

// Register new payment with Prepaid Logic
app.post('/api/payments', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { client_id, service_id, amount, currency, payment_date, due_date, status, payment_method, notes, months_covered = 1 } = req.body;

    try {
        await query('BEGIN');

        // Insert payment
        const result = await query(`
            INSERT INTO payments(client_id, service_id, amount, currency, payment_date, due_date, status, payment_method, notes, months_covered)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *
    `, [client_id, service_id, amount, currency, payment_date, due_date, status, payment_method, notes, months_covered]);

        // Logic for Prepaid Services & Billing Alignment (Unified Policy: Day 30)
        if ((status === 'PAGADO' || status === 'PAID')) {
            const months = parseInt(months_covered) || 1;
            const targetServices = [];

            if (service_id && service_id !== 'all') {
                targetServices.push(service_id);
            } else {
                // Apply to all active services for this client
                const activeServices = await query('SELECT id FROM services WHERE client_id = $1 AND status = $2', [client_id, 'ACTIVE']);
                activeServices.rows.forEach(s => targetServices.push(s.id));
            }

            for (const sId of targetServices) {
                const serviceRes = await query('SELECT expiration_date, billing_day_fixed FROM services WHERE id = $1', [sId]);
                const service = serviceRes.rows[0];

                if (!service) continue;

                let newExpirationDate;
                const currentExpiration = service.expiration_date ? new Date(service.expiration_date) : null;
                const paymentDateObj = new Date(payment_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const billingDay = service.billing_day_fixed || 30;

                // SPECIAL CASE: Prepaid accounts (more than 1 month ahead)
                // Do not apply proration logic now, just extend normally
                const oneMonthFromNow = new Date(today);
                oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

                if (currentExpiration && currentExpiration > oneMonthFromNow) {
                    newExpirationDate = new Date(currentExpiration);
                    newExpirationDate.setMonth(newExpirationDate.getMonth() + months);
                } else if (currentExpiration && currentExpiration.getDate() !== billingDay) {
                    // PRORATION LOGIC: If not aligned to day 30, align it to the NEXT day 30
                    // This is the "Transition Payment"
                    newExpirationDate = new Date(currentExpiration > today ? currentExpiration : paymentDateObj);

                    // Move to the next month's day 30 (or last day)
                    newExpirationDate.setMonth(newExpirationDate.getMonth() + months);

                    // Force to the billing day (e.g., 30)
                    // handling months with fewer days (like Feb) automatically via JS Date
                    const lastDayOfMonth = new Date(newExpirationDate.getFullYear(), newExpirationDate.getMonth() + 1, 0).getDate();
                    newExpirationDate.setDate(Math.min(billingDay, lastDayOfMonth));
                } else {
                    // Standard extension
                    newExpirationDate = new Date(currentExpiration && currentExpiration > today ? currentExpiration : paymentDateObj);
                    newExpirationDate.setMonth(newExpirationDate.getMonth() + months);

                    // Enforce billing day alignment
                    const lastDayOfMonth = new Date(newExpirationDate.getFullYear(), newExpirationDate.getMonth() + 1, 0).getDate();
                    newExpirationDate.setDate(Math.min(billingDay, lastDayOfMonth));
                }

                await query(`
                    UPDATE services 
                    SET last_payment_date = $1,
    expiration_date = $2
                    WHERE id = $3
    `, [payment_date, newExpirationDate.toISOString().split('T')[0], sId]);
            }
        }

        await query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await query('ROLLBACK');
        console.error('Error creating payment:', err);
        res.status(500).json({ message: 'Error creating payment' });
    }
});

// Update payment
app.put('/api/payments/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    const { amount, currency, payment_date, due_date, status, payment_method, notes, months_covered } = req.body;

    try {
        await query('BEGIN');

        // Update payment
        const result = await query(`
            UPDATE payments 
            SET amount = $1, currency = $2, payment_date = $3, due_date = $4,
    status = $5, payment_method = $6, notes = $7, months_covered = $8
            WHERE id = $9
RETURNING *
    `, [amount, currency, payment_date, due_date, status, payment_method, notes, months_covered, id]);

        if (result.rows.length === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ message: 'Payment not found' });
        }

        const payment = result.rows[0];

        // Auto-recalculate Service Expiration if linked
        if (payment.service_id && (status === 'PAGADO' || status === 'PAID')) {
            // "Smart" Heuristic: The service expires at the latest date covered by ANY valid payment
            const expResult = await query(`
                SELECT MAX(payment_date + (COALESCE(months_covered, 1) || ' months'):: INTERVAL) as max_expiration
                FROM payments
                WHERE service_id = $1 AND status IN('PAGADO', 'PAID')
    `, [payment.service_id]);

            const newExpiration = expResult.rows[0].max_expiration;

            if (newExpiration) {
                await query(`
                    UPDATE services 
                    SET expiration_date = $1,
    last_payment_date = (SELECT MAX(payment_date) FROM payments WHERE service_id = $2 AND status IN('PAGADO', 'PAID'))
                    WHERE id = $2
    `, [newExpiration, payment.service_id]);
            }
        }

        await query('COMMIT');
        res.json(payment);
    } catch (err) {
        await query('ROLLBACK');
        console.error('Error updating payment:', err);
        res.status(500).json({ message: 'Error updating payment' });
    }
});

// Manual Service Expiration Override
app.put('/api/services/:id/expiration', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    const { expiration_date } = req.body; // Expects YYYY-MM-DD or ISO string

    try {
        const result = await query(`
            UPDATE services 
            SET expiration_date = $1
            WHERE id = $2
RETURNING *
    `, [expiration_date, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating service expiration:', err);
        res.status(500).json({ message: 'Error updating service expiration' });
    }
});

// N8N Integration Endpoint - Get clients needing notifications
app.get('/api/notifications/pending', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
SELECT
c.id as client_id,
    c.name as client_name,
    c.email,
    c.phone,
    s.name as service_name,
    p.amount as amount_due,
    p.currency,
    TO_CHAR(p.due_date, 'DD/MM/YYYY') as due_date,
    p.status,
    CASE 
                    WHEN p.status = 'VENCIDO' OR p.due_date < CURRENT_DATE THEN CURRENT_DATE - p.due_date
                    ELSE 0
END as days_overdue,
    CASE 
                    WHEN p.status = 'VENCIDO' OR p.due_date < CURRENT_DATE THEN 'overdue'
                    WHEN p.due_date = CURRENT_DATE THEN 'due_today'
                    ELSE 'upcoming'
END as notification_type
            FROM payments p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN services s ON p.service_id = s.id
            WHERE p.status IN('PENDIENTE', 'VENCIDO')
AND(
    p.status = 'VENCIDO'
                OR p.due_date <= CURRENT_DATE + INTERVAL '3 days'
)
            ORDER BY p.due_date ASC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ message: 'Error fetching notifications' });
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
    console.log(`Server running on port ${PORT} `);
});
