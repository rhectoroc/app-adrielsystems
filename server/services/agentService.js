import axios from 'axios';
import { query } from '../db.js';
import { sendMessage } from './automationService.js';
import * as googleService from './googleService.js';
import fs from 'fs';
import path from 'path';

/**
 * AI Agent Service
 * Replaces the complete n8n workflow "AgentesAdrielsSystems" inside the app.
 * Handles client routing, debouncing, LLM agent loop, receipt verification via Gemini, 
 * and Google Workspace integration (Gmail, Calendar, Tasks) for admin users.
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://adrielssystems_evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'AdrielsSystems';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Buffer to debounce consecutive client messages
const messageBuffers = new Map();
const DEBOUNCE_TIME = 7000; // 7 seconds

// Defined Admin Phone Numbers
const ADMINS = {
    LA_JEFA: '584148175382@s.whatsapp.net', // Oxarellys Urbaneja
    EL_JEFE: '584140108030@s.whatsapp.net'  // Hector Ollarves
};

/**
 * Main Webhook Entrance for Evolution API
 */
export const handleIncomingWebhook = async (req, res) => {
    try {
        const body = req.body;
        console.log('[Agent Service] Webhook received:', JSON.stringify(body, null, 2));

        if (!body || !body.data) {
            return res.status(200).json({ status: 'ignored', reason: 'No data' });
        }

        const data = body.data;
        const key = data.key;

        if (!key) {
            return res.status(200).json({ status: 'ignored', reason: 'No key' });
        }

        // 1. Ignore self-sent messages
        if (key.fromMe === true) {
            return res.status(200).json({ status: 'ignored', reason: 'fromMe is true' });
        }

        const remoteJid = key.remoteJid;
        const remoteJidAlt = key.remoteJidAlt || remoteJid;
        const pushName = data.pushName || 'Usuario';
        const messageType = data.messageType || 'conversation';
        const sessionId = remoteJid.replace(/\D/g, '');

        let messageText = '';
        if (messageType === 'conversation') {
            messageText = data.message?.conversation || '';
        } else if (messageType === 'extendedTextMessage') {
            messageText = data.message?.extendedTextMessage?.text || '';
        } else if (messageType === 'imageMessage') {
            messageText = data.message?.imageMessage?.caption || '';
        }

        console.log(`[Agent Service] Message from ${remoteJidAlt} (${pushName}): [${messageType}] "${messageText}"`);

        // Check if Admin
        const isAdmin = Object.values(ADMINS).includes(remoteJidAlt);

        // 2. Handle Admin immediately (no debouncing needed)
        if (isAdmin) {
            const roleName = remoteJidAlt === ADMINS.LA_JEFA ? 'LA_JEFA' : 'EL_JEFE';
            if (messageType === 'imageMessage') {
                const messageId = key.id;
                await processAdminImage(remoteJid, messageId, messageText, roleName, pushName, data);
                return res.status(200).json({ status: 'processed', type: 'admin_image' });
            }
            await processAdminMessage(roleName, remoteJid, messageText, pushName);
            return res.status(200).json({ status: 'processed', type: 'admin' });
        }

        // 3. Handle Regular Client (Image check or Debounced Text)
        if (messageType === 'imageMessage') {
            // Retrieve media base64 from Evolution API and check receipt
            const messageId = key.id;
            await processClientImage(remoteJid, messageId, pushName, data);
            return res.status(200).json({ status: 'processed', type: 'client_image' });
        }

        // Debounce Text Messages
        if (messageText.trim() === '') {
            return res.status(200).json({ status: 'ignored', reason: 'empty text' });
        }

        // Clear existing buffer timeout for this sender
        if (messageBuffers.has(remoteJid)) {
            const existing = messageBuffers.get(remoteJid);
            clearTimeout(existing.timeout);
            existing.messages.push(messageText);
            
            // Set new timeout
            existing.timeout = setTimeout(() => {
                triggerClientResponse(remoteJid, pushName);
            }, DEBOUNCE_TIME);
            
            console.log(`[Agent Service] Appended text to buffer for ${remoteJid}. Buffer length: ${existing.messages.length}`);
        } else {
            const buffer = {
                messages: [messageText],
                timeout: setTimeout(() => {
                    triggerClientResponse(remoteJid, pushName);
                }, DEBOUNCE_TIME)
            };
            messageBuffers.set(remoteJid, buffer);
            console.log(`[Agent Service] Created new message buffer for ${remoteJid}`);
        }

        return res.status(200).json({ status: 'buffered' });
    } catch (error) {
        console.error('[Agent Service] Error in webhook handler:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Trigger Debounced Client Chat Response
 */
const triggerClientResponse = async (remoteJid, pushName) => {
    const buffer = messageBuffers.get(remoteJid);
    if (!buffer) return;

    messageBuffers.delete(remoteJid); // Clear buffer

    const combinedMessage = buffer.messages.join('\n');
    console.log(`[Agent Service] Triggering response for ${remoteJid}. Grouped input:\n"${combinedMessage}"`);

    try {
        const phone = remoteJid.replace(/\D/g, '');
        const sessionId = phone;

        // Save User Message to History
        await query(
            'INSERT INTO conversations (session_id, sender, message_content) VALUES ($1, $2, $3)',
            [sessionId, 'user', combinedMessage]
        );

        // 1. Context Enrichment
        const clientContext = await getClientContext(phone);

        // 2. Chat History
        const historyRows = await query(
            'SELECT sender, message_content FROM conversations WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 10',
            [sessionId]
        );
        const history = historyRows.rows.reverse().map(h => ({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: h.message_content
        }));

        // 3. System Prompt setup
        const nowCaracas = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
        const systemMessage = `==IDENTIDAD
Eres Eva, asistente virtual de Adriel's Systems ("Soluciones a tu medida"). Eres inteligente, empática y muy resolutiva. Responde siempre de forma natural, breve y directa (máximo 3-4 líneas).

CONTEXTO EN TIEMPO REAL (Hora de Venezuela: ${nowCaracas})
Es cliente registrado: ${clientContext.cliente_existe ? 'SÍ' : 'NO'}
Nombre en contacto: ${pushName}
${clientContext.cliente_existe ? `Detalles de Contrato:
- Cliente ID: ${clientContext.client_id}
- Nombre en base de datos: ${clientContext.client_name}
- Email: ${clientContext.email}
- Servicios Activos: ${JSON.stringify(clientContext.servicios)}
- Deuda Total: $${clientContext.deuda_total} USD
- Último Pago: ${JSON.stringify(clientContext.ultimo_pago)}` : ''}

INTELIGENCIA CONVERSACIONAL:
1. CERO ROBOT: Nunca te presentes de nuevo ("¡Hola! Soy Eva...") si ya estás en una charla continua. Ve al grano.
2. ENTIENDE EL CONTEXTO INVISIBLE: Si el cliente agradece, responde un "Sí" o pregunta sobre un pago, dile lo que refleja el sistema con precisión y amabilidad.
3. MENÚ: Solo muestra el menú numerado al inicio o si el cliente está indeciso. No lo impongas en medio de una charla fluida.

MENÚ PARA CLIENTES REGISTRADOS:
1️⃣ Información de mi contrato (Usa la información provista en el CONTEXTO).
2️⃣ Soporte técnico (Indícales que un técnico les atenderá pronto).
3️⃣ Otra consulta.

MENÚ PARA NO CLIENTES:
1️⃣ Conocer nuestros servicios.
2️⃣ Planes y precios.
3️⃣ Agendar una llamada con nuestro equipo.

REGLAS DE RESOLUCIÓN:
- Métodos de pago aceptados: PayPal, Zelle, Pago Móvil, Binance. (NUNCA des números de cuenta por aquí; dile que el equipo administrativo se los dará).
- Agendar Llamada: Envía el enlace https://calendar.app.google/VbiUW5P5HWYHvK4P7 y dile que responda "listo" al terminar.
- Si responde "Listo" tras agendar: Pide su correo y dile que en breve confirmaremos su cita.
- Nunca inventes datos de facturación ni reveles variables internas.`;

        // 4. LLM API Call
        const replyText = await callLLM(systemMessage, history);

        // 5. Send Response via WhatsApp
        await sendMessage(remoteJid, replyText);

        // 6. Save Bot Reply to History
        await query(
            'INSERT INTO conversations (session_id, sender, message_content) VALUES ($1, $2, $3)',
            [sessionId, 'bot', replyText]
        );

    } catch (error) {
        console.error(`[Agent Service] Error responding to client ${remoteJid}:`, error);
    }
};

/**
 * Handle Evolution API Media Message and check with Gemini Vision
 */
const processClientImage = async (remoteJid, messageId, pushName, data) => {
    try {
        console.log(`[Agent Service] Fetching media base64 for message: ${messageId}`);
        
        let base64Data = data?.message?.imageMessage?.base64 || data?.base64;
        let mimeType = data?.message?.imageMessage?.mimetype || 'image/jpeg';

        if (!base64Data) {
            try {
                const evolutionUrl = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`;
                const response = await axios.post(evolutionUrl, { message: data }, {
                    headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' }
                });
                base64Data = response.data?.base64 || response.data?.data?.base64;
                mimeType = response.data?.mimeType || 'image/jpeg';
            } catch (postErr) {
                const evolutionUrlV1 = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}/${messageId}`;
                const response = await axios.get(evolutionUrlV1, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                base64Data = response.data?.base64 || response.data?.data?.base64;
                mimeType = response.data?.mimeType || 'image/jpeg';
            }
        }

        if (!base64Data) {
            throw new Error('Could not retrieve base64 data for the image message');
        }

        console.log('[Agent Service] Sending image to Gemini Vision API for payment verification...');
        
        // 2. Query Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `Eres un asistente estricto de extracción de datos. Tu único trabajo es leer imágenes de comprobantes de pago, transferencias bancarias o recibos (Zelle, Pago Móvil, Banesco, BDV, Binance, etc.) y extraer su información textual.

REGLA CRÍTICA: NO juzgues la autenticidad, la fecha ni el estatus del pago. NO importa si la fecha es pasada/futura, si dice "en proceso", o si sospechas que la imagen está alterada. Si la imagen tiene la estructura visual de un pago o transferencia, asume que es un pago y extrae los datos obligatoriamente.

Extrae ÚNICAMENTE esta información en formato de lista (sin saludos, sin justificaciones y sin texto extra):
* Tipo de pago: [Ej: Pago Móvil BDV, Transferencia Banesco, Zelle, etc.]
* Monto: [Cantidad exacta con su moneda]
* Referencia: [Número de referencia, confirmación u operación]
* Destinatario: [Nombre de la empresa, persona o correo que recibe]
* Nota/Memo: [Si aplica, si no, escribe "N/A"]

Solo si la imagen es algo completamente ajeno a finanzas (como un paisaje, un meme, una foto personal), responde exactamente: "La imagen no es un comprobante de pago. Parece ser: [descripción de 1 línea]".`;

        const geminiPayload = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ]
        };

        const geminiResponse = await axios.post(geminiUrl, geminiPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const analysisText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[Agent Service] Gemini Analysis Result:\n', analysisText);

        const isPayment = !analysisText.toLowerCase().includes('no es un comprobante de pago');

        if (isPayment) {
            const phone = remoteJid.replace(/\D/g, '');
            
            // Check if registered client
            const clientResult = await query('SELECT id, name FROM clients WHERE phone = $1 OR phone LIKE $2', [phone, `%${phone.substring(3)}%`]);
            const client = clientResult.rows[0];

            // 3. Create a Payment Approval attempt in database
            const approvalInsert = await query(`
                INSERT INTO payment_approvals (client_id, client_name, phone, analysis, status)
                VALUES ($1, $2, $3, $4, 'PENDING')
                RETURNING id
            `, [client?.id || null, client?.name || pushName, phone, analysisText]);

            const approvalId = approvalInsert.rows[0].id;
            
            // 4. Reply to the Client
            const clientReply = 'Hemos recibido tu comprobante. Lo he enviado al equipo de administración para su verificación. Te confirmaremos por esta vía en cuanto esté aprobado.';
            await sendMessage(remoteJid, clientReply);

            // 5. Notify El Jefe (Hector) with the Approval Deep Link
            const adminNotify = `🚨 *NUEVO PAGO POR VERIFICAR* 🚨

*Cliente:* ${client?.name || pushName}
*Celular:* +${phone}

*Análisis de la IA:*
${analysisText}

✅ *PARA APROBAR ESTE PAGO, HAZ CLIC AQUÍ:*
${process.env.APP_URL || 'http://localhost:3000'}/api/payments/approve/${approvalId}`;

            await sendMessage(ADMINS.EL_JEFE, adminNotify);
            console.log(`[Agent Service] Payment approval ${approvalId} registered and Hector notified.`);

        } else {
            // Reply that image is not a payment receipt
            const clientReply = 'He recibido una imagen, pero no parece ser un comprobante de pago. Si estás intentando reportar un pago, por favor envía una captura de pantalla clara de la transacción. ¿Te puedo ayudar con algo más?';
            await sendMessage(remoteJid, clientReply);
        }

    } catch (error) {
        console.error('[Agent Service] Error processing media message:', error.message);
        await sendMessage(remoteJid, `Lo siento, no pude procesar la imagen enviada. Error interno: ${error.message}. Por favor comunícate con soporte.`);
    }
};

/**
 * Handle Admin Image Messages by using Gemini Vision API and feeding result to Agent Reasoning
 */
const processAdminImage = async (remoteJid, messageId, captionText, roleName, pushName, data) => {
    try {
        console.log(`[Agent Service] Fetching admin media base64 for message: ${messageId}`);
        
        let base64Data = data?.message?.imageMessage?.base64 || data?.base64;
        let mimeType = data?.message?.imageMessage?.mimetype || 'image/jpeg';

        if (!base64Data) {
            try {
                const evolutionUrl = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`;
                const response = await axios.post(evolutionUrl, { message: data }, {
                    headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' }
                });
                base64Data = response.data?.base64 || response.data?.data?.base64;
                mimeType = response.data?.mimeType || 'image/jpeg';
            } catch (postErr) {
                const evolutionUrlV1 = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}/${messageId}`;
                const response = await axios.get(evolutionUrlV1, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                base64Data = response.data?.base64 || response.data?.data?.base64;
                mimeType = response.data?.mimeType || 'image/jpeg';
            }
        }

        if (!base64Data) {
            throw new Error('Could not retrieve base64 data for the image message');
        }

        console.log('[Agent Service] Sending admin image to Gemini Vision API...');
        
        // 2. Query Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `Eres un asistente estricto de extracción de datos de comprobantes de pago financieros. Tu único trabajo es leer la imagen y extraer la información clave en formato de lista (sin saludos, sin justificaciones y sin texto extra):
* Tipo de pago: [Ej: Pago Móvil BDV, Transferencia Banesco, Zelle, etc.]
* Monto: [Cantidad exacta, ej: 50]
* Moneda: [Moneda del pago, ej: USD, VES, etc.]
* Referencia: [Número de referencia, confirmación u operación]
* Destinatario: [Nombre de la empresa, persona o correo que recibe]
* Nota/Memo: [Si aplica, si no, escribe "N/A"]`;

        const geminiPayload = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ]
        };

        const geminiResponse = await axios.post(geminiUrl, geminiPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const analysisText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[Agent Service] Admin Gemini Analysis Result:\n', analysisText);

        // Now, append this analysis to the reasoning cycle of processAdminMessage
        const captionInst = captionText.trim() ? `Instrucciones del Jefe: "${captionText}"` : "El Jefe no dejó instrucciones de texto. Pregúntale qué desea hacer con este comprobante.";
        const injectedMessage = `${captionInst}\n\n[SISTEMA - ANÁLISIS DE LA IMAGEN ENVIADA POR EL JEFE]:\nHe extraído los siguientes datos visuales de la imagen adjunta:\n${analysisText}\n\nPor favor, atiende la solicitud del Jefe usando los datos extraídos. Si es el pago de un cliente, búscalo y regístralo. Si es un gasto o ingreso para el control financiero, usa 'log_multiple_transactions' con los montos extraídos.`;
        
        // --- GUARDAR IMAGEN EN EL SERVIDOR ---
        try {
            const uploadRoot = process.platform === 'win32' ? path.join(process.cwd(), 'data') : '/data';
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const currentMonthName = meses[new Date().getMonth()];
            const uploadDir = path.join(uploadRoot, 'capref', 'Financiera', currentMonthName);
            
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
            const filename = `financiera_${Date.now()}_${Math.round(Math.random() * 1E9)}.${ext}`;
            const filePath = path.join(uploadDir, filename);

            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);
            console.log(`[Agent Service] Admin image saved successfully at: ${filePath}`);
        } catch (fsErr) {
            console.error('[Agent Service] Could not save admin image to filesystem:', fsErr.message);
        }
        // -------------------------------------

        await processAdminMessage(roleName, remoteJid, injectedMessage, pushName);
    } catch (error) {
        let errDetails = error.message;
        if (error.response) {
            errDetails = `${error.response.status} at ${error.config.url}`;
        }
        console.error('[Agent Service] Error processing admin media message:', error.message);
        await sendMessage(remoteJid, `Jefe, recibí su imagen pero falló el procesamiento. Error interno: ${errDetails}`);
    }
};

/**
 * Handle Payment Approval Link clicked by Boss
 */
export const approvePaymentById = async (approvalId) => {
    try {
        // 1. Fetch approval details
        const approvalResult = await query('SELECT * FROM payment_approvals WHERE id = $1', [approvalId]);
        const approval = approvalResult.rows[0];

        if (!approval) {
            return { success: false, message: 'Registro de aprobación no localizado.' };
        }

        if (approval.status === 'APPROVED') {
            return { success: true, message: 'Este pago ya ha sido aprobado previamente.' };
        }

        // Parse amount and currency from AI analysis text
        let amount = 10.0; // Default
        let currency = 'USD';
        const amountMatch = approval.analysis.match(/Monto:\s*([$]?\d+([.,]\d+)?)\s*([A-Za-z]+)?/i);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1].replace('$', '').replace(',', '.'));
            if (amountMatch[3]) currency = amountMatch[3].toUpperCase();
        }

        // 2. Mark approval as APPROVED
        await query(
            'UPDATE payment_approvals SET status = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['APPROVED', approvalId]
        );

        // 3. Register payment in database if client exists
        if (approval.client_id) {
            // Find active service
            const serviceResult = await query('SELECT id FROM services WHERE client_id = $1 AND status = \'ACTIVE\' LIMIT 1', [approval.client_id]);
            const serviceId = serviceResult.rows[0]?.id || null;

            await query(`
                INSERT INTO payments (client_id, service_id, amount, status, payment_method, due_date, notes)
                VALUES ($1, $2, $3, 'PAID', 'Transferencia/Móvil', CURRENT_DATE, $4)
            `, [approval.client_id, serviceId, amount, `Aprobado automáticamente vía bot. Ref: ${approvalId}`]);

            // Update service last payment date and extend expiration date by 1 month
            if (serviceId) {
                await query(`
                    UPDATE services 
                    SET last_payment_date = CURRENT_DATE,
                        expiration_date = COALESCE(expiration_date, CURRENT_DATE) + INTERVAL '1 month'
                    WHERE id = $1
                `, [serviceId]);
            }
        }

        // 4. Send Confirmation WhatsApp to the Client
        const clientJid = `${approval.phone}@s.whatsapp.net`;
        const approvalMessage = `¡Hola ${approval.client_name}! ✅ Tu pago ha sido verificado y aprobado exitosamente por nuestro equipo de administración. \n\nTu servicio se encuentra activo. ¡Gracias por confiar en Adriel's Systems! ¿Hay algo más en lo que te pueda ayudar hoy?`;
        
        await sendMessage(clientJid, approvalMessage);
        
        // Notify El Jefe that it went successfully
        await sendMessage(ADMINS.EL_JEFE, `✅ El pago del cliente *${approval.client_name}* (Ref: ${approvalId}) ha sido aprobado y el cliente ha sido notificado.`);

        return { success: true, message: 'Pago verificado y aprobado exitosamente. Cliente notificado.' };

    } catch (error) {
        console.error('[Agent Service] Error executing payment approval:', error);
        throw error;
    }
};

/**
 * Handle Admin Agent (Hector / Oxarellys) using Prompts and custom Tool Calling Loop
 */
const processAdminMessage = async (roleName, remoteJid, messageText, pushName) => {
    try {
        const sessionId = remoteJid.replace(/\D/g, '');
        const nowCaracas = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
        const profileKey = roleName === 'LA_JEFA' ? 'JEFA' : 'JEFE';

        // Save Admin Input to logs
        await query(
            'INSERT INTO arc_logs (session_id, sender, message_content) VALUES ($1, $2, $3)',
            [sessionId, 'Jefe', messageText]
        );

        // Fetch logs for memory
        const logHistory = await query(
            'SELECT sender, message_content, tool_used FROM arc_logs WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 8',
            [sessionId]
        );
        const historySummary = logHistory.rows.reverse().map(l => 
            `[${l.sender}]: ${l.message_content} ${l.tool_used ? `(Herramienta: ${l.tool_used})` : ''}`
        ).join('\n');

        // Setup Agent System Instruction with JSON-based Tool Calling definition
        const systemMessage = `=0. ROL Y OBJETIVO PRINCIPAL
Actúas como EVA, la asistente virtual inteligente y ejecutiva personal de ${roleName === 'LA_JEFA' ? 'la Jefa (Oxarellys Urbaneja)' : 'el Jefe (Hector Ollarves)'}. Tu misión es asistirlos con la máxima calidez, cortesía y eficiencia en el día a día.

HORA ACTUAL: ${nowCaracas}

1. TONO Y PERSONALIDAD
- Jerarquía: Te diriges al usuario con aprecio y respeto como "${roleName === 'LA_JEFA' ? 'Jefa' : 'Jefe'}".
- Tono: Sumamente humano, cálido, servicial y empático. Habla de forma natural y cordial, como una asistente ejecutiva de alto nivel de total confianza. Evita a toda costa sonar fría, rígida, distante o robótica.
- Estilo: Amigable, cordial y profesional. Puedes usar emojis de forma sutil y elegante (😊, ✨, 📝, 📅, 👍) para dar calidez y cercanía a tus respuestas. Utiliza saludos amables y frases de cortesía sinceras.
- Idioma: Español.

2. HERRAMIENTAS DISPONIBLES:
Debes usar estas herramientas cuando te pidan gestionar el calendario, email, tareas o clientes:
- check_calendar_availability(startTime, durationMinutes)
- schedule_meeting(title, start, end, description, attendees)
- find_and_manage_meeting(queryText, timeMin, timeMax)
- delete_meeting(eventId)
- list_tasks(taskListId)
- add_task(title, notes)
- delete_task(taskId)
- scan_inbox(queryText)
- get_email_details(messageId)
- create_draft(to, subject, messageBody)
- send_email(to, subject, messageBody) (REQUIERE AUTORIZACIÓN EXPLÍCITA DEL JEFE)
- query_client(phone)
- edit_client(phone, fieldsJSON)
- get_billing_summary() (Úsala cuando te pidan verificar el estatus de todos los clientes, ver quiénes deben, o un resumen de cobranza general)
- search_client_by_name(name) (Úsala para buscar clientes por su nombre cuando no tengas su número de teléfono)
- register_client_payment(clientId, amount, currency, reference, notes) (Úsala para registrar un pago verificado de un cliente, renovar su servicio y notificarle automáticamente por WhatsApp y Correo Electrónico)
- send_whatsapp(phone, message) (Úsala para enviar un mensaje directo de WhatsApp a un cliente o número. Ej: recordatorios de pago, notificaciones personalizadas o cualquier mensaje que el Jefe o Jefa te solicite enviar por WhatsApp)
- create_financial_sheet() (Úsala si el Jefe te pide explícitamente crear o inicializar el documento de Excel/Sheets para llevar los registros financieros desde cero)
- get_bcv_rate() (Úsala si el Jefe te pregunta cuál es la tasa del dólar actual del BCV)
- log_multiple_transactions(transactions) (Úsala para registrar UNA o MÚLTIPLES entradas y salidas de dinero. El parámetro 'transactions' es un ARREGLO de objetos JSON [{"type": "ENTRADA" o "SALIDA", "concept": "...", "amount": número, "currency": "VES" o "USD"}])
- get_current_balance() (Úsala para consultar el saldo total y exacto de la cuenta en Postgres)
- get_historical_bcv_rate(date_string) (Úsala para consultar a cómo estaba la tasa del BCV en una fecha pasada. FORMATO ESTRICTO YYYY-MM-DD. NO envíes frases relativas, deduce matemáticamente la fecha usando la HORA ACTUAL)
- get_bcv_rate_range(start_date, end_date) (Úsala para pedir las tasas del dólar en un periodo de tiempo y hacer análisis de fluctuación. FORMATOS ESTRICTOS YYYY-MM-DD)
- convert_currency(amount, from_currency, to_currency, use_historical_date) (Úsala SIEMPRE que te pidan calcular equivalencias como "Cuántos dólares son 5000 bolívares hoy" para hacer cálculos matemáticos infalibles. from/to pueden ser "USD" o "VES". use_historical_date es opcional pero debe ser estrictamente YYYY-MM-DD)

3. INSTRUCCIONES DE RESPUESTA EN FORMATO JSON (CRÍTICO)
Debes responder SIEMPRE con un objeto JSON válido con los siguientes campos:
A) Si deseas ejecutar una herramienta:
{
  "action": "tool_name",
  "parameters": {
     "param1": "val1"
  }
}
B) Si tienes la respuesta final para el usuario:
{
  "action": "reply",
  "text": "Tu respuesta final, cordial, natural y estructurada con amabilidad..."
}

4. REGLAS DE CONTROL DE FLUJO Y EVITACIÓN DE BUCLES (CRÍTICO):
- Ejecución Única: Si una herramienta de acción directa (como \`send_whatsapp\`, \`send_email\`, \`register_client_payment\`, \`schedule_meeting\`, \`add_task\`, etc.) ya se ejecutó exitosamente y tienes el resultado del sistema (e.g. \`{"success":true,...}\`), NO debes volver a llamarla ni llamar a otra similar en el mismo turno. Tu paso siguiente e inmediato debe ser responder al Jefe o Jefa con la acción "reply" para informar de la confirmación final.
- Cero Duplicados: Nunca envíes dos recordatorios o mensajes por WhatsApp en una misma interacción.

HISTORIAL DE CONVERSACIÓN:
${historySummary}

MENSAJE DEL USUARIO:
"${messageText}"`;

        // Start Agent Reasoning Loop
        let finalResponse = 'Lo siento, Jefe. Estoy experimentando dificultades técnicas ahora mismo.';
        let loopCount = 0;
        let currentPrompt = systemMessage;

        while (loopCount < 3) {
            loopCount++;
            console.log(`[Agent Loop] Executing reasoning cycle ${loopCount}...`);

            const llmOutput = await callLLMJSON(currentPrompt);
            let parsed;
            try {
                parsed = JSON.parse(llmOutput);
            } catch (err) {
                console.error('[Agent Loop] LLM failed to output valid JSON. Output was:', llmOutput);
                // Try to search for JSON substring
                const jsonMatch = llmOutput.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try { parsed = JSON.parse(jsonMatch[0]); } catch (_) {}
                }
            }

            if (!parsed || !parsed.action) {
                finalResponse = llmOutput;
                break;
            }

            if (parsed.action === 'reply') {
                finalResponse = parsed.text;
                break;
            }

            // Execute Tool
            console.log(`[Agent Loop] Executing Tool: "${parsed.action}" with parameters:`, parsed.parameters);
            let toolResult = '';
            
            try {
                switch (parsed.action) {
                    case 'check_calendar_availability':
                        toolResult = await googleService.checkCalendarAvailability(profileKey, 'primary', parsed.parameters.startTime, parsed.parameters.durationMinutes);
                        break;
                    case 'schedule_meeting':
                        toolResult = JSON.stringify(await googleService.scheduleMeeting(profileKey, 'primary', parsed.parameters));
                        break;
                    case 'find_and_manage_meeting':
                        toolResult = JSON.stringify(await googleService.findAndManageMeeting(profileKey, 'primary', parsed.parameters.queryText, parsed.parameters.timeMin, parsed.parameters.timeMax));
                        break;
                    case 'delete_meeting':
                        toolResult = JSON.stringify(await googleService.deleteMeeting(profileKey, 'primary', parsed.parameters.eventId));
                        break;
                    case 'list_tasks':
                        toolResult = JSON.stringify(await googleService.listTasks(profileKey, parsed.parameters.taskListId));
                        break;
                    case 'add_task':
                        toolResult = JSON.stringify(await googleService.addTask(profileKey, parsed.parameters.taskListId, parsed.parameters.title, parsed.parameters.notes));
                        break;
                    case 'delete_task':
                        toolResult = JSON.stringify(await googleService.deleteTask(profileKey, parsed.parameters.taskListId, parsed.parameters.taskId));
                        break;
                    case 'scan_inbox':
                        toolResult = JSON.stringify(await googleService.scanInbox(profileKey, parsed.parameters.queryText));
                        break;
                    case 'get_email_details':
                        toolResult = JSON.stringify(await googleService.getEmailDetails(profileKey, parsed.parameters.messageId));
                        break;
                    case 'create_draft':
                        toolResult = JSON.stringify(await googleService.createDraft(profileKey, parsed.parameters.to, parsed.parameters.subject, parsed.parameters.messageBody));
                        break;
                    case 'send_email':
                        toolResult = JSON.stringify(await googleService.sendEmail(profileKey, parsed.parameters.to, parsed.parameters.subject, parsed.parameters.messageBody));
                        break;
                    case 'query_client':
                        const clientInfo = await getClientContext(parsed.parameters.phone.replace(/\D/g, ''));
                        toolResult = JSON.stringify(clientInfo);
                        break;
                    case 'get_billing_summary':
                        const billingSummary = await getBillingSummary();
                        toolResult = JSON.stringify(billingSummary);
                        break;
                    case 'search_client_by_name':
                        const searchResult = await searchClientByName(parsed.parameters.name);
                        toolResult = JSON.stringify(searchResult);
                        break;
                    case 'register_client_payment':
                        const { clientId, amount, currency, reference, notes: paymentNotes } = parsed.parameters;
                        const regResult = await registerClientPayment(clientId, amount, currency, reference, paymentNotes);
                        toolResult = JSON.stringify(regResult);
                        break;
                    case 'send_whatsapp': {
                        const { phone: waPhone, message: waMessage } = parsed.parameters;
                        if (!waPhone || !waMessage) {
                            toolResult = JSON.stringify({ success: false, message: 'Faltan parámetros requeridos: phone o message.' });
                            break;
                        }
                        const cleanPhone = waPhone.replace(/\D/g, '');
                        await sendMessage(cleanPhone, waMessage);
                        
                        let clientId = null;
                        if (cleanPhone.length >= 7) {
                            const suffix = cleanPhone.substring(cleanPhone.length - 7);
                            const clientResult = await query(
                                'SELECT id FROM clients WHERE phone = $1 OR phone LIKE $2 LIMIT 1',
                                [cleanPhone, `%${suffix}`]
                            );
                            if (clientResult.rows.length > 0) {
                                clientId = clientResult.rows[0].id;
                            }
                        }
                        
                        await query(
                            'INSERT INTO notification_logs (client_id, type, channel, status, message_body) VALUES ($1, $2, $3, $4, $5)',
                            [clientId, 'manual', 'whatsapp', 'SENT', waMessage]
                        );
                        
                        toolResult = JSON.stringify({ success: true, message: `Mensaje de WhatsApp enviado exitosamente a +${cleanPhone} y registrado en el historial.` });
                        break;
                    }
                    case 'edit_client':
                        const { phone, fieldsJSON } = parsed.parameters;
                        // Execute SQL Edit
                        const sets = [];
                        const vals = [];
                        let idx = 1;
                        for (const [k, v] of Object.entries(fieldsJSON)) {
                            sets.push(`${k} = $${idx}`);
                            vals.push(v);
                            idx++;
                        }
                        vals.push(phone.replace(/\D/g, ''));
                        const updateQuery = `UPDATE clients SET ${sets.join(', ')} WHERE phone = $${idx}`;
                        await query(updateQuery, vals);
                        toolResult = 'Cliente actualizado con éxito en Base de Datos.';
                        break;
                    case 'create_financial_sheet': {
                        const sheetName = 'Registro Financiero EVA';
                        let spreadsheetId = await googleService.findSpreadsheetByName(profileKey, sheetName);
                        if (!spreadsheetId) {
                            spreadsheetId = await googleService.createSpreadsheet(profileKey, sheetName);
                            toolResult = JSON.stringify({ success: true, message: `Documento '${sheetName}' creado exitosamente en tu Google Drive.` });
                        } else {
                            toolResult = JSON.stringify({ success: true, message: `El documento '${sheetName}' ya existe en tu Google Drive.` });
                        }
                        break;
                    }
                    case 'get_bcv_rate': {
                        const rate = await getBCVRate();
                        if (rate) {
                            toolResult = JSON.stringify({ success: true, rate: rate, message: `La tasa actual del BCV es ${rate} VES por USD.` });
                        } else {
                            toolResult = JSON.stringify({ success: false, message: 'No se pudo obtener la tasa en este momento.' });
                        }
                        break;
                    }
                    case 'get_current_balance': {
                        // Query Postgres
                        const balanceRes = await query(`
                            SELECT 
                                COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_usd ELSE -amount_usd END), 0) as balance_usd,
                                COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_ves ELSE -amount_ves END), 0) as balance_ves
                            FROM financial_ledger
                        `);
                        const b = balanceRes.rows[0];
                        toolResult = JSON.stringify({ success: true, balance_usd: parseFloat(b.balance_usd).toFixed(2), balance_ves: parseFloat(b.balance_ves).toFixed(2) });
                        break;
                    }
                    case 'get_historical_bcv_rate': {
                        let queryDate = parsed.parameters.date_string;
                        try {
                            let result = await query(`SELECT rate_ves, date FROM exchange_rates_history WHERE date = $1::date`, [queryDate]);
                            if (result.rows.length > 0) {
                                toolResult = JSON.stringify({ success: true, rate: result.rows[0].rate_ves, date: result.rows[0].date });
                            } else {
                                toolResult = JSON.stringify({ success: false, message: 'No hay registro de la tasa BCV para esa fecha en la base de datos.' });
                            }
                        } catch (e) {
                            toolResult = JSON.stringify({ success: false, message: 'Formato de fecha inválido o error en consulta. Usa YYYY-MM-DD.' });
                        }
                        break;
                    }
                    case 'get_bcv_rate_range': {
                        const { start_date, end_date } = parsed.parameters;
                        try {
                            let result = await query(`SELECT date, rate_ves FROM exchange_rates_history WHERE date >= $1::date AND date <= $2::date ORDER BY date ASC`, [start_date, end_date]);
                            if (result.rows.length > 0) {
                                toolResult = JSON.stringify({ success: true, rates: result.rows });
                            } else {
                                toolResult = JSON.stringify({ success: false, message: 'No se encontraron tasas para ese rango de fechas.' });
                            }
                        } catch (e) {
                            toolResult = JSON.stringify({ success: false, message: 'Formato de fecha inválido. Usa YYYY-MM-DD.' });
                        }
                        break;
                    }
                    case 'convert_currency': {
                        const { amount, from_currency, to_currency, use_historical_date } = parsed.parameters;
                        let rate = null;
                        if (use_historical_date) {
                            try {
                                let r = await query(`SELECT rate_ves FROM exchange_rates_history WHERE date = $1::date`, [use_historical_date]);
                                if (r.rows.length > 0) rate = parseFloat(r.rows[0].rate_ves);
                            } catch (e) {}
                        }
                        if (!rate) {
                            rate = await getBCVRate();
                        }
                        if (!rate) {
                            toolResult = JSON.stringify({ success: false, message: 'No se pudo obtener la tasa BCV.' });
                            break;
                        }
                        const amt = parseFloat(amount);
                        let resultAmt = 0;
                        if (from_currency.toUpperCase() === 'VES' && to_currency.toUpperCase() === 'USD') {
                            resultAmt = amt / rate;
                        } else if (from_currency.toUpperCase() === 'USD' && to_currency.toUpperCase() === 'VES') {
                            resultAmt = amt * rate;
                        } else {
                            resultAmt = amt; // Same
                        }
                        toolResult = JSON.stringify({ success: true, original: `${amt} ${from_currency}`, converted: `${resultAmt.toFixed(2)} ${to_currency}`, rate_used: rate });
                        break;
                    }
                    case 'log_multiple_transactions': {
                        const { transactions } = parsed.parameters;
                        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
                            toolResult = JSON.stringify({ success: false, message: 'Faltan transacciones o el formato no es un arreglo.' });
                            break;
                        }

                        // Get BCV Rate
                        const rate = await getBCVRate();
                        if (!rate) {
                            toolResult = JSON.stringify({ success: false, message: 'No se pudo obtener la tasa BCV actual. Intenta más tarde.' });
                            break;
                        }

                        // ----- STEP 1: Postgres -----
                        let successCount = 0;
                        for (const tx of transactions) {
                            const { type, concept, amount, currency } = tx;
                            if (!type || !concept || amount === undefined || !currency) continue;

                            const parsedAmount = parseFloat(amount);
                            if (isNaN(parsedAmount)) continue;

                            let amountVES = currency.toUpperCase() === 'USD' ? parsedAmount * rate : parsedAmount;
                            let amountUSD = currency.toUpperCase() === 'VES' ? parsedAmount / rate : parsedAmount;

                            await query(`
                                INSERT INTO financial_ledger (type, concept, amount_ves, amount_usd, exchange_rate)
                                VALUES ($1, $2, $3, $4, $5)
                            `, [type.toUpperCase(), concept, amountVES, amountUSD, rate]);
                            successCount++;
                        }
                        
                        // ----- STEP 2: Google Sheets Backup -----
                        try {
                            const sheetName = 'Registro Financiero EVA';
                            let spreadsheetId = await googleService.findSpreadsheetByName(profileKey, sheetName);
                            if (!spreadsheetId) {
                                spreadsheetId = await googleService.createSpreadsheet(profileKey, sheetName);
                            }

                            const now = new Date();
                            const currentMonthName = now.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
                            const sheets = await googleService.getSpreadsheetSheets(profileKey, spreadsheetId);
                            const sheetExists = sheets.some(s => s.properties.title === currentMonthName);

                            if (!sheetExists) {
                                await googleService.addSheet(profileKey, spreadsheetId, currentMonthName);
                                await googleService.appendSheetRow(profileKey, spreadsheetId, `'${currentMonthName}'!A1`, [
                                    ['FECHA', 'CONCEPTO', 'ENTRADA', 'SALIDA', '={"SALDO"; ARRAYFORMULA(IF(C2:C&D2:D="", "", SUMIF(ROW(C2:C), "<="&ROW(C2:C), C2:C) - SUMIF(ROW(D2:D), "<="&ROW(D2:D), D2:D)))}', 'TASA', '={"DOLARES"; ARRAYFORMULA(IF(E2:E&F2:F="", "", IF(F2:F>0, E2:E/F2:F, "")))}']
                                ]);
                            }

                            const rowsToAppend = [];
                            const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
                            for (const tx of transactions) {
                                const { type, concept, amount, currency } = tx;
                                if (!type || !concept || amount === undefined || !currency) continue;
                                const parsedAmount = parseFloat(amount);
                                if (isNaN(parsedAmount)) continue;

                                let amountVES = currency.toUpperCase() === 'USD' ? parsedAmount * rate : parsedAmount;
                                let entrada = type.toUpperCase() === 'ENTRADA' ? amountVES : '';
                                let salida = type.toUpperCase() === 'SALIDA' ? amountVES : '';

                                rowsToAppend.push([dateStr, concept, entrada, salida, '', rate, '']);
                            }

                            if (rowsToAppend.length > 0) {
                                await googleService.appendSheetRow(profileKey, spreadsheetId, `'${currentMonthName}'!A1`, rowsToAppend);
                            }
                        } catch (sheetErr) {
                            console.error('[Agent Loop] Sheets backup failed:', sheetErr.message);
                        }

                        // ----- RETURN RESULT -----
                        if (successCount > 0) {
                            // Fetch fresh balance
                            const balanceRes = await query(`SELECT COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount_usd ELSE -amount_usd END), 0) as balance_usd FROM financial_ledger`);
                            const b = balanceRes.rows[0];
                            toolResult = JSON.stringify({ success: true, message: `Se registraron ${successCount} transacciones en la Base de Datos y Sheets. Nuevo Saldo: $${parseFloat(b.balance_usd).toFixed(2)} USD.` });
                        } else {
                            toolResult = JSON.stringify({ success: false, message: 'Ninguna transacción fue válida para registrar.' });
                        }
                        
                        break;
                    }
                    default:
                        toolResult = 'Error: Herramienta no reconocida.';
                }
            } catch (err) {
                console.error(`[Agent Loop] Error running tool "${parsed.action}":`, err);
                toolResult = `Error ejecutando la herramienta: ${err.message}`;
            }

            console.log(`[Agent Loop] Tool Result:`, toolResult);

            // Log tool execution to database
            await query(
                'INSERT INTO arc_logs (session_id, sender, message_content, tool_used) VALUES ($1, $2, $3, $4)',
                [sessionId, 'System', `Resultado de herramienta: ${parsed.action}`, parsed.action]
            );

            // Append Tool Result to Prompt for next loop cycle
            currentPrompt += `\n\n[SISTEMA - RESULTADO DE HERRAMIENTA "${parsed.action}"]:
${toolResult}

Continúa razonando y devuelve el JSON correspondiente.`;
        }

        // Send response back to Admin
        await sendMessage(remoteJid, finalResponse);

        // Save Eva reply to history logs
        await query(
            'INSERT INTO arc_logs (session_id, sender, message_content) VALUES ($1, $2, $3)',
            [sessionId, 'Eva', finalResponse]
        );

    } catch (error) {
        console.error('[Agent Service] Error in Admin processing:', error);
        await sendMessage(remoteJid, 'Jefe, ha ocurrido un error procesando su solicitud. Por favor verifique el log de la aplicación.');
    }
};

/**
 * Gather complete Client Account and Contract context details
 */
export const getClientContext = async (phone) => {
    try {
        const clientRes = await query(`
            SELECT c.*,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', s.id,
                        'nombre', s.name,
                        'costo_mensual', s.cost,
                        'special_price', s.special_price,
                        'moneda', s.currency,
                        'estado', s.status,
                        'vencimiento', s.expiration_date,
                        'estado_pago', CASE 
                                   WHEN s.expiration_date IS NULL OR (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE THEN 'MOROSO'
                                   WHEN ((s.expiration_date + INTERVAL '5 days') >= CURRENT_DATE AND s.expiration_date < CURRENT_DATE)
                                       OR (s.expiration_date >= CURRENT_DATE AND s.expiration_date <= (CURRENT_DATE + INTERVAL '3 days')) THEN 'PROXIMO'
                                   ELSE 'AL DIA'
                               END,
                        'dias_vencido', CASE 
                                   WHEN s.expiration_date < CURRENT_DATE THEN CURRENT_DATE - s.expiration_date
                                   ELSE 0
                               END
                    )
                ) FILTER(WHERE s.id IS NOT NULL),
                '[]'
            ) as servicios,
            COALESCE(SUM(
                CASE 
                    WHEN s.renewal_day = 30 THEN
                        (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                        (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                    ELSE
                        COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                END
            ) FILTER(WHERE s.status = 'ACTIVE' AND s.expiration_date < CURRENT_DATE), 0) as deuda_total
            FROM clients c
            LEFT JOIN services s ON s.client_id = c.id
            WHERE c.phone = $1 OR c.phone LIKE $2
            GROUP BY c.id
        `, [phone, `%${phone.substring(3)}%`]);

        const client = clientRes.rows[0];
        if (!client) {
            return { cliente_existe: false, deuda_total: 0, servicios: [] };
        }

        // Fetch last payment details
        const paymentRes = await query(`
            SELECT amount, payment_date, payment_method 
            FROM payments 
            WHERE client_id = $1 
            ORDER BY payment_date DESC LIMIT 1
        `, [client.id]);

        const row = paymentRes.rows[0];
        const lastPayment = row ? {
            monto: row.amount,
            fecha: row.payment_date,
            metodo: row.payment_method
        } : null;

        return {
            cliente_existe: true,
            client_id: client.id,
            client_name: client.name,
            email: client.email,
            servicios: client.servicios,
            deuda_total: parseFloat(client.deuda_total).toFixed(2),
            ultimo_pago: lastPayment
        };
    } catch (err) {
        console.error('[Agent Service] Error getting client context:', err);
        return { cliente_existe: false, deuda_total: 0, servicios: [] };
    }
};

/**
 * Search clients by name
 */
export const searchClientByName = async (name) => {
    try {
        const result = await query(
            'SELECT id, name, phone, email FROM clients WHERE name ILIKE $1 AND is_active = true',
            [`%${name}%`]
        );
        return result.rows;
    } catch (error) {
        console.error('[Agent Service] Error searching client by name:', error);
        return [];
    }
};

/**
 * Register client payment and notify client via email and WhatsApp
 */
export const registerClientPayment = async (clientId, amount, currency, reference, notes) => {
    try {
        // 1. Fetch client details
        const clientRes = await query('SELECT id, name, phone, email FROM clients WHERE id = $1', [clientId]);
        const client = clientRes.rows[0];
        if (!client) {
            return { success: false, message: 'Cliente no localizado en la base de datos.' };
        }

        // 2. Find active service
        const serviceResult = await query('SELECT id, name FROM services WHERE client_id = $1 AND status = \'ACTIVE\' LIMIT 1', [clientId]);
        const service = serviceResult.rows[0];
        const serviceId = service?.id || null;

        // 3. Register payment in database
        await query(`
            INSERT INTO payments (client_id, service_id, amount, status, payment_method, due_date, notes)
            VALUES ($1, $2, $3, 'PAID', 'Transferencia/Móvil', CURRENT_DATE, $4)
        `, [clientId, serviceId, amount, `Registrado por EVA vía WhatsApp. Ref: ${reference}. Nota: ${notes || 'N/A'}`]);

        // 4. Update service expiration date and last payment date
        if (serviceId) {
            await query(`
                UPDATE services 
                SET last_payment_date = CURRENT_DATE,
                    expiration_date = COALESCE(expiration_date, CURRENT_DATE) + INTERVAL '1 month'
                WHERE id = $1
            `, [serviceId]);
        }

        // 5. Send Confirmation WhatsApp to the Client
        const clientJid = `${client.phone}@s.whatsapp.net`;
        const whatsappMessage = `¡Hola ${client.name}! ✅ Tu pago de *${amount} ${currency}* (Ref: ${reference}) ha sido recibido y registrado con éxito. \n\nTu servicio se encuentra activo y al día. ¡Gracias por confiar en Adriel's Systems! ✨`;
        await sendMessage(clientJid, whatsappMessage);

        // 6. Send HTML Confirmation Email to the Client (if email exists)
        let emailSent = false;
        if (client.email && client.email.trim() !== '') {
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e1e8ed; border-radius: 12px; background-color: #ffffff; color: #2C3E50;">
                    <div style="text-align: center; border-bottom: 2px solid #3498DB; padding-bottom: 15px; margin-bottom: 20px;">
                        <h2 style="color: #3498DB; margin: 0; font-size: 24px;">Adriel's Systems</h2>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #7F8C8D;">Comprobante de Registro de Pago</p>
                    </div>
                    <p style="font-size: 16px; line-height: 1.5;">Estimado/a <strong>${client.name}</strong>,</p>
                    <p style="font-size: 15px; line-height: 1.5; color: #34495E;">Le confirmamos que hemos recibido y registrado su pago con éxito en nuestro sistema administrativo:</p>
                    
                    <div style="background-color: #F8F9FA; border-left: 4px solid #3498DB; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold; color: #7F8C8D; width: 40%;">Monto Registrado:</td>
                                <td style="padding: 6px 0; font-weight: bold; color: #2C3E50; font-size: 16px;">${amount} ${currency}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold; color: #7F8C8D;">Referencia:</td>
                                <td style="padding: 6px 0; color: #2C3E50;">${reference}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold; color: #7F8C8D;">Fecha de Registro:</td>
                                <td style="padding: 6px 0; color: #2C3E50;">${new Date().toLocaleDateString('es-VE')}</td>
                            </tr>
                            ${service ? `
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold; color: #7F8C8D;">Servicio Renovado:</td>
                                <td style="padding: 6px 0; color: #2C3E50;">${service.name}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    
                    <p style="font-size: 15px; line-height: 1.5; color: #34495E;">Su servicio ha sido renovado y se encuentra activo y al día. Agradecemos enormemente su puntualidad y confianza en nuestras soluciones.</p>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ECF0F1; font-size: 12px; color: #BDC3C7;">
                        <p style="margin: 0;">Este correo ha sido generado y enviado automáticamente por EVA, la asistente virtual de Adriel's Systems.</p>
                        <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Adriel's Systems. Todos los derechos reservados.</p>
                    </div>
                </div>
            `;

            try {
                await googleService.sendEmail('JEFE', client.email, 'Confirmación de Pago - Adriel\'s Systems', emailHtml);
                emailSent = true;
                console.log(`[Agent Service] Confirmation email sent to ${client.email}`);
            } catch (emailErr) {
                console.error('[Agent Service] Error sending confirmation email:', emailErr.message);
            }
        }

        return { success: true, message: 'Pago registrado, servicio extendido y notificaciones enviadas.', email_enviado: emailSent };
    } catch (error) {
        console.error('[Agent Service] Error registering client payment:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Fetch billing summary for all active services/clients
 */
export const getBillingSummary = async () => {
    try {
        const result = await query(`
            SELECT 
                c.name as client_name,
                c.phone,
                s.name as service_name,
                s.expiration_date,
                CASE 
                    WHEN s.expiration_date IS NULL OR (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE THEN 'MOROSO'
                    WHEN ((s.expiration_date + INTERVAL '5 days') >= CURRENT_DATE AND s.expiration_date < CURRENT_DATE) THEN 'EN GRACIA'
                    WHEN (s.expiration_date >= CURRENT_DATE AND s.expiration_date <= (CURRENT_DATE + INTERVAL '3 days')) THEN 'PROXIMO'
                    ELSE 'AL DIA'
                END as status,
                CASE 
                    WHEN s.expiration_date < CURRENT_DATE THEN CURRENT_DATE - s.expiration_date
                    ELSE 0
                END as days_overdue,
                COALESCE(
                    CASE 
                        WHEN s.renewal_day = 30 THEN
                            (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                            (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                        ELSE
                            COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                    END, 0
                ) as amount_due,
                s.currency
            FROM services s
            JOIN clients c ON s.client_id = c.id
            WHERE s.status = 'ACTIVE' AND c.is_active = true
            ORDER BY s.expiration_date ASC
        `);

        return result.rows;
    } catch (error) {
        console.error('[Agent Service] Error getting billing summary:', error);
        return [];
    }
};

/**
 * Process public website chatbot message using EVA's cognitive engine
 */
export const processWebChatMessage = async (sessionId, messageText) => {
    try {
        console.log(`[Agent Service] Processing web chat for session: ${sessionId}. Message: "${messageText}"`);

        // 1. Fetch chat history for this web session
        const logHistory = await query(
            'SELECT sender, message_content FROM conversations WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 8',
            [sessionId]
        );
        
        const history = logHistory.rows.reverse().map(l => ({
            role: l.sender === 'User' ? 'user' : 'assistant',
            content: l.message_content
        }));

        // 2. Save current User message to Database
        await query(
            'INSERT INTO conversations (session_id, sender, message_content) VALUES ($1, $2, $3)',
            [sessionId, 'User', messageText]
        );

        // 3. Define the Web EVA system instructions
        const systemMessage = `Eres EVA, la asistente virtual de Adriel's Systems. Tu misión: atender visitantes del sitio web con calidez y guiarlos a agendar una cita o contratar un servicio.

TONO Y ESTILO (CRÍTICO):
- Respuestas MUY CORTAS: máximo 2-3 oraciones por mensaje. Directo y cálido.
- Lenguaje simple. Sin tecnicismos. Como si hablaras con alguien que no sabe de tecnología.
- Sin listas largas con bullets. Si mencionas servicios, hazlo en texto corrido, máximo 2-3 ejemplos.
- Emojis sutiles solo cuando aporten calidez (😊 ✨). Máximo 1-2 por mensaje.
- No te presentes en cada mensaje. Conversa de forma natural y continua.
- Habla siempre en español.

SERVICIOS (en palabras simples si preguntan):
- Páginas web y aplicaciones hechas a la medida.
- Bots de WhatsApp y asistentes de IA para negocios.
- Conexión de sistemas y automatizaciones.
- Servidores y soporte tecnológico.

REGLAS DE NEGOCIO:
1. Pagos: PayPal, Zelle, Pago Móvil y Binance. No des números; al agendar, el equipo los contactará.
2. Agendar: Cuando el usuario quiera contratar, hablar con alguien o agendar, responde con entusiasmo en 1-2 oraciones y termina EXACTAMENTE con la palabra clave: [MOSTRAR_CALENDARIO]
3. Después de confirmar la cita: Si dice "listo" o "ya agendé", pídele su correo para enviarle la confirmación.`;

        // 4. Combine history and current message for Gemini call
        const formattedHistory = [
            ...history,
            { role: 'user', content: messageText }
        ];

        // 5. Call LLM
        const replyText = await callLLM(systemMessage, formattedHistory);

        // 6. Detect calendar intent from EVA's response
        const showCalendar = replyText.includes('[MOSTRAR_CALENDARIO]');
        const cleanReply = replyText.replace('[MOSTRAR_CALENDARIO]', '').trim();

        // 7. Save Eva's clean reply to Database
        await query(
            'INSERT INTO conversations (session_id, sender, message_content) VALUES ($1, $2, $3)',
            [sessionId, 'Eva', cleanReply]
        );

        return { response: cleanReply, showCalendar };
    } catch (error) {
        console.error('[Agent Service] Error in web chat processing:', error);
        return { response: '¡Disculpa! Tuve un inconveniente técnico. Intenta de nuevo en un momento. 😊', showCalendar: false };
    }
};

/**
 * Standard HTTP REST call to DeepSeek or Gemini API
 */
const callLLM = async (systemPrompt, messages) => {
    // If Gemini key exists, default to Gemini (flash) for fast & free/low cost
    if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '') {
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            // Format messages for Gemini API
            const contents = [
                {
                    role: 'user',
                    parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }]
                },
                ...messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }))
            ];

            const response = await axios.post(geminiUrl, { contents }, {
                headers: { 'Content-Type': 'application/json' }
            });

            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (error) {
            console.error('[Agent Service] Gemini API error, trying DeepSeek...', error.response?.data || error.message);
        }
    }

    // Fallback to DeepSeek/OpenAI
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.trim() === '') {
        throw new Error('No LLM API Key configured (neither GEMINI_API_KEY nor DEEPSEEK_API_KEY/OPENAI_API_KEY are set).');
    }

    try {
        const url = DEEPSEEK_API_KEY.includes('sk-') ? 'https://api.deepseek.com/chat/completions' : 'https://api.deepseek.com/v1/chat/completions';
        const model = DEEPSEEK_API_KEY.includes('sk-') ? 'deepseek-chat' : 'gpt-4o-mini';

        const payload = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            temperature: 0.7
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data?.choices?.[0]?.message?.content || '';
    } catch (error) {
        console.error('[Agent Service] DeepSeek/OpenAI API error:', error.response?.data || error.message);
        throw new Error('LLM Service Unavailable');
    }
};

