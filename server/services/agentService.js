import axios from 'axios';
import { query } from '../db.js';
import { sendMessage } from './automationService.js';
import * as googleService from './googleService.js';

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
        }

        console.log(`[Agent Service] Message from ${remoteJidAlt} (${pushName}): [${messageType}] "${messageText}"`);

        // Check if Admin
        const isAdmin = Object.values(ADMINS).includes(remoteJidAlt);

        // 2. Handle Admin immediately (no debouncing needed)
        if (isAdmin) {
            const roleName = remoteJidAlt === ADMINS.LA_JEFA ? 'LA_JEFA' : 'EL_JEFE';
            await processAdminMessage(roleName, remoteJid, messageText, pushName);
            return res.status(200).json({ status: 'processed', type: 'admin' });
        }

        // 3. Handle Regular Client (Image check or Debounced Text)
        if (messageType === 'imageMessage') {
            // Retrieve media base64 from Evolution API and check receipt
            const messageId = key.id;
            await processClientImage(remoteJid, messageId, pushName);
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
const processClientImage = async (remoteJid, messageId, pushName) => {
    try {
        console.log(`[Agent Service] Fetching media base64 for message: ${messageId}`);
        
        // 1. Fetch base64 media from Evolution API
        const evolutionUrl = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}/${messageId}`;
        const response = await axios.get(evolutionUrl, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });

        const base64Data = response.data?.base64 || response.data?.data?.base64;
        if (!base64Data) {
            throw new Error('Could not retrieve base64 data for the image message');
        }

        const mimeType = response.data?.mimeType || 'image/jpeg';

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
        await sendMessage(remoteJid, 'Lo siento, no pude procesar la imagen enviada. Por favor envíala de nuevo o comunícate con soporte.');
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
Actúas como EVA, la asistente virtual de Inteligencia Actorial ejecutiva personal de ${roleName === 'LA_JEFA' ? 'la Jefa (Oxarellys Urbaneja)' : 'el Jefe (Hector Ollarves)'}.
Tu único objetivo es maximizar su productividad operando con la máxima eficiencia y discreción.

HORA ACTUAL: ${nowCaracas}

1. TONO Y PERSONALIDAD
- Jerarquía: Te diriges al usuario como "${roleName === 'LA_JEFA' ? 'Jefa' : 'Jefe'}".
- Tono: Profesional, ejecutivo, sumamente discreto y conciso (usa listas con viñetas). No uses emojis.
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
  "text": "Tu respuesta ejecutiva final estructurada en viñetas..."
}

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

        const lastPayment = paymentRes.rows[0] ? {
            monto: lastPayment.amount,
            fecha: lastPayment.payment_date,
            metodo: lastPayment.payment_method
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
