-- Run this script to update the existing clients with the missing information.

-- 1. Sra. Lisbeth Lugo
UPDATE clients 
SET phone = '18293515702',
    domain = 'autanagrouprd.com',
    country = 'Republica Dominicana',
    notes = 'Pago puntual'
WHERE email = 'Ll.es.servicios@gmail.com';

-- 2. Sra. Martha Salazar
UPDATE clients 
SET phone = '584265133294',
    domain = 'gentepro80.com',
    country = 'Venezuela',
    notes = 'Pago puntual'
WHERE email = 'gentepro80@gmail.com';

-- 3. Sr. Julio Borges
UPDATE clients 
SET phone = '584143078681',
    domain = 'calmiranda.com',
    country = 'Venezuela',
    notes = 'Prepago hasta marzo 2026'
WHERE email = 'inversionesmiranda1311@gmail.com';

-- 4. Sr. Pushi
UPDATE clients 
SET phone = '14074370161',
    domain = 'oceanconstruction.us',
    country = 'Estados Unidos',
    notes = 'Pago todo un año el plan admin basico'
WHERE email = 'Remodelong.ocean.llc@gmail.com';
