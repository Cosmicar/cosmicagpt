import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const home = read('index.html');
const css = read('marketing/header-polish.css');
const build = read('scripts/build-public.mjs');

const header = home.match(/<header class="header"[\s\S]*?<\/header>/)?.[0] ?? '';
const hero = home.match(/<section class="hero" id="inicio">[\s\S]*?<\/section>/)?.[0] ?? '';
const dock = home.match(/<div class="mobile-sticky"[^>]*>[\s\S]*?<script src="\/marketing\/home\.js"/)?.[0] ?? '';

test('Cabecera mobile-first ofrece WhatsApp directo sin abrir el menu', () => {
  assert.match(header, /class="btn btn-primary btn-small wa-link"[^>]*data-source="nav"/);
  assert.match(header, /aria-label="Consultar por WhatsApp con un técnico de Cósmica"/);
  assert.match(header, /class="nav-whatsapp-label"/);
  assert.match(css, /@media \(max-width: 1180px\)\s*\{[\s\S]*?\.header \.nav \.nav-actions > a\.wa-link\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(css, /width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /a\.wa-link:focus-visible/);
});

test('Portada distingue consulta previa de una sesion remota ya coordinada', () => {
  assert.match(hero, /<h1>¿Tu PC falla\?[\s\S]*?Te ayudamos a distancia/);
  assert.match(hero, /Evaluamos si podemos resolverlo a distancia/);
  assert.match(hero, /confirmamos el alcance y el precio antes de comenzar/);
  assert.match(hero, /nos conectamos sólo con tu permiso/);
  assert.match(hero, /data-source="hero-primary"[^>]*data-message="Hola, quiero consultar/);
  assert.match(hero, /Consultar mi caso por WhatsApp/);
  assert.match(hero, /href="\/asistencia\.html" aria-label="Ya coordiné asistencia: ingresar mi código de Remotto"/);
  assert.match(hero, /Ya tengo código/);
  assert.ok(hero.indexOf('data-source="hero-primary"') < hero.indexOf('Ya tengo código'));
});

test('Barra inferior prioriza consultas e identifica el flujo de codigo', () => {
  assert.match(dock, /Accesos de asistencia remota/);
  assert.match(dock, /data-source="mobile-sticky"[^>]*data-message="Hola, necesito consultar/);
  assert.match(dock, /href="\/asistencia\.html"/);
  assert.ok(dock.indexOf('data-source="mobile-sticky"') < dock.indexOf('Tengo código'));
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /mobile-sticky-actions \.btn[\s\S]*?min-height:\s*48px/);
  assert.match(css, /@media \(max-width: 1180px\) and \(max-height: 540px\)/);
});

test('Se conserva marca, precios, canales de conversion y la separacion web-app', () => {
  for (const price of ['$24.900', '$35.900', '$49.900']) assert.ok(home.includes(price));
  assert.match(home, /<link rel="canonical" href="https:\/\/www\.cosmica\.ar\/"/);
  assert.match(home, /https:\/\/app\.cosmica\.ar/);
  assert.match(home, /data-source="pro-consulta"/);
  assert.doesNotMatch(home, /href="\/reset-almohadillas/);
  assert.match(build, /tests\/remote-mobile\.test\.mjs/);
});
