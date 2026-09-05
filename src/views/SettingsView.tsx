import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Bell, Check, ChevronRight, LockKeyhole, Monitor, Moon, Palette, Server, Sun, UserRound } from 'lucide-react';
import { apiFetch, mutate, type SessionUser } from '../lib/api';
import type { NotificationPreferences } from '../lib/preferences';
import { useWorkspace } from '../lib/workspace';
import { showToast } from '../components/ui/ToastViewport';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'green' | 'amber' | 'violet';
export type SettingsCategory = 'profile' | 'appearance' | 'notifications' | 'environment';

interface SettingsViewProps {
  user: SessionUser;
  theme: ThemeMode;
  accent: Accent;
  notificationPreferences: NotificationPreferences;
  initialCategory?: SettingsCategory | null;
  onBack: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: Accent) => void;
  onNotificationPreferencesChange: (next: Partial<NotificationPreferences>) => void;
}

const personalCategoryGroups = [
  {
    label: 'Personal',
    items: [
      { id: 'profile' as const, label: 'Profile', detail: 'Account and workspace', icon: UserRound },
      { id: 'notifications' as const, label: 'Notifications', detail: 'Approvals and deal alerts', icon: Bell },
    ],
  },
  {
    label: 'Personalise',
    items: [{ id: 'appearance' as const, label: 'Appearance', detail: 'Workspace theme', icon: Palette }],
  },
];

const categoryLabels: Record<SettingsCategory, string> = {
  profile: 'Profile',
  notifications: 'Notifications',
  appearance: 'Appearance',
  environment: 'Environment',
};

