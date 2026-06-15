import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { getAuthForProfile, findSpreadsheetByName } from './server/services/googleService.js';

async function run() {
    try {
        const profileKey = 'JEFE';
        const auth = await getAuthForProfile(profileKey);
        const spreadsheetId = await findSpreadsheetByName(profileKey, 'Registro Financiero EVA');
        if (!spreadsheetId) {
            console.log('No spreadsheet');
            return;
        }
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Let's get the exact sheet name instead of guessing
        const sheetResponse = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties.title'
        });
        const currentMonthName = new Date().toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
        const sheetTitle = sheetResponse.data.sheets.find(s => s.properties.title.includes('Junio'))?.properties?.title || currentMonthName;
        console.log(`Targeting sheet: ${sheetTitle}`);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetTitle}'!E2:E` });
        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetTitle}'!G2:G` });

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetTitle}'!E1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['={"SALDO"; ARRAYFORMULA(IF(C2:C&D2:D="", "", SUMIF(ROW(C2:C), "<="&ROW(C2:C), C2:C) - SUMIF(ROW(D2:D), "<="&ROW(D2:D), D2:D)))}']] }
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetTitle}'!G1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['={"DOLARES"; ARRAYFORMULA(IF(E2:E&F2:F="", "", IF(F2:F>0, E2:E/F2:F, "")))}']] }
        });
        console.log('Done fixing sheet');
    } catch(e) {
        console.error(e);
    }
}
run();