/**
 * Call LLM in structured JSON mode
 */
const callLLMJSON = async (prompt) => {
    if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== '') {
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json'
                }
            };
            const response = await axios.post(geminiUrl, payload, {
                headers: { 'Content-Type': 'application/json' }
            });
            return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (err) {
            console.error('[Agent Service] Gemini JSON API error, trying DeepSeek...', err.message);
        }
    }

    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.trim() === '') {
        throw new Error('No LLM JSON API Key configured (neither GEMINI_API_KEY nor DEEPSEEK_API_KEY/OPENAI_API_KEY are set).');
    }

    try {
        const url = DEEPSEEK_API_KEY.includes('sk-') ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        const model = DEEPSEEK_API_KEY.includes('sk-') ? 'deepseek-chat' : 'gpt-4o-mini';

        const payload = {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data?.choices?.[0]?.message?.content || '';
    } catch (error) {
        console.error('[Agent Service] DeepSeek JSON API error:', error.response?.data || error.message);
        throw new Error('LLM JSON Service Unavailable');
    }
};

/**
 * Automatically configure the webhook on Evolution API
 */
export const registerEvolutionWebhook = async () => {
    try {
        const appUrl = process.env.APP_URL || 'https://app.adrielssystems.com';
        const webhookUrl = `${appUrl}/api/webhooks/whatsapp`;
        
        console.log(`[Agent Service] Registering webhook in Evolution API... URL: ${webhookUrl}`);

        if (!EVOLUTION_API_KEY) {
            console.warn('[Agent Service] EVOLUTION_API_KEY is not defined. Webhook auto-registration skipped.');
            return;
        }

        const url = `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`;
        const payload = {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: [
                "MESSAGES_UPSERT"
            ]
        };

        const response = await axios.post(url, payload, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log('[Agent Service] Webhook registration response:', response.data);
    } catch (error) {
        console.error('[Agent Service] Failed to register webhook in Evolution API:', error.response?.data || error.message);
    }
};

/**
 * Fetch Current BCV Exchange Rate
 */
export const getBCVRate = async () => {
    try {
        const res = await axios.get('https://rates.dolarvzla.com/bcv/current.json');
        if (res.data && res.data.current && res.data.current.usd) {
            return parseFloat(res.data.current.usd);
        }
        return null;
    } catch (err) {
        console.error('[Agent Service] Error getting BCV rate:', err.message);
        return null;
    }
};
