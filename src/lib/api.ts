export type Role = 'admin' | 'sales_rep' | 'sales_manager' | 'finance_ops';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  activeRole: Role;
  teamId: string | null;
}

export interface WorkspaceData {
  quotes: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  fulfillment: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  teams: Array<Record<string, unknown>>;
  tiers: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  catalog: Array<Record<string, unknown>>;
  preferences: { theme: string; accent: string; desktopAlerts?: boolean; soundAlerts?: boolean; priorityOnly?: boolean; dnd?: boolean };
}

export interface BootstrapResponse { data: WorkspaceData; sync: { cursor: number; syncedAt: string } }

const CSRF_KEY = 'dealflow360.csrf';
let csrfToken = typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem(CSRF_KEY) ?? '';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}

export function setCsrf(token?: string) {
  csrfToken = token ?? '';
  if (typeof sessionStorage !== 'undefined') {
    if (csrfToken) sessionStorage.setItem(CSRF_KEY, csrfToken);
    else sessionStorage.removeItem(CSRF_KEY);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase()) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new ApiError(body?.error ?? 'Request failed.', response.status, body?.code ?? 'REQUEST_FAILED');
  return body as T;
}

export async function login(email: string, password: string) {
  const response = await apiFetch<{ user: SessionUser; csrfToken: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  setCsrf(response.csrfToken);
  return response.user;
}

export async function getSession() {
  const response = await apiFetch<{ authenticated: true; user: SessionUser; csrfToken: string }>('/api/auth/session');
  setCsrf(response.csrfToken);
  return response.user;
}

export async function logout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } finally { setCsrf(); }
}

export const getBootstrap = () => apiFetch<BootstrapResponse>('/api/bootstrap');

export async function downloadReport(format: 'pdf' | 'xls', filters: { status?: string; ownerId?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  if (filters.ownerId && filters.ownerId !== 'all') query.set('ownerId', filters.ownerId);
  const response = await fetch(`/api/reports/deals.${format}${query.size ? `?${query}` : ''}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error ?? 'Report download failed.', response.status, body?.code ?? 'REPORT_FAILED');
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `dealflow360-deals.${format}`;
  return { blob: await response.blob(), filename };
}

export async function mutate<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', payload?: unknown, idempotencyKey?: string) {
  return apiFetch<T>(path, { method, body: payload === undefined ? undefined : JSON.stringify(payload), headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined });
}
