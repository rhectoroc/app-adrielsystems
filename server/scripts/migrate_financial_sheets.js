import { googleService } from '../services/googleService.js';
import { query } from '../db.js';

const parseDate = (dateStr) => {
    // Expected formats: "01 jun", "15 may", etc.
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split(' ');
    if (parts.length !== 2) return null;
    
    const day = parseInt(parts[0]);
    const monthStr = parts[1].toLowerCase();
    
    const months = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };
    
    const month = months[monthStr];
    if (month === undefined) return null;
    
    const now = new Date();
    // Assumption: Current year
    return new Date(now.getFullYear(), month, day);
};

const runMigration = async () => {
    console.log('[Migration] Starting Google Sheets to Postgres Migration...');
    
    const profileKey = 'JEFE';
    const sheetName = 'Registro Financiero EVA';
    
    try {
        let spreadsheetId = await googleService.findSpreadsheetByName(profileKey, sheetName);
        if (!spreadsheetId) {
            console.log('[Migration] Spreadsheet not found. Exiting.');
            return;
        }
        
        console.log(`[Migration] Found Spreadsheet ID: ${spreadsheetId}`);
        const sheets = await googleService.getSpreadsheetSheets(profileKey, spreadsheetId);
        
        for (const sheet of sheets) {
            const tabTitle = sheet.properties.title;
            console.log(`\n[Migration] Processing tab: ${tabTitle}`);
            
            const sheetData = await googleService.getSheetData(profileKey, spreadsheetId, `'${tabTitle}'!A:G`);
            
            if (!sheetData || sheetData.length <= 1) {
                console.log(`[Migration] Tab ${tabTitle} is empty or only has headers. Skipping.`);
                continue;
            }
            
            let insertedCount = 0;
            // Start from row index 1 to skip headers
            for (let i = 1; i < sheetData.length; i++) {
                const row = sheetData[i];
                // Row format: [FECHA, CONCEPTO, ENTRADA, SALIDA, SALDO, TASA, DOLARES]
                const dateStr = row[0];
                const concept = row[1];
                let entradaStr = row[2] ? String(row[2]).replace(/\./g, '').replace(',', '.') : '';
                let salidaStr = row[3] ? String(row[3]).replace(/\./g, '').replace(',', '.') : '';
                let tasaStr = row[5] ? String(row[5]).replace(/\./g, '').replace(',', '.') : '1';
                
                const entrada = parseFloat(entradaStr);
                const salida = parseFloat(salidaStr);
                const tasa = parseFloat(tasaStr);
                
                if (!concept || (isNaN(entrada) && isNaN(salida))) {
                    continue;
                }
                
                let type = '';
                let amountVES = 0;
                
                if (!isNaN(entrada) && entrada > 0) {
                    type = 'ENTRADA';
                    amountVES = entrada;
                } else if (!isNaN(salida) && salida > 0) {
                    type = 'SALIDA';
                    amountVES = salida;
                } else {
                    continue; // Skip if both are 0 or empty
                }
                
                let amountUSD = amountVES / (isNaN(tasa) || tasa === 0 ? 1 : tasa);
                
                const txDate = parseDate(dateStr) || new Date();
                
                await query(`
                    INSERT INTO financial_ledger (date, type, concept, amount_ves, amount_usd, exchange_rate)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [txDate, type, concept, amountVES, amountUSD, isNaN(tasa) ? 1 : tasa]);
                
                insertedCount++;
            }
            
            console.log(`[Migration] Inserted ${insertedCount} rows from tab ${tabTitle}.`);
        }
        
        console.log('\n[Migration] Migration completed successfully.');
        process.exit(0);
        
    } catch (error) {
        console.error('[Migration] Error during migration:', error);
        process.exit(1);
    }
};

runMigration();
