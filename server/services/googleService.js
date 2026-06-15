import { google } from 'googleapis';
import { query } from '../db.js';

/**
 * Google Service (Multi-Profile Engine)
 * Manages Google Calendar, Google Tasks, and Gmail operations dynamically.
 * Supports multiple accounts simultaneously sharing the same Client App ID 
 * but utilizing distinct Refresh Tokens per profile:
 * - SYSTEM: adriels.systems@gmail.com
 * - JEFE: rhectoroc@gmail.com (Hector)
 * - JEFA: oxaurbaneja@gmail.com (Oxarellys)
 */

// Shared Google Cloud Client Application Credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Dynamic Profiles configurations (OAuth2 Refresh Tokens)
const REFRESH_TOKENS = {
    SYSTEM: process.env.GOOGLE_REFRESH_TOKEN_SYSTEM || process.env.GOOGLE_REFRESH_TOKEN,
    JEFE: process.env.GOOGLE_REFRESH_TOKEN_JEFE,
    JEFA: process.env.GOOGLE_REFRESH_TOKEN_JEFA
};

// Dynamic Profiles configurations (Service Account fallback)
const SERVICE_ACCOUNTS = {
    SYSTEM: {
        email: process.env.GOOGLE_CLIENT_EMAIL_SYSTEM || process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY_SYSTEM || process.env.GOOGLE_PRIVATE_KEY
    },
    JEFE: {
        email: process.env.GOOGLE_CLIENT_EMAIL_JEFE,
        key: process.env.GOOGLE_PRIVATE_KEY_JEFE
    },
    JEFA: {
        email: process.env.GOOGLE_CLIENT_EMAIL_JEFA,
        key: process.env.GOOGLE_PRIVATE_KEY_JEFA
    }
};

/**
 * Gets the authenticated client dynamically for the requested profile.
 * Falls back to simulation mode if no credentials are configured.
 */
export const getAuthForProfile = async (profileKey = 'SYSTEM') => {
    const key = profileKey.toUpperCase();

    // 1. Try OAuth2 Refresh Token (Best for personal @gmail.com accounts)
    const token = REFRESH_TOKENS[key] || REFRESH_TOKENS['SYSTEM'];
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && token) {
        try {
            const oauth2Client = new google.auth.OAuth2(
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
            );
            oauth2Client.setCredentials({ refresh_token: token });
            return oauth2Client;
        } catch (err) {
            console.error(`[Google Service] Error creating OAuth2 client for profile ${key}:`, err);
        }
    }

    // 2. Try Service Account (Best for Workspace domains)
    const sa = SERVICE_ACCOUNTS[key];
    if (sa && sa.email && sa.key) {
        try {
            const jwtClient = new google.auth.JWT(
                sa.email,
                null,
                sa.key.replace(/\\n/g, '\n'),
                [
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/tasks',
                    'https://www.googleapis.com/auth/gmail.modify',
                    'https://www.googleapis.com/auth/gmail.send',
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ]
            );
            return jwtClient;
        } catch (err) {
            console.error(`[Google Service] Error creating Service Account for profile ${key}:`, err);
        }
    }

    console.log(`[Google Service] No authentication credentials found for profile: ${key}. Operating in Simulation mode.`);
    return null;
};

// ==========================================
// 1. Google Calendar Operations
// ==========================================

export const checkCalendarAvailability = async (profileKey, calendarId, startTime, durationMinutes = 30) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Calendar Availability Check Simulated: ${startTime} (${durationMinutes} mins)`);
        return 'disponible';
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth });
        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        const response = await calendar.events.list({
            calendarId: calendarId || 'primary',
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items || [];
        return events.length === 0 ? 'disponible' : 'no disponible';
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error checking calendar availability:`, error);
        return 'disponible';
    }
};

export const scheduleMeeting = async (profileKey, calendarId, details) => {
    const auth = await getAuthForProfile(profileKey);
    const { title, start, end, description, attendees = [] } = details;

    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Schedule Meeting Simulated:`, details);
        return {
            id: 'mock-event-' + Date.now(),
            status: 'confirmed',
            htmlLink: 'https://calendar.google.com/calendar/r/eventedit',
            summary: title,
            start: { dateTime: start },
            end: { dateTime: end }
        };
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth });
        const response = await calendar.events.insert({
            calendarId: calendarId || 'primary',
            requestBody: {
                summary: title,
                description: description,
                start: { dateTime: new Date(start).toISOString() },
                end: { dateTime: new Date(end).toISOString() },
                attendees: attendees.map(email => ({ email })),
                conferenceData: {
                    createRequest: {
                        requestId: 'meeting-' + Date.now(),
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            },
            conferenceDataVersion: 1
        });

        console.log(`[Google Service] [${profileKey}] Meeting scheduled:`, response.data.summary);
        return response.data;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error scheduling meeting:`, error);
        throw error;
    }
};

