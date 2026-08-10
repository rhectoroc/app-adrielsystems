# Avance de Desarrollo — 10 de Agosto 2026

## Sesión: Panel de Finanzas Bidireccional, KPI Cambiario y Corrección de Backups

En esta sesión se transformó la sección de Finanzas en un Centro de Control Financiero completo con capacidades CRUD bidireccionales, además de resolver bugs críticos en la infraestructura de la base de datos y la funcionalidad de Backups.

### 💰 Finanzas y Cuentas Bancarias (CRUD Bidireccional)
- **Cuentas Bancarias:** Se rediseñó la UI de `Finances.tsx` para mostrar tarjetas independientes con los saldos de cada cuenta (Zelle, PayPal, Banesco, Banco de Venezuela, Banca Amiga y Efectivo).
- **CRUD Completo:** Implementación de modales interactivos para Añadir, Editar y Eliminar transacciones.
- **Lógica de Transferencias Internas:** Se añadieron 2 nuevos tipos de transacción (`TRANSFERENCIA_ENTRADA` y `TRANSFERENCIA_SALIDA`) para permitir movimientos de saldo entre cuentas sin alterar la contabilidad real de Ingresos y Gastos de la empresa.
- **KPI Cambiario y Total Liquidez:** 
  - Se agregó una 5ta tarjeta en el dashboard que consulta y muestra automáticamente el valor de la **Tasa BCV del día**.
  - Se implementó un "Badge" inteligente (`Total Liquidez`) que suma el capital de todas las cuentas en USD y lo proyecta automáticamente en su equivalente en Bolívares usando la tasa BCV real.

### 🐛 Correcciones de Infraestructura y Base de Datos
- **Ampliación de Límite VARCHAR:** Se diagnosticó un error 500 al intentar registrar la palabra `TRANSFERENCIA_ENTRADA` (21 caracteres) debido a una restricción antigua de la base de datos. Se actualizó la lógica en `initDb` para ampliar la columna `type` a `VARCHAR(50)` y remover el constraint limitante (`financial_ledger_type_check`).
- **Fix de Backup en Producción:** Se corrigió el detector de entornos (`isProd`) en `backup.js` para que utilice de forma exitosa el comando nativo `pg_dump` en Easypanel, independientemente de la variable `NODE_ENV`.
- **Fix de Restauración Local Silenciosa:** Se solucionó un bug en `BackupSection.tsx` donde el navegador enviaba el archivo ZIP con un `Content-Type` manual erróneo, provocando un fallo `Multipart: Boundary not found` en el backend. Se eliminó el encabezado forzado y se añadió validación estricta para evitar falsos positivos de éxito en la interfaz.

### 🛠️ Archivos Modificados (10 de Agosto)

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `src/pages/admin/Finances.tsx` | MODIFY | Rediseño completo a CRUD, tarjetas de cuentas bancarias, KPI BCV y Total Liquidez. |
| `src/components/settings/BackupSection.tsx` | MODIFY | Fix en encabezados de formulario multipart para correcta restauración del archivo ZIP. |
| `server/index.js` | MODIFY | Refactor del endpoint `GET /api/finances` (Cálculo de cuentas e integración BCV). Ampliación de columnas SQL. Implementación de POST, PUT, DELETE para Finanzas. |
| `server/routes/backup.js` | MODIFY | Optimización de detección `isProd` para compatibilidad total con VPS y Docker local. |
| `server/services/agentService.js` | MODIFY | Actualización del prompt de EVA para registrar transacciones y saldos bancarios. |

---

# Avance de Desarrollo — 4 de Agosto 2026

## Sesión: Entorno de Desarrollo, Base de Datos Local y Variables de Entorno

En esta sesión se preparó el entorno local de desarrollo, abarcando la clonación del proyecto, la orquestación de la base de datos de manera local con Docker y la configuración de variables de entorno seguras.

### 📥 Clonación y Setup del Entorno
- **Clonación:** Se clonaron los repositorios `web-adrielssystems` y `app-adrielsystems` en las carpetas `Web_AdrielsSystems` y `App_AdrielsSystems`.

