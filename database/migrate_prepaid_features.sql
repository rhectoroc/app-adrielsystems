-- Migration for Prepaid Services and Special Pricing

BEGIN;

-- 1. Modify SERVICES table (more appropriate than clients for service-specific data)
-- Assuming 'services' is where subscription details live.
-- Using 'expiration_date' to track when the service runs out.
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS special_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- Initialize expiration_date for existing active services (e.g., set to today + 1 month or just null)
-- For now, we leave it NULL or set it to current renewal date if possible.

-- 2. Modify PAYMENTS table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS months_covered INTEGER DEFAULT 1;

-- 3. Function to update service expiration on payment
CREATE OR REPLACE FUNCTION update_service_expiration()
RETURNS TRIGGER AS $$
DECLARE
    current_expiry DATE;
    new_expiry DATE;
    months_to_add INTEGER;
BEGIN
    -- Only proceed if payment is PAID
    IF NEW.status = 'PAGADO' OR NEW.status = 'PAID' THEN
        -- Get current expiration of the service
        SELECT expiration_date INTO current_expiry FROM services WHERE id = NEW.service_id;
        
        months_to_add := COALESCE(NEW.months_covered, 1);
        
        -- Logic: 
        -- If current_expiry is in the future, add months to IT.
        -- If current_expiry is null or in the past, add months to NOW (or Payment Date).
        
        IF current_expiry IS NOT NULL AND current_expiry > NEW.payment_date THEN
            new_expiry := current_expiry + (months_to_add || ' month')::INTERVAL;
        ELSE
            new_expiry := NEW.payment_date + (months_to_add || ' month')::INTERVAL;
        END IF;

        -- Update the service
        UPDATE services 
        SET expiration_date = new_expiry,
            last_payment_date = NEW.payment_date
        WHERE id = NEW.service_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to automatically update expiration (Optional, can be done in Node.js instead)
-- Keeping it in Node.js might be safer for logic control, but DB trigger ensures integrity.
-- Let's stick to Node.js logic for now as requested by user ("Generate code for modify table... logic is...").
-- I will NOT add the trigger here to strictly follow "Backend Logic" implementation pattern unless requested.

COMMIT;
