import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  Activity, ArrowLeft, Bell, BellOff, CheckCheck, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList,
  FileBarChart, FileText, HeartPulse, LayoutDashboard, LogOut, Menu, Moon,
  PackageCheck, Palette, Search, Settings, ShieldAlert, Sun, Trash2, UserRound, WalletCards, Workflow, X,
} from 'lucide-react';
import { APP_NAME } from '../../app-meta';
import type { DummyAccount } from '../../lib/dummy-accounts';
import type { NotificationPreferences } from '../../lib/preferences';
import type { SettingsCategory } from '../../views/SettingsView';
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
  onNavigate: (view: AppView, settingsCategory?: SettingsCategory) => void;
  onSettingsBack: () => void;
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

const WORKSPACE_SEARCH_ITEMS = [
  ...APP_NAVIGATION.map((item) => ({ key: `view-${item.id}`, view: item.id, label: item.label, hint: item.hint, icon: item.icon, type: 'View' as const })),
  { key: 'view-settings', view: 'settings' as const, label: 'Settings', hint: 'Profile, alerts, theme and colour', icon: Settings, type: 'View' as const },
  { key: 'setting-profile', view: 'settings' as const, settingsCategory: 'profile' as const, label: 'Profile', hint: 'Account and workspace settings', icon: UserRound, type: 'Setting' as const },
  { key: 'setting-notifications', view: 'settings' as const, settingsCategory: 'notifications' as const, label: 'Notifications', hint: 'Deal alerts and delivery settings', icon: Bell, type: 'Setting' as const },
  { key: 'setting-appearance', view: 'settings' as const, settingsCategory: 'appearance' as const, label: 'Appearance', hint: 'Theme and accent settings', icon: Palette, type: 'Setting' as const },
  { key: 'action-new-quotation', view: 'quotations' as const, label: 'New quotation', hint: 'Start a customer deal', icon: ClipboardList, type: 'Action' as const },
  { key: 'action-review-approvals', view: 'approvals' as const, label: 'Review approvals', hint: 'Open pending deal decisions', icon: ClipboardCheck, type: 'Action' as const },
  { key: 'action-check-risk', view: 'health' as const, label: 'Check deal risk', hint: 'Review health and anomalies', icon: HeartPulse, type: 'Action' as const },
];

type WorkspaceSearchItem = (typeof WORKSPACE_SEARCH_ITEMS)[number];

function searchWorkspace(query: string): WorkspaceSearchItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return WORKSPACE_SEARCH_ITEMS;
  return WORKSPACE_SEARCH_ITEMS
    .map((item) => {
      const label = item.label.toLowerCase();
      const hint = item.hint.toLowerCase();
      const score = label === normalized ? 0 : label.startsWith(normalized) ? 1 : label.includes(normalized) ? 2 : hint.includes(normalized) ? 3 : -1;
      return { item, score };
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label))
    .map(({ item }) => item);
}

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

