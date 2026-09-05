import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

export type ToastTone = "success" | "error" | "warning";

type ToastMessage = {
  id: string;
  message: string;
  tone: ToastTone;
};

const TOAST_EVENT = "dealflow360:toast";

export function showToast(message: string, tone: ToastTone = "success") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, tone } }));
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: ToastTone }>).detail;
      const item = { id: crypto.randomUUID(), message: detail.message, tone: detail.tone };
      setItems((current) => [...current, item].slice(-4));
      window.setTimeout(() => setItems((current) => current.filter(({ id }) => id !== item.id)), 3600);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  return (
    <aside className="toast-viewport" aria-live="polite" aria-label="Status messages">
      {items.map((item) => {
        const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? XCircle : AlertTriangle;
        return (
          <div className={`app-toast ${item.tone}`} key={item.id} role="status">
            <Icon size={15} />
            <span>{item.message}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setItems((current) => current.filter(({ id }) => id !== item.id))}><X size={13} /></button>
          </div>
        );
      })}
    </aside>
  );
}
