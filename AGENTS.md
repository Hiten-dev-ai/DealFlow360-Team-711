# DealFlow360 contributor guide

DealFlow360 is an original Team 711 sales-operations product. Do not refer to any design source or earlier template in product copy, documentation, commits, or deployment names.

## Architecture contract

- PostgreSQL is authoritative; IndexedDB is a read-only, user-scoped offline cache.
- Never cache `/api` routes, sessions, portal tokens, or customer links in the service worker.
- Roles are `admin`, `sales_rep`, `sales_manager`, and `finance_ops`; portal customers are separately scoped sessions.
- Prices and monetary totals use integer INR minor units. The server calculates totals, margins, risk, approval routing, invoice balances, and allocation.
- Every business mutation must validate workspace and role scope, use parameterized SQL, and write an audit event.
- Approval order is Manager then Finance. Quote revisions supersede earlier pending decisions.
- Keep customer portal access restricted to the linked customer and quotation.

## UI and PWA contract

- Preserve the existing desktop rail, phone drawer, settings behavior, and design tokens.
- Mobile install onboarding appears only on the first browser visit and is skipped on desktop, invite links, portal links, and installed mode.
- Offline mode is visibly read-only. Do not queue business mutations.
- The status indicator derives from authenticated API/database synchronization, not `navigator.onLine` alone.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. Validate migrations on a disposable PostgreSQL database before production. Deployment must back up the isolated database, preserve the previous release, health-check the new service, and leave unrelated Nginx sites and services untouched.
