import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity, Bell, BellOff, CheckCheck, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList,
  FileBarChart, FileText, HeartPulse, LayoutDashboard, LogOut, Menu, Moon,
  PackageCheck, Search, Settings, ShieldAlert, Sun, Trash2, WalletCards, Workflow, X,
} from 'lucide-react';
import { APP_NAME, TEAM_NAME } from '../../app-meta';
import type { DummyAccount } from '../../lib/dummy-accounts';
import type { NotificationPreferences } from '../../lib/preferences';
import { Modal } from '../ui/Modal';

export type AppView =
  | 'dashboard' | 'quotations' | 'approvals' | 'fulfillment'
  | 'subscriptions' | 'invoices' | 'health' | 'reports' | 'settings';

interface AppShellProps {
  activeView: AppView;
  children: ReactNode;
  user: DummyAccount;
  resolvedTheme: 'light' | 'dark';
  notificationPreferences: NotificationPreferences;
  onNavigate: (view: AppView) => void;
  onToggleTheme: () => void;
  onNotificationPreferencesChange: (next: Partial<NotificationPreferences>) => void;
  onLogout: () => void;
}

export const APP_NAVIGATION = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, hint: 'Sales activity and key metrics' },
  { id: 'quotations' as const, label: 'Quotations', icon: ClipboardList, hint: 'Draft, price, and send quotes' },
  { id: 'approvals' as const, label: 'Approvals', icon: ClipboardCheck, hint: 'Review discount exceptions' },
  { id: 'fulfillment' as const, label: 'Fulfillment', icon: PackageCheck, hint: 'Warehouse splits and orders' },
  { id: 'subscriptions' as const, label: 'Subscriptions', icon: WalletCards, hint: 'Recurring plans and billing' },
  { id: 'invoices' as const, label: 'Invoices', icon: FileText, hint: 'Invoices and payments' },
  { id: 'health' as const, label: 'Deal Health', icon: HeartPulse, hint: 'Risk and anomaly signals' },
  { id: 'reports' as const, label: 'Reports', icon: FileBarChart, hint: 'Performance and exports' },
] as const;

export const APP_VIEW_IDS: readonly AppView[] = [...APP_NAVIGATION.map((item) => item.id), 'settings'];

const titles: Record<AppView, string> = {
  dashboard: 'Dashboard', quotations: 'Quotations', approvals: 'Approvals',
  fulfillment: 'Fulfillment', subscriptions: 'Subscriptions', invoices: 'Invoices',
  health: 'Deal Health', reports: 'Reports', settings: 'Settings',
};

interface WorkspaceNotification {
  id: string;
  category: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: boolean;
  view: AppView;
}

const NOTIFICATIONS_KEY = 'dealflow360:notifications:v1';
const initialNotifications: WorkspaceNotification[] = [
  { id: 'n1', category: 'Approvals', title: 'Q-1047 needs approval', message: 'Beta Industries exceeds the service discount ceiling.', time: '18 min', read: false, priority: true, view: 'approvals' as const },
  { id: 'n2', category: 'Fulfillment', title: 'Stock risk detected', message: 'Order O-2287 depends on backordered East Depot stock.', time: '2 hr', read: false, priority: true, view: 'fulfillment' as const },
  { id: 'n3', category: 'Billing', title: 'Payment recorded', message: 'Invoice INV-8818 was paid in full.', time: 'Today', read: true, priority: false, view: 'invoices' as const },
];

function loadNotifications() {
  try {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    return saved ? JSON.parse(saved) as WorkspaceNotification[] : initialNotifications;
  } catch {
    return initialNotifications;
  }
}

