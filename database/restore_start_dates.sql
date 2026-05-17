-- Script para restaurar las fechas de inicio originales de los servicios
-- que fueron sobrescritas con la fecha de hoy (2026-05-17) debido al bug del frontend.
-- Este script restablece la fecha de inicio del servicio basándose en la fecha de creación del cliente
-- y recalcula el día de renovación (15 o 30) y la fecha de vencimiento inicial.

BEGIN;

-- 1. Restaurar created_at al valor original de clients.created_at
-- y recalcular renewal_day y billing_day_fixed basados en la fecha original
UPDATE services s
SET 
    created_at = c.created_at::DATE,
    renewal_day = (CASE WHEN EXTRACT(DAY FROM c.created_at::DATE) <= 15 THEN 15 ELSE 30 END),
    billing_day_fixed = (CASE WHEN EXTRACT(DAY FROM c.created_at::DATE) <= 15 THEN 15 ELSE 30 END)
FROM clients c
WHERE s.client_id = c.id
  AND s.created_at::DATE = '2026-05-17';

-- 2. Recalcular la fecha de vencimiento inicial (expiration_date) 
-- para aquellos servicios que NO tienen pagos registrados aún (last_payment_date IS NULL)
UPDATE services s
SET expiration_date = (
    CASE 
        WHEN s.renewal_day = 15 THEN 
            (DATE_TRUNC('month', s.created_at + INTERVAL '1 month') + INTERVAL '14 days')::DATE
        ELSE 
            (DATE_TRUNC('month', s.created_at + INTERVAL '1 month') + (LEAST(30, EXTRACT(DAY FROM (DATE_TRUNC('month', s.created_at + INTERVAL '2 months') - INTERVAL '1 day'))::INT) - 1) * INTERVAL '1 day')::DATE
    END
)
WHERE s.last_payment_date IS NULL
  AND s.created_at::DATE != '2026-05-17'; -- Solo los restaurados

COMMIT;
