import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'standard' | 'wide';
}

export function Modal({ open, title, eyebrow, children, onClose, size = 'standard' }: ModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('drawer-locked');
    closeButton.current?.focus();
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('drawer-locked');
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card ${size === 'wide' ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <div>{eyebrow && <span>{eyebrow}</span>}<h2 id="modal-title">{title}</h2></div>
          <button ref={closeButton} type="button" className="icon-control" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}
