import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Filter,
  MailPlus,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { CustomSelect, type SelectOption } from "../components/ui/CustomSelect";
import { Modal } from "../components/ui/Modal";
import { mutate, type Role, type SessionUser } from "../lib/api";
import { useWorkspace } from "../lib/workspace";
import { showToast } from "../components/ui/ToastViewport";

type Row = Record<string, unknown>;

const roleLabel: Record<Role, string> = {
  admin: "Admin",
  sales_rep: "Sales Rep",
  sales_manager: "Sales Manager",
  finance_ops: "Finance / Ops",
};

const roleOptions: SelectOption[] = Object.entries(roleLabel).map(([value, label]) => ({ value, label }));
const teamFilterOptions: SelectOption[] = [
  { value: "all", label: "All teams" },
  { value: "managed", label: "Manager assigned" },
  { value: "unmanaged", label: "Needs manager" },
];

export function TeamsView({ user, focusId, focusRequest }: { user: SessionUser; focusId?: string | null; focusRequest?: number }) {
  const { data, connection, run } = useWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const selectedTeam = data.teams.find((team) => String(team.id) === selectedTeamId);
  useEffect(() => {
    if (focusId && data.teams.some((team) => String(team.id) === focusId)) setSelectedTeamId(focusId);
  }, [data.teams, focusId, focusRequest]);
  const filteredTeams = useMemo(() => data.teams.filter((team) => {
    const members = (team.members as Row[]) ?? [];
    const matchesQuery = `${String(team.name)} ${members.map((member) => `${member.fullName} ${member.email}`).join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "managed" ? Boolean(team.managerUserId) : !team.managerUserId);
    return matchesQuery && matchesFilter;
  }), [data.teams, filter, query]);
  const totalPeople = data.teams.reduce((sum, team) => sum + (((team.members as Row[]) ?? []).length), 0);
  const managersAssigned = data.teams.filter((team) => Boolean(team.managerUserId)).length;

  const execute = async (operation: () => Promise<unknown>, fallback: string) => {
    setError("");
    try {
      await run(operation);
      showToast("Team changes saved.", "success");
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : fallback;
      setError(message);
      showToast(message, "error");
      return false;
    }
  };

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await execute(() => mutate("/api/admin/teams", "POST", { name: form.get("name") }), "Could not create team.");
    if (created) setCreateOpen(false);
  };

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const response = await run(() => mutate<{ data: { link: string; delivered: boolean } }>("/api/invitations", "POST", {
        fullName: form.get("fullName"),
        email: form.get("email"),
        role: form.get("role"),
        teamId: form.get("teamId") || null,
      }));
      setResult(response.data.delivered ? "Invitation sent." : response.data.link);
      showToast(response.data.delivered ? "Invitation sent." : "Invitation link created.", "success");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not invite user.";
      setError(message);
      showToast(message, "error");
    }
  };

  const teamOptions: SelectOption[] = [
    { value: "", label: "No team" },
    ...data.teams.map((team) => ({ value: String(team.id), label: String(team.name) })),
  ];

  if (selectedTeam) {
    return (
      <TeamWorkspace
        key={`${selectedTeam.id}-${selectedTeam.version}`}
        team={selectedTeam}
        user={user}
        connection={connection}
        error={error}
        onBack={() => { setSelectedTeamId(null); setError(""); }}
        onInvite={() => { setInviteTeamId(String(selectedTeam.id)); setInviteOpen(true); }}
        execute={execute}
      >
        <InviteModal
          open={inviteOpen}
          result={result}
          error={error}
          teamOptions={teamOptions}
          teamId={inviteTeamId}
          onTeamChange={setInviteTeamId}
          onClose={() => { setInviteOpen(false); setResult(""); setError(""); }}
          onSubmit={invite}
        />
      </TeamWorkspace>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-actions-row">
        <div className="modal-actions team-page-actions">
          <button type="button" className="secondary-action" disabled={connection !== "online"} onClick={() => setCreateOpen(true)}><Plus size={16} /> Team</button>
          <button type="button" className="primary-action" disabled={connection !== "online"} onClick={() => { setInviteTeamId(""); setInviteOpen(true); }}><MailPlus size={16} /> Invite</button>
        </div>
      </section>

      <section className="team-hierarchy-overview" aria-label="Company hierarchy">
        <div><span>Company</span><strong>DealFlow360</strong></div>
        <ChevronRight size={18} />
        <div><span>Sales teams</span><strong>{data.teams.length}</strong></div>
        <ChevronRight size={18} />
        <div><span>People</span><strong>{totalPeople}</strong></div>
        <div className={managersAssigned === data.teams.length ? "complete" : "warning"}><span>Managers</span><strong>{managersAssigned}/{data.teams.length}</strong></div>
      </section>

      <div className="data-toolbar standalone-toolbar">
        <label className="toolbar-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams or members" /></label>
        <CustomSelect className="toolbar-custom-select" ariaLabel="Filter teams" icon={<Filter size={15} />} options={teamFilterOptions} value={filter} onChange={setFilter} />
        <span className="result-count">{filteredTeams.length} teams</span>
      </div>
      {error && <p className="login-error">{error}</p>}

      <section className="card-grid three-column">
        {filteredTeams.map((team) => {
          const members = (team.members as Row[]) ?? [];
          const manager = members.find((member) => member.id === team.managerUserId);
          return (
            <button type="button" className="work-card team-card-button" key={String(team.id)} onClick={() => setSelectedTeamId(String(team.id))}>
              <header><span className="record-icon"><Users size={18} /></span><span className={`status-pill ${team.managerUserId ? "success" : "warning"}`}>{members.length} members</span></header>
              <div><h3>{String(team.name)}</h3><p>{manager ? `Managed by ${String(manager.fullName)}` : "Manager required"}</p></div>
              <footer><span>Manage team</span><ChevronRight size={16} /></footer>
            </button>
          );
        })}
        {!filteredTeams.length && <div className="inline-empty"><Users size={22} /><strong>No teams found</strong></div>}
      </section>

      <Modal open={createOpen} title="New sales team" eyebrow="Company" onClose={() => { setCreateOpen(false); setError(""); }}>
        <form className="modal-form" onSubmit={createTeam}>
          <label><span>Team name</span><input name="name" required /></label>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="primary-action">Create team</button></div>
        </form>
      </Modal>
      <InviteModal open={inviteOpen} result={result} error={error} teamOptions={teamOptions} teamId={inviteTeamId} onTeamChange={setInviteTeamId} onClose={() => { setInviteOpen(false); setResult(""); setError(""); }} onSubmit={invite} />
    </div>
  );
}

function TeamWorkspace({ team, user, connection, error, onBack, onInvite, execute, children }: {
  team: Row;
  user: SessionUser;
  connection: string;
  error: string;
  onBack: () => void;
  onInvite: () => void;
  execute: (operation: () => Promise<unknown>, fallback: string) => Promise<boolean>;
  children: ReactNode;
}) {
  const members = (team.members as Row[]) ?? [];
  const [name, setName] = useState(String(team.name));
  const managerOptions: SelectOption[] = [
    { value: "", label: "No manager" },
    ...members.filter((member) => member.role === "sales_manager").map((member) => ({ value: String(member.id), label: String(member.fullName) })),
  ];
  const updateTeam = (payload: Row) => execute(() => mutate(`/api/admin/teams/${team.id}`, "PATCH", { ...payload, expectedVersion: Number(team.version) }), "Could not update team.");

  return (
    <div className="page-stack team-detail-page">
      <button type="button" className="mobile-page-back" onClick={onBack}><ArrowLeft size={16} /> Back to teams</button>
      <section className="page-heading">
        <div><h2>{String(team.name)}</h2></div>
        <button type="button" className="primary-action" disabled={connection !== "online"} onClick={onInvite}><MailPlus size={16} /> Invite member</button>
      </section>
      {error && <p className="login-error">{error}</p>}
      <section className="team-admin-grid">
        <div className="settings-card team-configuration-card">
          <div className="setting-group"><h3>Team details</h3><label className="team-edit-field"><span>Name</span><div><input value={name} onChange={(event) => setName(event.target.value)} /><button type="button" className="secondary-action" disabled={connection !== "online" || name.trim() === String(team.name)} onClick={() => void updateTeam({ name: name.trim() })}><Save size={15} /> Save</button></div></label></div>
          <div className="setting-group"><h3>Approval manager</h3><CustomSelect ariaLabel="Approval manager" options={managerOptions} value={String(team.managerUserId ?? "")} disabled={connection !== "online"} onChange={(managerUserId) => void updateTeam({ managerUserId: managerUserId || null })} /></div>
          <div className="setting-group danger-zone"><h3>Delete team</h3><p>Available after all members and quotations are moved.</p><button type="button" className="danger-action" disabled={connection !== "online" || members.length > 0} onClick={() => void execute(() => mutate(`/api/admin/teams/${team.id}`, "DELETE", { expectedVersion: Number(team.version) }), "Could not delete team.")}><Trash2 size={15} /> Delete team</button></div>
        </div>
        <div className="settings-card team-members-card">
          <div className="setting-group"><h3>Members</h3><div className="team-member-admin-list">
            {members.map((member) => (
              <article key={String(member.id)}>
                <i>{String(member.fullName).split(" ").map((part) => part[0]).join("").slice(0, 2)}</i>
                <span><strong>{String(member.fullName)}</strong><small>{String(member.email)}</small></span>
                <CustomSelect ariaLabel={`Role for ${String(member.fullName)}`} options={roleOptions} value={String(member.role)} disabled={connection !== "online" || member.id === user.id} onChange={(role) => void execute(() => mutate(`/api/admin/teams/${team.id}/members/${member.id}`, "PATCH", { role }), "Could not update member.")} />
                <button type="button" className="icon-control danger-icon" aria-label={`Remove ${String(member.fullName)} from team`} disabled={connection !== "online" || member.id === user.id} onClick={() => void execute(() => mutate(`/api/admin/teams/${team.id}/members/${member.id}`, "DELETE"), "Could not remove member.")}><UserMinus size={16} /></button>
                {member.id === team.managerUserId && <span className="manager-chip"><ShieldCheck size={13} /> Manager</span>}
              </article>
            ))}
          </div></div>
        </div>
      </section>
      {children}
    </div>
  );
}

function InviteModal({ open, result, error, teamOptions, teamId, onTeamChange, onClose, onSubmit }: {
  open: boolean;
  result: string;
  error: string;
  teamOptions: SelectOption[];
  teamId: string;
  onTeamChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <Modal open={open} title="Invite staff" eyebrow="Access" onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label><span>Name</span><input name="fullName" required /></label>
    <label><span>Email</span><input name="email" type="email" required /></label>
    <label><span>Role</span><CustomSelect name="role" ariaLabel="Role" defaultValue="sales_rep" options={roleOptions} /></label>
    <label><span>Team</span><CustomSelect name="teamId" ariaLabel="Team" options={teamOptions} value={teamId} onChange={onTeamChange} /></label>
    {result && <div className="form-note"><span className="portal-link-text">{result}</span></div>}
    {error && <p className="login-error">{error}</p>}
    <div className="modal-actions"><button type="button" className="secondary-action" onClick={onClose}>Close</button><button type="submit" className="primary-action">Send invitation</button></div>
  </form></Modal>;
}
