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
import multer from 'multer';
import fs from 'fs';
import { initAutomation, runBillingNotifications, sendMessage } from './services/automationService.js';

// Uploads Configuration (Volume mounted at /data in production)

// Uploads Configuration (Volume mounted at /data in production)
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Uploads Configuration (Volume mounted at /data in production)
const uploadRoot = process.platform === 'win32' 
    ? path.join(__dirname, '..', 'data') 
    : '/data';
const uploadDir = path.join(uploadRoot, 'capref');

if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Directory created: ${uploadDir}`);
    } catch (err) {
        console.error(`Error creating directory ${uploadDir}:`, err);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const app = express();
const PORT = process.env.PORT || 3000;

// Dashboard Activity Endpoint
app.get('/api/activity', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            (SELECT 
                'PAYMENT' as type,
                p.payment_date as activity_date,
                p.amount,
                p.currency,
                c.name as client_name,
                c.id as client_id,
                p.status as detail
            FROM payments p
            JOIN clients c ON p.client_id = c.id
            WHERE p.status IN ('PAGADO', 'PAID')
            ORDER BY p.payment_date DESC
            LIMIT 5)
            UNION ALL
            (SELECT 
                'NOTIFICATION' as type,
                n.sent_at as activity_date,
                NULL as amount,
                NULL as currency,
                c.name as client_name,
                c.id as client_id,
                n.type as detail
            FROM notification_logs n
            JOIN clients c ON n.client_id = c.id
            ORDER BY n.sent_at DESC
            LIMIT 5)
            ORDER BY activity_date DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching system activity:', err);
        res.status(500).json({ message: 'Error fetching system activity' });
    }
});

// Initialize Database Table
const initDb = async () => {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS notification_logs (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                channel VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'SENT',
                message_body TEXT,
                sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS message_body TEXT;
            
            ALTER TABLE clients 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;


        `);
        console.log('Database initialized: Tables ready.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initDb();
initAutomation();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Serving for Uploads
app.use('/uploads/capref', express.static(uploadDir));

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
            monthlyIncome: 0,
            grossRevenue: 0
        };

        // 1. Total Clients
        const clientsRes = await query('SELECT COUNT(*) FROM clients');
        stats.totalClients = parseInt(clientsRes.rows[0].count);

        // 2. Overdue Amount (Actual Morosos) - 5 days grace
        const overdueRes = await query(`
            SELECT COALESCE(SUM(
                CASE 
                    WHEN s.renewal_day = 30 THEN
                        (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                        (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                    ELSE
                        COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                END
            ), 0) as total 
            FROM services s
            WHERE s.status = 'ACTIVE' 
            AND (
                s.expiration_date IS NULL 
                OR 
                (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE
            )
        `);
        stats.overdueAmount = parseFloat(overdueRes.rows[0].total);

        // 3. Pending Amount (Upcoming + Grace Period) - 5 days grace
        const pendingRes = await query(`
            SELECT COALESCE(SUM(
                CASE 
                    WHEN s.renewal_day = 30 THEN
                        (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1))
                    ELSE
                        COALESCE(s.special_price, s.cost)
                END
            ), 0) as total 
            FROM services s
            WHERE s.status = 'ACTIVE' 
            AND (
                -- Grace period case (5 days)
                (s.expiration_date < CURRENT_DATE AND (s.expiration_date + INTERVAL '5 days') >= CURRENT_DATE)
                OR
                -- Upcoming case (next 3 days)
                (s.expiration_date >= CURRENT_DATE AND s.expiration_date <= (CURRENT_DATE + INTERVAL '3 days'))
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

        // 5. Gross Revenue (All time paid payments) - GROSS total as requested
        const grossRes = await query(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM payments 
            WHERE status IN ('PAGADO', 'PAID')
        `);
        stats.grossRevenue = parseFloat(grossRes.rows[0].total);

        // 6. Notifications Sent Today
        const notificationsRes = await query(`
            SELECT type, COUNT(*) as count
            FROM notification_logs
            WHERE DATE(sent_at) = CURRENT_DATE
            GROUP BY type
        `);

        stats.notificationsToday = {
            overdue: 0,
            upcoming: 0,
            total: 0
        };

        notificationsRes.rows.forEach(row => {
            if (row.type === 'overdue' || row.type === 'vencido') stats.notificationsToday.overdue += parseInt(row.count);
            if (row.type === 'upcoming' || row.type === 'por_vencer') stats.notificationsToday.upcoming += parseInt(row.count);
            stats.notificationsToday.total += parseInt(row.count);
        });

        res.json(stats);
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

