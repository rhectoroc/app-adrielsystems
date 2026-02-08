-- Phase 1: Update services table
-- Add columns only if they don't exist

DO $$ 
BEGIN
    -- Add renewal_day if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'renewal_day'
    ) THEN
        ALTER TABLE services ADD COLUMN renewal_day INTEGER DEFAULT 1;
    END IF;

    -- Add prepaid_until if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'prepaid_until'
    ) THEN
        ALTER TABLE services ADD COLUMN prepaid_until DATE;
    END IF;

    -- Add last_payment_date if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' AND column_name = 'last_payment_date'
    ) THEN
        ALTER TABLE services ADD COLUMN last_payment_date DATE;
    END IF;
END $$;

-- Add comments for clarity
COMMENT ON COLUMN services.renewal_day IS 'Day of month when service renews (1-31)';
COMMENT ON COLUMN services.prepaid_until IS 'Date until which service is prepaid (NULL if not prepaid)';
COMMENT ON COLUMN services.last_payment_date IS 'Date of last payment received';

-- Phase 2: Update payments table
-- Add columns only if they don't exist

DO $$ 
BEGIN
    -- Add service_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'service_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN service_id INTEGER REFERENCES services(id) ON DELETE CASCADE;
    END IF;

    -- Add due_date if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE payments ADD COLUMN due_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;

    -- Add payment_method if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE payments ADD COLUMN payment_method VARCHAR(50);
    END IF;

    -- Add notes if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'notes'
    ) THEN
        ALTER TABLE payments ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Add indexes for faster queries (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_service_id'
    ) THEN
        CREATE INDEX idx_payments_service_id ON payments(service_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_due_date'
    ) THEN
        CREATE INDEX idx_payments_due_date ON payments(due_date);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_status'
    ) THEN
        CREATE INDEX idx_payments_status ON payments(status);
    END IF;
END $$;

-- Add comments for clarity
COMMENT ON COLUMN payments.service_id IS 'Reference to the service this payment is for';
COMMENT ON COLUMN payments.due_date IS 'Date when payment is due';
COMMENT ON COLUMN payments.payment_method IS 'Payment method used (PayPal, Zelle, Pago Movil, etc)';
COMMENT ON COLUMN payments.notes IS 'Additional notes about the payment';

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Payment tracking migration completed successfully!';
END $$;