### 🗄️ Base de Datos Local (PostgreSQL)
- **Exportación desde Producción:** Se instruyó el método para exportar el esquema y los datos mediante **DbGate** directamente desde el panel de Easypanel en el VPS (generando un archivo `.sql`).
- **Orquestación con Docker:** Se creó un archivo `docker-compose.yml` en la raíz del backend (`App_AdrielsSystems`) para levantar una instancia local de PostgreSQL 15, permitiendo un desarrollo aislado de producción.
- **Importación Local:** Se documentó cómo conectar DbGate/DBeaver a la base de datos Docker local (`localhost:5432`) para importar el archivo `.sql` de producción.

### 🔐 Gestión de Variables de Entorno
- Se construyó el archivo `.env` configurando las credenciales (base de datos, tokens de Google, Evolution API, DeepSeek y Gemini).
- Se validó explícitamente en el archivo `.gitignore` que el archivo `.env` está excluido del control de versiones, previniendo así la fuga de secretos o credenciales.

---

# Avance de Desarrollo — 7 de Julio 2026

## Sesión: Corrección Crítica del Algoritmo de Cálculo de Deuda y Prorrateo Fantasma

En esta sesión se identificó y solucionó un bug crítico en la lógica contable del sistema que calculaba saldos vencidos incorrectos (exagerados) para clientes con ciclos de facturación de 30 días, debido a una fórmula que acumulaba el prorrateo sumando todos los días transcurridos desde la creación del servicio.

### 🐛 Resolución del "Prorrateo Fantasma" en Base de Datos (SQL)
- **Eliminación del Acumulado Histórico:** Se refactorizaron las consultas SQL en `server/index.js`, `server/services/automationService.js` y `server/services/agentService.js` (específicamente la rama condicional `renewal_day = 30`).
- **Lógica Universal de Meses Vencidos:** Se reemplazó la fórmula prorrateada por una lógica matemática estricta: `(EXTRACT(YEAR FROM AGE(CURRENT_DATE, s.expiration_date)) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.expiration_date)) + 1)`. Ahora el sistema simplemente cuenta cuántos meses exactos han transcurrido desde el vencimiento y los multiplica por el costo mensual.

### 🖥️ Consistencia en el Dashboard (JavaScript)
- **Purgado de Fórmulas Redundantes:** Se descubrió que los endpoints `/api/payments/summary` y `/api/dashboard` replicaban el mismo error a nivel de código JavaScript (líneas ~1060 y ~1150 de `server/index.js`), sobreescribiendo el valor que venía de la base de datos.
- **Asignación Directa:** Se eliminó la evaluación `(monthlyCost / 30.0 * firstPeriodDays)` y se forzó a que el frontend reciba y respete la métrica limpia: `calculatedAmount = monthlyCost * monthsOverdue`.
- Con esto, los clientes (como Daniel Gallo) que debían $200 pasaron de mostrar errores inflados (ej. $613.33) a reflejar de forma exacta su mora real de un solo mes.

---

# Avance de Desarrollo — 19 de Junio 2026

## Sesión: Arquitectura Híbrida Financiera y Evolución de EVA a Rol CFO

En esta sesión se migró el motor contable principal a PostgreSQL manteniendo Google Sheets como panel secundario, y se dotó a la asistente virtual EVA de herramientas matemáticas y de memoria histórica para funcionar como Directora Financiera (CFO) automatizada.

### 💰 Motor de Doble Escritura (Postgres + Sheets)
- **Persistencia Híbrida (`log_multiple_transactions`):** Se reescribió la herramienta para que guarde las entradas y salidas instantáneamente en la nueva tabla `financial_ledger` de Postgres, y de forma asíncrona sincronice la fila en el Google Sheets actual.
- **Consultas a Velocidad de la Luz (`get_current_balance`):** EVA ahora calcula el saldo en milisegundos haciendo un `SELECT SUM` en Postgres en vez de leer celdas, erradicando tiempos de espera y garantizando precisión contable.
- **Cálculos Matemáticos Seguros (`convert_currency`):** Se delegó la matemática de divisas a funciones exactas de JavaScript en lugar del razonamiento del LLM, protegiendo las conversiones de alucinaciones.

