import { useEffect, useState, type ReactNode } from 'react';
import { AppShell, type AppView } from './components/layout/AppShell';
import { findDummyAccount, type DummyAccount } from './lib/dummy-accounts';
import { LoginPage } from './views/LoginPage';
import { OverviewView } from './views/OverviewView';
import { SettingsView, type Accent, type ThemeMode } from './views/SettingsView';
import {
  ApprovalsView,
  DealHealthView,
  FulfillmentView,
  InvoicesView,
  QuotationsView,
  ReportsView,
  SubscriptionsView,
} from './views/WorkspaceViews';

const USER_SESSION_KEY = 'dealflow360.demo.user';

function App() {
  const [user, setUser] = useState<DummyAccount | null>(() => findDummyAccount(sessionStorage.getItem(USER_SESSION_KEY)));
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('dealflow360.theme') as ThemeMode | null) ?? 'dark');
  const [accent, setAccent] = useState<Accent>(() => (localStorage.getItem('dealflow360.accent') as Accent | null) ?? 'blue');

  const resolvedTheme: 'light' | 'dark' = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem('dealflow360.theme', theme);
    localStorage.setItem('dealflow360.accent', accent);
  }, [theme, resolvedTheme, accent]);

  const authenticate = (account: DummyAccount) => {
    sessionStorage.setItem(USER_SESSION_KEY, account.id);
    setUser(account);
  };

  const logout = () => {
    sessionStorage.removeItem(USER_SESSION_KEY);
    setActiveView('dashboard');
    setUser(null);
  };

  if (!user) return <LoginPage onAuthenticated={authenticate} />;

  const views: Record<AppView, ReactNode> = {
    dashboard: <OverviewView onNavigate={setActiveView} />,
    quotations: <QuotationsView />,
    approvals: <ApprovalsView />,
    fulfillment: <FulfillmentView />,
    subscriptions: <SubscriptionsView />,
    invoices: <InvoicesView />,
    health: <DealHealthView />,
    reports: <ReportsView />,
    settings: <SettingsView user={user} theme={theme} accent={accent} onThemeChange={setTheme} onAccentChange={setAccent} />,
  };

  return (
    <AppShell
      activeView={activeView}
      user={user}
      resolvedTheme={resolvedTheme}
      onNavigate={setActiveView}
      onToggleTheme={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      onLogout={logout}
    >
      {views[activeView]}
    </AppShell>
  );
}

export default App;
