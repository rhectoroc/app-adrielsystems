import cron from 'node-cron';
import axios from 'axios';
import { query } from '../db.js';

/**
 * Automation Service
 * Handles scheduled WhatsApp notifications via Evolution API
 * Replaces n8n workflow "AvisosdeCobroAdrielssystems"
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://adrielssystems_evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'AdrielsSystems';

const TEMPLATES = {
    overdue: (data) => `⚠️ *AVISO DE MORA*
Hola estimado cliente *${data.client_name}*, te saludamos de Adriel's Systems.
Vemos que tu servicio *${data.service_name}* tiene un pago pendiente por:
💰 *${data.amount_due} ${data.currency}*
Tu servicio tiene más de ${data.days_overdue} días de retraso. Por favor regulariza tu situación para evitar cortes del servicio.
¡Muchas gracias!`,

    due_today: (data) => `📅 *¡Hola, ${data.client_name}! ¿Cómo va todo?* 😊

Te escribimos de Adriel's Systems para recordarte con mucho cariño que *hoy* es el día de vencimiento de tu servicio *${data.service_name}*. 

Sabemos que a veces el día a día nos mantiene ocupados, así que te pasamos los detalles para que puedas mantener tu cuenta al día fácilmente:

💰 *Monto a pagar:* ${data.amount_due} ${data.currency}
✨ *Estado:* Vence hoy

Si ya realizaste tu pago hace poquito, ¡muchísimas gracias! No necesitas hacer nada más, pronto se verá reflejado. ✅

Cualquier cosita que necesites o si tienes alguna duda, ¡aquí estamos para apoyarte! ¡Que tengas un resto de día fenomenal! 🚀`,

    upcoming: (data) => `🌟 *¡Hola, ${data.client_name}!* 🌟 

Te saludamos de Adriel's Systems, ¡esperamos que estés teniendo un día excelente! 😊

Te escribimos con mucho cariño para recordarte que el próximo pago de tu servicio *${data.service_name}* vencerá pronto. Queremos asegurarnos de que sigas disfrutando de todos sus beneficios sin interrupciones.

📝 *Detalles de tu cuenta:*
💰 *Monto:* ${data.amount_due} ${data.currency}
📅 *Fecha:* ${data.due_date}

Si ya realizaste tu pago, te agradecemos de corazón e ignorar este mensaje; pronto se verá reflejado en tu panel. ✅

Si tienes alguna duda o necesitas apoyo con tu pago, ¡aquí estamos para lo que necesites! 💬✨

*¡Muchas gracias por confiar en nosotros!*`
};

/**
 * Generic function to send a message via Evolution API
 */
export const sendMessage = async (number, text) => {
    if (!EVOLUTION_API_KEY) {
        throw new Error('EVOLUTION_API_KEY is not defined');
    }

    const cleanPhone = number.replace(/\D/g, '');
    const evolutionUrl = `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`;

    return axios.post(evolutionUrl, {
        number: cleanPhone,
        text: text,
        linkPreview: false
    }, {
        headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
        }
    });
};

/**
 * Main execution function
 */
export const runBillingNotifications = async () => {
    console.log('[Automation] Starting billing notification cycle...');
    
    if (!EVOLUTION_API_KEY) {
        console.error('[Automation] EVOLUTION_API_KEY is not defined. Skipping notifications.');
        return { error: 'API Key missing' };
    }

    try {
        // 1. Fetch pending notifications (Simulating /api/notifications/pending logic)
        const result = await query(`
            SELECT
                c.id as client_id,
                c.name as client_name,
                c.email,
                c.phone,
                s.name as service_name,
                -- Intelligent debt calculation (same as GET /api/clients)
                (
                    CASE 
                        WHEN s.renewal_day = 30 THEN
                            (COALESCE(s.special_price, s.cost) / 30.0 * (s.expiration_date - s.created_at::DATE + 1)) +
                            (COALESCE(s.special_price, s.cost) * FLOOR(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                        ELSE
                            COALESCE(s.special_price, s.cost) * GREATEST(1, (EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date))))
                    END
                ) as amount_due,
                s.currency,
                TO_CHAR(s.expiration_date, 'DD/MM/YYYY') as due_date,
                CASE 
                    WHEN (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE THEN 'overdue'
                    WHEN s.expiration_date = CURRENT_DATE THEN 'due_today'
                    ELSE 'upcoming'
                END as notification_type,
                CASE 
                    WHEN (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE THEN CURRENT_DATE - s.expiration_date
                    ELSE 0
                END as days_overdue
            FROM services s
            JOIN clients c ON s.client_id = c.id
            WHERE s.status = 'ACTIVE'
            AND c.is_active = true
            AND (
                -- Vencidos (Pasaron 5 días de gracia)
                (s.expiration_date + INTERVAL '5 days' < CURRENT_DATE)
                OR
                -- Vence hoy
                (s.expiration_date = CURRENT_DATE)
                OR
                -- Próximos 3 días
                (s.expiration_date > CURRENT_DATE AND s.expiration_date <= CURRENT_DATE + INTERVAL '3 days')
            )
            -- Avoid spamming: Only notify once per type per day if not already notified
            AND NOT EXISTS (
                SELECT 1 FROM notification_logs nl 
                WHERE nl.client_id = c.id 
                AND nl.type = CASE 
                    WHEN (s.expiration_date + INTERVAL '5 days') < CURRENT_DATE THEN 'overdue'
                    WHEN s.expiration_date = CURRENT_DATE THEN 'due_today'
                    ELSE 'upcoming'
                END
                AND DATE(nl.sent_at) = CURRENT_DATE
            )
        `);

        console.log(`[Automation] Found ${result.rows.length} pending notifications.`);

        let sentCount = 0;
        let errorCount = 0;

        for (const record of result.rows) {
            const template = TEMPLATES[record.notification_type];
            if (!template) continue;

            const messageText = template(record);

            if (!record.phone) {
                console.warn(`[Automation] Client ${record.client_name} has no phone number. Skipping.`);
                continue;
            }

            try {
                // Send via Evolution API
                await sendMessage(record.phone, messageText);

                // Log success to DB
                await query(
                    'INSERT INTO notification_logs (client_id, type, channel, status, message_body) VALUES ($1, $2, $3, $4, $5)',
                    [record.client_id, record.notification_type, 'whatsapp', 'SENT', messageText]
                );

                sentCount++;
                console.log(`[Automation] Notification sent to ${record.client_name} (${record.notification_type})`);
            } catch (err) {
                console.error(`[Automation] Error sending to ${record.client_name}:`, err.response?.data || err.message);
                errorCount++;
            }
        }

        return { sent: sentCount, errors: errorCount };

    } catch (error) {
        console.error('[Automation] Critical error in notification cycle:', error);
        return { error: error.message };
    }
};

/**
 * Initialize Cron Job
 */
export const initAutomation = () => {
    // Schedule: Every day at 9:00 AM
    // '0 9 * * *'
    cron.schedule('0 9 * * *', async () => {
        await runBillingNotifications();
    });

    console.log('[Automation] Notification service initialized (Daily at 9:00 AM)');
};
