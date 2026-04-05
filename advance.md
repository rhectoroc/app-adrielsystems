# Avance de Desarrollo — 4 de Abril 2026

## Sesión: Facturación Fija + Automatización de Mensajes + Integración EVA

---

## 1. Modelo de Facturación Fijo (Ciclo del Día 30)

### Cambios en `server/index.js`

- **POST /api/clients:** Todos los nuevos clientes se configuran con `renewal_day = 30` y `billing_day_fixed = 30`. La fecha de vencimiento se calcula al día 30 del mes actual.
- **Excepción de fin de mes (día 28+):** Si un cliente se registra a partir del día 28, el primer vencimiento se traslada al día 30 del mes siguiente, sumando los días restantes del mes actual a la primera factura.
- **Prorrateo automático:** Las consultas SQL en `GET /api/clients` y `GET /api/stats` calculan la deuda proporcional para el primer mes de servicio.
- **Periodo de gracia reducido:** Se cambió globalmente de 7 a **5 días** en todos los endpoints que determinan el estado de pago (`OVERDUE`, `UPCOMING`, `PAID`).
- **Alcance:** Solo aplica a clientes creados a partir de esta fecha. Clientes existentes mantienen su lógica previa.

---

## 2. Dashboard de Contactos + Sistema de Mensajería

### Frontend

- **Nueva sección:** `ContactsManagement.tsx` — Dashboard especializado para comunicación con clientes.
- **MessageModal.tsx:** Modal para enviar mensajes personalizados con plantillas (Recordatorio de Cobro, Oferta Promocional, Prueba de Sistema).
- **Envío directo por API:** Se eliminó la redirección a WhatsApp Web. Los mensajes ahora se envían directamente a través de la API de Evolution desde el backend.
- **Botón de prueba mejorado:** Permite seleccionar contactos específicos antes de enviar mensajes de prueba.

### Backend

- **POST /api/messages/send:** Nuevo endpoint que envía mensajes a WhatsApp vía Evolution API internamente.
- **Función `sendMessage()`:** Extraída como utilidad reutilizable en `automationService.js`.

### Fix de Build (TypeScript)
- Corregidos errores de compilación en `MessageModal.tsx` y `ContactsManagement.tsx`:
  - Template literals con `${{monto}}` provocaban errores TS18004
  - Importaciones no utilizadas (`Send`, `Filter`, `ExternalLink`, etc.)

---

## 3. Automatización de Cobro Nativa (Reemplaza n8n)

### Nuevo archivo: `server/services/automationService.js`

- **Cron Job:** Se ejecuta todos los días a las 9:00 AM (`node-cron`).
- **Lógica de selección:** Identifica clientes con pagos vencidos (>5 días), que vencen hoy, o próximos a vencer (3 días).
- **3 plantillas de mensaje:** Copia exacta de los textos del workflow de n8n (Morosos, Vence Hoy, Por Vencer).
- **Prevención de spam:** Solo envía un tipo de mensaje por día por cliente.
- **Envío vía Evolution API:** Comunicación interna entre contenedores Docker (`http://adrielssystems_evolution-api:8080`).
- **Registro automático:** Cada envío se registra en `notification_logs`.

### Nuevos endpoints en `server/index.js`
- **POST /api/admin/automation/trigger:** Trigger manual para ejecutar el ciclo de notificaciones (protegido para ADMIN).

### Dependencias añadidas
- `node-cron` ^3.0.3
- `axios` ^1.6.7

---

## 4. API de Contexto para EVA (Agente Virtual)

### Nuevo endpoint: `GET /api/bot/client-context`

- **Autenticación:** Header `x-api-key` con `EVOLUTION_API_KEY` (sin JWT, para comunicación bot-a-bot).
- **Parámetro:** `?phone=584140108030`
- **Matching flexible:** Busca por los últimos 10 dígitos del teléfono, ignorando `+`, `-` y espacios.
- **Respuesta para clientes registrados:**
  - Servicios activos con deuda calculada en tiempo real
  - Estado de pago (AL DIA, PROXIMO A VENCER, EN GRACIA, VENCIDO)
  - Último pago registrado
  - Métodos de pago aceptados: PayPal, Zelle, Pago Móvil, Binance
  - Instrucción de pago: Contactar al equipo (nunca dar datos bancarios)
- **Respuesta para no clientes:** `cliente_existe: false` con instrucción para EVA.

### System Prompt de EVA actualizado
- Respuestas cortas (máximo 3-4 líneas)
- Menú para clientes: 1️⃣ Info contrato, 2️⃣ Soporte, 3️⃣ Otra consulta
- Menú para no clientes: 1️⃣ Servicios, 2️⃣ Planes, 3️⃣ Agendar llamada
- Detección de cliente transparente (nunca revela si es o no es cliente)
- Info de cuenta solo cuando el cliente la solicita (opción 1)

---

## Variables de Entorno Requeridas (Easypanel)

| Variable | Descripción |
|----------|-------------|
| `EVOLUTION_API_URL` | `http://adrielssystems_evolution-api:8080` |
| `EVOLUTION_API_KEY` | API Key de la instancia de Evolution |
| `EVOLUTION_INSTANCE_NAME` | `AdrielsSystems` |

---

## Archivos Modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `server/index.js` | MODIFY | Facturación fija, endpoints de mensajería, API de contexto para bot |
| `server/services/automationService.js` | NEW | Servicio de automatización de cobro |
| `src/pages/admin/ContactsManagement.tsx` | MODIFY | Fix imports, selección de contactos para prueba |
| `src/components/features/admin/MessageModal.tsx` | MODIFY | Fix TS errors, envío directo vía API |
| `package.json` | MODIFY | Añadir node-cron, axios |

---
