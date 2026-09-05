export const ROLES = Object.freeze(['admin', 'sales_rep', 'sales_manager', 'finance_ops']);

export const ROLE_CAPABILITIES = Object.freeze({
  admin: Object.freeze([
    'workspace.read',
    'quotes.read.all', 'quotes.write.all', 'quotes.submit',
    'approvals.manager', 'approvals.finance',
    'fulfillment.manage', 'billing.manage', 'reports.read.all',
    'catalog.manage', 'teams.manage', 'users.manage',
    'settings.manage',
  ]),
  sales_rep: Object.freeze([
    'workspace.read',
    'quotes.read.own', 'quotes.write.own', 'quotes.submit',
    'portal_links.create', 'reports.read.own', 'settings.manage',
  ]),
  sales_manager: Object.freeze([
    'workspace.read',
    'quotes.read.team', 'quotes.write.team', 'quotes.submit',
    'approvals.manager', 'portal_links.create', 'reports.read.team',
    'settings.manage',
  ]),
  finance_ops: Object.freeze([
    'workspace.read',
    'quotes.read.all', 'approvals.finance',
    'fulfillment.manage', 'billing.manage', 'reports.read.all',
    'settings.manage',
  ]),
});

export function isRole(value) {
  return ROLES.includes(value);
}

export function capabilitiesForRole(role) {
  return ROLE_CAPABILITIES[role] ?? [];
}

export function hasCapability(role, capability) {
  return capabilitiesForRole(role).includes(capability);
}

export function chooseDefaultRole(roles) {
  return ROLES.find((role) => roles.includes(role)) ?? null;
}
