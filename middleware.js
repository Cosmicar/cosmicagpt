/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CÓSMICA — Vercel Edge Middleware                                ║
 * ║                                                                  ║
 * ║  Intercepts requests at the edge (BEFORE static file serving)    ║
 * ║  to route the app.cosmica.ar subdomain to the SaaS.              ║
 * ║                                                                  ║
 * ║  Why: vercel.json rewrites are checked AFTER static files.       ║
 * ║  The root has its own index.html, sw.js, manifest.json (legacy   ║
 * ║  artifacts), so plain rewrites can't override them for the       ║
 * ║  subdomain. Middleware runs first and bypasses static serving.   ║
 * ║                                                                  ║
 * ║  Other hosts (cosmica.ar, *.vercel.app) pass through unchanged.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
export const config = {
  // Match only the root-level paths that conflict with legacy root files.
  // Sub-paths like /core/*, /views/* are handled by vercel.json rewrites
  // because they don't have conflicting root files.
  matcher: ['/', '/index.html', '/sw.js', '/manifest.json'],
};

// Map of root paths that need to be rewritten for app.cosmica.ar
const SAAS_REWRITES = {
  '/':               '/apps/cosmica-app/index.html',
  '/index.html':     '/apps/cosmica-app/index.html',
  '/sw.js':          '/apps/cosmica-app/sw.js',
  '/manifest.json':  '/apps/cosmica-app/manifest.json',
};

export default function middleware(request) {
  const host = request.headers.get('host') ?? '';

  // Only intercept the SaaS subdomain — other hosts pass through
  if (host !== 'app.cosmica.ar') return;

  const url = new URL(request.url);
  const target = SAAS_REWRITES[url.pathname];
  if (!target) return; // not a path we need to rewrite

  const targetUrl = new URL(target, request.url);
  return new Response(null, {
    status: 200,
    headers: {
      'x-middleware-rewrite': targetUrl.toString(),
    },
  });
}