// Manual Notification Trigger (Admin only)
app.post('/api/admin/automation/trigger', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await runBillingNotifications();
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json({ message: 'Automation loop completed', ...result });
    } catch (err) {
        console.error('Error triggering automation:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Manual Send (Single/Bulk via Evolution)
app.post('/api/messages/send', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
        return res.status(400).json({ message: 'Phone and message are required' });
    }

    try {
        await sendMessage(phone, message);
        res.json({ message: 'Message sent successfully' });
    } catch (err) {
        console.error('Error sending message:', err.response?.data || err.message);
        res.status(500).json({ 
            message: 'Error sending via Evolution API',
            details: err.response?.data || err.message
        });
    }
});

// ========================
// BOT CONTEXT API (For n8n EVA Agent)
// Protected by x-api-key header (EVOLUTION_API_KEY)
// ========================
app.get('/api/bot/client-context', async (req, res) => {
    // API Key authentication (no JWT needed for bot-to-bot communication)
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.EVOLUTION_API_KEY) {
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    }

    const { phone } = req.query;
    if (!phone) {
        return res.status(400).json({ message: 'Phone number is required (?phone=584140108030)' });
    }

    try {
        // Clean the phone number for flexible matching
        const cleanPhone = phone.replace(/\D/g, '');

        // 1. Find the client by phone (flexible match: exact, with +, partial)
        const clientResult = await query(`
            SELECT id, name, email, phone, company_name, domain, country, is_active, created_at
            FROM clients 
            WHERE REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', '') LIKE '%' || $1 || '%'
            LIMIT 1
        `, [cleanPhone.slice(-10)]); // Match last 10 digits for flexibility

        if (clientResult.rows.length === 0) {
            return res.json({
                cliente_existe: false,
                phone: phone,
                mensaje_instruccion: "Este número no está registrado como cliente. Trátalo como un cliente potencial. Ofrece información sobre los servicios y sugiere agendar una llamada de descubrimiento."
            });
        }

        const client = clientResult.rows[0];

        // 2. Get active services with debt calculation
        const servicesResult = await query(`
            SELECT 
                s.id,
                s.name as nombre,
                COALESCE(s.special_price, s.cost) as costo_mensual,
                s.currency as moneda,
                s.status as estado,
                s.renewal_day,
                s.expiration_date as vencimiento,
                s.created_at,
                -- Debt calculation (same logic as main app)
                CASE 
                    WHEN s.expiration_date >= CURRENT_DATE THEN 0
                    WHEN s.renewal_day = 30 THEN
                        (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                        (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                    ELSE
                        COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                END as deuda,
                -- Payment status
                CASE 
                    WHEN s.expiration_date IS NULL OR (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE THEN 'VENCIDO'
                    WHEN s.expiration_date < CURRENT_DATE THEN 'EN GRACIA'
                    WHEN s.expiration_date <= (CURRENT_DATE + INTERVAL '3 days') THEN 'PROXIMO A VENCER'
                    ELSE 'AL DIA'
                END as estado_pago,
                -- Days info
                CASE 
                    WHEN s.expiration_date < CURRENT_DATE THEN CURRENT_DATE - s.expiration_date
                    ELSE 0
                END as dias_vencido
            FROM services s
            WHERE s.client_id = $1 AND s.status = 'ACTIVE'
            ORDER BY s.expiration_date ASC
        `, [client.id]);

        // 3. Get last payment
        const lastPaymentResult = await query(`
            SELECT amount, payment_date, payment_method, status, service_month
            FROM payments 
            WHERE client_id = $1 AND status = 'PAID'
            ORDER BY payment_date DESC 
            LIMIT 1
        `, [client.id]);

        // 4. Get last notification/contact
        const lastContactResult = await query(`
            SELECT sent_at, type, message_body 
            FROM notification_logs 
            WHERE client_id = $1 
            ORDER BY sent_at DESC 
            LIMIT 1
        `, [client.id]);

        // 5. Calculate total debt
        const deudaTotal = servicesResult.rows.reduce((sum, s) => sum + parseFloat(s.deuda || 0), 0);

        // Build response
        const response = {
            cliente_existe: true,
            client_id: client.id,
            client_name: client.name,
            email: client.email,
            phone: client.phone,
            empresa: client.company_name,
            dominio: client.domain,
            pais: client.country,
            cliente_desde: client.created_at,
            
            servicios: servicesResult.rows.map(s => ({
                nombre: s.nombre,
                costo_mensual: parseFloat(s.costo_mensual),
                moneda: s.moneda,
                estado: s.estado,
                vencimiento: s.vencimiento,
                estado_pago: s.estado_pago,
                deuda: parseFloat(s.deuda || 0).toFixed(2),
                dias_vencido: parseInt(s.dias_vencido || 0)
            })),

            deuda_total: deudaTotal.toFixed(2),
            
            ultimo_pago: lastPaymentResult.rows.length > 0 ? {
                fecha: lastPaymentResult.rows[0].payment_date,
                monto: lastPaymentResult.rows[0].amount,
                metodo: lastPaymentResult.rows[0].payment_method,
                periodo: lastPaymentResult.rows[0].service_month
            } : null,

            ultimo_contacto: lastContactResult.rows.length > 0 ? {
                fecha: lastContactResult.rows[0].sent_at,
                tipo: lastContactResult.rows[0].type
            } : null,

            metodos_pago_aceptados: ["PayPal", "Zelle", "Pago Móvil", "Binance"],
            
            instruccion_pago: "Para coordinar el pago, el cliente debe contactar directamente al equipo de Adriel's Systems. NO proporciones datos bancarios, números de cuenta ni enlaces de pago. Simplemente indica que el equipo le asistirá con el proceso."
        };

        res.json(response);

    } catch (err) {
        console.error('Error fetching client context for bot:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Client Management Routes (Protected)
app.get('/api/clients', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            SELECT c.*, c.is_active, u.email as user_email, u.role,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', s.id,
                        'name', s.name,
                        'cost', s.cost,
                        'special_price', s.special_price,
                        'currency', s.currency,
                        'amount', (
                            CASE 
                                WHEN c.name = 'Martha Salazar' THEN
                                    (CASE WHEN (EXTRACT(YEAR FROM s.expiration_date) = 2023 AND EXTRACT(MONTH FROM s.expiration_date) = 12) THEN 20 
                                     ELSE 10 END) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                                WHEN s.renewal_day = 30 THEN
                                    CASE 
                                        WHEN s.expiration_date <= CURRENT_DATE THEN
                                            (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                                            (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                                        ELSE 0
                                    END
                                ELSE COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                            END
                        ),
                        'months_overdue', (
                            CASE 
                                WHEN s.renewal_day = 30 THEN 
                                    FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))) + 1
                                ELSE
                                    GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                            END
                        ),
                        'status', s.status,
                        'expiration_date', s.expiration_date,
                        'payment_status', CASE 
                                   --OVERDUE: Expired and past grace period(7 days)
                                   WHEN s.expiration_date IS NULL OR (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE THEN 'OVERDUE'
                                   --UPCOMING: Expired within grace period OR expiring in next 3 days
                                   WHEN(
                            ((s.expiration_date + INTERVAL '5 days') >= CURRENT_DATE AND s.expiration_date < CURRENT_DATE)
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
                --OVERDUE check (5 days grace)
                WHEN EXISTS(SELECT 1 FROM services s2 WHERE s2.client_id = c.id AND s2.status = 'ACTIVE' AND (s2.expiration_date IS NULL OR (s2.expiration_date + INTERVAL '5 days') < CURRENT_DATE)) THEN 'OVERDUE'
                --UPCOMING check (5 days grace period OR Next 3 days)
                WHEN EXISTS(SELECT 1 FROM services s2 WHERE s2.client_id = c.id AND s2.status = 'ACTIVE' AND (
                    ((s2.expiration_date + INTERVAL '5 days') >= CURRENT_DATE AND s2.expiration_date < CURRENT_DATE)
                    OR
                    (s2.expiration_date >= CURRENT_DATE AND s2.expiration_date <= (CURRENT_DATE + INTERVAL '3 days'))
                )) THEN 'UPCOMING'
                ELSE 'PAID'
            END
        ), 'PAID'
    ) as payment_status,
            -- Add expiration_date at client level (minimum expiration of active services)
            (SELECT MIN(s2.expiration_date) FROM services s2 WHERE s2.client_id = c.id AND s2.status = 'ACTIVE') as expiration_date
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

// Toggle Client Status (Active/Inactive)
app.put('/api/clients/:id/status', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    try {
        const result = await query(
            'UPDATE clients SET is_active = $1 WHERE id = $2 RETURNING *',
            [is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating client status:', err);
        res.status(500).json({ message: 'Error updating client status' });
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
        // Fixed Billing Logic: Everyone pays on the 30th.
        // If joining on day 28, 29, 30, the first bill is on the 30th of NEXT month (pro-rated + full month).
        const billingSql = `(
            CASE 
                WHEN EXTRACT(DAY FROM CURRENT_DATE) >= 28 THEN 
                    (DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '29 days')::DATE
                ELSE 
                    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '29 days')::DATE
            END
        )`;

        if (services.length > 0) {
            for (const service of services) {
                await query(
                    `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed)
                    VALUES($1, $2, $3, $4, 'ACTIVE', 30, $5, ${billingSql}, 30)`,
                    [clientId, service.name, service.cost || 0, service.currency || 'USD', service.special_price || null]
                );
            }
        } else if (service_name) {
            // Backward compatibility for single service
            await query(
                `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed)
                VALUES($1, $2, $3, $4, 'ACTIVE', 30, $5, ${billingSql}, 30)`,
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
    COUNT(CASE WHEN status IN ('VENCIDO', 'OVERDUE') THEN 1 END) as overdue_count,
    COALESCE(SUM(CASE WHEN status IN ('VENCIDO', 'OVERDUE') THEN amount ELSE 0 END), 0) as overdue_amount,
    COUNT(CASE WHEN status IN ('PENDIENTE', 'PENDING') THEN 1 END) as pending_count,
    COALESCE(SUM(CASE WHEN status IN ('PENDIENTE', 'PENDING') THEN amount ELSE 0 END), 0) as pending_amount,
    COUNT(CASE WHEN status IN ('PENDIENTE', 'PENDING') AND due_date <= CURRENT_DATE + INTERVAL '15 days' THEN 1 END) as upcoming_count,
    COALESCE(SUM(CASE WHEN status IN ('PENDIENTE', 'PENDING') AND due_date <= CURRENT_DATE + INTERVAL '15 days' THEN amount ELSE 0 END), 0) as upcoming_amount
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
                s.id as service_id,
                COALESCE(s.special_price, s.cost) as monthly_cost,
                s.currency,
                s.expiration_date as due_date,
                s.created_at,
                s.renewal_day,
                'VENCIDO' as status,
                CURRENT_DATE - s.expiration_date as days_overdue,
                c.id as client_id,
                c.name as client_name,
                c.email as client_email,
                c.phone as client_phone,
                s.name as service_name,
                -- Calculate full months elapsed since expiration
                GREATEST(1, EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date)) + 1) as months_overdue
            FROM services s
            JOIN clients c ON s.client_id = c.id
            WHERE s.status = 'ACTIVE' 
            AND s.expiration_date + INTERVAL '5 days' < CURRENT_DATE -- Overdue threshold (5 days grace)
            ORDER BY s.expiration_date ASC
        `);

        // Fetch notification status and calculate intelligent cumulative debt
        const clientsWithNotifications = await Promise.all(result.rows.map(async (row) => {
            // Notifications check
            const notifRes = await query(`
                SELECT sent_at FROM notification_logs 
                WHERE client_id = $1 
                AND DATE(sent_at) = CURRENT_DATE
                ORDER BY sent_at DESC LIMIT 1
            `, [row.client_id]);

            // DYNAMIC DEBT LOGIC
            let calculatedAmount = 0;
            const monthsOverdue = parseInt(row.months_overdue);

            if (row.renewal_day === 30) {
                // Pro-rated First Month + Full months since
                const monthlyCost = parseFloat(row.monthly_cost);
                // First period is handled by the initial months_overdue calculation in SQL if we adjust it, 
                // but let's do it precisely in JS here.
                const firstPeriodDays = (new Date(row.due_date).getTime() - new Date(row.created_at).getTime()) / (1000 * 3600 * 24) + 1;
                calculatedAmount = (monthlyCost / 30.0 * firstPeriodDays) + (monthlyCost * (monthsOverdue - 1));
            } else {
                calculatedAmount = parseFloat(row.monthly_cost) * monthsOverdue;
            }

            // Martha Salazar Special Exception (Historical Pricing)
            // User context: Dec 2025 was $20, Jan 2026+ is $10.
            // If expiration was Dec 2025, we add the $10 difference for that first month.
            const dueDate = new Date(row.due_date);
            if (row.client_email === 'gentepro80@gmail.com' && dueDate.getFullYear() === 2025 && dueDate.getMonth() === 11) {
                calculatedAmount += 10; // Adjustment for the $20 month
            }

            return {
                ...row,
                amount: calculatedAmount,
                last_notification_date: notifRes.rows.length > 0 ? notifRes.rows[0].sent_at : null
            };
        }));

        res.json(clientsWithNotifications);
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
                s.id as service_id,
                COALESCE(s.special_price, s.cost) as amount,
                s.currency,
                s.expiration_date as due_date,
                'UPCOMING' as status,
                CAST(s.expiration_date - CURRENT_DATE AS INTEGER) as days_until_due,
                c.id as client_id,
                c.name as client_name,
                c.email as client_email,
                c.phone as client_phone,
                s.name as service_name
            FROM services s
            JOIN clients c ON s.client_id = c.id
            WHERE s.status = 'ACTIVE' 
            AND s.expiration_date >= (CURRENT_DATE - INTERVAL '15 days') -- Show recently expired and upcoming
            AND s.expiration_date <= (CURRENT_DATE + INTERVAL '${days} days')
            ORDER BY s.expiration_date ASC
    `);

        // Fetch notification status for each client
        const clientsWithNotifications = await Promise.all(result.rows.map(async (row) => {
            const notifRes = await query(`
                SELECT sent_at FROM notification_logs 
                WHERE client_id = $1 
                AND DATE(sent_at) = CURRENT_DATE
                ORDER BY sent_at DESC LIMIT 1
    `, [row.client_id]);
            return {
                ...row,
                last_notification_date: notifRes.rows.length > 0 ? notifRes.rows[0].sent_at : null
            };
        }));

        res.json(clientsWithNotifications);
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

// Create new payment
app.post('/api/payments', authenticateToken, authorizeRole('ADMIN'), upload.single('evidence'), async (req, res) => {
    const { client_id, service_id, amount, currency, payment_date, due_date, status, payment_method, notes, months_covered = 1, service_month } = req.body;
    const evidence_path = req.file ? req.file.filename : null;

    try {
        await query('BEGIN');

        // Normalize service_id: if it's 'all', NaN, or not provided, treat as NULL for the payment record
        const normalizedServiceId = (service_id === 'all' || !service_id || isNaN(parseInt(service_id))) ? null : parseInt(service_id);

        // Insert payment
        const result = await query(`
            INSERT INTO payments(client_id, service_id, amount, currency, payment_date, due_date, status, payment_method, notes, months_covered, evidence_path, service_month)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *
    `, [client_id, normalizedServiceId, amount, currency, payment_date, due_date, status, payment_method, notes, months_covered, evidence_path, service_month]);

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
app.put('/api/payments/:id', authenticateToken, authorizeRole('ADMIN'), upload.single('evidence'), async (req, res) => {
    const { id } = req.params;
    const { amount, currency, payment_date, due_date, status, payment_method, notes, months_covered, service_month } = req.body;
    const new_evidence_path = req.file ? req.file.filename : null;

    try {
        await query('BEGIN');

        // Update payment
        const result = await query(`
            UPDATE payments 
            SET amount = $1, currency = $2, payment_date = $3, due_date = $4,
                status = $5, payment_method = $6, notes = $7, months_covered = $8, 
                service_month = $9,
                evidence_path = COALESCE($10, evidence_path)
            WHERE id = $11
            RETURNING *
        `, [amount, currency, payment_date, due_date, status, payment_method, notes, months_covered, service_month, new_evidence_path, id]);

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

// DELETE payment endpoint
app.delete('/api/payments/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;

    try {
        await query('BEGIN');

        // Fetch payment details before deletion for recalculation
        const paymentRes = await query('SELECT service_id, status FROM payments WHERE id = $1', [id]);
        if (paymentRes.rows.length === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ message: 'Payment not found' });
        }

        const payment = paymentRes.rows[0];

        // Delete the payment
        await query('DELETE FROM payments WHERE id = $1', [id]);

        // Auto-recalculate Service Expiration if linked
        if (payment.service_id && (payment.status === 'PAGADO' || payment.status === 'PAID')) {
            const expResult = await query(`
                SELECT MAX(payment_date + (COALESCE(months_covered, 1) || ' months'):: INTERVAL) as max_expiration,
                       MAX(payment_date) as last_payment
                FROM payments
                WHERE service_id = $1 AND status IN('PAGADO', 'PAID')
            `, [payment.service_id]);

            const newExpiration = expResult.rows[0].max_expiration;
            const lastPayment = expResult.rows[0].last_payment;

            if (newExpiration) {
                await query(`
                    UPDATE services 
                    SET expiration_date = $1, last_payment_date = $2, status = 'ACTIVE'
                    WHERE id = $3
                `, [newExpiration, lastPayment, payment.service_id]);
            } else {
                // No more payments, maybe set to null or a default
                await query(`
                    UPDATE services 
                    SET expiration_date = NULL, last_payment_date = NULL, status = 'ACTIVE'
                    WHERE id = $1
                `, [payment.service_id]);
            }
        }

        await query('COMMIT');
        res.json({ message: 'Payment deleted and service status updated' });
    } catch (err) {
        await query('ROLLBACK');
        console.error('Error deleting payment:', err);
        res.status(500).json({ message: 'Error deleting payment' });
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

// NEW: Message Dashboard Data Route
app.get('/api/contacts/status', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                c.id, c.name, c.email, c.phone, c.is_active,
                COALESCE(
                    (SELECT SUM(COALESCE(s.special_price, s.cost)) 
                     FROM services s 
                     WHERE s.client_id = c.id AND s.status = 'ACTIVE'
                    ), 0) as monthly_revenue,
                (SELECT COUNT(*) FROM services s WHERE s.client_id = c.id AND s.status = 'ACTIVE') as services_count,
                (SELECT MAX(sent_at) FROM notification_logs nl WHERE nl.client_id = c.id) as last_contact,
                -- Dynamic Debt Calculation (Pro-rated for 30th cycle)
                COALESCE(
                    (SELECT SUM(
                        CASE 
                            WHEN s.renewal_day = 30 THEN
                                (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                                (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                            ELSE
                                COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                        END
                    )
                    FROM services s
                    WHERE s.client_id = c.id 
                    AND s.status = 'ACTIVE' 
                    AND (s.expiration_date IS NULL OR (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE)
                ), 0) as total_debt,
                CASE 
                    WHEN EXISTS (SELECT 1 FROM services s WHERE s.client_id = c.id AND s.status = 'ACTIVE' AND (s.expiration_date IS NULL OR (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE)) THEN 'OVERDUE'
                    ELSE 'PAID'
                END as status
            FROM clients c
            ORDER BY c.name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching contacts status:', err);
        res.status(500).json({ message: 'Error fetching contacts status' });
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
            AND c.is_active = true
            AND (
                p.status = 'VENCIDO' OR p.due_date <= CURRENT_DATE + INTERVAL '3 days'
            )
            ORDER BY p.due_date ASC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
});

// Notification Logging Endpoint
// GET /api/notifications/log - Get notification history
app.get('/api/notifications/log', authenticateToken, async (req, res) => {
    const { limit = 50, date, client_id } = req.query;

    try {
        let queryText = `
            SELECT 
                nl.id,
                nl.type,
                nl.channel,
                nl.status,
                nl.sent_at,
                c.id as client_id,
                c.name as client_name,
                c.email as client_email,
                c.phone as client_phone
            FROM notification_logs nl
            JOIN clients c ON nl.client_id = c.id
            WHERE 1=1
        `;

        const queryParams = [];
        let paramCount = 1;

        if (date) {
            queryText += ` AND DATE(nl.sent_at) = $${paramCount}`;
            queryParams.push(date);
            paramCount++;
        }

        if (client_id) {
            queryText += ` AND nl.client_id = $${paramCount}`;
            queryParams.push(client_id);
            paramCount++;
        }

        queryText += ` ORDER BY nl.sent_at DESC LIMIT $${paramCount}`;
        queryParams.push(limit);

        const result = await query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching notification logs:', err);
        res.status(500).json({ message: 'Error fetching notification logs' });
    }
});

// POST /api/notifications/log - Log a new notification
app.post('/api/notifications/log', authenticateToken, async (req, res) => {
    const { client_id, type, channel, status, message_body } = req.body;

    console.log('Received notification log request:', { client_id, type, channel, status });

    try {
        await query(
            `INSERT INTO notification_logs(client_id, type, channel, status, message_body) VALUES($1, $2, $3, $4, $5)`,
            [client_id, type, channel, status || 'SENT', message_body || null]
        );
        res.json({ message: 'Notification logged successfully' });
    } catch (err) {
        console.error('Error logging notification:', err);
        console.error('Request body was:', req.body);
        res.status(500).json({ message: 'Error logging notification', error: err.message });
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
