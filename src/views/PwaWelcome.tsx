import { useEffect, useState } from 'react';
import { ArrowRight, Download, Share, Workflow } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWA_CHOICE_KEY = 'dealflow360.pwa-choice-v1';

export function shouldShowPwaWelcome() {
  if (location.pathname === '/portal' || location.pathname === '/invite') return false;
  const mobile = window.matchMedia('(max-width: 768px)').matches;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  return mobile && !standalone && !localStorage.getItem(PWA_CHOICE_KEY);
}

export function PwaWelcome({ onContinue }: { onContinue: () => void }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  const complete = () => { localStorage.setItem(PWA_CHOICE_KEY, 'continued'); onContinue(); };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') { localStorage.setItem(PWA_CHOICE_KEY, 'installed'); onContinue(); }
  };

  return <main className="pwa-welcome">
    <section className="pwa-welcome-card">
      <span className="pwa-welcome-mark"><Workflow size={28} /></span>
      <div><span className="page-kicker">DealFlow360</span><h1>Keep deals close.</h1><p>Install for quick access and offline viewing.</p></div>
      {prompt && <button type="button" className="primary-action pwa-action" onClick={install}><Download size={18} /> Install app</button>}
      {!prompt && isiOS && <div className="pwa-ios-note"><Share size={18} /><span>Tap Share, then Add to Home Screen.</span></div>}
      <button type="button" className={prompt ? 'secondary-action pwa-action' : 'primary-action pwa-action'} onClick={complete}>Continue on web <ArrowRight size={18} /></button>
    </section>
  </main>;
}
