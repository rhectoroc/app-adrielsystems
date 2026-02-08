-- 1. Create Plans Table
CREATE TABLE IF NOT EXISTS "plans" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "cost" DECIMAL(10, 2) NOT NULL,
  "currency" VARCHAR(10) DEFAULT 'USD',
  "billing_cycle" VARCHAR(50) DEFAULT 'MONTHLY', -- MONTHLY, YEARLY
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add plan_id to Clients (optional, or we can keep services distinct)
-- The user wants to "assign plans to clients". 
-- Currently we have a "services" table. 
-- Option A: Replace 'services' with 'plans' link.
-- Option B: 'services' table references 'plans' to snapshot the deal.
-- Let's go with Option B for flexibility (custom pricing per client).
-- But for now, let's just make sure we have the plans table.

-- 3. Initial Seed for Plans (Optional)
INSERT INTO plans (name, cost, currency, description) VALUES
('Plan Admin Básico', 30.00, 'USD', 'Administración básica de sistemas'),
('Plan Hosting Básico', 15.00, 'USD', 'Hosting compartido para sitios web'),
('Plan Admin Básico + IA', 50.00, 'USD', 'Administración con asistente de IA integrado'),
('Plan Mantenimiento', 20.00, 'USD', 'Mantenimiento preventivo mensual');
