import { query } from './server/db.js';

async function checkClient() {
    try {
        const res = await query(`
            SELECT 
                c.name, 
                s.cost, 
                s.special_price, 
                s.created_at, 
                s.expiration_date, 
                s.renewal_day,
                (
                    CASE 
                        WHEN s.renewal_day = 30 THEN
                            (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                            (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                        ELSE
                            COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                    END
                ) as amount_due_calculated
            FROM services s
            JOIN clients c ON s.client_id = c.id
            WHERE c.name ILIKE '%Daniel Gallo%'
        `);
        console.log("Result:", res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkClient();
