-- ============================================
-- Fix Missing Currency Column in Payments Table
-- Date: 2026-02-10
-- Issue: Column "currency" does not exist in payments table
-- ============================================

-- Add currency column to payments table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'currency'
    ) THEN
        ALTER TABLE payments ADD COLUMN currency VARCHAR(10) DEFAULT 'USD';
        RAISE NOTICE 'Column currency added to payments table';
    ELSE
        RAISE NOTICE 'Column currency already exists in payments table';
    END IF;
END $$;

-- Update existing payments to inherit currency from their associated service
UPDATE payments p
SET currency = s.currency
FROM services s
WHERE p.service_id = s.id
AND p.currency IS NULL;

-- For payments without a service_id, set default to USD
UPDATE payments
SET currency = 'USD'
WHERE currency IS NULL;

-- Make currency NOT NULL after data migration
ALTER TABLE payments ALTER COLUMN currency SET NOT NULL;

-- Verify the change
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'currency';