export function AppShell({ activeView, children, user, resolvedTheme, notificationPreferences, onNavigate, onSettingsBack, onToggleTheme, onNotificationPreferencesChange, onLogout }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<WorkspaceSearchItem[]>([]);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>(loadNotifications);
  const initials = useMemo(
    () => user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    [user.fullName],
  );
  const unreadCount = notifications.filter((item) => !item.read).length;
  const filteredNotifications = notificationPreferences.priorityOnly ? notifications.filter((item) => item.priority) : notifications;
  const searchInput = useRef<HTMLInputElement>(null);
  const searchDialogInput = useRef<HTMLInputElement>(null);
  const searchOpening = useRef(false);
  const fullSearchResults = useMemo(() => searchWorkspace(searchQuery), [searchQuery]);
  const searchHasMore = fullSearchResults.length > 4;

  const resetSearch = () => {
    setSearchQuery('');
    setSearchSuggestions([]);
    setSearchActiveIndex(-1);
    setSearchLoading(false);
  };

  const closeFullSearch = () => {
    searchOpening.current = false;
    setSearchOpen(false);
    setSearchFocused(false);
    resetSearch();
  };

  const openFullSearch = () => {
    const showDialog = () => {
      searchOpening.current = true;
      setSearchOpen(true);
      setSearchFocused(false);
      setSearchActiveIndex(-1);
    };
    const transitionDocument = document as Document & { startViewTransition?: (update: () => void) => unknown };
    if (transitionDocument.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      transitionDocument.startViewTransition(() => flushSync(showDialog));
    } else {
      showDialog();
    }
  };

  useEffect(() => {
    const onKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openFullSearch();
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
    if (!searchFocused || searchOpen || !searchQuery.trim()) {
      setSearchSuggestions([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      setSearchSuggestions(searchWorkspace(searchQuery).slice(0, 4));
      setSearchActiveIndex(-1);
      setSearchLoading(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchFocused, searchOpen, searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;
    window.requestAnimationFrame(() => {
      searchDialogInput.current?.focus();
      searchOpening.current = false;
    });
  }, [searchOpen]);

  useEffect(() => {
    if (!mobileOpen && !notificationsOpen) return;
    document.body.classList.add('drawer-locked');
    return () => document.body.classList.remove('drawer-locked');
  }, [mobileOpen, notificationsOpen]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const navigate = (view: AppView, settingsCategory?: SettingsCategory) => {
    onNavigate(view, settingsCategory);
    setMobileOpen(false);
    setNotificationsOpen(false);
  };

  const handleSettingsTrigger = () => {
    if (activeView === 'settings') {
      onSettingsBack();
      return;
    }
    navigate('settings');
  };

  const openSearchResult = (item: WorkspaceSearchItem) => {
    searchInput.current?.blur();
    searchDialogInput.current?.blur();
    navigate(item.view, 'settingsCategory' in item ? item.settingsCategory : undefined);
    setSearchOpen(false);
    resetSearch();
  };

  const handleInlineSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!searchSuggestions.length) return;
      setSearchActiveIndex((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        return next < 0 ? searchSuggestions.length - 1 : next >= searchSuggestions.length ? 0 : next;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = searchSuggestions[searchActiveIndex];
      if (selected) openSearchResult(selected);
      else if (searchQuery.trim()) {
        const firstResult = searchSuggestions[0] ?? fullSearchResults[0];
        if (window.matchMedia('(max-width: 768px)').matches && firstResult) openSearchResult(firstResult);
        else openFullSearch();
      }
      return;
    }
    if (event.key === 'Escape') {
      setSearchFocused(false);
      resetSearch();
      searchInput.current?.blur();
    }
  };

  const handleDialogSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!fullSearchResults.length) return;
      setSearchActiveIndex((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        return next < 0 ? fullSearchResults.length - 1 : next >= fullSearchResults.length ? 0 : next;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = fullSearchResults[searchActiveIndex] ?? (fullSearchResults.length === 1 ? fullSearchResults[0] : undefined);
      if (selected) openSearchResult(selected);
    }
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
          <span className="sidebar-brand-copy"><strong>{APP_NAME}</strong></span>
          <button type="button" className="drawer-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <nav className="sidebar-navigation">
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
          <button type="button" className={`sidebar-item ${activeView === 'settings' ? 'active' : ''}`} aria-current={activeView === 'settings' ? 'page' : undefined} title={activeView === 'settings' ? 'Back to workspace' : 'Settings'} onClick={handleSettingsTrigger}>
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
            <div><h1>{titles[activeView]}</h1></div>
          </div>
          <div className="topbar-search-wrap" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSearchFocused(false);
              window.setTimeout(() => {
                if (!searchOpening.current && !document.querySelector('.modal-card.search-modal')) resetSearch();
              }, 0);
            }
          }}>
            <div className={`topbar-search ${!searchOpen ? 'search-transition-source' : ''}`} role="search">
              <Search size={17} />
              <input
                ref={searchInput}
                type="text"
                role="combobox"
                aria-label="Search workspace"
                aria-autocomplete="list"
                aria-expanded={searchFocused && searchSuggestions.length > 0}
                aria-controls="workspace-search-suggestions"
                aria-activedescendant={searchActiveIndex >= 0 ? `workspace-search-result-${searchActiveIndex}` : undefined}
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(event) => { setSearchQuery(event.target.value); setSearchFocused(true); setSearchActiveIndex(-1); }}
                onKeyDown={handleInlineSearchKeyDown}
                placeholder="Search modules and actions..."
              />
              <span className="shortcut"><kbd>Ctrl</kbd><b>+</b><kbd>K</kbd></span>
            </div>
            {searchFocused && searchQuery.trim() && !searchOpen && (searchLoading || searchSuggestions.length > 0) && (
              <div className="search-suggestions" id="workspace-search-suggestions" role="listbox">
                {searchLoading && <div className="search-suggestion-status">Searching workspace...</div>}
                {!searchLoading && searchSuggestions.map((item, index) => {
                  const Icon = item.icon;
                  return <button key={item.key} id={`workspace-search-result-${index}`} type="button" role="option" aria-selected={searchActiveIndex === index} className={`search-suggestion ${searchActiveIndex === index ? 'active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(item)}><span><Icon size={17} /></span><span><strong>{item.label}</strong><small>{item.hint}</small></span><em>{item.type}</em></button>;
                })}
                {!searchLoading && searchHasMore && <button type="button" className="search-more" onMouseDown={(event) => event.preventDefault()} onClick={openFullSearch}>Press Enter for more results <span>↵</span></button>}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <button type="button" className="topbar-icon theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}>
              {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button type="button" className={`topbar-icon notification-trigger ${notificationsOpen ? 'selected' : ''}`} onClick={() => setNotificationsOpen((open) => !open)} aria-label={`${unreadCount} unread notifications`}>
              <Bell size={19} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            <button type="button" className={`topbar-icon ${activeView === 'settings' ? 'selected' : ''}`} onClick={handleSettingsTrigger} aria-label={activeView === 'settings' ? 'Back to workspace' : 'Settings'}><Settings size={19} /></button>
          </div>
        </header>
        <main className={`workspace-content ${activeView === 'settings' ? 'settings-workspace-content' : ''}`} key={activeView}>{children}</main>
      </div>

      <button type="button" className={`action-center-overlay ${notificationsOpen ? 'open' : ''}`} aria-label="Close notifications" tabIndex={notificationsOpen ? 0 : -1} onClick={() => setNotificationsOpen(false)} />
      <aside className={`action-center ${notificationsOpen ? 'open' : ''}`} aria-hidden={!notificationsOpen} inert={!notificationsOpen}>
        <header className="action-center-header">
          <button type="button" className="action-center-mobile-back" onClick={() => setNotificationsOpen(false)} aria-label="Back"><ArrowLeft size={19} /></button>
          <div className="action-center-title"><span>Action center</span><h2>Notifications</h2></div>
          <div className="action-center-actions">
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

      <Modal open={searchOpen} title="Search workspace" eyebrow="Quick navigation" className="search-modal" onClose={closeFullSearch}>
        <div className="command-search search-transition-target"><Search size={18} /><input ref={searchDialogInput} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchActiveIndex(-1); }} onKeyDown={handleDialogSearchKeyDown} placeholder="Find a module..." aria-label="Search modules" /></div>
        <div className="command-results">
          {fullSearchResults.length === 0 && <p className="compact-empty"><Activity size={18} /> No matching module.</p>}
          {fullSearchResults.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.key} type="button" className={searchActiveIndex === index ? 'active' : ''} onClick={() => openSearchResult(item)}><span><Icon size={18} /></span><span><strong>{item.label}</strong><small>{item.hint}</small></span><ChevronRight size={16} /></button>;
          })}
        </div>
      </Modal>
    </div>
  );
}
