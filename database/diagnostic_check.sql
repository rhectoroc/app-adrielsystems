-- Diagnostic Script to check why recalculation affects 0 rows

-- 1. Count Total Services
SELECT COUNT(*) as total_active_services FROM services WHERE status = 'ACTIVE';

-- 2. Count Total Payments with 'PAGADO'/'PAID'
SELECT COUNT(*) as total_paid_payments FROM payments WHERE status IN ('PAGADO', 'PAID');

-- 3. Check for matching Service IDs in Payments
SELECT COUNT(*) as payments_with_valid_services 
FROM payments p 
JOIN services s ON p.service_id = s.id 
WHERE p.status IN ('PAGADO', 'PAID');

-- 4. Check if 'months_covered' exists and is populated
SELECT COUNT(*) as payments_with_months_covered 
FROM payments 
WHERE months_covered IS NOT NULL AND status IN ('PAGADO', 'PAID');

-- 5. Sample Data to see what we are working with
SELECT p.id, p.service_id, p.status, p.months_covered, p.payment_date 
FROM payments p 
WHERE p.status IN ('PAGADO', 'PAID') 
LIMIT 5;

-- 6. Check current expiration dates
SELECT id, expiration_date FROM services WHERE status = 'ACTIVE' LIMIT 5;
