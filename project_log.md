# Project Infrastructure & Architecture Log

**Last Updated**: 2026-02-08 15:03:00

## Database Architecture
- **Environment**: Cloud VPS (Easypanel Container)
- **Access**: External operations via **DbGate**
- **Constraint**: The local application (`app-adrielssystems`) connects via standard TCP/IP, but *schema modifications* and *seed data insertion* are performed MANUALLY by the developer using DbGate
- **Action Item**: Do NOT attempt to run `node scripts/seed...` or direct schema migrations from the agent. Always generate `.sql` files for the user to execute
- **Schema Documentation**: `database/SCHEMA.md` - Updated after each migration

## Application Structure
- **Root**: `app-adrielssystems`
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express (Port 3000)
- **Authentication**: JWT + bcrypt
- **Database**: PostgreSQL (via pg library)

---

## Implemented Features

### 1. Authentication & Authorization
- **JWT-based authentication** with role-based access control
- **Roles**: ADMIN, CLIENT
- **Protected routes** using `authenticateToken` and `authorizeRole` middleware
- **Password hashing** with bcrypt (10 salt rounds)
- **Auto-logout** on token expiration

### 2. Client Management (`/admin/clients`)
- **CRUD operations** for clients
- **Features**:
  - Create client with optional service plan
  - Edit client information and change plan
  - View all clients in table format
  - Assign plans from Plans Management
- **Bug Fix (2026-02-08)**: Fixed signin redirect issue when editing client plans
  - Problem: Double JSON parsing causing errors
  - Solution: Only parse JSON on error responses

### 3. Plans Management (`/admin/plans`)
- **CRUD operations** for service plans
- **Features**:
  - Create new plans with cost, currency, billing cycle
  - Edit existing plans
  - View all plans in grid layout
  - Delete plans (with confirmation)
- **Endpoints**:
  - `GET /api/plans` - List all plans
  - `POST /api/plans` - Create new plan
  - `PUT /api/plans/:id` - Update plan
  - `DELETE /api/plans/:id` - Delete plan

### 4. Payment Tracking System (2026-02-08)
**Complete implementation with database, backend, and frontend**

#### Database Schema Updates
**Migration File**: `database/add_payment_tracking.sql`

**Services Table - New Columns**:
- `renewal_day` (INTEGER) - Day of month when service renews (1-31)
- `prepaid_until` (DATE) - Date until which service is prepaid
- `last_payment_date` (DATE) - Date of last payment received

**Payments Table - New Columns**:
- `service_id` (INTEGER FK) - Reference to services table
- `due_date` (DATE) - Date when payment is due
- `payment_method` (VARCHAR) - Payment method used
- `notes` (TEXT) - Additional notes

**Indexes Created**:
- `idx_payments_service_id` - For faster service lookups
- `idx_payments_due_date` - For faster due date queries
- `idx_payments_status` - For faster status filtering

#### Backend API (8 Endpoints)

**Payment Endpoints**:
1. `GET /api/payments/summary` - Dashboard summary (overdue, pending, upcoming)
2. `GET /api/payments/overdue` - List of overdue clients with days overdue
3. `GET /api/payments/upcoming?days=7` - Payments due in next X days
4. `GET /api/payments/client/:clientId` - Payment history for specific client
5. `POST /api/payments` - Register new payment (updates `last_payment_date`)
6. `PUT /api/payments/:id` - Update existing payment
7. `GET /api/notifications/pending` - N8N integration endpoint
8. `GET /api/clients/:id/services` - Get services for a client

**Business Logic Helpers** (`server/utils/paymentHelpers.js`):
- `calculatePaymentStatus(dueDate, prepaidUntil)` - Returns PAGADO/PENDIENTE/VENCIDO
- `calculateDaysOverdue(dueDate)` - Days payment is overdue
- `calculateNextDueDate(renewalDay, lastPaymentDate)` - Next due date
- `calculateDaysUntilDue(dueDate)` - Days until payment due

#### Frontend Components

**Dashboard Widgets** (`/admin`):
1. **PaymentSummaryWidget** - 3 cards showing:
   - Morosos (overdue) - count and total amount
   - Pendientes (pending) - count and total amount
   - Próximos (upcoming 7 days) - count and total amount

