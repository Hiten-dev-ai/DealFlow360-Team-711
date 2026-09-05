import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppShell, type AppView } from "./components/layout/AppShell";
import {
  ApiError,
  getBootstrap,
  getSession,
  login,
  logout as apiLogout,
  mutate,
  type BootstrapResponse,
  type SessionUser,
  type WorkspaceData,
} from "./lib/api";
import {
  clearWorkspaceCache,
  loadWorkspaceCache,
  saveWorkspaceCache,
} from "./lib/offline-cache";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "./lib/preferences";
import { WorkspaceProvider, type ConnectionState } from "./lib/workspace";
import { LoginPage } from "./views/LoginPage";
import { OverviewView } from "./views/OverviewView";
import { PwaWelcome, shouldShowPwaWelcome } from "./views/PwaWelcome";
import { CustomerPortal } from "./views/CustomerPortal";
import { ToastViewport } from "./components/ui/ToastViewport";
import { InviteRedeem } from "./views/InviteRedeem";
import { TeamsView } from "./views/TeamsView";
import {
  SettingsView,
  type Accent,
  type SettingsCategory,
  type ThemeMode,
} from "./views/SettingsView";
import {
  ApprovalsView,
  DealHealthView,
  FulfillmentView,
  InvoicesView,
  QuotationsView,
  ReportsView,
  SubscriptionsView,
} from "./views/WorkspaceViews";

const LAST_USER_KEY = "dealflow360.last-user";
const NOTIFICATION_PREFERENCES_KEY = "dealflow360.notification-preferences";
const ACCENTS: readonly Accent[] = ["blue", "green", "amber", "violet"];
const EMPTY_WORKSPACE: WorkspaceData = {
  quotes: [],
  approvals: [],
  fulfillment: [],
  subscriptions: [],
  invoices: [],
  payments: [],
  alerts: [],
  notifications: [],
  teams: [],
  customers: [],
  catalog: [],
  preferences: { theme: "system", accent: "blue" },
};

function loadAccent(): Accent {
  const saved = localStorage.getItem("dealflow360.accent");
  return ACCENTS.includes(saved as Accent) ? (saved as Accent) : "blue";
}

function storedUser() {
  try {
    return JSON.parse(
      localStorage.getItem(LAST_USER_KEY) ?? "null",
    ) as SessionUser | null;
  } catch {
    return null;
  }
}

