-- Migration to update payment statuses to Spanish and fix constraints

BEGIN;

-- 1. Drop the existing check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- 2. Update existing data to Spanish
UPDATE payments SET status = 'PENDIENTE' WHERE status = 'PENDING';
UPDATE payments SET status = 'PAGADO' WHERE status = 'PAID';
UPDATE payments SET status = 'VENCIDO' WHERE status = 'OVERDUE';

-- 3. Add the new check constraint with Spanish values
ALTER TABLE payments ADD CONSTRAINT payments_status_check 
    CHECK (status IN ('PENDIENTE', 'PAGADO', 'VENCIDO'));

-- 4. Ensure currency column has a default if not already (safeguard)
ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'USD';

COMMIT;
