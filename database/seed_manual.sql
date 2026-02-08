-- SQL Seed Script for Adriel's Systems
-- Run this in DbGate to populate the database with initial client data.

-- 1. Create Admin User (Password: admin123)
-- Hash generated for 'admin123'
INSERT INTO users (email, password_hash, role) 
VALUES ('admin@adrielssystems.com', '$2b$10$YourGeneratedHashHere_or_Use_Online_Generator_For_admin123', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- 2. Insert Clients

-- Client 1: Sra. Lisbeth Lugo
WITH new_client AS (
    INSERT INTO clients (name, phone, email, domain, country, notes)
    VALUES ('Sra. Lisbeth Lugo', '18293515702', 'Ll.es.servicios@gmail.com', 'autanagrouprd.com', 'Republica Dominicana', 'Pago puntual')
    RETURNING id
),
new_user AS (
    INSERT INTO users (email, password_hash, role, client_id)
    SELECT 'Ll.es.servicios@gmail.com', '$2b$10$DefaultHashFor123456', 'CLIENT', id FROM new_client
    RETURNING client_id
),
new_service AS (
    INSERT INTO services (client_id, name, cost, currency, renewal_day, status)
    SELECT id, 'Plan admin basico', 30, 'USD', 11, 'ACTIVE' FROM new_client
    RETURNING client_id
)
INSERT INTO payments (client_id, amount, payment_date, status, payment_method, service_month)
SELECT id, 30, '2026-01-11', 'PENDING', 'PayPal', '2026-02-01' FROM new_client;

-- Client 2: Sra. Martha Salazar
WITH new_client AS (
    INSERT INTO clients (name, phone, email, domain, country, notes)
    VALUES ('Sra. Martha Salazar', '584265133294', 'gentepro80@gmail.com', 'gentepro80.com', 'Venezuela', 'Pago puntual')
    RETURNING id
),
new_user AS (
    INSERT INTO users (email, password_hash, role, client_id)
    SELECT 'gentepro80@gmail.com', '$2b$10$DefaultHashFor123456', 'CLIENT', id FROM new_client
    RETURNING client_id
),
new_service AS (
    INSERT INTO services (client_id, name, cost, currency, renewal_day, status)
    SELECT id, 'Plan admin basico VZLA', 20, 'VES', 15, 'ACTIVE' FROM new_client
    RETURNING client_id
)
INSERT INTO payments (client_id, amount, payment_date, status, payment_method, service_month)
SELECT id, 20, '2025-12-02', 'OVERDUE', 'Pago Movil', '2025-01-01' FROM new_client;

-- Client 3: Sr. Julio Borges
WITH new_client AS (
    INSERT INTO clients (name, phone, email, domain, country, notes)
    VALUES ('Sr. Julio Borges', '584143078681', 'inversionesmiranda1311@gmail.com', 'calmiranda.com', 'Venezuela', 'Prepago hasta marzo 2026')
    RETURNING id
),
new_user AS (
    INSERT INTO users (email, password_hash, role, client_id)
    SELECT 'inversionesmiranda1311@gmail.com', '$2b$10$DefaultHashFor123456', 'CLIENT', id FROM new_client
    RETURNING client_id
),
new_service AS (
    INSERT INTO services (client_id, name, cost, currency, renewal_day, status)
    SELECT id, 'Plan hosting basico', 15, 'USD', 15, 'ACTIVE' FROM new_client
    RETURNING client_id
)
INSERT INTO payments (client_id, amount, payment_date, status, payment_method, service_month)
SELECT id, 15, '2025-11-15', 'PAID', 'Pago Movil', '2026-03-01' FROM new_client;

-- Client 4: Sr. Pushi
WITH new_client AS (
    INSERT INTO clients (name, phone, email, domain, country, notes)
    VALUES ('Sr. Pushi', '14074370161', 'Remodelong.ocean.llc@gmail.com', 'oceanconstruction.us', 'Estados Unidos', 'Pago todo un año el plan admin basico')
    RETURNING id
),
new_user AS (
    INSERT INTO users (email, password_hash, role, client_id)
    SELECT 'Remodelong.ocean.llc@gmail.com', '$2b$10$DefaultHashFor123456', 'CLIENT', id FROM new_client
    RETURNING client_id
),
new_service AS (
    INSERT INTO services (client_id, name, cost, currency, renewal_day, status)
    SELECT id, 'Plan Admin basico + asistente IA', 30, 'USD', 10, 'ACTIVE' FROM new_client
    RETURNING client_id
)
INSERT INTO payments (client_id, amount, payment_date, status, payment_method, service_month)
SELECT id, 30, '2025-11-10', 'PENDING', 'Zelle', '2026-09-01' FROM new_client;
