# Adriel's Systems App

This directory contains the source code for the Administrative and Client Application ("App").

## Project Structure

The folder structure is organized as follows:

```text
app-adrielssystems/
├── database/
│   └── schema.sql        # Database schema for Users, Clients, Services, Payments
├── src/
│   ├── components/       # React components
│   │   ├── ui/           # Reusable UI components
│   │   ├── layouts/      # Layout components (AdminLayout, ClientLayout, AuthLayout)
│   │   └── features/     # Feature-specific components
│   ├── pages/            # Page components
│   │   ├── admin/        # Admin dashboard pages
│   │   ├── client/       # Client dashboard pages
│   │   └── auth/         # Authentication pages
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API service calls
│   └── utils/            # Utility functions
│       └── paymentStatus.ts # Logic for calculating payment status
└── public/               # Static assets
```

## Getting Started

To run the application, execute:

```bash
npm install
npm run dev
```

The project is fully configured with Vite + React + TypeScript + TailwindCSS.

## Database

Refer to `database/schema.sql` for the PostgreSQL table definitions.

## Key Logic

`src/utils/paymentStatus.ts` contains the core logic for determining if a client is "Al día", "Pendiente", or "Vencido".
