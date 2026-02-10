-- Recursive Expiration Calculation (Pure SQL)
-- This approach avoids PL/pgSQL loops and reconstructs the expiration date logic fully.
-- 1. Identify valid payments.
-- 2. Calculate logical 'months covered' based on Amount/Cost if needed.
-- 3. Iterate chronologically to accumulate expiration date.
--    Logic: New_Expiration = MAX(Previous_Expiration, Payment_Date) + Months_Covered

WITH RECURSIVE 
PaymentChain AS (
    -- Base Data: Get all valid payments, ordered by date
    SELECT 
        p.id as payment_id,
        p.service_id,
        p.payment_date,
        s.cost as service_cost,
        p.amount as payment_amount,
        COALESCE(p.months_covered, 
            CASE 
                WHEN s.cost > 0 THEN ROUND(p.amount / s.cost)
                ELSE 1 
            END
        ) as months_covered,
        ROW_NUMBER() OVER (PARTITION BY p.service_id ORDER BY p.payment_date, p.id) as rn
    FROM payments p
    JOIN services s ON p.service_id = s.id -- Only consider linked payments (Assuming orphans fixed)
    WHERE p.status IN ('PAGADO', 'PAID')
),
ExpirationCalc AS (
    -- Anchor: First payment for each service
    SELECT 
        service_id,
        payment_date,
        months_covered,
        rn,
        (payment_date + (months_covered || ' months')::INTERVAL)::DATE as expiration_date
    FROM PaymentChain
    WHERE rn = 1

    UNION ALL

    -- Recursive Step: Next payment
    SELECT 
        pc.service_id,
        pc.payment_date,
        pc.months_covered,
        pc.rn,
        -- Logic: If payment is BEFORE current expiration, extend from expiration.
        --        If payment IS AFTER (gap), start from new payment date.
        CASE 
            WHEN pc.payment_date <= ec.expiration_date THEN 
                (ec.expiration_date + (pc.months_covered || ' months')::INTERVAL)::DATE
            ELSE 
                (pc.payment_date + (pc.months_covered || ' months')::INTERVAL)::DATE
        END as expiration_date
    FROM PaymentChain pc
    JOIN ExpirationCalc ec ON pc.service_id = ec.service_id AND pc.rn = ec.rn + 1
),
FinalExpiration AS (
    -- Get the last calculated expiration date per service
    SELECT DISTINCT ON (service_id) 
        service_id, 
        payment_date as last_payment_date,
        expiration_date
    FROM ExpirationCalc
    ORDER BY service_id, rn DESC
)
-- Update Services with the final calculated date
UPDATE services s
SET 
    last_payment_date = fe.last_payment_date,
    expiration_date = fe.expiration_date
FROM FinalExpiration fe
WHERE s.id = fe.service_id;

-- Ensure services with NO valid payments have NULL expiration
UPDATE services
SET expiration_date = NULL
WHERE id NOT IN (SELECT service_id FROM FinalExpiration);
