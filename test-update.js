import { query } from './server/db.js';

async function test() {
    try {
        console.log("Fetching transactions...");
        const res = await query('SELECT * FROM financial_ledger LIMIT 1');
        if (res.rows.length === 0) {
            console.log("No transactions found.");
            process.exit(0);
        }
        
        const tx = res.rows[0];
        console.log("Transaction before update:", tx);
        
        console.log("Attempting update on id", tx.id);
        const updateRes = await query(`
            UPDATE financial_ledger 
            SET type = $1, concept = $2, amount_usd = $3, amount_ves = $4, exchange_rate = $5, account_name = $6, created_at = $7
            WHERE id = $8 RETURNING *
        `, [tx.type, tx.concept, parseFloat(tx.amount_usd) + 1, tx.amount_ves || 0, tx.exchange_rate || 0, tx.account_name || 'Efectivo', tx.created_at || new Date(), tx.id]);
        
        console.log("Update result:", updateRes.rows[0]);
    } catch (e) {
        console.error("Error during test:", e);
    } finally {
        process.exit(0);
    }
}

test();