### 📈 Histórico y Proyección de Divisas Automatizado
- **Cron Job Inteligente del BCV (`fetchAndSaveBCVRate`):** Se programó una recolección automática de la tasa oficial del dólar en 3 horarios clave: **8:00 AM, 1:00 PM y 7:00 PM**. El horario de las 7:00 PM garantiza capturar la tasa de cierre de los viernes que rige durante el fin de semana.
- **Base de Datos Histórica (`exchange_rates_history`):** Todas las tasas capturadas se almacenan persistentemente para proveer un registro perpetuo.

### 🧠 Inteligencia Analítica Avanzada (Fluctuaciones)
- **Extracción Estricta de Fechas:** Se actualizaron los prompts del agente para forzar a EVA a deducir fechas en formato estricto `YYYY-MM-DD` usando su propio reloj interno, evitando errores de casting en Postgres.
- **Herramientas de Análisis (`get_historical_bcv_rate` y `get_bcv_rate_range`):** Se le otorgó a EVA la capacidad de extraer bloques de historia cambiaria en una sola consulta. Esto desbloqueó su capacidad analítica para calcular promedios de inflación diaria y proyectar porcentajes de pérdida del poder adquisitivo.

---

# Avance de Desarrollo — 15 de Junio 2026

## Sesión: Generalización de Procesamiento Visual, Automatización de Google Sheets y Fixes Críticos

En esta sesión se amplió la capacidad de la asistente virtual EVA para procesar cualquier tipo de comprobante financiero (no solo pagos de clientes) y se resolvieron bugs críticos relacionados con integraciones de APIs de terceros y permisos de Google.

### 📸 Expansión de Procesamiento de Imágenes (Control Financiero)
- **Prompt Generalizado en Gemini:** Se modificó `processAdminImage` para que EVA interprete imágenes no solo como pagos de clientes, sino también como gastos o comprobantes financieros arbitrarios enviados por el Administrador. 
- **Conexión Directa a Herramientas Financieras:** EVA ahora analiza si la imagen representa un ingreso/gasto interno y la canaliza automáticamente hacia la herramienta `log_multiple_transactions` si se detecta como tal.
- **Respaldo Físico de Imágenes:** Se implementó lógica en `agentService.js` para que cada vez que el Administrador envíe una imagen, esta se guarde automáticamente en el disco local (`/data/capref/Financiera/{MesActual}`) antes de ser enviada a la API de Inteligencia Artificial, manteniendo un respaldo estructurado y ordenado.

### 🐛 Resolución de Bugs de Conectividad (APIs Externas)
- **Corrección de Endpoints Evolution API:** Se diagnosticó un error 404 al intentar descargar las imágenes en base64. Se definió como solución definitiva que el Administrador active la opción `webhookBase64: true` en su instancia de Evolution API v2 para que los webhooks incluyan las imágenes empaquetadas, eludiendo rutas deprecadas.
- **Reversión de Modelo Gemini:** Se revirtió un intento fallido de migrar el modelo visual a `gemini-1.5-flash` (modelo deprecado que arrojaba error 404) regresando al modelo moderno y robusto original `gemini-2.5-flash`.
- **Manejo de SyntaxError:** Se solucionó una caída del servidor (`SyntaxError: Identifier 'mimeType' has already been declared`) limpiando declaraciones redundantes que quedaron de refactorizaciones previas.
- **Log de URLs de Error:** Se inyectó código al bloque de `catch` de `axios` en `agentService.js` para que EVA responda en WhatsApp con el `status` exacto y la `url` específica que causó un error HTTP, facilitando el diagnóstico rápido (ej. `503 Service Unavailable`).

