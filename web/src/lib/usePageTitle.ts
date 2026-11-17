import { useEffect } from 'react';

/** Names the browser tab after what is on the page, so it can be told apart (WCAG 2.4.2). */
export function pageTitle(name: string | null | undefined): string {
  return name ? `${name} · Lumio` : 'Lumio';
}

export function usePageTitle(name: string | null | undefined) {
  useEffect(() => {
    document.title = pageTitle(name);
  }, [name]);
}
