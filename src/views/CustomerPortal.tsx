import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  LockKeyhole,
  MessageSquare,
  Send,
  Workflow,
  X,
} from "lucide-react";
import { apiFetch, setCsrf } from "../lib/api";

type PortalLine = {
  id: string;
  product: string;
  quantity: number;
  unitPriceMinor: number;
  discountBps: number;
};
type PortalQuote = {
  id: string;
  quoteNumber: number;
  status: string;
  revision: number;
  totalMinor: number;
  customer: string;
  lines: PortalLine[];
};

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(value / 100);

export function CustomerPortal() {
  const [quote, setQuote] = useState<PortalQuote | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const response = await apiFetch<{ data: PortalQuote }>("/api/portal/quote");
    setQuote(response.data);
  };

  useEffect(() => {
    void (async () => {
      try {
        const token = new URLSearchParams(location.search).get("token");
        if (token) {
          const redeemed = await apiFetch<{ csrfToken: string }>("/api/portal/redeem", {
            method: "POST",
            body: JSON.stringify({ token }),
          });
          setCsrf(redeemed.csrfToken);
          history.replaceState({}, "", "/portal");
        }
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "This link is unavailable.");
      }
    })();
  }, []);

  const respond = async (action: "accept" | "reject" | "comment", event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/portal/quote/respond", {
        method: "POST",
        body: JSON.stringify({ action, message: message || undefined }),
      });
      setMessage("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send response.");
    } finally {
      setBusy(false);
    }
  };

  const counter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quote) return;
    const form = new FormData(event.currentTarget);
    const lines = quote.lines.map((line) => ({
      lineId: line.id,
      quantity: Number(form.get(`quantity-${line.id}`)),
      discountBps: Math.round(Number(form.get(`discount-${line.id}`)) * 100),
    }));
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/portal/quote/respond", {
        method: "POST",
        body: JSON.stringify({ action: "counteroffer", message: message || undefined, lines }),
      });
      setMessage("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit counteroffer.");
    } finally {
      setBusy(false);
    }
  };

  const canRespond = quote?.status === "approved";
  return (
    <main className="portal-page">
      <header className="portal-header">
        <span className="brand-mark"><Workflow size={21} /></span>
        <strong>DealFlow360</strong>
        <small><LockKeyhole size={13} /> Secure quote</small>
      </header>
      <section className="portal-card">
        {error && !quote ? (
          <div className="inline-empty"><X size={22} /><strong>{error}</strong></div>
        ) : !quote ? (
          <p className="portal-loading">Opening quotation…</p>
        ) : (
          <>
            <div className="detail-hero portal-hero">
              <div><span>Quotation Q-{String(quote.quoteNumber).padStart(4, "0")}</span><h1>{quote.customer}</h1><p>Revision {quote.revision}</p></div>
              <span className={`status-pill ${quote.status === "accepted" ? "success" : quote.status === "rejected" ? "danger" : "info"}`}>{quote.status.replaceAll("_", " ")}</span>
            </div>
            <div className="portal-lines">
              {quote.lines.map((line) => {
                const lineTotal = line.quantity * line.unitPriceMinor * (1 - line.discountBps / 10_000);
                return <article key={line.id}><div><strong>{line.product}</strong><small>{line.quantity} × {money(line.unitPriceMinor)} · {line.discountBps / 100}% off</small></div><strong>{money(Math.round(lineTotal))}</strong></article>;
              })}
            </div>
            <div className="portal-total"><span>Total</span><strong>{money(quote.totalMinor)}</strong></div>
            {canRespond ? (
              <form className="modal-form portal-response" onSubmit={counter}>
                <label><span>Message</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add a note for the sales team" /></label>
                <details className="portal-counter"><summary>Request line changes <ChevronDown size={16} /></summary><div>{quote.lines.map((line) => <div className="form-columns" key={line.id}><label><span>{line.product} quantity</span><input name={`quantity-${line.id}`} type="number" min="1" defaultValue={line.quantity} /></label><label><span>Discount %</span><input name={`discount-${line.id}`} type="number" min="0" max="100" step="0.1" defaultValue={line.discountBps / 100} /></label></div>)}</div></details>
                {error && <p className="login-error">{error}</p>}
                <div className="portal-actions"><button type="button" className="danger-action" disabled={busy} onClick={() => void respond("reject")}><X size={16} /> Reject</button><button type="submit" className="secondary-action" disabled={busy}><Send size={16} /> Counter</button><button type="button" className="primary-action" disabled={busy} onClick={() => void respond("accept")}><Check size={16} /> Accept</button></div>
                <button type="button" className="action-text-button" disabled={busy || !message.trim()} onClick={() => void respond("comment")}><MessageSquare size={15} /> Send comment only</button>
              </form>
            ) : (
              <div className="portal-outcome"><Check size={18} /><span><strong>{quote.status === "accepted" ? "Quotation accepted" : quote.status === "rejected" ? "Quotation declined" : "Sales review in progress"}</strong><small>No further action is needed here.</small></span></div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
