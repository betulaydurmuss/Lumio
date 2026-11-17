// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axe from 'axe-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import en from './i18n/en.json';
import i18n from './i18n/index.js';
import tr from './i18n/tr.json';
import { pageTitle } from './lib/usePageTitle.js';
import { routes, type RouteHandle } from './routes.js';

/**
 * Renders a URL through the real route table, as the browser would show it
 * before any data arrives, with the tab title the route asks for. (Effects do
 * not run in a static render, so the title is applied here the way the layout
 * applies it.)
 */
function render(url: string) {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const handle = router.state.matches.at(-1)?.route.handle as RouteHandle | undefined;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  document.body.innerHTML = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  document.title = pageTitle(handle?.title ? i18n.t(handle.title) : null);
}

async function violations() {
  const result = await axe.run(document, {
    // jsdom has no layout engine, so contrast cannot be measured here; the
    // palette's contrast is checked in the design system instead.
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations.map((violation) => ({
    rule: violation.id,
    nodes: violation.nodes.map((node) => node.html.slice(0, 120)),
  }));
}

// The pages anyone can reach without data from the server.
const pages = [
  '/sign-in',
  '/sign-up?type=company',
  '/check-email',
  '/verify-email?token=abcdefghijklmnopqrstuvwxyz',
  '/forgot-password',
  '/reset-password?token=abcdefghijklmnopqrstuvwxyz',
  '/privacy',
  '/no-such-page',
];

describe.each(['tr', 'en'])('accessibility in %s', (locale) => {
  it.each(pages)('finds no WCAG violations on %s', async (url) => {
    await i18n.changeLanguage(locale);
    render(url);
    expect(document.documentElement.lang).toBe(locale);
    expect(document.title).toMatch(/^.+ · Lumio$/);
    expect(await violations()).toEqual([]);
  });
});

describe('the layout', () => {
  it('starts with a link that skips straight to the content', () => {
    render('/sign-in');
    const first = document.querySelector('a');
    expect(first?.getAttribute('href')).toBe('#main');
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
  });

  it('gives every titled route a title in both languages', () => {
    const keys: string[] = [];
    const walk = (list: RouteObject[]) => {
      for (const route of list) {
        const title = (route.handle as RouteHandle | undefined)?.title;
        if (title) keys.push(title);
        if (route.children) walk(route.children);
      }
    };
    walk(routes);
    const lookup = (source: object, key: string) =>
      key
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], source);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      expect(typeof lookup(en, key), key).toBe('string');
      expect(typeof lookup(tr, key), key).toBe('string');
    }
  });
});
