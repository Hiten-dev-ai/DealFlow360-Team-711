import { describe, expect, it } from 'vitest';
import { APP_VIEW_IDS, isViewAvailable, searchWorkspace } from './components/layout/AppShell';
import type { WorkspaceData } from './lib/api';
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

  it('finds contextual records and preserves role scope', () => {
    const data: WorkspaceData = {
      quotes: [{
        id: 'quote-1',
        quoteNumber: 'Q-711001',
        customer: 'Meridian Foods',
        owner: 'Sujith Kumar',
        status: 'manager_review',
        tier: 'Gold',
        team: 'Enterprise South',
        lines: [{ product: 'Cold Chain Monitor', sku: 'CCM-711' }],
      }],
      approvals: [],
      fulfillment: [],
      subscriptions: [],
      invoices: [],
      payments: [],
      alerts: [],
      notifications: [],
      teams: [{ id: 'team-1', name: 'Enterprise South', members: [] }],
      tiers: [],
      customers: [],
      catalog: [],
      preferences: { theme: 'system', accent: 'blue' },
    };

    expect(searchWorkspace('quotations meridian', 'sales_rep', data)).toEqual(
      expect.arrayContaining([expect.objectContaining({ recordId: 'quote-1', type: 'Quotation' })]),
    );
    expect(searchWorkspace('cold chain', 'sales_rep', data)).toEqual(
      expect.arrayContaining([expect.objectContaining({ recordId: 'quote-1', type: 'Quotation' })]),
    );
    expect(searchWorkspace('enterprise south', 'sales_rep', data).some((item) => item.type === 'Team')).toBe(false);
    expect(searchWorkspace('enterprise south', 'admin', data)).toEqual(
      expect.arrayContaining([expect.objectContaining({ recordId: 'team-1', type: 'Team' })]),
    );
  });
});
