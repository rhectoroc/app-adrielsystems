# Avance de Desarrollo — 18 de Mayo 2026

## Sesión: Superpoderes de EVA (Visión Computacional, Resumen de Cobranza Global y Notificaciones Multicanal)

---

## 7. Herramientas y Visión Computacional Avanzada para EVA

Se dotó a la asistente virtual **EVA** de herramientas analíticas y de visión avanzadas para automatizar por completo las operaciones del día a día del Administrador directamente desde WhatsApp.

### 📸 Visión Computacional y Auto-Procesamiento de Capturas (El Jefe)
- **Captura de Leyenda de Imágenes:** Se modificó el webhook de Evolution API en `server/services/agentService.js` para extraer las leyendas (*caption*) de los mensajes tipo `imageMessage`. Esto permite leer instrucciones del Jefe junto a la foto (ej: *"registra este pago de Daniel Gallo"*).
- **Procesamiento de Vision API (`processAdminImage`):** Cuando el Jefe envía un capture de pago, EVA lo procesa a través de la API de Visión de Gemini 2.5 Flash, extrayendo dinámicamente Monto, Moneda, Referencia, Tipo de pago y Nota, inyectando estos datos directamente en el razonamiento de EVA.
- **Búsqueda Dinámica de Clientes (`search_client_by_name`):** EVA busca clientes de forma inteligente comparando nombres (mediante SQL `ILIKE`) sin requerir un número de teléfono específico.
- **Registro y Renovación Automática (`register_client_payment`):** Inserta la transacción en `payments`, actualiza `services` extendiendo la fecha de vencimiento `+ 1 mes` y pone al día al cliente de manera automática.
- **Notificación y Comprobante Digital HTML (Multicanal):** 
  - Envía un WhatsApp automático y cálido al cliente notificándole la aprobación de su pago.
  - Genera y envía un correo electrónico en formato HTML de alta definición (comprobante digital premium) utilizando la API de Gmail conectada a la cuenta de Google del Jefe.

### 📊 Resumen Global de Cobranza (`get_billing_summary`)
- **Reporte en Tiempo Real:** Nueva herramienta que permite a EVA consultar a todos los clientes activos del sistema, calcular sus deudas de forma matemática e inteligente, categorizarlos según su estado de pago (Morosos, En Gracia, Próximos a Vencer, Al Día) y devolverle al Jefe un resumen ejecutivo por WhatsApp que detalla la cartera de clientes y la deuda consolidada.

### 🌐 Migración del Chatbot de la Web Pública a EVA Nativo
- **Eliminación de Dependencia de N8N:** Se retiró a N8N del flujo conversacional de la página web principal, centralizando todo el procesamiento en el backend de la app.
- **Función de Chat Web Nativo (`processWebChatMessage`):** EVA procesa las consultas de visitantes web utilizando Gemini 2.5 Flash de forma directa, persistiendo el historial de chat de la sesión en la base de datos de PostgreSQL (tabla `conversations`).
- **Endpoint Express (`POST /api/chat`):** Registro de la nueva ruta pública en el backend principal para procesar peticiones web de forma segura.
- **Redirección de Proxy Next.js:** Modificación de `src/app/api/chat/route.ts` en la web pública para actuar como proxy e interactuar con el backend nativo de EVA, eliminando latencias y problemas de CORS.

---

## 8. Robustez de Infraestructura y Conectividad

- **Hardening contra caídas por API Keys:** Modificación en `callLLM` y `callLLMJSON` en `server/services/agentService.js` para validar la existencia física de `GEMINI_API_KEY` y `DEEPSEEK_API_KEY`. Si no están declaradas, el servidor ya no experimenta caídas catastróficas, manejando el error con logs preventivos muy claros.
- **Auto-Registro de Webhooks:** Implementación de `registerEvolutionWebhook` ejecutado asíncronamente en el arranque del servidor (`app.listen` en `server/index.js`), lo cual auto-registra la URL del webhook en Evolution API cada vez que se despliega una nueva versión en Easypanel, eliminando la necesidad de configuraciones manuales.
- **Humanización de Personalidad (Warm Style):** Refactorización del prompt principal (`systemMessage`) para brindarle a EVA una personalidad extremadamente cálida, atenta, profesional y servicial con el uso sutil de emojis, dirigiéndose cordialmente al staff como *"Jefe"* o *"Jefa"*.
- **Reporte de Cobranza Diario Automatizado:** Integración en `automationService.js` para compilar un reporte diario a las 9:00 AM con las notificaciones de morosidad enviadas, fallidas y omitidas, enviándolo directamente al celular del Jefe por WhatsApp.

---

## Archivos Modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `app-adrielssystems: server/services/agentService.js` | MODIFY | Implementación de `getBillingSummary`, `searchClientByName`, `registerClientPayment`, `processAdminImage`, `processWebChatMessage` y humanización del prompt. |
| `app-adrielssystems: server/services/automationService.js` | MODIFY | Integración del reporte ejecutivo diario consolidado de cobros para el Jefe. |
| `app-adrielssystems: server/index.js` | MODIFY | Importación e inicialización del auto-registro de webhooks y el endpoint de chat `/api/chat`. |
| `web-adrielssystems: src/app/api/chat/route.ts` | MODIFY | Redirección de proxy API del webhook de N8N al motor nativo de EVA del backend. |

---

## 💡 Propuestas y Futuro Roadmap: Control de Infraestructura y Contenedores vía EVA

Se realizó el análisis de factibilidad técnica y el diseño de la arquitectura para dotar a EVA del poder de apagar o encender de forma segura contenedores Docker distribuidos en tus 3 VPS en Easypanel:

