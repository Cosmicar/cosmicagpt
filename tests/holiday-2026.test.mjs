import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('marketing/holiday-2026.css');
const script = html.match(/<script id="holiday-2026-activation">([\s\S]*?)<\/script>/)?.[1];

function seasonalAt(iso) {
  assert.ok(script, 'Falta activación temporal en la cabecera');
  const enabled = [];
  class FixedDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(iso); }
  }
  vm.runInNewContext(script, {
    Intl, Date: FixedDate,
    document: { documentElement: { classList: { add: name => enabled.push(name) } } }
  });
  return enabled.includes('holiday-2026-active');
}

test('La campaña se activa según la fecha local de Jujuy sin depender del reloj UTC', () => {
  assert.equal(seasonalAt('2026-11-10T02:59:59.000Z'), false);
  assert.equal(seasonalAt('2026-11-10T03:00:00.000Z'), true);
  assert.equal(seasonalAt('2026-12-31T23:59:59.000Z'), true);
  assert.equal(seasonalAt('2027-01-01T02:59:59.000Z'), true);
  assert.equal(seasonalAt('2027-01-01T03:00:00.000Z'), false);
  assert.equal(seasonalAt('2027-11-10T13:00:00.000Z'), false);
});

test('Estilos navideños apagados por defecto y visibles sólo dentro de la campaña', () => {
  assert.match(css, /\.holiday-2026-ribbon,\s*\.holiday-2026-footer-note\s*\{\s*display:\s*none/);
  assert.match(css, /html\.holiday-2026-active \.hero \.holiday-2026-ribbon\s*\{/);
  assert.match(css, /display:\s*flex/);
  assert.match(css, /html\.holiday-2026-active \.holiday-2026-footer-note\s*\{/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /@font-face|url\(|animation:\s*infinite/i);
  assert.match(css, /#E1063A/);
  assert.match(css, /#0F121A/);
  assert.match(css, /#F6F3F0/);
});

test('Portada conserva marca y separa consulta estacional de ingreso de código', () => {
  assert.match(html, /href="\/marketing\/holiday-2026\.css"/);
  assert.ok(html.indexOf('id="holiday-2026-activation"') < html.indexOf('/marketing/site.css'));
  assert.match(html, /class="holiday-2026-ribbon wa-link"[^>]*data-source="holiday-hero"/);
  assert.match(html, /data-message="Hola Cósmica, quiero consultar por asistencia remota o mantenimiento/);
  assert.ok(html.indexOf('class="holiday-2026-ribbon wa-link"') < html.indexOf('id="serviceStatus"'));
  assert.match(html, /Fin de año sin interrupciones/);
  assert.match(html, /Prepará tu PC para diciembre/);
  assert.match(html, /href="\/asistencia\.html" aria-label="Ya coordiné asistencia: ingresar mi código de Remotto"/);
  assert.match(html, /src="\/brand\/official\/cosmica-logo-light\.png\?v=10"/);
  assert.match(html, /src="\/brand\/official\/cosmica-logo-dark\.png\?v=10"/);
  assert.doesNotMatch(html, /Rally de Navidad|reset-almohadillas\.html|promoción válida para siempre/i);
  assert.match(html, /href="https:\/\/www\.cosmica\.ar\/"/);
  assert.match(html, /https:\/\/app\.cosmica\.ar/);
  for (const price of ['$24.900', '$35.900', '$49.900']) assert.ok(html.includes(price));
});
