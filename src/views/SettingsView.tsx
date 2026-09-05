import { useState } from 'react';
import { Bell, Check, ChevronRight, Monitor, Moon, Palette, Sun, UserRound } from 'lucide-react';
import type { DummyAccount } from '../lib/dummy-accounts';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'teal' | 'slate';
type SettingsCategory = 'profile' | 'appearance' | 'notifications';

interface SettingsViewProps {
  user: DummyAccount;
  theme: ThemeMode;
  accent: Accent;
  onThemeChange: (theme: ThemeMode) => void;
  onAccentChange: (accent: Accent) => void;
}

const categories = [
  { id: 'profile' as const, label: 'Profile', icon: UserRound },
  { id: 'appearance' as const, label: 'Appearance', icon: Palette },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell },
];

export function SettingsView({ user, theme, accent, onThemeChange, onAccentChange }: SettingsViewProps) {
  const [category, setCategory] = useState<SettingsCategory>('profile');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [approvalAlerts, setApprovalAlerts] = useState(true);
  const [billingAlerts, setBillingAlerts] = useState(false);

  return (
    <div className="settings-page">
      <aside className="settings-navigation" aria-label="Settings navigation">
        <div className="settings-nav-heading"><span>Workspace</span><h2>Settings</h2></div>
        {categories.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={category === id ? 'active' : ''} onClick={() => setCategory(id)}>
            <span><Icon size={18} /></span><strong>{label}</strong><ChevronRight size={15} />
          </button>
        ))}
      </aside>

      <section className="settings-content">
        {category === 'profile' && (
          <div className="settings-panel">
            <div className="settings-heading"><span>Personal</span><h2>Profile</h2><p>Your workspace identity.</p></div>
            <div className="profile-summary">
              <span className="profile-avatar large">{user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
              <div><strong>{user.fullName}</strong><span>{user.email}</span></div>
            </div>
            <div className="settings-field-grid">
              <label><span>Display name</span><input value={user.fullName} readOnly /></label>
              <label><span>Email</span><input value={user.email} readOnly /></label>
              <label><span>Workspace</span><input value="DealFlow360 · Team 711" readOnly /></label>
            </div>
          </div>
        )}

        {category === 'appearance' && (
          <div className="settings-panel">
            <div className="settings-heading"><span>Personalise</span><h2>Appearance</h2><p>Choose how the workspace feels.</p></div>
            <div className="setting-group"><h3>Theme</h3><div className="choice-grid">
              {([
                ['light', 'Light', Sun],
                ['dark', 'Dark', Moon],
                ['system', 'System', Monitor],
              ] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" className={theme === value ? 'active' : ''} onClick={() => onThemeChange(value)}>
                  <Icon size={19} /><strong>{label}</strong>{theme === value && <Check size={16} />}
                </button>
              ))}
            </div></div>
            <div className="setting-group"><h3>Accent</h3><div className="accent-grid">
              {(['blue', 'teal', 'slate'] as const).map((value) => (
                <button key={value} type="button" className={accent === value ? 'active' : ''} onClick={() => onAccentChange(value)}>
                  <span className={`accent-swatch ${value}`} /><strong>{value[0].toUpperCase() + value.slice(1)}</strong>{accent === value && <Check size={16} />}
                </button>
              ))}
            </div></div>
          </div>
        )}

        {category === 'notifications' && (
          <div className="settings-panel">
            <div className="settings-heading"><span>Signals</span><h2>Notifications</h2><p>Keep only the alerts that matter.</p></div>
            <div className="toggle-list">
              <ToggleRow label="Email summaries" description="A concise daily deal summary." checked={emailAlerts} onChange={setEmailAlerts} />
              <ToggleRow label="Approval decisions" description="Changes to pending quotations." checked={approvalAlerts} onChange={setApprovalAlerts} />
              <ToggleRow label="Billing updates" description="Invoice and payment status changes." checked={billingAlerts} onChange={setBillingAlerts} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span /></span>
    </label>
  );
}
