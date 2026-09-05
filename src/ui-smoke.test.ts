import { describe, expect, it } from 'vitest';
import { authenticateDummyAccount, DUMMY_ACCOUNTS } from './lib/dummy-accounts';

describe('UI smoke identities', () => {
  it('contains only Hiten and Sujith Kumar', () => {
    expect(DUMMY_ACCOUNTS.map((account) => account.fullName)).toEqual(['Hiten', 'Sujith Kumar']);
  });

  it.each(DUMMY_ACCOUNTS)('authenticates $fullName', (account) => {
    expect(authenticateDummyAccount(account.email, account.password)?.fullName).toBe(account.fullName);
  });
});