export function AppShell({ activeView, children, user, resolvedTheme, notificationPreferences, onNavigate, onToggleTheme, onNotificationPreferencesChange, onLogout }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>(loadNotifications);
  const initials = useMemo(
    () => user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    [user.fullName],
  );
  const unreadCount = notifications.filter((item) => !item.read).length;
  const filteredNotifications = notificationPreferences.priorityOnly ? notifications.filter((item) => item.priority) : notifications;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = APP_NAVIGATION.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(normalizedQuery));

  useEffect(() => {
    const onKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyboard);
    return () => document.removeEventListener('keydown', onKeyboard);
  }, []);

  useEffect(() => {
    if (!mobileOpen && !notificationsOpen) return;
    document.body.classList.add('drawer-locked');
    return () => document.body.classList.remove('drawer-locked');
  }, [mobileOpen, notificationsOpen]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const navigate = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
    setNotificationsOpen(false);
  };

  const openSearchResult = (view: AppView) => {
    navigate(view);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const markRead = (id: string) => {
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  };

  return (
    <div className="workspace-root">
      <button type="button" className={`mobile-backdrop ${mobileOpen ? 'visible' : ''}`} aria-label="Close navigation" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)} />

      <aside className={`workspace-sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-brand">
          <span className="sidebar-logo"><Workflow size={22} /></span>
          <span className="sidebar-brand-copy"><strong>{APP_NAME}</strong><small>{TEAM_NAME}</small></span>
          <button type="button" className="drawer-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <nav className="sidebar-navigation">
          <span className="sidebar-section-label">Workspace</span>
          {APP_NAVIGATION.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button key={item.id} type="button" className={`sidebar-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} title={item.label} onClick={() => navigate(item.id)}>
                <span className="sidebar-item-icon"><Icon size={20} /></span>
                <span className="sidebar-item-label">{item.label}</span>
                <ChevronRight className="sidebar-item-chevron" size={16} />
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" className={`sidebar-item ${activeView === 'settings' ? 'active' : ''}`} aria-current={activeView === 'settings' ? 'page' : undefined} title="Settings" onClick={() => navigate('settings')}>
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
          <button type="button" className="topbar-search" aria-label="Search workspace" onClick={() => setSearchOpen(true)}>
            <Search size={17} /><span>Search modules and actions...</span>
            <span className="shortcut"><kbd>Ctrl</kbd><b>+</b><kbd>K</kbd></span>
          </button>
          <div className="topbar-actions">
            <button type="button" className="topbar-icon theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}>
              {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button type="button" className={`topbar-icon notification-trigger ${notificationsOpen ? 'selected' : ''}`} onClick={() => setNotificationsOpen((open) => !open)} aria-label={`${unreadCount} unread notifications`}>
              <Bell size={19} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            <button type="button" className={`topbar-icon ${activeView === 'settings' ? 'selected' : ''}`} onClick={() => navigate('settings')} aria-label="Settings"><Settings size={19} /></button>
          </div>
        </header>
        <main className="workspace-content" key={activeView}>{children}</main>
      </div>

      <button type="button" className={`action-center-overlay ${notificationsOpen ? 'open' : ''}`} aria-label="Close notifications" tabIndex={notificationsOpen ? 0 : -1} onClick={() => setNotificationsOpen(false)} />
      <aside className={`action-center ${notificationsOpen ? 'open' : ''}`} aria-hidden={!notificationsOpen} inert={!notificationsOpen}>
        <header className="action-center-header">
          <div><span>Action center</span><h2>Notifications</h2></div>
          <div>
            {notifications.length > 0 && <button type="button" className="action-text-button" onClick={() => setNotifications((items) => items.map((item) => ({ ...item, read: true })))}><CheckCheck size={15} /> Read all</button>}
            {notifications.length > 0 && <button type="button" className="action-text-button" onClick={() => setNotifications([])}><Trash2 size={15} /> Clear</button>}
            <button type="button" className="icon-control" onClick={() => setNotificationsOpen(false)} aria-label="Close notification panel"><X size={17} /></button>
          </div>
        </header>
        <div className="action-center-dnd">
          <div><span className={notificationPreferences.dnd ? 'active' : ''}>{notificationPreferences.dnd ? <BellOff size={17} /> : <Bell size={17} />}</span><div><strong>Do not disturb</strong><small>{notificationPreferences.dnd ? 'Banners and sound silenced' : 'Receiving all banners'}</small></div></div>
          <button type="button" role="switch" aria-checked={notificationPreferences.dnd} className={`toggle-switch ${notificationPreferences.dnd ? 'checked' : ''}`} onClick={() => onNotificationPreferencesChange({ dnd: !notificationPreferences.dnd })}><span /></button>
        </div>
        <div className="action-center-filters">
          <button type="button" className={!notificationPreferences.priorityOnly ? 'active' : ''} onClick={() => onNotificationPreferencesChange({ priorityOnly: false })}>All alerts ({unreadCount} unread)</button>
          <button type="button" className={notificationPreferences.priorityOnly ? 'active' : ''} onClick={() => onNotificationPreferencesChange({ priorityOnly: true })}><ShieldAlert size={13} /> Priority only</button>
        </div>
        <div className="action-center-scroll">
          {filteredNotifications.length > 0 ? <><p className="action-center-group">Today</p>{filteredNotifications.map((item) => <article className={`action-notification-card ${!item.read ? 'unread' : ''}`} key={item.id}><header><span><i className={item.priority ? 'priority' : ''} />{item.category}</span><time>{item.time}</time></header><div><strong>{item.title}{!item.read && <em>Unread</em>}</strong><p>{item.message}</p></div><button type="button" onClick={() => { markRead(item.id); navigate(item.view); }}>Open {item.category.toLowerCase()}</button></article>)}</> : <div className="action-center-empty"><CheckCircle2 size={32} /><strong>No new notifications</strong><span>You are all caught up.</span></div>}
        </div>
      </aside>

      <Modal open={searchOpen} title="Search workspace" eyebrow="Quick navigation" onClose={() => setSearchOpen(false)}>
        <div className="command-search"><Search size={18} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find a module..." aria-label="Search modules" /></div>
        <div className="command-results">
          {searchResults.length === 0 && <p className="compact-empty"><Activity size={18} /> No matching module.</p>}
          {searchResults.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" onClick={() => openSearchResult(item.id)}><span><Icon size={18} /></span><span><strong>{item.label}</strong><small>{item.hint}</small></span><ChevronRight size={16} /></button>;
          })}
        </div>
      </Modal>
    </div>
  );
}
