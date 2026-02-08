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
  "id" SERIAL PRIMARY KEY, -- Auto-generated ID (Integer) like users
  "name" VARCHAR(255) NOT NULL,
  "company_name" VARCHAR(255),
  "contact_info" TEXT,
  "email" VARCHAR(255) UNIQUE, -- Ensure email is unique if used for linking
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- USERS Table: Application users (Admins and Clients)
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" VARCHAR(50) NOT NULL CHECK ("role" IN ('ADMIN', 'CLIENT')),
  "client_id" INTEGER REFERENCES "clients" ("id") ON DELETE SET NULL, -- Linked to clients (Integer)
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SERVICES Table: Tracks services subscribed by clients
CREATE TABLE "services" (
  "id" SERIAL PRIMARY KEY,
  "client_id" INTEGER NOT NULL REFERENCES "clients" ("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('HOSTING', 'WEB', 'N8N')),
  "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'CANCELLED')),
  "cost" DECIMAL(10, 2) NOT NULL,
  "renewal_date" DATE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENTS Table: Tracks payment history
CREATE TABLE "payments" (
  "id" SERIAL PRIMARY KEY,
  "client_id" INTEGER NOT NULL REFERENCES "clients" ("id") ON DELETE CASCADE,
  "amount" DECIMAL(10, 2) NOT NULL,
  "payment_date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(50) NOT NULL CHECK ("status" IN ('PAID', 'PENDING', 'OVERDUE')),
  "n8n_reference_id" VARCHAR(255), -- ID from n8n automation if applicable
  "service_month" DATE NOT NULL -- The month this payment covers (e.g., 2023-10-01)
);

-- Indexes for performance
CREATE INDEX "idx_clients_email" ON "clients" ("email");
CREATE INDEX "idx_users_email" ON "users" ("email");
CREATE INDEX "idx_services_client_id" ON "services" ("client_id");
CREATE INDEX "idx_payments_client_id" ON "payments" ("client_id");
CREATE INDEX "idx_payments_status" ON "payments" ("status");
