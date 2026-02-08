-- 1. Make 'type' nullable in services table (since we now use 'name')
ALTER TABLE services ALTER COLUMN type DROP NOT NULL;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_type_check;

-- 2. Make 'renewal_date' nullable (we are using renewal_day now for recurring billing)
ALTER TABLE services ALTER COLUMN renewal_date DROP NOT NULL;

-- 3. Update 'payments' status check to strictly include 'PENDING'
-- First drop existing constraint to avoid conflicts
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
-- Re-add with correct values
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('PAID', 'PENDING', 'OVERDUE'));
