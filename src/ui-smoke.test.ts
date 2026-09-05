import { describe, expect, it } from 'vitest';
import { APP_VIEW_IDS, isViewAvailable } from './components/layout/AppShell';
import { formatCurrency, statusTone } from './lib/demo-data';

describe('UI smoke coverage', () => {
  it('contains every required workspace tab', () => {
    expect(APP_VIEW_IDS).toEqual([
      'dashboard', 'quotations', 'approvals', 'fulfillment', 'subscriptions',
      'invoices', 'health', 'reports', 'teams', 'settings',
    ]);
  });

  it('shows only role-relevant navigation', () => {
    expect(APP_VIEW_IDS.filter((view) => isViewAvailable(view, 'sales_rep'))).toEqual([
      'dashboard', 'quotations', 'health', 'reports', 'settings',
    ]);
    expect(APP_VIEW_IDS.filter((view) => isViewAvailable(view, 'sales_manager'))).toEqual([
      'dashboard', 'quotations', 'approvals', 'health', 'reports', 'settings',
    ]);
    expect(APP_VIEW_IDS.filter((view) => isViewAvailable(view, 'finance_ops'))).toEqual([
      'dashboard', 'quotations', 'approvals', 'fulfillment', 'subscriptions',
      'invoices', 'health', 'reports', 'settings',
    ]);
    expect(APP_VIEW_IDS.every((view) => isViewAvailable(view, 'admin'))).toBe(true);
  });

  it('formats operational values consistently', () => {
    expect(formatCurrency(1240000)).toContain('12,40,000');
    expect(statusTone('Approved')).toBe('success');
    expect(statusTone('Overdue')).toBe('danger');
  });
});
