import { describe, expect, it } from 'vitest';
import { APP_VIEW_IDS } from './components/layout/AppShell';
import { formatCurrency, statusTone } from './lib/demo-data';
import { authenticateDummyAccount, DUMMY_ACCOUNTS } from './lib/dummy-accounts';

describe('UI smoke identities', () => {
  it('contains only Hiten and Sujith Kumar', () => {
    expect(DUMMY_ACCOUNTS.map((account) => account.fullName)).toEqual(['Hiten', 'Sujith Kumar']);
  });

  it.each(DUMMY_ACCOUNTS)('authenticates $fullName', (account) => {
    expect(authenticateDummyAccount(account.email, account.password)?.fullName).toBe(account.fullName);
  });

  it('contains every required workspace tab', () => {
    expect(APP_VIEW_IDS).toEqual([
      'dashboard', 'quotations', 'approvals', 'fulfillment', 'subscriptions',
      'invoices', 'health', 'reports', 'settings',
    ]);
  });

  it('formats operational values consistently', () => {
    expect(formatCurrency(1240000)).toContain('12,40,000');
    expect(statusTone('Approved')).toBe('success');
    expect(statusTone('Overdue')).toBe('danger');
  });
});
