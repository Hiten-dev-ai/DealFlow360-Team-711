# DealFlow360 (Team 711)

DealFlow360 is a sales-operations workspace for governed quotations, approval routing, warehouse fulfillment, hybrid billing, and customer negotiation.

The current foundation includes the authenticated application shell, responsive navigation, overview, quotation and pipeline entry points, personal settings, and the server-side security foundation. Product workflows will be added incrementally as the team implements and tests each milestone.

The local UI uses two named dummy identities for smoke testing. Login shortcuts and credentials are intentionally not displayed on the sign-in screen.

## Development

```bash
npm install
npm run dev       # Vite frontend
npm run server    # Hono health endpoint on 127.0.0.1:4173
npm run lint
npm test
npm run build
```

## Contribution split

- Hiten: backend, business rules, data, security, deployment, and integration.
- Sujith: frontend screens, responsive UI, design system, accessibility, and frontend tests.

Use feature branches and pull requests. Keep commits focused on real implementation or verification work, and preserve the actual author and timestamp for every contribution.
