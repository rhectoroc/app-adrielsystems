import { query } from '../server/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientsData = [
    {
        name: "Sra. Lisbeth Lugo",
        phone: "18293515702",
        email: "Ll.es.servicios@gmail.com",
        domain: "autanagrouprd.com",
        country: "Republica Dominicana",
        service_name: "Plan admin basico",
        currency: "USD",
        cost: 30,
        renewal_day: 11,
        payment_month: "2026-02-01", // "febrero 2026"
        status: "PENDIENTE",
        last_payment_date: "2026-01-11", // "11/01/2026"
        payment_method: "PayPal",
        notes: "Pago puntual"
    },
    {
        name: "Sra. Martha Salazar",
        phone: "584265133294",
        email: "gentepro80@gmail.com",
        domain: "gentepro80.com",
        country: "Venezuela",
        service_name: "Plan admin basico VZLA",
        currency: "VES",
        cost: 20,
        renewal_day: 15,
        payment_month: "2025-01-01", // "enero 2025"
        status: "OVERDUE", // "VENCIDO" -> OVERDUE
        last_payment_date: "2025-12-02", // "02/12/2025"
        payment_method: "Pago Movil",
        notes: "Pago puntual"
    },
    {
        name: "Sr. Julio Borges",
        phone: "584143078681",
        email: "inversionesmiranda1311@gmail.com",
        domain: "calmiranda.com",
        country: "Venezuela",
        service_name: "Plan hosting basico",
        currency: "USD",
        cost: 15,
        renewal_day: 15,
        payment_month: "2026-03-01", // "marzo 2026"
        status: "PAID", // "PAGADO" -> PAID
        last_payment_date: "2025-11-15", // "15/11/2025"
        payment_method: "Pago Movil",
        notes: "Prepago hasta marzo 2026"
    },
    {
        name: "Sr. Pushi",
        phone: "14074370161",
        email: "Remodelong.ocean.llc@gmail.com",
        domain: "oceanconstruction.us",
        country: "Estados Unidos",
        service_name: "Plan Admin basico + asistente IA",
        currency: "USD",
        cost: 30,
        renewal_day: 10,
        payment_month: "2026-09-01", // "septiembre 2026"
        status: "PENDIENTE", // "PENDIENTE"
        last_payment_date: "2025-11-10", // "10/11/2025"
        payment_method: "Zelle",
        notes: "Pago todo un año el plan admin basico"
    }
];

async function seed() {
    try {
        console.log('Starting seed process...');

        // 1. Re-create schema
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await query(schemaSql);
        console.log('Schema recreated.');

        // 2. Create Admin User
        const saltRounds = 10;
        const adminHash = await bcrypt.hash('admin123', saltRounds);
        await query(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
            ['admin@adrielssystems.com', adminHash, 'ADMIN']
        );
        console.log('Admin user created.');

        // 3. Insert Clients & Related Data
        for (const client of clientsData) {
            // Create Client
            const clientRes = await query(
                `INSERT INTO clients (name, phone, email, domain, country, notes) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [client.name, client.phone, client.email, client.domain, client.country, client.notes]
            );
            const clientId = clientRes.rows[0].id;

            // Create User for Client
            // Use a default password
            const userHash = await bcrypt.hash('123456', saltRounds);
            await query(
                'INSERT INTO users (email, password_hash, role, client_id) VALUES ($1, $2, $3, $4)',
                [client.email, userHash, 'CLIENT', clientId]
            );

            // Create Service
            await query(
                `INSERT INTO services (client_id, name, cost, currency, renewal_day, status) 
                 VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
                [clientId, client.service_name, client.cost, client.currency, client.renewal_day]
            );

            // Create Payment Record (Last payment / Current Status)
            // "Estado del Pago" -> refers to the *current* month/period owed usually, or the last record?
            // User data has "Mes de Pago" and "Estado". 
            // If "PAGADO", we insert a PAID record.
            // If "PENDIENTE", we insert a PENDING record.
            // "OVERDUE" -> OVERDUE record.

            let paymentStatus = 'PENDING';
            if (client.status === 'PAGADO') paymentStatus = 'PAID';
            else if (client.status === 'VENCIDO') paymentStatus = 'OVERDUE';
            else paymentStatus = 'PENDING';

            await query(
                `INSERT INTO payments (client_id, amount, payment_date, status, payment_method, service_month) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    clientId,
                    client.cost,
                    client.last_payment_date,
                    paymentStatus,
                    client.payment_method,
                    client.payment_month
                ]
            );
        }

        console.log(`Successfully seeded ${clientsData.length} clients.`);
        process.exit(0);

    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
}

seed();
