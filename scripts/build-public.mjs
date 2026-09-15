import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
for (const script of ['validate-project-boundaries', 'sync-brand-contacts', 'validate-marketing', 'sync-brand-markup', 'check-brand-official']) {
  execFileSync(process.execPath, [path.join(root, `scripts/${script}.mjs`)], { cwd: root, stdio: 'inherit' });
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const provinces = JSON.parse(fs.readFileSync(path.join(root, 'data/provincias.json'), 'utf8')).provinces;
const pages = ['index.html', '404.html', 'planes.html', 'plus.html', 'asistencia.html', 'serviciotecnico.html', 'soporte-tecnico-remoto-argentina.html', ...provinces.map(p => `pc-lenta-${p.slug}.html`)];
const files = [...pages, 'google83d6e45e153aaa85.html', 'robots.txt', 'sitemap.xml', 'llms.txt', 'humans.txt', 'site.webmanifest', 'favicon.ico', 'anydesk-id-ejemplo.png'];
function copy(file) {
  const target = path.join(out, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
files.forEach(copy);
function copyAssets(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) copyAssets(file);
    else if (entry.isFile() && /\.(css|js|svg|png|webp|jpe?g|ico|woff2?)$/i.test(entry.name)) copy(file);
  }
}
['marketing', 'brand'].forEach(copyAssets);

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
for (const page of pages) {
  const html = fs.readFileSync(path.join(out, page), 'utf8');
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
console.log(`✓ Salida pública aislada: ${pages.length} páginas, recursos locales y sitemap verificados.`);