### 🎯 Objetivo
Permitir al Administrador (El Jefe) suspender y reactivar de inmediato la infraestructura web de clientes morosos mediante comandos naturales en WhatsApp (ej. *"Eva, apaga la web de Daniel Gallo"*).

### 🛠️ Estrategia Técnica Diseñada
- **Conexión Robusta SSH (Recomendada):** Conexión segura desde el backend principal hacia cada uno de los 3 VPS usando la librería `ssh2` en Node.js mediante autenticación por clave SSH privada.
  - **Suspensión:** EVA ejecuta `docker service scale [nombre_servicio]=0` o `docker stop [nombre_contenedor]`.
  - **Reactivación:** EVA ejecuta `docker service scale [nombre_servicio]=1` o `docker start [nombre_contenedor]`.
- **Pantalla de Suspensión Directa:** Configuración a nivel de proxy Nginx en el VPS para redirigir el tráfico del contenedor apagado hacia un banner premium corporativo que indique: *"Servicio suspendido temporalmente por razones administrativas. Contacte a soporte@adrielssystems.com"*.

### 🛡️ Protocolo de Hardening de Seguridad Propuesto
1. **Restricción de Remitente Extrema:** Comandos validados únicamente contra los teléfonos registrados de `EL_JEFE` (Héctor) y `LA_JEFA` (Oxarellys).
2. **Doble Confirmación Conversacional:** EVA nunca suspenderá un servicio inmediatamente; requerirá un mensaje de confirmación idéntico (ej: *"Confirmar apagado de [nombre]"*) o el ingreso de un PIN dinámico temporal enviado al Jefe.
3. **Auditoría Permanente:** Cada evento de control de infraestructura se guardará en la tabla `audit_logs` con la fecha, hora y el administrador responsable.

---

# Avance de Desarrollo — 5 de Abril 2026

## Sesión: Gestión de Usuarios + Auditoría y Hardening de Seguridad

---

## 5. Sistema de Gestión de Usuarios (CRUD)

### Backend
- **Nuevos Endpoints en `server/index.js`:**
  - `GET /api/users`: Lista completa con datos de cliente asociados.
  - `POST /api/users`: Creación con hashing de contraseña (bcrypt).
  - `PUT /api/users/:id`: Actualización de perfil y/o contraseña.
  - `DELETE /api/users/:id`: Eliminación con protección contra auto-borrado.
- **Auto-Migración:** El servidor ahora detecta y añade automáticamente las columnas `phone` y `receive_notifications`, y actualiza el constraint de roles para incluir `EMPLOYEE`.

### Frontend
- **Nueva sección:** `UsersManagement.tsx` — Panel de administración de personal.
- **Acceso Multinivel:** Se implementó el rol `EMPLOYEE`, permitiendo a empleados acceder al panel administrativo mientras que la gestión de usuarios queda reservada para `ADMIN`.
- **Notificaciones:** Toggle integrado para que usuarios de staff elijan recibir alertas de pagos vía WhatsApp.

---

## 6. Auditoría y Hardening de Seguridad (Fase 1, 2 y 3)

Se realizó una auditoría completa de los 35+ endpoints del backend, aplicando 12 correcciones críticas y preventivas.

### Mejoras de Infraestructura y Middleware
- **Helmet.js:** Integración de cabeceras de seguridad HTTP para prevenir XSS y ataques de inyección.
- **CORS Estricto:** Restricción de acceso solo a dominios permitidos (`APP_URL` y localhost).
- **Trust Proxy:** Configuración corregida para detectar IPs reales detrás de Easypanel/Nginx.
- **Rate Limiting Robusto:** 
  - Protección contra DoS en `/api/health` y API de bot.
  - Prevención de fugas de memoria (Memory Leaks) limitando las entradas de IP en memoria a 10,000 registros.

### Hardening de API
- **SQL Injection Fix:** Parametrización de consultas en filtros temporales de pagos.
- **Validación de Archivos:** El sistema ahora solo permite subir imágenes (JPEG, PNG, WebP) como evidencia de pago, bloqueando archivos ejecutables.
- **Protección de Mensajería:** Cooldown de 5 minutos en el trigger de automatización y validación estricta de formato de teléfonos para evitar spam o bloqueos de WhatsApp.
- **Privacidad de Datos:** Los endpoints de notificaciones y logs ahora requieren rol `ADMIN`, evitando que clientes vean deudas de otros usuarios.
- **Sanitización de Errores:** Se eliminó la exposición de trazas de error internas hacia el cliente.

---

## Variables de Entorno Requeridas (Easypanel) — Actualizado

| Variable | Descripción |
|----------|-------------|
| `APP_URL` | URL base de la app (ej: `https://app.adrielssystems.com`) para validación CORS. |
| `EVOLUTION_API_URL` | `http://adrielssystems_evolution-api:8080` |
| `EVOLUTION_API_KEY` | API Key de la instancia de Evolution |
| `EVOLUTION_INSTANCE_NAME` | `AdrielsSystems` |

---

## Archivos Modificados (Histórico 5 de Abril)

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `server/index.js` | MODIFY | CRUD de Usuarios, 12 fixes de seguridad, Helmet, CORS dinámico. |
| `server/middleware/rateLimiter.js` | MODIFY | Pruning de memoria, soporte para proxy, rate limits específicos. |
| `src/pages/admin/UsersManagement.tsx` | NEW | Panel de gestión de usuarios staff. |
| `src/context/AuthContext.tsx` | MODIFY | Soporte para rol `EMPLOYEE`. |
| `src/App.tsx` | MODIFY | Rutas protegidas para staff, redirección de roles. |
| `package.json` | MODIFY | Añadido `helmet`. |

---