export default function App() {
  if (location.pathname === "/portal") return <><CustomerPortal /><ToastViewport /></>;
  if (location.pathname === "/invite") return <InviteRedeem />;
  const [showPwaWelcome, setShowPwaWelcome] = useState(shouldShowPwaWelcome);
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [workspace, setWorkspace] = useState<BootstrapResponse | null>(null);
  const [connection, setConnection] = useState<ConnectionState>(
    navigator.onLine ? "syncing" : "offline",
  );
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [lastWorkspaceView, setLastWorkspaceView] =
    useState<AppView>("dashboard");
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategory | null>(null);
  const [recordTarget, setRecordTarget] = useState<{ view: AppView; id: string; request: number } | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(
    () =>
      (localStorage.getItem("dealflow360.theme") as ThemeMode | null) ?? "dark",
  );
  const [accent, setAccent] = useState<Accent>(loadAccent);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(() => {
      try {
        return {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...JSON.parse(
            localStorage.getItem(NOTIFICATION_PREFERENCES_KEY) ?? "{}",
          ),
        };
      } catch {
        return DEFAULT_NOTIFICATION_PREFERENCES;
      }
    });

  const resolvedTheme: "light" | "dark" =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme;

  const loadWorkspace = useCallback(async (currentUser: SessionUser) => {
    setConnection("syncing");
    try {
      const next = await getBootstrap();
      setWorkspace(next);
      await saveWorkspaceCache(currentUser, next);
      setConnection("online");
      if (next.data.preferences.theme)
        setTheme(next.data.preferences.theme as ThemeMode);
      if (ACCENTS.includes(next.data.preferences.accent as Accent))
        setAccent(next.data.preferences.accent as Accent);
      setNotificationPreferences((current) => ({
        ...current,
        ...next.data.preferences,
      }));
    } catch (error) {
      const cached = await loadWorkspaceCache(currentUser);
      if (cached) setWorkspace(cached);
      setConnection(navigator.onLine ? "degraded" : "offline");
      if (!cached) throw error;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const current = await getSession();
        if (!alive) return;
        setUser(current);
        localStorage.setItem(LAST_USER_KEY, JSON.stringify(current));
        await loadWorkspace(current);
      } catch (error) {
        if (!alive) return;
        const cachedUser = storedUser();
        if (!(error instanceof ApiError) && cachedUser) {
          const cached = await loadWorkspaceCache(cachedUser);
          if (cached) {
            setUser(cachedUser);
            setWorkspace(cached);
            setConnection("offline");
          }
        } else if (error instanceof ApiError && error.status === 401)
          localStorage.removeItem(LAST_USER_KEY);
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadWorkspace]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem("dealflow360.theme", theme);
    localStorage.setItem("dealflow360.accent", accent);
  }, [theme, resolvedTheme, accent]);
  useEffect(
    () =>
      localStorage.setItem(
        NOTIFICATION_PREFERENCES_KEY,
        JSON.stringify(notificationPreferences),
      ),
    [notificationPreferences],
  );

  useEffect(() => {
    if (!user || connection === "offline") return;
    let timer: number | undefined;
    let interval: number | undefined;
    let source: EventSource | undefined;
    const refreshSoon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadWorkspace(user), 250);
    };
    try {
      source = new EventSource(
        `/api/events?cursor=${workspace?.sync.cursor ?? 0}`,
      );
      source.addEventListener("change", refreshSoon);
      source.onerror = () => {
        source?.close();
        interval ??= window.setInterval(refreshSoon, 5000);
      };
    } catch {
      interval = window.setInterval(refreshSoon, 5000);
    }
    return () => {
      source?.close();
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [connection, loadWorkspace, user, workspace?.sync.cursor]);

  useEffect(() => {
    const online = () => {
      if (user) void loadWorkspace(user);
    };
    const offline = () => setConnection("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [loadWorkspace, user]);

  const authenticate = async (email: string, password: string) => {
    const current = await login(email, password);
    setUser(current);
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(current));
    await loadWorkspace(current);
  };
  const logout = async () => {
    const current = user;
    try {
      if (connection !== "offline") await apiLogout();
    } finally {
      if (current) await clearWorkspaceCache(current);
      localStorage.removeItem(LAST_USER_KEY);
      setWorkspace(null);
      setUser(null);
      setActiveView("dashboard");
    }
  };
  const navigate = (view: AppView, nextSettingsCategory?: SettingsCategory, recordId?: string) => {
    if (view === "settings" && activeView !== "settings")
      setLastWorkspaceView(activeView);
    setSettingsCategory(nextSettingsCategory ?? null);
    setRecordTarget(recordId ? { view, id: recordId, request: Date.now() } : null);
    setActiveView(view);
  };
  const updateNotificationPreferences = (
    next: Partial<NotificationPreferences>,
  ) => {
    setNotificationPreferences((current) => ({ ...current, ...next }));
    if (connection === "online") void mutate("/api/preferences", "PATCH", next);
  };
  const updateTheme = (next: ThemeMode) => {
    setTheme(next);
    if (connection === "online")
      void mutate("/api/preferences", "PATCH", { theme: next });
  };
  const updateAccent = (next: Accent) => {
    setAccent(next);
    if (connection === "online")
      void mutate("/api/preferences", "PATCH", { accent: next });
  };

  const context = useMemo(
    () => ({
      data: workspace?.data ?? EMPTY_WORKSPACE,
      role: user?.activeRole ?? "sales_rep",
      connection,
      syncedAt: workspace?.sync.syncedAt ?? null,
      refresh: async () => {
        if (user) await loadWorkspace(user);
      },
      run: async <T,>(operation: () => Promise<T>) => {
        if (connection !== "online")
          throw new Error("Reconnect to make changes.");
        const result = await operation();
        if (user) await loadWorkspace(user);
        return result;
      },
    }),
    [connection, loadWorkspace, user, workspace],
  );

  if (showPwaWelcome)
    return <PwaWelcome onContinue={() => setShowPwaWelcome(false)} />;
  if (booting)
    return (
      <main className="app-loading">
        <span className="sidebar-logo">D</span>
        <p>Opening workspace…</p>
      </main>
    );
  if (!user) return <LoginPage onAuthenticated={authenticate} />;

  const views: Record<AppView, ReactNode> = {
    dashboard: <OverviewView onNavigate={navigate} />,
    quotations: <QuotationsView focusId={recordTarget?.view === "quotations" ? recordTarget.id : null} focusRequest={recordTarget?.request} />,
    approvals: <ApprovalsView focusId={recordTarget?.view === "approvals" ? recordTarget.id : null} focusRequest={recordTarget?.request} />,
    fulfillment: <FulfillmentView />,
    subscriptions: <SubscriptionsView />,
    invoices: <InvoicesView focusId={recordTarget?.view === "invoices" ? recordTarget.id : null} focusRequest={recordTarget?.request} />,
    health: <DealHealthView focusId={recordTarget?.view === "health" ? recordTarget.id : null} focusRequest={recordTarget?.request} />,
    reports: <ReportsView />,
    teams: <TeamsView user={user} focusId={recordTarget?.view === "teams" ? recordTarget.id : null} focusRequest={recordTarget?.request} />,
    settings: (
      <SettingsView
        user={user}
        theme={theme}
        accent={accent}
        initialCategory={settingsCategory}
        notificationPreferences={notificationPreferences}
        onBack={() => navigate(lastWorkspaceView)}
        onThemeChange={updateTheme}
        onAccentChange={updateAccent}
        onNotificationPreferencesChange={updateNotificationPreferences}
      />
    ),
  };

  return (
    <WorkspaceProvider value={context}>
      <AppShell
        activeView={activeView}
        user={user}
        resolvedTheme={resolvedTheme}
        notificationPreferences={notificationPreferences}
        connection={connection}
        syncedAt={workspace?.sync.syncedAt ?? null}
        notifications={workspace?.data.notifications ?? []}
        onNavigate={navigate}
        onSettingsBack={() => navigate(lastWorkspaceView)}
        onToggleTheme={() =>
          updateTheme(resolvedTheme === "dark" ? "light" : "dark")
        }
        onNotificationPreferencesChange={updateNotificationPreferences}
        onLogout={logout}
      >
        {views[activeView]}
      </AppShell>
      <ToastViewport />
    </WorkspaceProvider>
  );
}
