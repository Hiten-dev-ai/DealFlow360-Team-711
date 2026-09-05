# DealFlow360 - Team 711

[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169e1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-5a0fc8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

DealFlow360 is a secure quote-to-cash workspace for sales teams. It brings pricing, approvals, customer negotiation, fulfillment, subscriptions, invoicing, payments, deal health, and reporting into one governed workflow.

**Live application:** [dealflow360.athergrid.dev](https://dealflow360.athergrid.dev)

## Why DealFlow360

Sales work often moves between spreadsheets, email threads, warehouse tools, and finance systems. DealFlow360 keeps every commercial decision attached to the same deal. Prices and risk are calculated on the server, approvals follow fixed rules, customer changes create revisions, stock allocation is transactional, and billing starts from the accepted commercial record.

## End-to-end product flow

```mermaid
flowchart LR
  A[Create quotation] --> B[Server pricing and risk]
  B -->|Low risk| D[Approved]
  B -->|Exception| C[Manager / Finance approval]
  C --> D
  D --> E[Customer deal room]
  E -->|Counteroffer| B
  E -->|Accepted| F[Inventory allocation]
  F --> G[Shipment or backorder]
  F --> H[Subscription and invoice]
  H --> I[Payment ledger]
  G --> J[Reports and deal health]
  I --> J
```

## Product capabilities

### Quotations and pricing

- Product catalogue with one-time and recurring items
- Customer tiers and category-level discount ceilings
- Integer INR minor-unit calculations to avoid floating-point money errors
- Server-calculated subtotal, discount, cost, margin, risk score, and approval route
- Versioned quotations with optimistic concurrency on material edits
- Deterministic upsell suggestions with revenue and margin impact

### Approvals and customer negotiation

- Automatic approval for low-risk offers
- Sequential Sales Manager and Finance/Ops approval for governed exceptions
- Revision invalidation when commercial terms change
- Short-lived, single-use customer magic links
- Quote-scoped customer sessions for accepting, rejecting, commenting, or counteroffering
- Responsive customer deal room with item totals and guarded response states
- Audit records for staff and customer decisions

### Fulfillment and billing

- PostgreSQL row locking during inventory allocation
- Allocation ordered by fewest shipments, lowest shipping cost, then smallest backorder
- Warehouse splits, shipment states, and backorder visibility
- Separation of one-time invoice lines from recurring subscriptions
- Daily proration for the first recurring billing period
- Due, partially paid, paid, and overdue invoice states
- Searchable internal payment ledger with idempotent payment recording and references

### Workspace experience

- Role-scoped global search and reports
- Searchable fulfillment, deal-health, and team workspaces
- Team drill-down administration for names, managers, roles, invitations, and membership
- Responsive desktop rail and mobile drawer navigation
- Read/unread notifications with priority and DND preferences
- API/database/sync health indicator
- Dark and light themes with synchronized user preferences
- Installable PWA with a user-partitioned IndexedDB read cache
- Read-only offline access with mutations disabled until reconnection

## Roles and access

| Role | Main access |
| --- | --- |
| Admin | All quotations, approvals, fulfillment, billing, reports, catalogue, teams, invitations, and workspace settings |
| Sales Rep | Own quotations, submissions, customer links, own reports, and personal settings |
| Sales Manager | Team quotations, manager approvals, customer links, team reports, and personal settings |
| Finance/Ops | All quotations, finance approvals, fulfillment, subscriptions, invoices, payments, and reports |

Customer portal sessions are separate from internal accounts and are restricted to one customer and one quotation.

## Demo dataset

`npm run db:seed` installs a deterministic and idempotent demonstration workspace. Re-running it refreshes the same smoke records instead of multiplying them.

| Entity | Seeded records |
| --- | ---: |
| Internal users | 40 |
| Sales teams | 6 |
| Customer tiers | 3 — Bronze, Silver, and Gold |
| Customers | 24 |
| Product categories | 3 |
| Products | 16 |
| Quotations | 42 across every lifecycle status |
| Fulfillment orders | 6 plus 2 accepted deals ready to allocate |
| Shipments/backorders | 8 |
| Subscriptions | 14 |
| Invoices | 24 |
| Deal-health alerts | 30 |
| Notifications | 32 per internal user |
| Audit events | 24 |

The dataset includes draft, pending, approved, negotiating, accepted, rejected, and expired quotations; manager and finance queues; warehouse splits; backorders; active/paused/cancelled subscriptions; and due/partial/paid/overdue invoices.

### Demo account emails

- `hiten@dealflow360.demo` - Admin
- `sujith@dealflow360.demo` - Sales Rep
- `manager@dealflow360.demo` - Sales Manager
- `finance@dealflow360.demo` - Finance/Ops

The extended hierarchy adds five regional/segment managers, 29 additional sales representatives, one additional Admin, and one additional Finance/Ops account. Generated sales logins follow patterns such as `north.manager@dealflow360.demo`, `north.rep1@dealflow360.demo`, `strategic.rep3@dealflow360.demo`, and `channel.rep5@dealflow360.demo`.

Passwords are supplied through the protected runtime environment and are never stored in Git or shown on the login screen.

## Architecture

```text
Browser / installed PWA
  |- React 19 + TypeScript application shell
  |- IndexedDB user/workspace read cache
  |- Versioned service-worker application assets
  `- Same-origin HTTPS API requests
                |
                v
Nginx: dealflow360.athergrid.dev
                |
                v
Hono API: 127.0.0.1:4174
  |- Session, CSRF, rate-limit, and capability middleware
  |- Pricing, approval, negotiation, allocation, and billing services
  |- SSE change events with polling fallback
  `- Static production client
                |
                v
PostgreSQL 17: 127.0.0.1:55432
  `- Authoritative workspace, security, audit, and sync data
```

### Technology stack

- React 19, TypeScript 5.9, Vite 8, and `vite-plugin-pwa`
- Hono on Node.js 22
- PostgreSQL 17 with parameterized `pg` queries
- Zod validation
- Argon2id password hashing
- PDFKit report generation and spreadsheet-compatible XLS exports
- Vitest unit and PostgreSQL integration tests

## Repository layout

```text
src/
  components/       Application shell and reusable UI
  views/            Quotations, approvals, fulfillment, billing, reports, settings
  lib/              API client, offline cache, workspace state, PWA lifecycle
  styles.css        Design system and responsive behavior
server/
  auth/             Passwords, sessions, CSRF, roles, and capabilities
  db/               Migrations, core seed, and deterministic smoke dataset
  domain/           Pricing, risk, allocation, billing, and alert rules
  middleware/       Security headers, authorization, limits, and rate limiting
  routes/           Authentication, invitations, domain APIs, and health
  store/            PostgreSQL and test-memory adapters
deploy/             Secret provisioning, isolated verification, release, rollback checks
```

## API overview

| Area | Routes |
| --- | --- |
| Authentication | `/api/auth/login`, `/api/auth/session`, `/api/auth/logout` |
| Access | `/api/invitations`, `/api/invitations/redeem`, `/api/admin/teams`, `/api/admin/teams/:id/members/:userId` |
| Environment | `/api/admin/environment` |
| Workspace | `/api/bootstrap`, `/api/search`, `/api/preferences`, `/api/notifications` |
| Quotations | `/api/quotes`, `/api/quotes/:id/lines`, `/api/quotes/:id/submit` |
| Approvals | `/api/approvals/:id/decision` |
| Customer portal | `/api/quotes/:id/portal-link`, `/api/portal/redeem`, `/api/portal/quote` |
| Operations | `/api/fulfillment/quotes/:id/allocate`, `/api/subscriptions/:id` |
| Finance | `/api/invoices/:id/payments`, `/api/reports/deals.pdf`, `/api/reports/deals.xls` |
| Synchronization | `/api/sync`, `/api/events` |
| Service | `/api/health`, `/api/version` |

Mutation responses use consistent JSON errors. Sensitive operations require an authenticated session, an origin match, a CSRF token, and the appropriate role capability. Payment mutations additionally require an `Idempotency-Key`.

## Local development

### Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 17, locally or in Docker

### Install and verify

```bash
npm install
npm test
npm run lint
npm run build
```

### Configure the environment

Create a local environment file that is not committed:

```bash
NODE_ENV=development
HOST=127.0.0.1
PORT=4173
APP_ORIGIN=http://127.0.0.1:4173
DATABASE_URL=postgresql://dealflow360:password@127.0.0.1:55432/dealflow360
WORKSPACE_ID=00000000-0000-4000-8000-000000000711
SETTINGS_ENCRYPTION_KEY=replace-with-a-long-random-secret
DEMO_ADMIN_PASSWORD=replace-with-a-local-password
DEMO_SALES_PASSWORD=replace-with-a-local-password
DEMO_MANAGER_PASSWORD=replace-with-a-local-password
DEMO_FINANCE_PASSWORD=replace-with-a-local-password
```

Demo seed passwords must contain at least seven characters; use at least twelve characters outside a controlled demonstration.

### Prepare and start the database

```bash
npm run db:migrate
npm run db:seed
npm run server
```

For frontend development, run Vite in another terminal:

```bash
npm run dev
```

## Runtime configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `APP_ORIGIN` | Yes | Exact trusted origin used for CSRF validation |
| `HOST` / `PORT` | No | Listener address; production uses `127.0.0.1:4174` |
| `WORKSPACE_ID` | No | Single-workspace identifier |
| `RELEASE_ID` | Production | Version exposed by `/api/version` |
| `DEMO_*_PASSWORD` | Seeding | Four primary demo-account passwords, supplied outside Git |
| `DEMO_STAFF_PASSWORD` | Seeding | Password for generated hierarchy accounts; falls back to `DEMO_SALES_PASSWORD` |
| `SMTP_URL` | No | SMTP connection URL for invitation and portal email |
| `MAIL_FROM` | No | Sender identity for email delivery |
| `SETTINGS_ENCRYPTION_KEY` | Admin SMTP UI | Encrypts workspace SMTP credentials before database storage |
| `SEED_DEMO` | Deployment | Runs the idempotent demo seed when set to `true` |

Admins can configure SMTP host, port, username, password, TLS mode, and sender in **Settings → Environment**. The assembled password-bearing connection URL is encrypted at rest and the password is never returned to the browser. `SMTP_URL` remains a server-level fallback. When SMTP is absent, authorized staff receive a copy-link fallback for expiring invitations and customer portal links.

## Offline and PWA behavior

- The service worker caches only versioned application assets and the offline shell.
- Authentication and `/api` responses are never stored in the service-worker cache.
- Successful server data is copied into IndexedDB under both workspace and user identifiers.
- Offline sessions can browse previously synchronized records and use cached search.
- Quotes, approvals, customer responses, payments, preferences, and administration stay read-only offline.
- SSE announces workspace changes online; the client uses cursor catch-up and falls back to five-second polling.
- The app checks for a new release on launch, focus, and reconnection, then reloads once after activation.

## Security model

- Argon2id password hashes; plaintext passwords never enter the database
- Opaque `Secure`, `HttpOnly`, `SameSite=Lax` session cookies
- 30-minute inactivity timeout and eight-hour absolute session lifetime
- CSRF validation and exact-origin checks on mutations
- Capability checks and workspace scope on every protected route
- Request-size limits, Zod input validation, and parameterized queries
- Rate limiting for authentication and link-creation endpoints
- Hashed, expiring, single-use invitation and customer tokens
- Server-owned audit records and `Cache-Control: no-store` on sensitive responses
- CSP, frame denial, content-type protection, and conservative browser permissions

## Testing

```bash
npm test              # Unit and UI smoke tests
npm run lint          # Strict TypeScript check
npm run build         # Typecheck plus production/PWA build
```

`server/postgres-integration.test.js` runs only when `TEST_DATABASE_URL` is present. It creates a quotation, routes both approval stages, redeems a customer link, accepts the offer, allocates inventory, creates billing records, and verifies payment idempotency against PostgreSQL.

The deployment pipeline also verifies that the production bootstrap contains the expected smoke-data minimums.

## Production deployment

Production uses an isolated systemd service, PostgreSQL container, and Nginx site:

- Application root: `/srv/apps/dealflow360-team-711`
- Service: `dealflow360-team-711.service`
- API listener: `127.0.0.1:4174`
- Database listener: `127.0.0.1:55432`
- Protected environment: `/etc/dealflow360-team-711.env`
- Public origin: `https://dealflow360.athergrid.dev`

`deploy/release.sh` creates a database backup, installs a timestamped release, applies migrations, optionally refreshes demo data, switches the `current` symlink, restarts only the DealFlow360 service, and checks application health. If the release fails, it restores the previous symlink and database backup.

Nginx and unrelated services are intentionally outside the application release script.

## Contribution ownership

- **Hiten:** backend, business rules, security, data, synchronization, deployment, and integration
- **Sujith Kumar:** frontend structure, responsive UI, design system, and accessibility

Commits must represent real work and use the actual contributor identity. Do not manufacture dates or history.