export function SettingsView({
  user,
  theme,
  accent,
  notificationPreferences,
  initialCategory,
  onBack,
  onThemeChange,
  onAccentChange,
  onNotificationPreferencesChange,
}: SettingsViewProps) {
  const isPhone = window.matchMedia('(max-width: 768px)').matches;
  const [category, setCategory] = useState<SettingsCategory>(initialCategory ?? 'profile');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() => (
    isPhone && initialCategory != null
  ));

  useEffect(() => {
    setCategory(initialCategory ?? 'profile');
    setMobileDetailOpen(isPhone && initialCategory != null);
  }, [initialCategory, isPhone]);

  const openCategory = (next: SettingsCategory) => {
    setCategory(next);
    setMobileDetailOpen(true);
  };
  const categoryGroups = user.activeRole === 'admin'
    ? [...personalCategoryGroups, { label: 'Server', items: [{ id: 'environment' as const, label: 'Environment', detail: 'SMTP delivery', icon: Server }] }]
    : personalCategoryGroups;

  return (
    <div className="settings-page">
      <div className="settings-mobile-header">
        <button type="button" className="settings-mobile-back" aria-label={mobileDetailOpen ? 'Back to settings categories' : 'Back to workspace'} onClick={mobileDetailOpen ? () => setMobileDetailOpen(false) : onBack}>
          <ArrowLeft size={16} /><span>Back</span>
        </button>
        <div className="settings-mobile-breadcrumb" aria-label="Settings navigation">
          <span>Settings</span>
          {mobileDetailOpen && <><ChevronRight size={14} /><strong>{categoryLabels[category]}</strong></>}
        </div>
      </div>

      <div className="settings-layout">
        <aside className={`settings-navigation ${mobileDetailOpen ? 'settings-mobile-panel-hidden' : ''}`} aria-label="Settings categories">
          <div className="settings-nav-heading">
            <button type="button" className="settings-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          </div>
          <div className="settings-category-list">
            {categoryGroups.map((group) => (
              <section className="settings-category-group" key={group.label}>
                <p>{group.label}</p>
                <div>
                  {group.items.map(({ id, label, detail, icon: Icon }) => (
                    <button key={id} type="button" className={category === id && (mobileDetailOpen || !isPhone) ? 'active' : ''} onClick={() => openCategory(id)}>
                      <span><Icon size={18} /></span>
                      <span><strong>{label}</strong><small>{detail}</small></span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <section key={`${category}-${mobileDetailOpen}`} className={`settings-content ${!mobileDetailOpen ? 'settings-mobile-panel-hidden' : ''}`} aria-label={`${categoryLabels[category]} settings`}>
          {category === 'profile' && <ProfileSettings user={user} />}
          {category === 'appearance' && <AppearanceSettings theme={theme} accent={accent} onThemeChange={onThemeChange} onAccentChange={onAccentChange} />}
          {category === 'notifications' && <NotificationSettings preferences={notificationPreferences} onChange={onNotificationPreferencesChange} />}
          {category === 'environment' && user.activeRole === 'admin' && <EnvironmentSettings />}
        </section>
      </div>
    </div>
  );
}

function SettingsHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="settings-heading"><span>{eyebrow}</span><h2>{title}</h2></div>;
}

function ProfileSettings({ user }: { user: SessionUser }) {
  return <div className="settings-panel"><SettingsHeader eyebrow="Deal workspace" title="Profile" /><div className="settings-card"><div className="profile-summary"><span className="profile-avatar large">{user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{user.fullName}</strong><span>{user.email}</span></div></div><div className="settings-field-grid"><label><span>Display name</span><input value={user.fullName} readOnly /></label><label><span>Email</span><input value={user.email} readOnly /></label><label><span>Workspace</span><input value="DealFlow360 / Team 711" readOnly /></label></div></div></div>;
}

function AppearanceSettings({ theme, accent, onThemeChange, onAccentChange }: { theme: ThemeMode; accent: Accent; onThemeChange: (theme: ThemeMode) => void; onAccentChange: (accent: Accent) => void }) {
  return <div className="settings-panel"><SettingsHeader eyebrow="Workspace" title="Appearance" /><div className="settings-card"><div className="setting-group"><h3>Deal colour</h3><div className="accent-grid">{(['blue', 'green', 'amber', 'violet'] as const).map((value) => <button key={value} type="button" className={accent === value ? 'active' : ''} onClick={() => onAccentChange(value)}><span className={`accent-swatch ${value}`} /><strong>{value[0].toUpperCase() + value.slice(1)}</strong>{accent === value && <Check size={16} />}</button>)}</div></div><div className="setting-group"><h3>Theme</h3><div className="choice-grid">{([['dark', 'Dark mode', Moon], ['light', 'Light mode', Sun], ['system', 'System', Monitor]] as const).map(([value, label, Icon]) => <button key={value} type="button" className={theme === value ? 'active' : ''} onClick={() => onThemeChange(value)}><Icon size={19} /><strong>{label}</strong>{theme === value && <Check size={16} />}</button>)}</div></div></div></div>;
}

function NotificationSettings({ preferences, onChange }: { preferences: NotificationPreferences; onChange: (next: Partial<NotificationPreferences>) => void }) {
  return <div className="settings-panel"><SettingsHeader eyebrow="Deal alerts" title="Notifications" /><div className="settings-card"><div className="setting-group"><h3>Delivery</h3><div className="toggle-list"><ToggleRow label="Desktop alerts" description="Show deal updates" checked={preferences.desktopAlerts} onChange={(desktopAlerts) => onChange({ desktopAlerts })} /><ToggleRow label="Alert sounds" description="Sound for urgent events" checked={preferences.soundAlerts} onChange={(soundAlerts) => onChange({ soundAlerts })} /><ToggleRow label="Priority only" description="Approvals and risks only" checked={preferences.priorityOnly} onChange={(priorityOnly) => onChange({ priorityOnly })} /></div></div></div></div>;
}

interface EnvironmentState {
  smtpConfigured: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpUsername: string;
  smtpSecure: boolean;
  smtpHasPassword: boolean;
  source: 'workspace' | 'server' | 'none';
  mailFrom: string;
  version: number;
  updatedAt: string | null;
  encryptionReady: boolean;
}

function EnvironmentSettings() {
  const { connection, run } = useWorkspace();
  const [environment, setEnvironment] = useState<EnvironmentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ data: EnvironmentState }>('/api/admin/environment');
      setEnvironment(response.data);
      setSmtpSecure(response.data.smtpSecure);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load environment settings.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const smtpHost = String(form.get('smtpHost') ?? '').trim();
    const smtpPort = Number(form.get('smtpPort'));
    const smtpUsername = String(form.get('smtpUsername') ?? '').trim();
    const smtpPassword = String(form.get('smtpPassword') ?? '');
    const mailFrom = String(form.get('mailFrom') ?? '').trim();
    setError('');
    setMessage('');
    try {
      const response = await run(() => mutate<{ data: EnvironmentState }>('/api/admin/environment', 'PATCH', { smtpHost, smtpPort, smtpUsername, ...(smtpPassword ? { smtpPassword } : {}), smtpSecure, mailFrom }));
      setEnvironment(response.data);
      setMessage('Environment saved.');
      showToast('SMTP environment saved.', 'success');
      const passwordInput = formElement.elements.namedItem('smtpPassword') as HTMLInputElement | null;
      if (passwordInput) passwordInput.value = '';
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : 'Could not save environment.';
      setError(nextError);
      showToast(nextError, 'error');
    }
  };
  const disable = async () => {
    setError('');
    setMessage('');
    try {
      const response = await run(() => mutate<{ data: EnvironmentState }>('/api/admin/environment', 'PATCH', { clearSmtp: true }));
      setEnvironment(response.data);
      setMessage('Workspace SMTP disabled.');
      showToast('Workspace SMTP disabled.', 'warning');
    } catch (caught) {
      const nextError = caught instanceof Error ? caught.message : 'Could not disable SMTP.';
      setError(nextError);
      showToast(nextError, 'error');
    }
  };
  return <div className="settings-panel environment-settings">
    <SettingsHeader eyebrow="Server" title="Environment" />
    <div className="settings-card">
      <div className="environment-status">
        <span className={`environment-status-icon ${environment?.smtpConfigured ? 'ready' : ''}`}><Server size={19} /></span>
        <span><strong>{loading ? 'Checking SMTP' : environment?.smtpConfigured ? 'SMTP configured' : 'Copy-link mode'}</strong><small>{environment?.smtpHost ?? 'Customer links are copied manually'}</small></span>
        <span className={`status-pill ${environment?.smtpConfigured ? 'success' : 'warning'}`}>{environment?.source ?? 'none'}</span>
      </div>
      <form className="modal-form" key={`${environment?.source ?? 'loading'}-${environment?.version ?? 0}`} onSubmit={save}>
        <div className="form-columns">
          <label><span>SMTP host</span><input name="smtpHost" defaultValue={environment?.smtpHost ?? ''} autoComplete="off" placeholder="smtp.example.com" required /></label>
          <label><span>Port</span><input name="smtpPort" type="number" min="1" max="65535" defaultValue={environment?.smtpPort ?? 465} required /></label>
        </div>
        <div className="form-columns">
          <label><span>Username</span><input name="smtpUsername" defaultValue={environment?.smtpUsername ?? ''} autoComplete="username" placeholder="mailer@example.com" /></label>
          <label><span>Password</span><input name="smtpPassword" type="password" autoComplete="new-password" placeholder={environment?.smtpHasPassword ? 'Leave blank to keep current' : 'SMTP password'} /></label>
        </div>
        <ToggleRow label="Secure connection" description="Use implicit TLS (SMTPS)" checked={smtpSecure} onChange={setSmtpSecure} />
        <label><span>Sender</span><input name="mailFrom" defaultValue={environment?.mailFrom ?? ''} placeholder="DealFlow360 <sales@example.com>" required /></label>
        <div className="form-note"><LockKeyhole size={16} /><span>Credentials are encrypted and never returned to the browser.</span></div>
        {message && <p className="settings-success">{message}</p>}
        {error && <p className="login-error">{error}</p>}
        <div className="modal-actions split"><button type="button" className="secondary-action" disabled={connection !== 'online' || !environment?.smtpConfigured} onClick={() => void disable()}>Disable SMTP</button><button type="submit" className="primary-action" disabled={connection !== 'online' || !environment?.encryptionReady}>Save environment</button></div>
      </form>
    </div>
  </div>;
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle-switch ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)}><span /></button></div>;
}
