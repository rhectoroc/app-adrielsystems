import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { handleIncomingWebhook, approvePaymentById, registerEvolutionWebhook, processWebChatMessage } from './services/agentService.js';
import { getAuthForProfile } from './services/googleService.js';
import { google } from 'googleapis';

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
// FIX-06: File type validation — only allow images
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed: ${file.mimetype}. Only images (JPEG, PNG, WebP, GIF) are accepted.`));
        }
    }
});

const app = express();
const PORT = process.env.PORT || 3000;

// FIX-02: Trust proxy for correct IP detection behind Easypanel/Nginx
app.set('trust proxy', 1);

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

            -- User Management: Add new columns and update role constraint
            ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_notifications BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
            
            -- Update role constraint to include EMPLOYEE
            ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
            ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'EMPLOYEE', 'CLIENT'));

            -- AI Agent conversations table
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                sender VARCHAR(50) NOT NULL,
                message_content TEXT NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sender VARCHAR(50);
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_content TEXT;
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

            -- AI Agent payment approvals table
            CREATE TABLE IF NOT EXISTS payment_approvals (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                client_name VARCHAR(255),
                phone VARCHAR(50) NOT NULL,
                analysis TEXT,
                status VARCHAR(50) DEFAULT 'PENDING',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP WITH TIME ZONE
            );

            -- AI Agent executive logs table
            CREATE TABLE IF NOT EXISTS arc_logs (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                sender VARCHAR(255) NOT NULL,
                message_content TEXT NOT NULL,
                tool_used VARCHAR(255),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database initialized: Tables ready.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initDb();
initAutomation();

// Middleware
// FIX-10: Helmet for security headers (XSS protection, Content-Type sniffing, etc.)
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for SPA compatibility

// FIX-01: CORS restricted to allowed origins only
const ALLOWED_ORIGINS = [
    process.env.APP_URL, // e.g. https://app.adrielssystems.com
    'http://localhost:5173', // Vite dev
    'http://localhost:3000'  // Local server
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static Serving for Uploads
app.use('/uploads/capref', express.static(uploadDir));

// Apply general rate limiting to all routes
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 200 }));

// API Routes
// FIX-03: Rate limit on public health endpoint (stricter)
const strictRateLimit = rateLimiter({ windowMs: 60 * 1000, max: 10 }); // 10 req/min

app.get('/api/health', strictRateLimit, async (req, res) => {
    try {
        const result = await query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        console.error('Database connection error', err);
        res.status(500).json({ status: 'error', message: 'Service unavailable' });
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

// FIX-09: Debug route removed (was leaking endpoint info)

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

        // Count active services that are unpaid (due date is null or in the past)
        const pendingCountRes = await query(`
            SELECT COUNT(*) FROM services 
            WHERE status = 'ACTIVE' 
            AND (expiration_date IS NULL OR expiration_date < CURRENT_DATE)
        `);
        stats.pendingPayments = parseInt(pendingCountRes.rows[0].count);

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
// FIX-07: Cooldown to prevent WhatsApp spam/blocking
let lastAutomationTrigger = 0;
const AUTOMATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

app.post('/api/admin/automation/trigger', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const now = Date.now();
    const elapsed = now - lastAutomationTrigger;
    if (elapsed < AUTOMATION_COOLDOWN_MS) {
        const remaining = Math.ceil((AUTOMATION_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ message: `Cooldown activo. Intenta de nuevo en ${remaining} segundos.` });
    }

    try {
        lastAutomationTrigger = now;
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
// FIX-08: Validate phone format and limit message length
// FIX-11: Sanitize error responses
app.post('/api/messages/send', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
        return res.status(400).json({ message: 'Phone and message are required' });
    }

    // Validate phone format (digits only, 10-15 chars)
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return res.status(400).json({ message: 'Invalid phone number format (10-15 digits required)' });
    }

    // Limit message length
    if (message.length > 4096) {
        return res.status(400).json({ message: 'Message too long (max 4096 characters)' });
    }

    try {
        await sendMessage(cleanPhone, message);
        res.json({ message: 'Message sent successfully' });
    } catch (err) {
        console.error('Error sending message:', err.response?.data || err.message);
        res.status(500).json({ message: 'Error sending message. Please try again.' });
    }
});

// ========================
// BOT CONTEXT API (For n8n EVA Agent)
// Protected by x-api-key header (EVOLUTION_API_KEY)
// ========================
// FIX-03: Strict rate limit on bot endpoint to prevent enumeration
const botRateLimit = rateLimiter({ windowMs: 60 * 1000, max: 30 }); // 30 req/min

app.get('/api/bot/client-context', botRateLimit, async (req, res) => {
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
                    WHEN s.renewal_day IN (15, 30) THEN
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
                        'created_at', s.created_at,
                        'amount', (
                            CASE 
                                WHEN c.name = 'Martha Salazar' THEN
                                    (CASE WHEN (EXTRACT(YEAR FROM s.expiration_date) = 2023 AND EXTRACT(MONTH FROM s.expiration_date) = 12) THEN 20 
                                     ELSE 10 END) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                                WHEN s.renewal_day IN (15, 30) THEN
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
                                WHEN s.renewal_day IN (15, 30) THEN 
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

        if (services.length > 0) {
            for (const service of services) {
                const serviceStartDate = service.created_at || new Date().toISOString().split('T')[0];
                const renewalDaySql = `(CASE WHEN EXTRACT(DAY FROM $5::DATE) <= 15 THEN 15 ELSE 30 END)`;
                const billingSql = `(
                    CASE 
                        WHEN EXTRACT(DAY FROM $5::DATE) <= 15 THEN 
                            (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + INTERVAL '14 days')::DATE
                        ELSE 
                            (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + (LEAST(30, EXTRACT(DAY FROM (DATE_TRUNC('month', $5::DATE + INTERVAL '2 months') - INTERVAL '1 day'))::INT) - 1) * INTERVAL '1 day')::DATE
                    END
                )`;
                await query(
                    `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed, created_at)
                    VALUES($1, $2, $3, $4, 'ACTIVE', ${renewalDaySql}, $6, ${billingSql}, ${renewalDaySql}, $5)`,
                    [clientId, service.name, service.cost || 0, service.currency || 'USD', serviceStartDate, service.special_price || null]
                );
            }
        } else if (service_name) {
            // Backward compatibility for single service
            const serviceStartDate = new Date().toISOString().split('T')[0];
            const renewalDaySql = `(CASE WHEN EXTRACT(DAY FROM $5::DATE) <= 15 THEN 15 ELSE 30 END)`;
            const billingSql = `(
                CASE 
                    WHEN EXTRACT(DAY FROM $5::DATE) <= 15 THEN 
                        (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + INTERVAL '14 days')::DATE
                    ELSE 
                        (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + (LEAST(30, EXTRACT(DAY FROM (DATE_TRUNC('month', $5::DATE + INTERVAL '2 months') - INTERVAL '1 day'))::INT) - 1) * INTERVAL '1 day')::DATE
                END
            )`;
            await query(
                `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed, created_at)
                VALUES($1, $2, $3, $4, 'ACTIVE', ${renewalDaySql}, $6, ${billingSql}, ${renewalDaySql}, $5)`,
                [clientId, service_name, cost || 0, currency || 'USD', serviceStartDate, req.body.special_price || null]
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
                const serviceStartDate = service.created_at || new Date().toISOString().split('T')[0];
                const renewalDaySql = `(CASE WHEN EXTRACT(DAY FROM $5::DATE) <= 15 THEN 15 ELSE 30 END)`;
                if (service.id) {
                    // Update existing service
                    const billingSql = `(
                        CASE 
                            WHEN EXTRACT(DAY FROM $5::DATE) <= 15 THEN 
                                (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + INTERVAL '14 days')::DATE
                            ELSE 
                                (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + (LEAST(30, EXTRACT(DAY FROM (DATE_TRUNC('month', $5::DATE + INTERVAL '2 months') - INTERVAL '1 day'))::INT) - 1) * INTERVAL '1 day')::DATE
                        END
                    )`;
                    await query(
                        `UPDATE services 
                         SET name = $1, cost = $2, currency = $3, special_price = $4, created_at = $5,
                             renewal_day = ${renewalDaySql},
                             billing_day_fixed = ${renewalDaySql},
                             expiration_date = CASE 
                                 WHEN last_payment_date IS NULL THEN ${billingSql}
                                 ELSE expiration_date
                             END
                         WHERE id = $6 AND client_id = $7`,
                        [service.name, service.cost || 0, service.currency || 'USD', service.special_price || null, serviceStartDate, service.id, id]
                    );
                } else {
                    // Create new service
                    const billingSql = `(
                        CASE 
                            WHEN EXTRACT(DAY FROM $5::DATE) <= 15 THEN 
                                (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + INTERVAL '14 days')::DATE
                            ELSE 
                                (DATE_TRUNC('month', $5::DATE + INTERVAL '1 month') + (LEAST(30, EXTRACT(DAY FROM (DATE_TRUNC('month', $5::DATE + INTERVAL '2 months') - INTERVAL '1 day'))::INT) - 1) * INTERVAL '1 day')::DATE
                        END
                    )`;
                    await query(
                        `INSERT INTO services(client_id, name, cost, currency, status, renewal_day, special_price, expiration_date, billing_day_fixed, created_at)
                         VALUES($1, $2, $3, $4, 'ACTIVE', ${renewalDaySql}, $6, ${billingSql}, ${renewalDaySql}, $5)`,
                        [id, service.name, service.cost || 0, service.currency || 'USD', serviceStartDate, service.special_price || null]
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
// Get payment summary for dashboard
app.get('/api/payments/summary', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            SELECT
                s.id as service_id,
                COALESCE(s.special_price, s.cost) as monthly_cost,
                s.currency,
                s.expiration_date as due_date,
                s.created_at,
                s.renewal_day,
                c.email as client_email,
                GREATEST(1, EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date)) + 1) as months_overdue
            FROM services s
            JOIN clients c ON s.client_id = c.id
            WHERE s.status = 'ACTIVE'
        `);

        let overdueCount = 0;
        let overdueAmount = 0;
        let pendingCount = 0;
        let pendingAmount = 0;
        let upcomingCount = 0;
        let upcomingAmount = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const row of result.rows) {
            const monthlyCost = parseFloat(row.monthly_cost) || 0;
            if (!row.due_date) {
                // If expiration_date is NULL, treat as overdue (needs initialization/payment)
                overdueCount++;
                overdueAmount += monthlyCost;
                continue;
            }

            const dueDate = new Date(row.due_date);
            dueDate.setHours(0, 0, 0, 0);

            // Calculate grace period date (due_date + 5 days)
            const graceDate = new Date(dueDate);
            graceDate.setDate(graceDate.getDate() + 5);

            // Calculate upcoming threshold date (today + 7 days)
            const upcomingThreshold = new Date(today);
            upcomingThreshold.setDate(upcomingThreshold.getDate() + 7);

            if (graceDate < today) {
                // 1. OVERDUE (En Mora) - Exceeded 5 days grace
                overdueCount++;
                
                let calculatedAmount = 0;
                const monthsOverdue = parseInt(row.months_overdue) || 1;

                if (row.renewal_day === 30 || row.renewal_day === 15) {
                    const start = new Date(row.created_at);
                    const end = new Date(row.due_date);
                    const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
                    const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
                    const firstPeriodDays = Math.round((utcEnd - utcStart) / (1000 * 3600 * 24)) + 1;
                    calculatedAmount = (monthlyCost / 30.0 * firstPeriodDays) + (monthlyCost * (monthsOverdue - 1));
                } else {
                    calculatedAmount = monthlyCost * monthsOverdue;
                }

                // Martha Salazar Special Exception (Historical Pricing)
                if (row.client_email === 'gentepro80@gmail.com' && dueDate.getFullYear() === 2025 && dueDate.getMonth() === 11) {
                    calculatedAmount += 10;
                }

                overdueAmount += Math.round(calculatedAmount * 100) / 100;

            } else if (dueDate < today && graceDate >= today) {
                // 2. PENDING (Pendiente) - Expired but within 5 days of grace
                pendingCount++;
                pendingAmount += monthlyCost;
            } else if (dueDate >= today && dueDate <= upcomingThreshold) {
                // 3. UPCOMING (Próximos a pagar) - Expiring in next 7 days
                upcomingCount++;
                upcomingAmount += monthlyCost;
            }
        }

        res.json({
            overdue: {
                count: overdueCount,
                totalAmount: Math.round(overdueAmount * 100) / 100
            },
            pending: {
                count: pendingCount,
                totalAmount: Math.round(pendingAmount * 100) / 100
            },
            upcoming: {
                count: upcomingCount,
                totalAmount: Math.round(upcomingAmount * 100) / 100
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

            if (row.renewal_day === 30 || row.renewal_day === 15) {
                // Pro-rated First Month + Full months since
                const monthlyCost = parseFloat(row.monthly_cost);
                // Calculate firstPeriodDays using date-only components (ignoring timezone / time-of-day offsets)
                const start = new Date(row.created_at);
                const end = new Date(row.due_date);
                const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
                const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
                const firstPeriodDays = Math.round((utcEnd - utcStart) / (1000 * 3600 * 24)) + 1;
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

            calculatedAmount = Math.round(calculatedAmount * 100) / 100;

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
            AND s.expiration_date >= (CURRENT_DATE - INTERVAL '5 days') -- Show recently expired (grace period) and upcoming
            AND s.expiration_date <= (CURRENT_DATE + $1 * INTERVAL '1 day')
            ORDER BY s.expiration_date ASC
    `, [days]);

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

        // Send WhatsApp receipt confirmation if status is PAGADO/PAID
        if (status === 'PAGADO' || status === 'PAID') {
            try {
                const clientRes = await query('SELECT name, phone FROM clients WHERE id = $1', [client_id]);
                const client = clientRes.rows[0];
                if (client && client.phone) {
                    const cleanPhone = client.phone.replace(/\D/g, '');
                    if (cleanPhone.length >= 10) {
                        const msg = `Estimado/a *${client.name}*, le confirmamos que hemos recibido y registrado su pago con éxito en nuestro sistema administrativo:

💰 *Monto:* ${amount} ${currency}
💳 *Método:* ${payment_method || 'N/A'}
📅 *Fecha:* ${payment_date}
📝 *Concepto:* ${notes || 'Pago de servicio'}

Su cuenta se encuentra al día. ¡Agradecemos su confianza en Adriel's Systems! ✨`;
                        
                        await sendMessage(cleanPhone, msg);
                        await query(
                            'INSERT INTO notification_logs (client_id, type, channel, status, message_body) VALUES ($1, $2, $3, $4, $5)',
                            [client_id, 'receipt', 'whatsapp', 'SENT', msg]
                        );
                    }
                }
            } catch (sendErr) {
                console.error('Error sending payment receipt WhatsApp (POST):', sendErr.message);
            }
        }

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

        // Fetch previous status to prevent double WhatsApp sending
        const prevPaymentRes = await query('SELECT status FROM payments WHERE id = $1', [id]);
        const prevStatus = prevPaymentRes.rows[0]?.status;

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

        // Send WhatsApp receipt confirmation if status changed to PAGADO/PAID
        if ((prevStatus !== 'PAGADO' && prevStatus !== 'PAID') && (status === 'PAGADO' || status === 'PAID')) {
            try {
                const clientRes = await query('SELECT name, phone FROM clients WHERE id = $1', [payment.client_id]);
                const client = clientRes.rows[0];
                if (client && client.phone) {
                    const cleanPhone = client.phone.replace(/\D/g, '');
                    if (cleanPhone.length >= 10) {
                        const msg = `Estimado/a *${client.name}*, le confirmamos que hemos recibido y registrado su pago con éxito en nuestro sistema administrativo:

💰 *Monto:* ${amount} ${currency}
💳 *Método:* ${payment_method || 'N/A'}
📅 *Fecha:* ${payment_date}
📝 *Concepto:* ${notes || 'Pago de servicio'}

Su cuenta se encuentra al día. ¡Agradecemos su confianza en Adriel's Systems! ✨`;
                        
                        await sendMessage(cleanPhone, msg);
                        await query(
                            'INSERT INTO notification_logs (client_id, type, channel, status, message_body) VALUES ($1, $2, $3, $4, $5)',
                            [payment.client_id, 'receipt', 'whatsapp', 'SENT', msg]
                        );
                    }
                }
            } catch (sendErr) {
                console.error('Error sending payment receipt WhatsApp (PUT):', sendErr.message);
            }
        }

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
                ROUND(COALESCE(
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
                ), 0)::numeric, 2) as total_debt,
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
// FIX-05: Restrict to ADMIN only (was accessible by any authenticated user)
app.get('/api/notifications/pending', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
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
// FIX-05: Restrict to ADMIN only (was accessible by any authenticated user including CLIENT)
app.post('/api/notifications/log', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
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

// ========================
// USER MANAGEMENT ROUTES (ADMIN only)
// ========================

// GET /api/users — List all users
app.get('/api/users', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    try {
        const result = await query(`
            SELECT u.id, u.email, u.role, u.client_id, u.receive_notifications, u.phone, u.created_at,
                   c.name as client_name
            FROM users u
            LEFT JOIN clients c ON u.client_id = c.id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// POST /api/users — Create new user
app.post('/api/users', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { email, password, role, phone, receive_notifications, client_id } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password and role are required' });
    }

    if (!['ADMIN', 'EMPLOYEE', 'CLIENT'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be ADMIN, EMPLOYEE or CLIENT' });
    }

    try {
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);

        const result = await query(
            `INSERT INTO users (email, password_hash, role, phone, receive_notifications, client_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role, phone, receive_notifications, created_at`,
            [email, hash, role, phone || null, receive_notifications || false, client_id || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating user:', err);
        if (err.constraint === 'users_email_key') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Error creating user' });
    }
});

// PUT /api/users/:id — Update user
app.put('/api/users/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    const { email, password, role, phone, receive_notifications, client_id } = req.body;

    if (!['ADMIN', 'EMPLOYEE', 'CLIENT'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be ADMIN, EMPLOYEE or CLIENT' });
    }

    try {
        // If password is provided, update it. Otherwise keep existing hash.
        if (password && password.trim() !== '') {
            const saltRounds = 10;
            const hash = await bcrypt.hash(password, saltRounds);
            await query(
                `UPDATE users SET email = $1, password_hash = $2, role = $3, phone = $4, receive_notifications = $5, client_id = $6
                 WHERE id = $7`,
                [email, hash, role, phone || null, receive_notifications || false, client_id || null, id]
            );
        } else {
            await query(
                `UPDATE users SET email = $1, role = $2, phone = $3, receive_notifications = $4, client_id = $5
                 WHERE id = $6`,
                [email, role, phone || null, receive_notifications || false, client_id || null, id]
            );
        }

        res.json({ message: 'User updated successfully' });
    } catch (err) {
        console.error('Error updating user:', err);
        if (err.constraint === 'users_email_key') {
            return res.status(400).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Error updating user' });
    }
});

// ==========================================
// AI Agent Bot Webhook & Payment Approval Routes
// ==========================================

// Webhook for Evolution API
app.post('/api/webhooks/whatsapp', handleIncomingWebhook);

// ============================================
// PUBLIC CALENDAR ENDPOINTS (No Auth Required)
// ============================================

// GET /api/availability - Returns available time slots for the next 7 business days
app.get('/api/availability', async (req, res) => {
    try {
        const auth = await getAuthForProfile('SYSTEM');
        if (!auth) {
            return res.status(503).json({ error: 'Calendar service unavailable' });
        }

        const calendar = google.calendar({ version: 'v3', auth });
        const now = new Date();
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

        // Get all existing events in the next 14 days
        const eventsRes = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime'
        });
        const busyEvents = eventsRes.data.items || [];

        // Build available slots: Mon-Fri, 9am-6pm (Venezuela time, UTC-4), 1hr slots
        const slots = [];
        const SLOT_DURATION_MS = 60 * 60 * 1000;
        const BUSINESS_START_HOUR = 9;
        const BUSINESS_END_HOUR = 18;
        const TZ_OFFSET_MS = -4 * 60 * 60 * 1000;

        const cursor = new Date(now);
        cursor.setHours(cursor.getHours() + 1, 0, 0, 0); // Start from next full hour

        let slotsGenerated = 0;
        while (slotsGenerated < 20) {
            const localHour = ((cursor.getUTCHours() + (-4 + 24)) % 24); // UTC-4
            const dayOfWeek = cursor.getDay();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                // Weekend: skip to Monday
                cursor.setDate(cursor.getDate() + (dayOfWeek === 6 ? 2 : 1));
                cursor.setHours(9 - (-4), 0, 0, 0); // 9am VZ = 13 UTC
                continue;
            }

            if (localHour < BUSINESS_START_HOUR) {
                cursor.setUTCHours(BUSINESS_START_HOUR + 4, 0, 0, 0);
                continue;
            }

            if (localHour >= BUSINESS_END_HOUR) {
                cursor.setDate(cursor.getDate() + 1);
                cursor.setUTCHours(BUSINESS_START_HOUR + 4, 0, 0, 0);
                continue;
            }

            const slotStart = new Date(cursor);
            const slotEnd = new Date(cursor.getTime() + SLOT_DURATION_MS);

            // Check if this slot conflicts with any existing event
            const isBusy = busyEvents.some(event => {
                const eStart = new Date(event.start?.dateTime || event.start?.date);
                const eEnd = new Date(event.end?.dateTime || event.end?.date);
                return slotStart < eEnd && slotEnd > eStart;
            });

            if (!isBusy) {
                // Format for display in Venezuela time (UTC-4)
                const vzDate = new Date(slotStart.getTime() + TZ_OFFSET_MS);
                const dateStr = vzDate.toISOString().split('T')[0];
                const hour = vzDate.getUTCHours();
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                slots.push({
                    isoStart: slotStart.toISOString(),
                    isoEnd: slotEnd.toISOString(),
                    date: dateStr,
                    timeLabel: `${displayHour}:00 ${ampm}`,
                    dayLabel: vzDate.toLocaleDateString('es-VE', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Caracas' })
                });
                slotsGenerated++;
            }

            cursor.setTime(cursor.getTime() + SLOT_DURATION_MS);
        }

        res.json({ slots });
    } catch (err) {
        console.error('[Calendar API] Error getting availability:', err);
        res.status(500).json({ error: 'Error al consultar disponibilidad' });
    }
});

// POST /api/schedule - Book a meeting slot
app.post('/api/schedule', async (req, res) => {
    const { name, email, isoStart, isoEnd, notes } = req.body;
    if (!name || !email || !isoStart || !isoEnd) {
        return res.status(400).json({ error: 'Faltan campos requeridos: name, email, isoStart, isoEnd' });
    }
    try {
        const auth = await getAuthForProfile('SYSTEM');
        if (!auth) {
            return res.status(503).json({ error: 'Calendar service unavailable' });
        }

        const calendar = google.calendar({ version: 'v3', auth });
        const event = await calendar.events.insert({
            calendarId: 'primary',
            sendUpdates: 'all',
            requestBody: {
                summary: `Cita con ${name} — Adriel's Systems`,
                description: `Cliente: ${name}\nEmail: ${email}\nNota: ${notes || 'Sin nota adicional'}`,
                start: { dateTime: isoStart, timeZone: 'America/Caracas' },
                end: { dateTime: isoEnd, timeZone: 'America/Caracas' },
                attendees: [{ email }],
                conferenceData: {
                    createRequest: {
                        requestId: 'webchat-' + Date.now(),
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            },
            conferenceDataVersion: 1
        });

        console.log(`[Calendar API] Meeting scheduled for ${name} (${email}) at ${isoStart}`);
        res.json({ success: true, eventId: event.data.id, meetLink: event.data.hangoutLink });
    } catch (err) {
        console.error('[Calendar API] Error scheduling meeting:', err);
        res.status(500).json({ error: 'Error al agendar la cita' });
    }
});

// Web Chatbot Public Endpoint (Directly connects to EVA's engine)
app.post('/api/chat', async (req, res) => {
    const { sessionId, chatInput } = req.body;
    if (!sessionId || !chatInput) {
        return res.status(400).json({ error: 'Faltan parámetros obligatorios: sessionId o chatInput' });
    }
    try {
        const result = await processWebChatMessage(sessionId, chatInput);
        return res.json(result);
    } catch (error) {
        console.error('[Express Router] Error in POST /api/chat:', error);
        return res.status(500).json({ error: 'Error interno del servidor procesando la consulta.' });
    }
});

// Payment Approval Visual UI for the Boss (Hector)
app.get('/api/payments/approve/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('SELECT * FROM payment_approvals WHERE id = $1', [id]);
        const approval = result.rows[0];
        
        if (!approval) {
            return res.send(`
                <html>
                    <head>
                        <title>Error - Adriel's Systems</title>
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&display=swap" rel="stylesheet">
                        <style>
                            body { background: #0f172a; color: white; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                            .card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                            h1 { color: #f43f5e; font-size: 24px; margin-bottom: 16px; }
                            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <h1>Aprobación No Encontrada</h1>
                            <p>El registro de aprobación especificado no existe o ha sido eliminado.</p>
                        </div>
                    </body>
                </html>
            `);
        }

        if (approval.status === 'APPROVED') {
            return res.send(`
                <html>
                    <head>
                        <title>Pago Ya Aprobado - Adriel's Systems</title>
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&display=swap" rel="stylesheet">
                        <style>
                            body { background: #0f172a; color: white; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                            .card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                            .badge { background: rgba(34,197,94,0.2); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; padding: 8px 16px; border-radius: 99px; font-size: 12px; font-weight: 900; letter-spacing: 0.1em; display: inline-block; margin-bottom: 24px; }
                            h1 { color: white; font-size: 24px; margin-bottom: 16px; }
                            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="badge">VERIFICADO</div>
                            <h1>Pago Ya Aprobado</h1>
                            <p>Este comprobante de <strong>${approval.client_name}</strong> ya fue aprobado y procesado anteriormente.</p>
                        </div>
                    </body>
                </html>
            `);
        }

        res.send(`
            <html>
                <head>
                    <title>Aprobar Pago - Adriel's Systems</title>
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&display=swap" rel="stylesheet">
                    <style>
                        body { background: #0b0f19; color: white; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                        .card { background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 40px; text-align: center; max-width: 500px; width: 100%; box-shadow: 0 40px 80px rgba(0,0,0,0.6); backdrop-blur: 20px; }
                        .header { margin-bottom: 32px; }
                        .logo { font-size: 12px; font-weight: 900; letter-spacing: 0.3em; color: #38bdf8; margin-bottom: 8px; text-transform: uppercase; }
                        h1 { font-size: 28px; font-weight: 900; color: white; margin: 0; letter-spacing: -0.02em; }
                        .details { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 24px; margin-bottom: 32px; text-align: left; }
                        .detail-item { margin-bottom: 16px; }
                        .detail-item:last-child { margin-bottom: 0; }
                        .label { font-size: 10px; font-weight: 900; letter-spacing: 0.1em; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
                        .value { font-size: 15px; font-weight: 600; color: #f1f5f9; }
                        .analysis { font-family: monospace; font-size: 13px; color: #38bdf8; background: rgba(56,189,248,0.05); border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 16px; white-space: pre-wrap; line-height: 1.6; }
                        .btn { background: #38bdf8; color: black; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; padding: 18px 36px; border-radius: 16px; border: none; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); width: 100%; box-shadow: 0 10px 20px rgba(56,189,248,0.3); }
                        .btn:hover { background: #7dd3fc; transform: translateY(-2px); box-shadow: 0 15px 30px rgba(56,189,248,0.5); }
                        .btn:active { transform: translateY(0); }
                    </style>
                    <script>
                        async function doApprove() {
                            const btn = document.getElementById('approveBtn');
                            btn.disabled = true;
                            btn.innerText = 'PROCESANDO...';
                            try {
                                const res = await fetch('/api/payments/approve/${id}/confirm', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    document.body.innerHTML = \`
                                        <div class="card" style="animation: scaleIn 0.5s ease;">
                                            <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto;">
                                                <svg style="width:32px;height:32px;color:#22c55e;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                            </div>
                                            <h1 style="color:#22c55e; margin-bottom:16px;">¡Pago Aprobado!</h1>
                                            <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin-bottom:0;">El pago de <strong>\${data.clientName || '${approval.client_name}'}</strong> ha sido verificado con éxito y el cliente ha sido notificado automáticamente por WhatsApp.</p>
                                        </div>
                                    \`;
                                } else {
                                    alert(data.message || 'Error al aprobar el pago');
                                    btn.disabled = false;
                                    btn.innerText = 'APROBAR COMPROBANTE';
                                }
                            } catch (err) {
                                alert('Error de conexión al procesar el pago');
                                btn.disabled = false;
                                btn.innerText = 'APROBAR COMPROBANTE';
                            }
                        }
                    </script>
                </head>
                <body>
                    <div class="card">
                        <div class="header">
                            <div class="logo">Adriel's Systems</div>
                            <h1>Verificar Pago</h1>
                        </div>
                        <div class="details">
                            <div class="detail-item">
                                <div class="label">Cliente</div>
                                <div class="value">${approval.client_name}</div>
                            </div>
                            <div class="detail-item">
                                <div class="label">Celular</div>
                                <div class="value">+${approval.phone}</div>
                            </div>
                            <div class="detail-item">
                                <div class="label">Análisis de la IA</div>
                                <div class="analysis">${approval.analysis}</div>
                            </div>
                        </div>
                        <button id="approveBtn" class="btn" onclick="doApprove()">Aprobar Comprobante</button>
                    </div>
                </body>
            </html>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error interno del servidor.');
    }
});

// Confirmation logic endpoint
app.post('/api/payments/approve/:id/confirm', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await approvePaymentById(parseInt(id));
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// DELETE /api/users/:id — Delete user
app.delete('/api/users/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    try {
        const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Error deleting user' });
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
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT} `);
    // Auto-register webhook in Evolution API
    await registerEvolutionWebhook();
});
