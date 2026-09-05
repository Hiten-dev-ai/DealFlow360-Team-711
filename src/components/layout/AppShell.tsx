import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Workflow,
  X,
} from 'lucide-react';
import { APP_NAME, TEAM_NAME } from '../../app-meta';
import type { DummyAccount } from '../../lib/dummy-accounts';

export type AppView = 'overview' | 'quotations' | 'pipeline' | 'settings';

interface AppShellProps {
  activeView: AppView;
  children: ReactNode;
  user: DummyAccount;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
}

const navigation = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'quotations' as const, label: 'Quotations', icon: ClipboardList },
  { id: 'pipeline' as const, label: 'Pipeline', icon: BarChart3 },
];

const titles: Record<AppView, string> = {
  overview: 'Overview',
  quotations: 'Quotations',
  pipeline: 'Pipeline',
  settings: 'Settings',
};

export function AppShell({ activeView, children, user, onNavigate, onLogout }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = useMemo(
    () => user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    [user.fullName],
  );

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', close);
    document.body.classList.add('drawer-locked');
    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('drawer-locked');
    };
  }, [mobileOpen]);

  const navigate = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <div className="workspace-root">
      <button
        type="button"
        className={`mobile-backdrop ${mobileOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`workspace-sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-brand">
          <span className="sidebar-logo"><Workflow size={22} /></span>
          <span className="sidebar-brand-copy"><strong>{APP_NAME}</strong><small>{TEAM_NAME}</small></span>
          <button type="button" className="drawer-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <nav className="sidebar-navigation">
          <span className="sidebar-section-label">Workspace</span>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                <span className="sidebar-item-icon"><Icon size={20} /></span>
                <span className="sidebar-item-label">{item.label}</span>
                <ChevronRight className="sidebar-item-chevron" size={16} />
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={`sidebar-item ${activeView === 'settings' ? 'active' : ''}`}
            aria-current={activeView === 'settings' ? 'page' : undefined}
            onClick={() => navigate('settings')}
          >
            <span className="sidebar-item-icon"><Settings size={20} /></span>
            <span className="sidebar-item-label">Settings</span>
            <ChevronRight className="sidebar-item-chevron" size={16} />
          </button>
          <div className="sidebar-profile">
            <span className="profile-avatar">{initials}</span>
            <span className="profile-copy"><strong>{user.fullName}</strong><small>{user.email}</small></span>
            <button type="button" className="logout-button" onClick={onLogout} aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-title-group">
            <button type="button" className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div><span>{TEAM_NAME}</span><h1>{titles[activeView]}</h1></div>
          </div>
          <button type="button" className="topbar-search" aria-label="Search workspace">
            <Search size={17} />
            <span>Search deals, quotes, customers…</span>
            <span className="shortcut"><kbd>Ctrl</kbd><b>+</b><kbd>K</kbd></span>
          </button>
          <div className="topbar-actions">
            <button type="button" className="topbar-icon" aria-label="Notifications"><Bell size={19} /></button>
            <button type="button" className={`topbar-icon ${activeView === 'settings' ? 'selected' : ''}`} onClick={() => navigate('settings')} aria-label="Settings"><Settings size={19} /></button>
          </div>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
