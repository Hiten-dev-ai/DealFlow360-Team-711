export const ROLES = Object.freeze(['owner', 'admin', 'operator']);

export const ROLE_CAPABILITIES = Object.freeze({
  owner: Object.freeze([
    'workspace.read',
    'inventory.read',
    'inventory.write',
    'inventory.delete',
    'pipeline.read',
    'pipeline.write',
    'roles.manage',
    'settings.manage',
  ]),
  admin: Object.freeze([
    'workspace.read',
    'inventory.read',
    'inventory.write',
    'inventory.delete',
    'pipeline.read',
    'pipeline.write',
    'settings.manage',
  ]),
  operator: Object.freeze([
    'workspace.read',
    'inventory.read',
    'inventory.write',
    'pipeline.read',
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
