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

## Archivos Modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `server/index.js` | MODIFY | CRUD de Usuarios, 12 fixes de seguridad, Helmet, CORS dinámico. |
| `server/middleware/rateLimiter.js` | MODIFY | Pruning de memoria, soporte para proxy, rate limits específicos. |
| `src/pages/admin/UsersManagement.tsx` | NEW | Panel de gestión de usuarios staff. |
| `src/context/AuthContext.tsx` | MODIFY | Soporte para rol `EMPLOYEE`. |
| `src/App.tsx` | MODIFY | Rutas protegidas para staff, redirección de roles. |
| `package.json` | MODIFY | Añadido `helmet`. |

---

