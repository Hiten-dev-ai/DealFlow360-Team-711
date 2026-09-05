# DealFlow360 — Team 711

DealFlow360 is an end-to-end sales-operations workspace for governed quotations, sequential discount approvals, customer negotiation, warehouse allocation, hybrid billing, deal health, and reporting.

## What works

- Secure internal accounts with Admin, Sales Rep, Sales Manager, and Finance/Ops roles
- Company → Sales Team → User ownership and approval routing
- Server-calculated pricing, margin, discount ceilings, and deterministic risk scores
- Manager → Finance approval chains with complete audit records
- Expiring customer magic links and a quote-scoped negotiation portal
- Inventory reservation, fewest-shipment allocation, and backorders
- One-time invoices, recurring subscriptions, daily proration, and payment ledger
- Server notifications, authorized search, PDF/XLS exports, and health signals
- Installable PWA with per-user IndexedDB read cache and automatic updates
- Read-only offline access; sensitive actions always require the server

## Stack

- React 19, TypeScript, Vite 8, Vite PWA
- Hono on Node.js
- PostgreSQL 17 and parameterized `pg` queries
- Argon2id password hashing, opaque cookie sessions, CSRF and origin validation

## Local development

```bash
npm install
npm run test
npm run lint
npm run build
npm run server
```

The API uses PostgreSQL when `DATABASE_URL` is set. Apply migrations before starting it:

```bash
npm run db:migrate
```

Provision the demo workspace by supplying four passwords of at least 7 characters outside Git. Use 12 or more characters outside controlled demos:

```bash
DEMO_ADMIN_PASSWORD=... \
DEMO_SALES_PASSWORD=... \
DEMO_MANAGER_PASSWORD=... \
DEMO_FINANCE_PASSWORD=... \
npm run db:seed
```

The provisioned emails are `hiten@dealflow360.demo`, `sujith@dealflow360.demo`, `manager@dealflow360.demo`, and `finance@dealflow360.demo`. Credentials are never shown on the login screen.

## Runtime configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_ORIGIN` | Exact public origin used for CSRF validation |
| `PORT` / `HOST` | API listener; production uses `127.0.0.1:4174` |
| `RELEASE_ID` | Version reported by `/api/version` |
| `SMTP_URL` | Optional SMTP transport for invitations and portal links |
| `MAIL_FROM` | Sender address for email delivery |

If SMTP is absent, authorized staff can copy the generated expiring link.

## Data and offline rules

PostgreSQL is authoritative. The browser cache is partitioned by user and workspace, cleared at logout, and used only for offline viewing. API responses and authentication are never service-worker cached. Mutations use server authorization, validation, transactions, audit records, and optimistic versions where concurrent edits matter.

## Demo flow

1. Sign in as Sales Rep and create a quote with a discount exception.
2. Approve it as Sales Manager, then Finance/Ops.
3. Generate a customer link and submit a counteroffer from the portal.
4. Re-submit and approve the new revision, then let the customer accept.
5. Allocate stock, review shipments/backorders, invoice the one-time items, start recurring billing, and record payment.

Production: [dealflow360.athergrid.dev](https://dealflow360.athergrid.dev)

## Contribution ownership

- Hiten: backend, business rules, security, data, deployment, and integration.
- Sujith Kumar: frontend structure, responsive UI, design system, and accessibility.

Commits must reflect the real contributor and real work performed.
