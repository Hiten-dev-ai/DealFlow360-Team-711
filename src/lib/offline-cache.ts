import { openDB } from 'idb';
import type { BootstrapResponse, SessionUser } from './api';

const db = openDB('dealflow360-cache-v1', 1, {
  upgrade(database) {
    database.createObjectStore('workspaces');
  },
});

const key = (user: SessionUser) => `${user.id}:${user.teamId ?? 'workspace'}`;

export async function saveWorkspaceCache(user: SessionUser, value: BootstrapResponse) {
  await (await db).put('workspaces', { ...value, cachedFor: user.id }, key(user));
}

export async function loadWorkspaceCache(user: SessionUser) {
  const cached = await (await db).get('workspaces', key(user)) as (BootstrapResponse & { cachedFor: string }) | undefined;
  if (cached?.data && !Array.isArray(cached.data.payments)) cached.data.payments = [];
  return cached;
}

export async function clearWorkspaceCache(user: SessionUser) {
  await (await db).delete('workspaces', key(user));
}
