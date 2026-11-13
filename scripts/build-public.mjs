import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { optimizeBrandDelivery } from './optimize-brand-delivery.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
execFileSync(process.execPath, ['--test', 'tests/analytics.test.mjs', 'tests/assistance.test.mjs', 'tests/remotto-connect.test.mjs', 'tests/plans.test.mjs', 'tests/box.test.mjs', 'tests/header.test.mjs', 'tests/remote-mobile.test.mjs', 'tests/holiday-2026.test.mjs'], { cwd: root, stdio: 'inherit' });
for (const script of ['validate-project-boundaries', 'sync-brand-contacts', 'validate-marketing', 'sync-brand-markup', 'check-brand-official']) {
  execFileSync(process.execPath, [path.join(root, `scripts/${script}.mjs`)], { cwd: root, stdio: 'inherit' });
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const provinces = JSON.parse(fs.readFileSync(path.join(root, 'data/provincias.json'), 'utf8')).provinces;
const pages = ['index.html', 'box.html', 'stickers-preview.html', 'stickers-ia.html', 'calendarios-2027.html', '404.html', 'planes.html', 'asistencia.html', 'serviciotecnico.html', 'soporte-tecnico-remoto-argentina.html', ...provinces.map(p => `pc-lenta-${p.slug}.html`)];
const files = [...pages, 'box.css', 'box/muestrario-real.jpg', 'box/stickers-preview.jpg', 'box/stickers-96-general.jpg', 'box/stickers-96-mujeres.jpg', 'box/stickers-96-hombres.jpg', 'box/stickers-ia-48-muestrario.jpg', 'box/calendarios-mignon-2027.jpg', 'box/calendarios-anime-2027-muestrario.jpg', 'box/calendarios-anime-2027-v3-feriados.jpg', 'google83d6e45e153aaa85.html', 'robots.txt', 'sitemap.xml', 'llms.txt', 'humans.txt', 'favicon.ico'];
function copy(file) {
  const target = path.join(out, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
files.forEach(copy);
// Documento aislado del widget; no es una página indexable ni carga GA4.
copy('marketing/remotto-connect.html');
// El sandbox tiene origen opaco: los recursos propios no deben depender de
// cookies SameSite de la Preview protegida. Empaquetar sólo este documento
// con su CSS/loader locales, conservando los scripts oficiales por separado.
const widgetPath = path.join(out, 'marketing/remotto-connect.html');
const widgetScript = fs.readFileSync(path.join(root, 'marketing/remotto-connect.js'), 'utf8');
const widgetStyle = fs.readFileSync(path.join(root, 'marketing/remotto-connect.css'), 'utf8');
const widgetHtml = fs.readFileSync(widgetPath, 'utf8')
  .replace('  <link rel="stylesheet" href="/marketing/remotto-connect.css">', `<style>${widgetStyle}</style>`)
  .replace('  <script src="/marketing/remotto-connect.js" defer></script>', '')
  .replace('</body>', () => `<script>${widgetScript}</script>\n</body>`);
fs.writeFileSync(widgetPath, widgetHtml);
function copyAssets(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) copyAssets(file);
    else if (entry.isFile() && /\.(css|js|svg|png|webp|jpe?g|ico|woff2?)$/i.test(entry.name)) copy(file);
  }
}
['marketing', 'brand'].forEach(copyAssets);
optimizeBrandDelivery(root, out);
for (const page of pages.filter(page => page !== '404.html')) {
  const target = path.join(out, page);
  const html = fs.readFileSync(target, 'utf8');
  if (!html.includes('</head>')) throw new Error(`${page}: falta head para analítica`);
  fs.writeFileSync(target, html.replace('</head>', '  <script defer src="/marketing/analytics.js"></script>\n</head>'));
}

// Comprobar que el aislamiento no deja imágenes, CSS, scripts o rutas locales rotos.
const rewrites = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).rewrites;
function verifyReference(ref, source) {
  if (!ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) return;
  let pathname = decodeURIComponent(ref.split(/[?#]/)[0]);
  if (!pathname) return;
  const relative = pathname.startsWith('/') ? pathname.slice(1) : path.join(path.dirname(source), pathname);
  const candidates = [relative || 'index.html', `${relative}.html`, path.join(relative, 'index.html')];
  const rewrite = rewrites.find(r => r.source === `/${relative}`);
  if (rewrite) candidates.push(rewrite.destination.slice(1));
  if (!candidates.some(p => fs.existsSync(path.join(out, p)))) throw new Error(`${source}: recurso ausente ${ref}`);
}
for (const page of [...pages, 'marketing/remotto-connect.html']) {
  const html = fs.readFileSync(path.join(out, page), 'utf8');
  if (/<link\b[^>]*\brel\s*=\s*(?:"[^"]*\bmanifest\b[^"]*"|'[^']*\bmanifest\b[^']*'|manifest(?=[\s/>]))/i.test(html)) {
    throw new Error(`${page}: la PWA sólo se anuncia desde app.cosmica.ar`);
  }
  for (const [, ref] of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) verifyReference(ref, page);
}
function verifyAssets(dir) {
  for (const entry of fs.readdirSync(path.join(out, dir), { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) verifyAssets(file);
    else if (entry.name.endsWith('.css')) {
      for (const [, ref] of fs.readFileSync(path.join(out, file), 'utf8').matchAll(/url\(["']?([^"')]+)["']?\)/g)) verifyReference(ref, file);
    }
  }
}
['marketing'].forEach(verifyAssets);
for (const [, url] of fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)) verifyReference(new URL(url).pathname, 'sitemap.xml');
// Verificar el artefacto final DESPUÉS del generador y la sincronización de marca.
const canonicalRoutes = new Map([
  ['index.html','/'],
  ['box.html','/box'],
  ['calendarios-2027.html','/box/calendarios-2027'],
  ['stickers-preview.html','/box/stickers'],
  ['stickers-ia.html','/box/stickers-ia'],
  ['planes.html','/planes'],
  ['serviciotecnico.html','/serviciotecnico'],
  ['asistencia.html','/asistencia.html'],
  ['soporte-tecnico-remoto-argentina.html','/soporte-tecnico-remoto-argentina.html'],
  ...provinces.map(p => [`pc-lenta-${p.slug}.html`, `/pc-lenta-${p.slug}.html`])
]);
const publishedCanonicals = new Set();
for (const [page, route] of canonicalRoutes) {
  const html = fs.readFileSync(path.join(out,page), 'utf8');
  const links = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/gi)];
  const expected = `https://www.cosmica.ar${route}`;
  if (links.length !== 1 || links[0][1] !== expected) throw new Error(`${page}: canonical incorrecto (esperado ${expected})`);
  if (/https:\/\/cosmica\.ar(?:\/|["'])/.test(html)) throw new Error(`${page}: URL absoluta sin www`);
  publishedCanonicals.add(expected);
}
const finalSitemap = fs.readFileSync(path.join(out,'sitemap.xml'),'utf8');
const finalUrls = [...finalSitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (publishedCanonicals.size !== 33 || finalUrls.length !== 33 ||
    new Set(finalUrls).size !== 33 || finalUrls.some(url => !publishedCanonicals.has(url))) {
  throw new Error('sitemap.xml debe reflejar exactamente 33 canonicals publicados');
}
if (!fs.readFileSync(path.join(out,'robots.txt'),'utf8').includes('Sitemap: https://www.cosmica.ar/sitemap.xml')) {
  throw new Error('robots.txt no apunta al sitemap canónico');
}
console.log(`✓ Salida pública aislada: ${pages.length} páginas, recursos locales y sitemap verificados.`);
