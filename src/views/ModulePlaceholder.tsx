import { Construction, Plus } from 'lucide-react';

export function ModulePlaceholder({ title, summary }: { title: string; summary: string }) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><span className="page-kicker">Workspace module</span><h2>{title}</h2><p>{summary}</p></div>
        <button type="button" className="primary-action"><Plus size={17} /> Create</button>
      </section>
      <section className="empty-module">
        <span><Construction size={24} /></span>
        <h3>{title} structure ready</h3>
        <p>Data, actions, and workflow logic will land in the next feature milestone.</p>
      </section>
    </div>
  );
}
