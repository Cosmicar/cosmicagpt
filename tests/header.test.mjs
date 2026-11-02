import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../marketing/header-polish.css', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../marketing/home.js', import.meta.url), 'utf8');

const section = html.match(/<div class="nav-links" id="navLinks">([\s\S]*?)<\/div>\s*<div class="nav-actions">/)?.[1];
test('Navegación principal compacta conserva rutas esenciales y agrupa secundarias', () => {
  assert.ok(section, 'Falta menú de la portada');
  const primary = section.split('<details class="nav-more"')[0];
  const mainRoutes = [...primary.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/g)].map(match => match[1]);
  assert.deepEqual(mainRoutes, ['#problemas', '/planes', '/box', 'https://app.cosmica.ar/']);
  assert.match(section, /<details class="nav-more" id="navMore">\s*<summary>Más<\/summary>/);
  const more = section.match(/<div class="nav-more-menu">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(more);
  const extraRoutes = [...more.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(extraRoutes, ['#como-funciona', '#resenas', '/serviciotecnico', '#preguntas']);
  assert.match(section, /class="nav-assistance-mobile" href="\/asistencia.html"/);
  assert.match(section, /class="nav-whatsapp-mobile wa-link" href="https:\/\/wa.me\/5493883298736"/);
});

test('Diseño de encabezado reduce altura y evita cortes en escritorio y móvil', () => {
  assert.match(css, /min-height:\s*64px/);
  assert.match(css, /@media \(min-width: 1181px\)/);
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /max-height:\s*calc\(100dvh - 86px\)/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /\.nav-more\s*>\s*summary:focus-visible/);
  assert.ok(html.indexOf('/marketing/header-polish.css') > html.indexOf('/marketing/brand-v2.css'));
});

test('Menú Más cierra al navegar, pulsar Escape, salir o volver a escritorio', () => {
  assert.match(script, /if \(moreMenu\) moreMenu\.open = false/);
  assert.match(script, /moreMenu\.contains\(event\.target\)/);
  assert.match(script, /moreSummary\?\.focus\(\)/);
  assert.match(script, /matchMedia\('\(min-width: 1181px\)'\)/);
  assert.match(script, /navLinks\?\.querySelectorAll\('a'\)/);
});

test('El ajuste no modifica los precios ni la política Free/PRO', () => {
  for (const price of ['$24.900', '$35.900', '$49.900'])
    assert.ok(html.includes(price), 'Se alteró la tarifa ' + price);
  assert.ok(html.includes('CONSULTAR PRECIO PRO'));
  assert.ok(html.includes('Empezar gratis'));
});