### 📊 Automatización Robusta de Cálculos en Google Sheets
- **Fórmulas Matriciales (`ARRAYFORMULA`):** Se modificó la creación de pestañas mensuales (`log_multiple_transactions`) para inyectar Fórmulas Matriciales dinámicas directamente en los títulos de las columnas SALDO (`E1`) y DÓLARES (`G1`). Esto asegura que cuando el usuario escriba transacciones *manualmente*, los saldos continuos (`SUMIF`) y las tasas se calculen mágicamente hacia el infinito sin necesidad de arrastrar fórmulas.
- **Resolución de "Simulation Mode" Fantasma:** Se diagnosticó y reparó un "bug" crítico donde el Administrador principal (`JEFE`) estaba operando silenciosamente en Modo Simulación debido a la ausencia de un `GOOGLE_REFRESH_TOKEN_JEFE`.
- **Fallback Automático de Tokens:** Se modificó `getAuthForProfile` en `googleService.js` para que, si el token de un perfil específico (como el JEFE) no se encuentra, haga un "fallback" automático al token maestro del sistema (`REFRESH_TOKENS['SYSTEM']`). Esto garantiza que los gastos dictados por el Administrador ahora sí se escriban permanentemente en el documento real de Google Sheets.

---

# Avance de Desarrollo — 22 de Mayo 2026

## Sesión: Reglas de Cobranza, Horarios de Notificación y Comprobantes Automatizados

Se implementaron y validaron ajustes críticos en la lógica de facturación, la visualización de resúmenes de deuda en el dashboard, la programación horaria de notificaciones por WhatsApp y el envío automatizado de recibos de pago.

### 📅 Ajustes en Reglas de Negocio y Notificaciones Automáticas
- **Horario Localizado (Venezuela):** Se configuró la zona horaria `"America/Caracas"` en el programador de tareas `node-cron`. Las notificaciones automáticas diarias ahora se disparan exactamente a las **9:00 AM hora de Venezuela** en lugar de a las 5:00 AM (9:00 AM UTC del servidor).
- **Filtro Estricto de Avisos:** Se eliminó el envío de recordatorios de cobro de 3 días antes (`upcoming`). Ahora la automatización de WhatsApp notifica únicamente en dos instancias para evitar spam:
  1. **Día de Vencimiento (`due_today`):** El día exacto en que corresponde pagar.
  2. **Mora Crítica (`overdue`):** Cuando transcurren los 5 días de gracia y se requiere suspender/regularizar.

### 💳 Confirmación Automática de Recibos de Pago (WhatsApp)
- **Registros Manuales (`POST /api/payments`):** Cuando el administrador ingresa un pago en la interfaz con estado `'PAGADO'`, el backend consulta los datos del cliente y le envía un mensaje de confirmación profesional y amable detallando el monto, moneda, método, fecha y concepto del pago recibido.
- **Actualización de Pagos (`PUT /api/payments/:id`):** Al cambiar el estado de un pago de `'PENDIENTE'` a `'PAGADO'`, se envía la misma confirmación automática. Se implementó una verificación para evitar duplicados si solo se editan notas u otros datos de un pago que ya estaba marcado como cobrado.
- **Log de Registro:** Todos estos envíos manuales de confirmación de pago se registran de forma automática en la tabla `notification_logs` con el tipo `'receipt'`.

### 📊 Optimización de Dashboard e Interfaz de Cobranza
- **Suma Acumulada de Deudas:** 
  - El widget **Mora Crítica** ahora muestra en su cabecera un badge con el total acumulado de las deudas en mora (ej. `USD X,XXX.XX ACUM.`).
  - El widget **Próximos Cobros** se alineó estéticamente agregando un borde inferior y un badge con la suma acumulada de cobros programados para los siguientes días (ej. `USD XX.XX ACUM.`).
- **Formateo Monetario:** Los montos globales del resumen de cobros de las tres tarjetas del dashboard principal se formatearon a dos decimales con separadores de miles de manera uniforme.
- **Corrección de Métrica de Pendientes:** El contador `stats.pendingPayments` del panel principal ahora calcula correctamente los servicios activos vencidos sin pagar, en lugar de mostrar siempre `0`.

