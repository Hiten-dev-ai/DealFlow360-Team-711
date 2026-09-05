import { useState } from 'react';
import { ArrowLeft, Bell, Check, ChevronRight, Monitor, Moon, Palette, Sun, UserRound } from 'lucide-react';
import type { DummyAccount } from '../lib/dummy-accounts';
import type { NotificationPreferences } from '../lib/preferences';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'teal' | 'slate';
type SettingsCategory = 'profile' | 'appearance' | 'notifications';

interface SettingsViewProps {
  user: DummyAccount;
  theme: ThemeMode;
  accent: Accent;
  notificationPreferences: NotificationPreferences;
  onBack: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: Accent) => void;
  onNotificationPreferencesChange: (next: Partial<NotificationPreferences>) => void;
}

const categoryGroups = [
  {
    label: 'Personal',
    items: [
      { id: 'profile' as const, label: 'Profile', detail: 'Identity and workspace', icon: UserRound },
      { id: 'notifications' as const, label: 'Notifications', detail: 'Alerts and sound', icon: Bell },
    ],
  },
  {
    label: 'Personalise',
    items: [{ id: 'appearance' as const, label: 'Appearance', detail: 'Theme and colour', icon: Palette }],
  },
];

const categoryLabels: Record<SettingsCategory, string> = {
  profile: 'Profile',
  notifications: 'Notifications',
  appearance: 'Appearance',
};

export function SettingsView({
  user,
  theme,
  accent,
  notificationPreferences,
  onBack,
  onThemeChange,
  onAccentChange,
  onNotificationPreferencesChange,
}: SettingsViewProps) {
  const [category, setCategory] = useState<SettingsCategory>('profile');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const openCategory = (next: SettingsCategory) => {
    setCategory(next);
    setMobileDetailOpen(true);
  };

  return (
    <div className="settings-page">
      <div className="settings-mobile-breadcrumb" aria-label="Settings navigation">
        <button type="button" className="settings-mobile-back" onClick={mobileDetailOpen ? () => setMobileDetailOpen(false) : onBack}>
          <ArrowLeft size={16} /><span>Back</span>
        </button>
        <span>Settings</span>
        {mobileDetailOpen && <><ChevronRight size={14} /><strong>{categoryLabels[category]}</strong></>}
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
                    <button key={id} type="button" className={category === id ? 'active' : ''} onClick={() => openCategory(id)}>
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
        </section>
      </div>
    </div>
  );
}

function SettingsHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="settings-heading"><span>{eyebrow}</span><h2>{title}</h2></div>;
}

function ProfileSettings({ user }: { user: DummyAccount }) {
  return <div className="settings-panel"><SettingsHeader eyebrow="Personal" title="Profile" /><div className="settings-card"><div className="profile-summary"><span className="profile-avatar large">{user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{user.fullName}</strong><span>{user.email}</span></div></div><div className="settings-field-grid"><label><span>Display name</span><input value={user.fullName} readOnly /></label><label><span>Email</span><input value={user.email} readOnly /></label><label><span>Workspace</span><input value="DealFlow360 · Team 711" readOnly /></label></div></div></div>;
}

function AppearanceSettings({ theme, accent, onThemeChange, onAccentChange }: { theme: ThemeMode; accent: Accent; onThemeChange: (theme: ThemeMode) => void; onAccentChange: (accent: Accent) => void }) {
  return <div className="settings-panel"><SettingsHeader eyebrow="Personalise" title="Appearance" /><div className="settings-card"><div className="setting-group"><h3>Accent colour</h3><div className="accent-grid">{(['blue', 'teal', 'slate'] as const).map((value) => <button key={value} type="button" className={accent === value ? 'active' : ''} onClick={() => onAccentChange(value)}><span className={`accent-swatch ${value}`} /><strong>{value === 'blue' ? 'Blue' : value === 'teal' ? 'Teal' : 'Slate'}</strong>{accent === value && <Check size={16} />}</button>)}</div></div><div className="setting-group"><h3>Theme</h3><div className="choice-grid">{([['dark', 'Dark mode', Moon], ['light', 'Light mode', Sun], ['system', 'System', Monitor]] as const).map(([value, label, Icon]) => <button key={value} type="button" className={theme === value ? 'active' : ''} onClick={() => onThemeChange(value)}><Icon size={19} /><strong>{label}</strong>{theme === value && <Check size={16} />}</button>)}</div></div></div></div>;
}

function NotificationSettings({ preferences, onChange }: { preferences: NotificationPreferences; onChange: (next: Partial<NotificationPreferences>) => void }) {
  return <div className="settings-panel"><SettingsHeader eyebrow="Personal" title="Notifications" /><div className="settings-card"><div className="setting-group"><h3>Delivery</h3><div className="toggle-list"><ToggleRow label="Desktop banner alerts" description="Show banners" checked={preferences.desktopAlerts} onChange={(desktopAlerts) => onChange({ desktopAlerts })} /><ToggleRow label="Sound notifications" description="Play alert sounds" checked={preferences.soundAlerts} onChange={(soundAlerts) => onChange({ soundAlerts })} /><ToggleRow label="Priority-only mode" description="Only high-priority alerts" checked={preferences.priorityOnly} onChange={(priorityOnly) => onChange({ priorityOnly })} /></div></div></div></div>;
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle-switch ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)}><span /></button></div>;
}
