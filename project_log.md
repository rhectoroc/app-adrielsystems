# Registro de Desarrollo - Adriel's Systems App

Este archivo sirve como memoria persistente para registrar los cambios, avances y decisiones técnicas del proyecto.

## Información del Proyecto
- **Directorio Raíz**: `app-adrielssystems`
- **Tecnologías**: React (Vite), Node.js (Express), PostgreSQL via `pg`.
- **Despliegue**: Docker (Easypanel).

## Historial de Cambios

### [Fecha Actual] - Inicio del Proyecto & Infraestructura
- **Estructura**: Se definió la estructura base con React + Vite.
- **Base de Datos**:
  - Se creó el esquema `schema.sql` con tablas: `users`, `clients`, `services`, `payments`.
  - Se ajustó `clients` para usar ID autoincremental (`SERIAL`) para consistencia.
- **Backend**:
  - Se decidió implementar un servidor Node.js/Express (`server/`) para gestionar la conexión a PostgreSQL de forma segura.
  - La conexión usará `DATABASE_URL` y variables de entorno del contenedor.
- **Docker**:
  - Se creó `Dockerfile` para construcción multi-etapa (Build Frontend -> Serve Backend).
- **Correcciones (Build)**:
  - Se eliminaron importaciones `import React from 'react'` innecesarias que causaban errores en TypeScript (TS6133).
  - Se corrigió la ruta de importación en `ProtectedRoute.tsx` hacia `AuthContext`.
