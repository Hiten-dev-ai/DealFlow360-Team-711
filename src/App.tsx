import { useEffect, useState } from 'react';
import { AppShell, type AppView } from './components/layout/AppShell';
import { findDummyAccount, type DummyAccount } from './lib/dummy-accounts';
import { LoginPage } from './views/LoginPage';
import { ModulePlaceholder } from './views/ModulePlaceholder';
import { OverviewView } from './views/OverviewView';
import { SettingsView, type Accent, type ThemeMode } from './views/SettingsView';

const USER_SESSION_KEY = 'dealflow360.demo.user';

function App() {
  const [user, setUser] = useState<DummyAccount | null>(() => findDummyAccount(sessionStorage.getItem(USER_SESSION_KEY)));
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('dealflow360.theme') as ThemeMode | null) ?? 'dark');
  const [accent, setAccent] = useState<Accent>(() => (localStorage.getItem('dealflow360.accent') as Accent | null) ?? 'blue');

  useEffect(() => {
    const resolvedTheme = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem('dealflow360.theme', theme);
    localStorage.setItem('dealflow360.accent', accent);
  }, [theme, accent]);

  const authenticate = (account: DummyAccount) => {
    sessionStorage.setItem(USER_SESSION_KEY, account.id);
    setUser(account);
  };

  const logout = () => {
    sessionStorage.removeItem(USER_SESSION_KEY);
    setActiveView('overview');
    setUser(null);
  };

  if (!user) return <LoginPage onAuthenticated={authenticate} />;

  let content;
  if (activeView === 'settings') {
    content = <SettingsView user={user} theme={theme} accent={accent} onThemeChange={setTheme} onAccentChange={setAccent} />;
  } else if (activeView === 'quotations') {
    content = <ModulePlaceholder title="Quotations" summary="Build and govern customer quotations." />;
  } else if (activeView === 'pipeline') {
    content = <ModulePlaceholder title="Pipeline" summary="Follow active deals through each operational stage." />;
  } else {
    content = <OverviewView />;
  }

  return <AppShell activeView={activeView} user={user} onNavigate={setActiveView} onLogout={logout}>{content}</AppShell>;
}

export default App;
