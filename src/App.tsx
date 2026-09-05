import { useEffect, useState, type ReactNode } from 'react';
import { AppShell, type AppView } from './components/layout/AppShell';
import { findDummyAccount, type DummyAccount } from './lib/dummy-accounts';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from './lib/preferences';
import { LoginPage } from './views/LoginPage';
import { OverviewView } from './views/OverviewView';
import { SettingsView, type Accent, type SettingsCategory, type ThemeMode } from './views/SettingsView';
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
const NOTIFICATION_PREFERENCES_KEY = 'dealflow360.notification-preferences';
const ACCENTS: readonly Accent[] = ['blue', 'green', 'amber', 'violet'];

function loadAccent(): Accent {
  const saved = localStorage.getItem('dealflow360.accent');
  if (saved === 'teal') return 'green';
  if (saved === 'slate') return 'violet';
  return ACCENTS.includes(saved as Accent) ? saved as Accent : 'blue';
}

function App() {
  const [user, setUser] = useState<DummyAccount | null>(() => findDummyAccount(sessionStorage.getItem(USER_SESSION_KEY)));
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [lastWorkspaceView, setLastWorkspaceView] = useState<AppView>('dashboard');
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('dealflow360.theme') as ThemeMode | null) ?? 'dark');
  const [accent, setAccent] = useState<Accent>(loadAccent);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
    try {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(localStorage.getItem(NOTIFICATION_PREFERENCES_KEY) ?? '{}') };
    } catch {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  });

  const resolvedTheme: 'light' | 'dark' = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem('dealflow360.theme', theme);
    localStorage.setItem('dealflow360.accent', accent);
  }, [theme, resolvedTheme, accent]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(notificationPreferences));
  }, [notificationPreferences]);

  const authenticate = (account: DummyAccount) => {
    sessionStorage.setItem(USER_SESSION_KEY, account.id);
    setUser(account);
  };

  const logout = () => {
    sessionStorage.removeItem(USER_SESSION_KEY);
    setActiveView('dashboard');
    setUser(null);
  };

  const navigate = (view: AppView, nextSettingsCategory?: SettingsCategory) => {
    if (view === 'settings' && activeView !== 'settings') setLastWorkspaceView(activeView);
    setSettingsCategory(nextSettingsCategory ?? null);
    setActiveView(view);
  };

  const updateNotificationPreferences = (next: Partial<NotificationPreferences>) => {
    setNotificationPreferences((current) => ({ ...current, ...next }));
  };

  if (!user) return <LoginPage onAuthenticated={authenticate} />;

  const views: Record<AppView, ReactNode> = {
    dashboard: <OverviewView onNavigate={navigate} />,
    quotations: <QuotationsView />,
    approvals: <ApprovalsView />,
    fulfillment: <FulfillmentView />,
    subscriptions: <SubscriptionsView />,
    invoices: <InvoicesView />,
    health: <DealHealthView />,
    reports: <ReportsView />,
    settings: <SettingsView user={user} theme={theme} accent={accent} initialCategory={settingsCategory} notificationPreferences={notificationPreferences} onBack={() => navigate(lastWorkspaceView)} onThemeChange={setTheme} onAccentChange={setAccent} onNotificationPreferencesChange={updateNotificationPreferences} />,
  };

  return (
    <AppShell
      activeView={activeView}
      user={user}
      resolvedTheme={resolvedTheme}
      notificationPreferences={notificationPreferences}
      onNavigate={navigate}
      onSettingsBack={() => navigate(lastWorkspaceView)}
      onToggleTheme={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      onNotificationPreferencesChange={updateNotificationPreferences}
      onLogout={logout}
    >
      {views[activeView]}
    </AppShell>
  );
}

export default App;
