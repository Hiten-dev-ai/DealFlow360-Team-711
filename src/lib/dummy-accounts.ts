export interface DummyAccount {
  id: 'hiten' | 'sujith';
  fullName: 'Hiten' | 'Sujith Kumar';
  email: string;
  password: string;
}

export const DUMMY_ACCOUNTS: readonly DummyAccount[] = Object.freeze([
  {
    id: 'hiten',
    fullName: 'Hiten',
    email: 'hiten@dealflow360.demo',
    password: 'team711-demo',
  },
  {
    id: 'sujith',
    fullName: 'Sujith Kumar',
    email: 'sujith@dealflow360.demo',
    password: 'team711-demo',
  },
]);

export function authenticateDummyAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return DUMMY_ACCOUNTS.find(
    (account) => account.email === normalizedEmail && account.password === password,
  ) ?? null;
}

export function findDummyAccount(id: string | null) {
  return DUMMY_ACCOUNTS.find((account) => account.id === id) ?? null;
}