2. **OverdueClientsWidget** - Detailed list of overdue clients:
   - Client name, service, amount, currency
   - Days overdue
   - Contact info (email, phone)

3. **UpcomingPaymentsWidget** - List of upcoming payments:
   - Client name, service, amount
   - Days until due
   - Formatted due date

**Payments Management Page** (`/admin/payments`):
- **Full payment table** with all payments
- **Status filters**: ALL, PAGADO, PENDIENTE, VENCIDO
- **Register Payment Modal**:
  - Client selection (loads services dynamically)
  - Service selection
  - Amount and currency (USD, EUR, VES)
  - Payment and due dates
  - Status selection
  - Payment method (PayPal, Zelle, Pago Movil, etc.)
  - Notes field
- **Features**:
  - Auto-refresh after registration
  - Color-coded status badges
  - Responsive design with glassmorphism
  - Toast notifications for success/error

---

## Database Schema Summary

### Tables
1. **clients** - Client information
2. **users** - Application users (linked to clients)
3. **plans** - Service plans/packages
4. **services** - Client subscriptions to plans
5. **payments** - Payment records
6. **conversations** - Chat/conversation history

### Key Relationships
- `users.client_id` → `clients.id`
- `services.client_id` → `clients.id`
- `payments.client_id` → `clients.id`
- `payments.service_id` → `services.id`

---

## Known Issues & Fixes

### Fixed Issues
1. ✅ **Client Edit Redirect** (2026-02-08)
   - Issue: Editing client plan caused redirect to signin
   - Cause: Double JSON parsing in response handling
   - Fix: Only parse JSON on error responses

### Pending Items
1. **N8N Integration** - Configure workflow for automated notifications
2. **Client Dashboard** - Allow clients to view their payment history
3. **Payment Reports** - Generate monthly revenue reports
4. **Multi-currency Conversion** - For consolidated reporting
5. **CSRF Protection** - Implement CSRF tokens
6. **Password Strength Validation** - Frontend validation for passwords

---

## File Structure

```
app-adrielssystems/
├── database/
│   ├── SCHEMA.md                    # Database schema documentation
│   └── add_payment_tracking.sql     # Payment tracking migration
├── server/
│   ├── index.js                     # Main server file with all routes
│   └── utils/
│       └── paymentHelpers.js        # Payment business logic
├── src/
│   ├── components/
│   │   ├── features/admin/
│   │   │   ├── PaymentSummaryWidget.tsx
│   │   │   ├── OverdueClientsWidget.tsx
│   │   │   └── UpcomingPaymentsWidget.tsx
│   │   ├── layouts/
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── ClientLayout.tsx
│   │   │   └── AuthLayout.tsx
│   │   └── ui/
│   │       ├── ProtectedRoute.tsx
│   │       └── sonner.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── ClientsManagement.tsx
│   │   │   ├── PaymentsManagement.tsx
│   │   │   └── PlansManagement.tsx
│   │   ├── auth/
│   │   │   └── Login.tsx
│   │   └── client/
│   │       └── ClientDashboard.tsx
│   ├── utils/
│   │   └── api.ts                   # API helper with JWT handling
│   └── App.tsx                      # Main routing
└── package.json
```

---

## Development Notes

### API Helper (`src/utils/api.ts`)
- Automatically includes JWT token in all requests
- Handles token refresh
- Redirects to login on 401 errors
- Usage: `api.get()`, `api.post()`, `api.put()`, `api.delete()`

### Authentication Flow
1. User logs in → JWT token stored in localStorage
2. AuthContext provides token to all components
3. ProtectedRoute checks role before rendering
4. API helper includes token in all requests
5. Backend validates token on protected routes

### Payment Status Logic
- **PAGADO**: `prepaid_until >= today` OR payment recorded
- **VENCIDO**: `due_date < today` AND not prepaid
- **PENDIENTE**: `due_date >= today` AND not prepaid

---

## Build Information
- **Last Build**: 2026-02-08 15:00:00
- **Build Size**: 391.88 kB (gzipped: 116.87 kB)
- **Build Tool**: Vite 5.4.21
- **TypeScript**: Strict mode enabled
- **Status**: ✅ All builds successful