export const findAndManageMeeting = async (profileKey, calendarId, queryText, timeMin, timeMax) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Find Meeting Simulated for query: "${queryText}"`);
        return [
            {
                id: 'mock-event-1',
                summary: `Reunión: ${queryText}`,
                start: { dateTime: new Date().toISOString() },
                description: 'Reunión simulada de prueba.'
            }
        ];
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth });
        const response = await calendar.events.list({
            calendarId: calendarId || 'primary',
            q: queryText,
            timeMin: timeMin ? new Date(timeMin).toISOString() : undefined,
            timeMax: timeMax ? new Date(timeMax).toISOString() : undefined,
            singleEvents: true,
            orderBy: 'startTime'
        });

        return response.data.items || [];
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error searching meetings:`, error);
        return [];
    }
};

export const deleteMeeting = async (profileKey, calendarId, eventId) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Delete Meeting Simulated for ID: ${eventId}`);
        return { status: 'deleted', id: eventId };
    }

    try {
        const calendar = google.calendar({ version: 'v3', auth });
        await calendar.events.delete({
            calendarId: calendarId || 'primary',
            eventId: eventId
        });
        console.log(`[Google Service] [${profileKey}] Event ${eventId} deleted successfully.`);
        return { status: 'deleted', id: eventId };
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error deleting event:`, error);
        throw error;
    }
};

// ==========================================
// 2. Google Tasks Operations
// ==========================================

export const listTasks = async (profileKey, taskListId) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] List Tasks Simulated.`);
        return [
            { id: 'task-1', title: 'Revisar pagos de Adriel\'s Systems', status: 'needsAction' },
            { id: 'task-2', title: 'Enviar reporte a Oxa', status: 'completed' }
        ];
    }

    try {
        const tasks = google.tasks({ version: 'v1', auth });
        const response = await tasks.tasks.list({
            tasklist: taskListId || '@default'
        });
        return response.data.items || [];
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error listing tasks:`, error);
        return [];
    }
};

export const addTask = async (profileKey, taskListId, title, notes) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Add Task Simulated: "${title}"`);
        return { id: 'mock-task-' + Date.now(), title, notes, status: 'needsAction' };
    }

    try {
        const tasks = google.tasks({ version: 'v1', auth });
        const response = await tasks.tasks.insert({
            tasklist: taskListId || '@default',
            requestBody: { title, notes }
        });
        console.log(`[Google Service] [${profileKey}] Task created:`, response.data.title);
        return response.data;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error adding task:`, error);
        throw error;
    }
};

export const deleteTask = async (profileKey, taskListId, taskId) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Delete Task Simulated for ID: ${taskId}`);
        return { status: 'deleted', id: taskId };
    }

    try {
        const tasks = google.tasks({ version: 'v1', auth });
        await tasks.tasks.delete({
            tasklist: taskListId || '@default',
            task: taskId
        });
        console.log(`[Google Service] [${profileKey}] Task ${taskId} deleted.`);
        return { status: 'deleted', id: taskId };
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error deleting task:`, error);
        throw error;
    }
};

// ==========================================
// 3. Gmail Operations
// ==========================================

export const scanInbox = async (profileKey, queryText) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Scan Inbox Simulated for: "${queryText}"`);
        return [
            { id: 'msg-1', threadId: 'thread-1', snippet: 'Importante: Presupuesto Adriel\'s Systems 2026' }
        ];
    }

    try {
        const gmail = google.gmail({ version: 'v1', auth });
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: queryText,
            maxResults: 5
        });

        const messages = response.data.messages || [];
        const enriched = [];

        for (const msg of messages) {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id
            });
            enriched.push({
                id: msg.id,
                threadId: msg.threadId,
                snippet: detail.data.snippet,
                subject: detail.data.payload.headers.find(h => h.name === 'Subject')?.value || 'Sin Asunto',
                from: detail.data.payload.headers.find(h => h.name === 'From')?.value || 'Desconocido'
            });
        }
        return enriched;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error scanning inbox:`, error);
        return [];
    }
};

