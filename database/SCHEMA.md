# Database Schema - AdrielsSystems

**Last Updated**: 2026-02-08 14:32:00

## Tables and Constraints

### `clients`
- **Primary Key**: `id`
- **Unique Constraints**: `email`
- **Columns**: id, name, company_name, email, phone, domain, country, notes, created_at, updated_at

### `users`
- **Primary Key**: `id`
- **Unique Constraints**: `email`
- **Foreign Keys**: 
  - `client_id` → `clients(id)`
- **Columns**: id, email, password, role, client_id, created_at, updated_at

### `plans`
- **Primary Key**: `id`
- **Columns**: id, name, description, cost, currency, billing_cycle, created_at, updated_at

### `services`
- **Primary Key**: `id`
- **Foreign Keys**:
  - `client_id` → `clients(id)`
- **Columns**: id, client_id, name, cost, currency, status, renewal_day, prepaid_until, last_payment_date, created_at, updated_at

### `payments`
- **Primary Key**: `id`
- **Foreign Keys**:
  - `client_id` → `clients(id)`
  - `service_id` → `services(id)` ON DELETE CASCADE
- **Columns**: id, client_id, service_id, amount, currency, payment_date, due_date, status, payment_method, notes, created_at, updated_at
- **Indexes**:
  - `idx_payments_service_id` on `service_id`
  - `idx_payments_due_date` on `due_date`
  - `idx_payments_status` on `status`

### `conversations`
- **Primary Key**: `id`
- **Columns**: id, client_id, message, response, created_at

## Recent Changes

### 2026-02-08 - Payment Tracking System
**Added to `services`:**
- `renewal_day` (INTEGER) - Day of month when service renews (1-31)
- `prepaid_until` (DATE) - Date until which service is prepaid (NULL if not prepaid)
- `last_payment_date` (DATE) - Date of last payment received

**Added to `payments`:**
- `service_id` (INTEGER) - Reference to the service this payment is for
- `due_date` (DATE) - Date when payment is due
- `payment_method` (VARCHAR(50)) - Payment method used (PayPal, Zelle, Pago Movil, etc)
- `notes` (TEXT) - Additional notes about the payment

**Indexes Created:**
- `idx_payments_service_id` - For faster service lookups
- `idx_payments_due_date` - For faster due date queries
- `idx_payments_status` - For faster status filtering

## Relationships Diagram

```
clients (1) ──< (N) users
clients (1) ──< (N) services
clients (1) ──< (N) payments
services (1) ──< (N) payments
```

## Notes
- All tables have `created_at` and `updated_at` timestamp fields
- Payment status values: 'PAGADO', 'PENDIENTE', 'VENCIDO'
- Service status values: 'ACTIVE', 'INACTIVE', 'SUSPENDED'
- User roles: 'ADMIN', 'CLIENT'
