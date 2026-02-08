-- Phase 1: Update services table
ALTER TABLE services 
ADD COLUMN renewal_day INTEGER DEFAULT 1,
ADD COLUMN prepaid_until DATE,
ADD COLUMN last_payment_date DATE;

-- Add comment for clarity
COMMENT ON COLUMN services.renewal_day IS 'Day of month when service renews (1-31)';
COMMENT ON COLUMN services.prepaid_until IS 'Date until which service is prepaid (NULL if not prepaid)';
COMMENT ON COLUMN services.last_payment_date IS 'Date of last payment received';

-- Phase 1: Update payments table
ALTER TABLE payments 
ADD COLUMN service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
ADD COLUMN due_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN payment_method VARCHAR(50),
ADD COLUMN notes TEXT;

-- Add index for faster queries
CREATE INDEX idx_payments_service_id ON payments(service_id);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_payments_status ON payments(status);

-- Add comment for clarity
COMMENT ON COLUMN payments.service_id IS 'Reference to the service this payment is for';
COMMENT ON COLUMN payments.due_date IS 'Date when payment is due';
COMMENT ON COLUMN payments.payment_method IS 'Payment method used (PayPal, Zelle, Pago Movil, etc)';
COMMENT ON COLUMN payments.notes IS 'Additional notes about the payment';