export const getEmailDetails = async (profileKey, messageId) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Get Email Details Simulated for ID: ${messageId}`);
        return {
            id: messageId,
            subject: 'Presupuesto Solicitado',
            from: 'cliente@ejemplo.com',
            snippet: 'Buenas tardes Hector, adjunto el comprobante de...',
            body: 'Cuerpo completo del correo de prueba para el flujo del bot.'
        };
    }

    try {
        const gmail = google.gmail({ version: 'v1', auth });
        const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId
        });

        let body = '';
        const payload = response.data.payload;
        if (payload.parts) {
            const part = payload.parts.find(p => p.mimeType === 'text/plain') || payload.parts[0];
            if (part && part.body && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        } else if (payload.body && payload.body.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }

        return {
            id: response.data.id,
            subject: payload.headers.find(h => h.name === 'Subject')?.value || 'Sin Asunto',
            from: payload.headers.find(h => h.name === 'From')?.value || 'Desconocido',
            snippet: response.data.snippet,
            body: body || response.data.snippet
        };
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error getting email details:`, error);
        throw error;
    }
};

export const createDraft = async (profileKey, to, subject, messageBody) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Create Draft Simulated to: ${to}`);
        return { id: 'mock-draft-1', message: { id: 'mock-msg-draft' } };
    }

    try {
        const gmail = google.gmail({ version: 'v1', auth });
        const emailContent = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            messageBody
        ].join('\n');

        const base64SafeEmail = Buffer.from(emailContent)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await gmail.users.drafts.create({
            userId: 'me',
            requestBody: {
                message: {
                    raw: base64SafeEmail
                }
            }
        });
        console.log(`[Google Service] [${profileKey}] Draft created successfully.`);
        return response.data;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error creating email draft:`, error);
        throw error;
    }
};

export const sendEmail = async (profileKey, to, subject, messageBody) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Send Email Simulated to: ${to}`);
        return { id: 'mock-sent-msg-1' };
    }

    try {
        const gmail = google.gmail({ version: 'v1', auth });
        const emailContent = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            messageBody
        ].join('\n');

        const base64SafeEmail = Buffer.from(emailContent)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: base64SafeEmail
            }
        });
        console.log(`[Google Service] [${profileKey}] Email sent successfully to:`, to);
        return response.data;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error sending email:`, error);
        throw error;
    }
};

// ==========================================
// 4. Google Sheets & Drive Operations
// ==========================================

export const findSpreadsheetByName = async (profileKey, name) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Find Spreadsheet Simulated for: ${name}`);
        return null;
    }

    try {
        const drive = google.drive({ version: 'v3', auth });
        const response = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${name}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
            pageSize: 1
        });

        const files = response.data.files;
        if (files && files.length > 0) {
            return files[0].id;
        }
        return null;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error finding spreadsheet:`, error);
        throw error;
    }
};

export const createSpreadsheet = async (profileKey, title) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Create Spreadsheet Simulated: ${title}`);
        return 'mock-spreadsheet-id';
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const resource = {
            properties: { title }
        };
        const response = await sheets.spreadsheets.create({
            resource,
            fields: 'spreadsheetId'
        });

        const spreadsheetId = response.data.spreadsheetId;
        console.log(`[Google Service] [${profileKey}] Spreadsheet created: ${title} (${spreadsheetId})`);
        
        // Add headers to the new sheet
        await appendSheetRow(profileKey, spreadsheetId, 'A1', [
            ['FECHA', 'CONCEPTO', 'ENTRADA', 'SALIDA', 'SALDO', 'TASA', 'DOLARES']
        ]);

        return spreadsheetId;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error creating spreadsheet:`, error);
        throw error;
    }
};

export const getSpreadsheetSheets = async (profileKey, spreadsheetId) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Get Spreadsheet Sheets Simulated.`);
        return [{ properties: { title: 'Sheet1' } }];
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties.title'
        });
        return response.data.sheets || [];
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error getting sheets:`, error);
        return [];
    }
};

export const addSheet = async (profileKey, spreadsheetId, title) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Add Sheet Simulated: ${title}`);
        return true;
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title }
                    }
                }]
            }
        });
        console.log(`[Google Service] [${profileKey}] Sheet added: ${title}`);
        return true;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error adding sheet:`, error);
        throw error;
    }
};

export const getSheetData = async (profileKey, spreadsheetId, range) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Get Sheet Data Simulated.`);
        return [];
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        return response.data.values || [];
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error reading sheet:`, error);
        return [];
    }
};

export const appendSheetRow = async (profileKey, spreadsheetId, range, values) => {
    const auth = await getAuthForProfile(profileKey);
    if (!auth) {
        console.log(`[Google Service] [${profileKey}] Append Sheet Row Simulated:`, values);
        return { updates: { updatedRows: 1 } };
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const resource = { values };
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource
        });
        console.log(`[Google Service] [${profileKey}] Appended row to sheet.`);
        return response.data;
    } catch (error) {
        console.error(`[Google Service] [${profileKey}] Error appending to sheet:`, error);
        throw error;
    }
};

