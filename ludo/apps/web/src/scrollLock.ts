/**
 * Reference-counted page scroll lock manager shared by all modals and drawers.
 * Locks both <html> and <body> while at least one overlay is active and cleanly
 * restores their original inline overflow styles only when the last one closes.
 */
let activeLocks = 0;
let savedHtmlOverflow = '';
let savedBodyOverflow = '';

export function acquireScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (activeLocks === 0) {
    savedHtmlOverflow = document.documentElement.style.overflow;
    savedBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  activeLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks === 0 && typeof document !== 'undefined') {
      document.documentElement.style.overflow = savedHtmlOverflow;
      document.body.style.overflow = savedBodyOverflow;
    }
  };
}
