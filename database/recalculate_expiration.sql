-- Revised Smart Recalculation Script
-- Handles:
-- 1. Payments missing service_id (links them to client's active service)
-- 2. Recalculates expiration date for services based on last valid payment.

-- Step 1: Link orphaned payments to client's ACTIVE service (fallback)
-- If a payment has NULL service_id, link it to the first ACTIVE service found for that client.
UPDATE payments p
SET service_id = (
    SELECT id 
    FROM services s 
    WHERE s.client_id = p.client_id 
    AND s.status = 'ACTIVE' 
    LIMIT 1
)
WHERE p.service_id IS NULL;

-- Step 2: Recalculate Expiration Dates for Services with VALID Payments
WITH LastPayments AS (
    SELECT DISTINCT ON (service_id) 
        service_id, 
        payment_date, 
        COALESCE(months_covered, 1) as months_covered
    FROM payments
    WHERE 
        status IN ('PAGADO', 'PAID') 
        AND service_id IS NOT NULL
    ORDER BY service_id, payment_date DESC
)
UPDATE services s
SET 
    last_payment_date = lp.payment_date,
    expiration_date = (lp.payment_date + (lp.months_covered || ' months')::INTERVAL)::DATE
FROM LastPayments lp
WHERE s.id = lp.service_id;

-- Step 3: Ensure services with NO valid payments have NULL expiration
UPDATE services
SET expiration_date = NULL
WHERE id NOT IN (
    SELECT DISTINCT service_id 
    FROM payments 
    WHERE status IN ('PAGADO', 'PAID') 
    AND service_id IS NOT NULL
);
