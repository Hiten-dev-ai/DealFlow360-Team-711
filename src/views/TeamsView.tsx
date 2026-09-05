import { useState, type FormEvent } from "react";
import { MailPlus, Plus, ShieldCheck, Users } from "lucide-react";
import { CustomSelect, type SelectOption } from "../components/ui/CustomSelect";
import { Modal } from "../components/ui/Modal";
import { mutate, type Role } from "../lib/api";
import { useWorkspace } from "../lib/workspace";

const roleLabel: Record<Role, string> = {
  admin: "Admin",
  sales_rep: "Sales Rep",
  sales_manager: "Sales Manager",
  finance_ops: "Finance / Ops",
};

const roleOptions: SelectOption[] = Object.entries(roleLabel).map(([value, label]) => ({
  value,
  label,
}));

export function TeamsView() {
  const { data, connection, run } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await run(() => mutate("/api/admin/teams", "POST", { name: form.get("name") }));
      setCreateOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create team.");
    }
  };

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const response = await run(() =>
        mutate<{ data: { link: string; delivered: boolean } }>("/api/invitations", "POST", {
          fullName: form.get("fullName"),
          email: form.get("email"),
          role: form.get("role"),
          teamId: form.get("teamId") || null,
        }),
      );
      setResult(response.data.delivered ? "Invitation sent." : response.data.link);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not invite user.");
    }
  };

  const teamOptions: SelectOption[] = [
    { value: "", label: "No team" },
    ...data.teams.map((team) => ({ value: String(team.id), label: String(team.name) })),
  ];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Company structure</span>
          <h2>Teams</h2>
          <p>Route ownership, approvals, and reporting.</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-action" disabled={connection !== "online"} onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Team
          </button>
          <button type="button" className="primary-action" disabled={connection !== "online"} onClick={() => setInviteOpen(true)}>
            <MailPlus size={16} /> Invite
          </button>
        </div>
      </section>

      <section className="card-grid three-column">
        {data.teams.map((team) => {
          const members = (team.members as Array<Record<string, unknown>>) ?? [];
          return (
            <article className="work-card" key={String(team.id)}>
              <header>
                <span className="record-icon"><Users size={18} /></span>
                <span className="status-pill success">{members.length} members</span>
              </header>
              <div>
                <h3>{String(team.name)}</h3>
                <p>Manager-led sales and approval scope.</p>
              </div>
              <div className="team-member-list">
                {members.map((member) => (
                  <span key={String(member.id)}>
                    <i>{String(member.fullName).split(" ").map((part) => part[0]).join("").slice(0, 2)}</i>
                    <span>
                      <strong>{String(member.fullName)}</strong>
                      <small>{roleLabel[member.role as Role]}</small>
                    </span>
                    {member.id === team.managerUserId && <ShieldCheck size={15} />}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <Modal open={createOpen} title="New sales team" eyebrow="Company" onClose={() => { setCreateOpen(false); setError(""); }}>
        <form className="modal-form" onSubmit={createTeam}>
          <label><span>Team name</span><input name="name" required /></label>
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-action" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="primary-action">Create team</button>
          </div>
        </form>
      </Modal>

      <Modal open={inviteOpen} title="Invite staff" eyebrow="Access" onClose={() => { setInviteOpen(false); setResult(""); setError(""); }}>
        <form className="modal-form" onSubmit={invite}>
          <label><span>Name</span><input name="fullName" required /></label>
          <label><span>Email</span><input name="email" type="email" required /></label>
          <label>
            <span>Role</span>
            <CustomSelect name="role" ariaLabel="Role" defaultValue="sales_rep" options={roleOptions} />
          </label>
          <label>
            <span>Team</span>
            <CustomSelect name="teamId" ariaLabel="Team" options={teamOptions} />
          </label>
          {result && <div className="form-note"><span className="portal-link-text">{result}</span></div>}
          {error && <p className="login-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-action" onClick={() => setInviteOpen(false)}>Close</button>
            <button type="submit" className="primary-action">Send invitation</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
