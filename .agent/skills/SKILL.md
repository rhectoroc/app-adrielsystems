---
description: Estructura, estándares y arquitectura del proyecto app-adrielssystems
---

# Skill: Adriel's Systems App — Estructura del Desarrollo

## Información General

- **Proyecto:** Adriel's Systems — Panel Administrativo y Portal de Clientes
- **Stack:** Vite + React + TypeScript + TailwindCSS (Frontend) | Node.js + Express (Backend) | PostgreSQL (DB)
- **Infraestructura:** Easypanel (Docker Containers) en VPS Cloud
- **Puerto:** 3000
- **Autenticación:** JWT + bcrypt | Roles: ADMIN, CLIENT

---

## Estructura de Archivos

```
app-adrielssystems/
├── database/
│   ├── schema.sql                          # Esquema base (clients, users, services, payments)
│   └── SCHEMA.md                           # Documentación del esquema
├── server/
│   ├── index.js                            # Servidor Express principal (~1300 líneas, TODOS los endpoints)
│   ├── db.js                               # Pool de conexión PostgreSQL
│   ├── init-db.js                          # Inicialización de tablas (notification_logs, etc.)
│   ├── middleware/
│   │   ├── auth.js                         # authenticateToken, authorizeRole
│   │   └── rateLimiter.js                  # Rate limiting por IP
│   ├── services/
│   │   └── automationService.js            # Cron job de notificaciones WhatsApp (node-cron + Evolution API)
│   └── utils/
│       └── paymentHelpers.js               # Lógica de estados de pago
├── src/
│   ├── App.tsx                             # Router principal
│   ├── components/
│   │   ├── features/admin/
│   │   │   ├── ClientsTable.tsx            # Tabla de clientes con estados de pago
│   │   │   ├── MessageModal.tsx            # Modal de envío de mensajes WhatsApp
│   │   │   ├── OverdueClientsWidget.tsx    # Widget de clientes morosos
│   │   │   ├── PaymentSummaryWidget.tsx    # Resumen financiero (3 cards)
│   │   │   ├── SentMessagesWidget.tsx      # Historial de mensajes enviados
│   │   │   └── UpcomingPaymentsWidget.tsx  # Pagos próximos a vencer
│   │   ├── layouts/
│   │   │   ├── AdminLayout.tsx             # Layout con sidebar para admin
│   │   │   ├── ClientLayout.tsx            # Layout para portal de clientes
│   │   │   └── AuthLayout.tsx              # Layout de autenticación
│   │   └── ui/
│   │       ├── ConfirmDialog.tsx           # Diálogo de confirmación reutilizable
│   │       ├── ProtectedRoute.tsx          # HOC de rutas protegidas por rol
│   │       └── sonner.tsx                  # Configuración de toasts
│   ├── context/
│   │   └── AuthContext.tsx                 # Proveedor de autenticación (JWT, rol, logout)
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx          # Dashboard principal
│   │   │   ├── ClientsManagement.tsx       # CRUD de clientes + servicios
│   │   │   ├── ContactsManagement.tsx      # Dashboard de mensajería (WhatsApp)
│   │   │   ├── PaymentsManagement.tsx      # Gestión de pagos
│   │   │   ├── PaymentsOverview.tsx        # Vista general financiera
│   │   │   └── PlansManagement.tsx         # CRUD de planes
│   │   ├── auth/
│   │   │   └── Login.tsx                   # Página de login
│   │   └── client/
│   │       └── ClientDashboard.tsx         # Portal del cliente
│   └── utils/
│       ├── api.ts                          # Helper HTTP con JWT automático
│       ├── dateUtils.ts                    # Funciones de fecha (getTimeAgo, formatDate)
│       └── paymentStatus.ts               # Lógica de estados de pago (frontend)
├── package.json
├── Dockerfile                              # Multi-stage build (builder + production)
├── project_log.md                          # Log histórico del desarrollo
├── advance.md                              # Avance de la sesión actual
└── vite.config.ts
```

---

## Base de Datos (PostgreSQL)

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `clients` | Información de clientes (name, email, phone, domain, is_active) |
| `users` | Usuarios de la app (email, password_hash, role: ADMIN/CLIENT, client_id FK) |
| `services` | Servicios contratados (client_id FK, name, cost, special_price, currency, renewal_day, expiration_date, status) |
| `payments` | Historial de pagos (client_id FK, service_id FK, amount, payment_method, status, due_date) |
| `notification_logs` | Registro de mensajes enviados (client_id FK, type, channel, status, message_body, sent_at) |