### 🛠️ Archivos Modificados (22 de Mayo)

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `server/index.js` | MODIFY | Integración de notificaciones de recibos por WhatsApp en `POST /api/payments` y `PUT /api/payments/:id`, y verificación de estado previo. |
| `server/services/automationService.js` | MODIFY | Configuración de zona horaria `"America/Caracas"`, exclusión de avisos preventivos (`upcoming`) del flujo cron. |
| `src/components/features/admin/UpcomingPaymentsWidget.tsx` | MODIFY | Suma acumulada de cobros próximos y rediseño de cabecera para alineación con mora. |
| `src/components/features/admin/OverdueClientsWidget.tsx` | MODIFY | Añadido el badge con la suma acumulada de las deudas en mora en la cabecera. |
| `src/components/features/admin/PaymentSummaryWidget.tsx` | MODIFY | Formateo uniforme de montos a dos decimales y separadores de miles en las tarjetas de resumen. |
| `src/pages/admin/AdminDashboard.tsx` | MODIFY | Formateo del monto de la actividad del cliente a dos decimales. |
| `src/pages/admin/PaymentsManagement.tsx` | MODIFY | Corrección en el modal de registrar pago que impedía seleccionar el servicio (control de `clearService`). |

---

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

### 💬 Notificaciones Directas y Personalizadas por WhatsApp (`send_whatsapp`)
- **Envío Autónomo:** Se creó e implementó la herramienta `send_whatsapp(phone, message)` que dota a EVA de la habilidad de enviar mensajes de WhatsApp directamente a clientes o cualquier número bajo instrucción directa (ej: *"Envíale un mensaje de recordatorio a Julio Borges..."*).
- **Asociación en Historial (`notification_logs`):** La herramienta realiza búsquedas flexibles en la tabla `clients` mediante coincidencia del sufijo del teléfono. Si el número pertenece a un cliente registrado, asocia la notificación al `client_id` correspondiente con tipo `'manual'`, canal `'whatsapp'`, estado `'SENT'` y el cuerpo exacto del mensaje.

### 🛡️ Hardening de Bucle de Razonamiento del Agente
- **Evitación de Doble Envío:** Se detectó y corrigió un comportamiento en el cual Gemini, al tener ciclos de razonamiento sobrantes tras completar un envío exitoso, intentaba repetir la llamada a la herramienta `send_whatsapp` con variaciones menores en un mismo turno, resultando en mensajes duplicados.
- **Reglas de Flujo Estrictas:** Se inyectó una nueva sección de control en el prompt del sistema de EVA (**"4. REGLAS DE CONTROL DE FLUJO Y EVITACIÓN DE BUCLES"**), forzando al modelo a responder directamente al usuario con la acción `'reply'` tan pronto como reciba una confirmación exitosa del sistema, garantizando la ejecución única y segura de las acciones de mensajería.

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
| `app-adrielssystems: server/services/agentService.js` | MODIFY | Implementación de `getBillingSummary`, `searchClientByName`, `registerClientPayment`, `processAdminImage`, `processWebChatMessage`, humanización del prompt, herramienta `send_whatsapp` y hardening de bucle contra dobles envíos. |
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

## Sesión: Configuración General y Sistema de Backups

### Frontend
- **Configuración (`Settings.tsx`):** Creación de un panel principal de configuración escalable usando diseño horizontal de pestañas (Tabs).
- **Módulo de Backups (`BackupSection.tsx`):** Interfaz para exportar e importar la base de datos completa. Incluye advertencias visuales de seguridad para evitar pérdida de datos accidental.
- **Diseño UI:** Implementación estricta de la guía de estilo (Glassmorphism, Dark Theme, botones neón) con animaciones suaves usando Framer Motion.

### Backend & Infraestructura
- **Endpoint de Exportación (`GET /api/backup/download`):** Ejecuta `pg_dump` (vía comandos nativos o Docker), comprime el `.sql` en formato `.zip` al vuelo utilizando `adm-zip` y lo envía al usuario.
- **Endpoint de Restauración (`POST /api/backup/restore`):** Recibe un archivo `.zip`, lo descomprime, purga la base de datos actual (CASCADE) e inyecta la data del backup.
- **Compatibilidad Local/Producción:** Lógica inteligente en Node.js que detecta si el usuario corre el sistema en Windows localmente (usando Docker exec) o en producción.
- **Dockerfile Mejorado:** Se añadió la instalación de `postgresql-client` al Stage 2 para permitir respaldos nativos en el VPS (Easypanel).

---
