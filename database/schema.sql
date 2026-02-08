-- Database Schema for Adriel's Systems Admin App
-- WARNING: This script drops existing tables to ensure a clean slate with the new schema.

-- Drop tables if they exist (Order matters due to foreign keys)
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "services" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
-- WARNING: This will drop the existing 'clients' table and data.
DROP TABLE IF EXISTS "clients" CASCADE;

-- CLIENTS Table: Stores client information
CREATE TABLE "clients" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "company_name" VARCHAR(255),
  "email" VARCHAR(255) UNIQUE,
  "phone" VARCHAR(50), -- Movil
  "domain" VARCHAR(255), -- Dns
  "country" VARCHAR(100), -- Pais
  "notes" TEXT, -- Notas/Observaciones
  "contact_info" TEXT, -- Keeping for backward compatibility or generic info
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- USERS Table: Application users (Admins and Clients)
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" VARCHAR(50) NOT NULL CHECK ("role" IN ('ADMIN', 'CLIENT')),
  "client_id" INTEGER REFERENCES "clients" ("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SERVICES Table: Tracks services subscribed by clients
CREATE TABLE "services" (
  "id" SERIAL PRIMARY KEY,
  "client_id" INTEGER NOT NULL REFERENCES "clients" ("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL, -- "Plan admin basico", etc.
  "type" VARCHAR(50), -- Generic category if needed
  "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'CANCELLED')),
  "cost" DECIMAL(10, 2) NOT NULL,
  "currency" VARCHAR(10) DEFAULT 'USD', -- USD, VES
  "renewal_day" INTEGER, -- "11 de cada mes" -> 11
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENTS Table: Tracks payment history
CREATE TABLE "payments" (
  "id" SERIAL PRIMARY KEY,
  "client_id" INTEGER NOT NULL REFERENCES "clients" ("id") ON DELETE CASCADE,
  "amount" DECIMAL(10, 2) NOT NULL,
  "payment_date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(50) NOT NULL CHECK ("status" IN ('PAID', 'PENDING', 'OVERDUE')),
  "payment_method" VARCHAR(50), -- PayPal, Zelle, Pago Movil
  "n8n_reference_id" VARCHAR(255),
  "service_month" VARCHAR(50) -- "febrero 2026" - storing as string or date. Let's strictly use DATE for sorting, but user gave string. I'll store as DATE (first of month).
);

-- Indexes for performance
CREATE INDEX "idx_clients_email" ON "clients" ("email");
CREATE INDEX "idx_users_email" ON "users" ("email");
CREATE INDEX "idx_services_client_id" ON "services" ("client_id");
CREATE INDEX "idx_payments_client_id" ON "payments" ("client_id");
CREATE INDEX "idx_payments_status" ON "payments" ("status");