### Relaciones
- `users.client_id` → `clients.id`
- `services.client_id` → `clients.id`
- `payments.client_id` → `clients.id`
- `payments.service_id` → `services.id`
- `notification_logs.client_id` → `clients.id`

### Nota Importante sobre Migraciones
> **NO** ejecutar scripts de migración desde el agente. La base de datos está en un VPS y las migraciones se administran manualmente vía **DbGate**. Siempre generar archivos `.sql` para que el usuario ejecute.

---

## API Endpoints Principales

### Autenticación
- `POST /api/auth/login` — Login con JWT

### Dashboard
- `GET /api/stats` — Métricas financieras (ingresos, deuda, clientes activos)
- `GET /api/activity` — Actividad reciente del sistema

### Clientes
- `GET /api/clients` — Lista con servicios, deuda y estado (protegido ADMIN)
- `POST /api/clients` — Crear cliente + servicio (ciclo fijo día 30)
- `PUT /api/clients/:id` — Actualizar cliente
- `DELETE /api/clients/:id` — Eliminar cliente

### Pagos
- `GET /api/payments/overdue` — Clientes morosos con deuda calculada
- `GET /api/payments/upcoming` — Pagos próximos a vencer
- `POST /api/payments` — Registrar pago

### Mensajería (WhatsApp)
- `POST /api/messages/send` — Enviar mensaje vía Evolution API (protegido ADMIN)
- `GET /api/contacts/status` — Lista de contactos con estado de pago
- `POST /api/notifications/log` — Registrar notificación enviada

### Bot / Automatización
- `GET /api/bot/client-context?phone=XXX` — Contexto de facturación para EVA (auth por x-api-key)
- `POST /api/admin/automation/trigger` — Ejecutar ciclo de notificaciones manualmente

---

## Modelo de Negocio y Facturación

### Reglas de Facturación
- **Ciclo fijo:** Todos los nuevos clientes vencen el día **30 de cada mes**
- **Prorrateo:** Si un cliente entra a mitad de mes, paga proporcional hasta el día 30
- **Excepción fin de mes:** Si se registra del día 28 en adelante, el primer vencimiento es el 30 del **mes siguiente**
- **Periodo de gracia:** 5 días después del vencimiento antes de marcar como VENCIDO
- **Modelo:** Mes consumido, mes pagado

### Estados de Pago
- `AL DIA` / `PAID` — Vencimiento futuro o dentro del periodo válido
- `PROXIMO A VENCER` / `UPCOMING` — Vence en los próximos 3 días o dentro del periodo de gracia
- `VENCIDO` / `OVERDUE` — Pasaron más de 5 días desde el vencimiento

---

## Integraciones Externas

### Evolution API (WhatsApp)
- **URL interna:** `http://adrielssystems_evolution-api:8080`
- **Instancia:** `AdrielsSystems`
- **Uso:** Envío de mensajes automáticos y manuales
- **Variables de entorno:** `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`

### n8n (Agentes de IA)
- **EVA (clientes):** Agente virtual que responde preguntas de clientes vía WhatsApp
- **EVA (jefes):** Asistente personal para gestión de calendario, email y tareas
- **Conexión:** n8n llama a `/api/bot/client-context` para obtener datos de facturación en tiempo real

---

## Estándares de Desarrollo

### Frontend
- **Idioma de UI:** Español
- **Idioma de código:** Inglés (variables, funciones, comentarios)
- **Diseño:** Dark mode, glassmorphism, micro-animaciones
- **Tipografía:** Font-black, uppercase, tracking-widest para encabezados
- **Colores:** Sistema de CSS variables con `--primary`, `--primary-rgb`
- **Componentes:** TailwindCSS con clases utilitarias

### Backend
- **Archivo único:** Todos los endpoints están en `server/index.js` (~1300 líneas)
- **Queries SQL:** Inline dentro de los handlers de Express (no ORM)
- **Autenticación:** JWT con middleware `authenticateToken` + `authorizeRole`

### Build & Deploy
- **Build:** `tsc && vite build` (TypeScript strict mode)
- **Deploy:** Dockerfile multi-stage → Easypanel (auto-deploy desde GitHub)
- **Variables de entorno:** Configuradas en Easypanel (DATABASE_URL, PORT, AUTH_SECRET, EVOLUTION_API_KEY)
