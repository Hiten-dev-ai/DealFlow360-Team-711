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
  return (await db).get('workspaces', key(user)) as Promise<(BootstrapResponse & { cachedFor: string }) | undefined>;
}

export async function clearWorkspaceCache(user: SessionUser) {
  await (await db).delete('workspaces', key(user));
}
