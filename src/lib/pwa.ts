import { registerSW } from 'virtual:pwa-register';

let updating = false;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (updating) return;
    updating = true;
    void updateSW(true);
  },
});

export function installPwaUpdateChecks() {
  const check = () => navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  window.setInterval(check, 15 * 60 * 1000);
}
