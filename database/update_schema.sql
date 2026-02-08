-- Run this script in DbGate to update your existing tables with the new columns.

-- 1. Update CLIENTS table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Update SERVICES table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS renewal_day INTEGER;

-- 3. Update PAYMENTS table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS service_month VARCHAR(50),
ADD COLUMN IF NOT EXISTS n8n_reference_id VARCHAR(255);

-- 4. Re-run seed data after executing this script.
