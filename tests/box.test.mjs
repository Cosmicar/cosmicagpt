import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const home = read('index.html');
const box = read('box.html');
const style = read('box.css');
const build = read('scripts/build-public.mjs');
const vercel = JSON.parse(read('vercel.json'));
const image = new URL('box/muestrario-real.jpg', root);

test('Página Cósmica BOX tiene identidad oficial y contenido correcto', () => {
  assert.match(box, /\/brand\/official\/cosmica-logo-light\.png/);
  assert.match(box, /Fiestas Vol\. 1/);
  for (const word of ['80', '16', '30 invitaciones', '20 etiquetas', '20 agradecimientos', '10 carteles', '3.990']) {
    assert.ok(box.includes(word), 'Falta: ' + word);
  }
  assert.ok(style.includes('@media'), 'Faltan estilos responsive');
  assert.ok(fs.existsSync(image), 'Falta la imagen real');
  assert.ok(fs.statSync(image).size > 100000, 'Imagen de muestrario vacía');
});

test('La navegación enlaza el producto pero no expone cobro fuera de la landing', () => {
  assert.match(home, /class="cosmica-box-nav" href="\/box"/);
  assert.match(home, /href="\/box">Cósmica BOX/);
  assert.ok(!home.includes('mpago.la/12rSj12'));
  assert.equal(box.split('https://mpago.la/12rSj12').length - 1, 1, 'Pago sólo una vez en sección de compra');
  assert.ok(box.indexOf('https://mpago.la/12rSj12') > box.indexOf('id="comprar"'));
  assert.match(box, /La entrega es|entrega es|La entrega del ZIP es/);
  assert.ok(!box.includes('/api/box/checkout'), 'No activar pagos automáticos');
});

test('La compilación y ruta /box incluyen todos los recursos necesarios', () => {
  assert.ok(build.includes("'box.html'"));
  assert.ok(build.includes("'box.css'"));
  assert.ok(build.includes("'box/muestrario-real.jpg'"));
  assert.ok(vercel.rewrites.some((entry) => entry.source === '/box' && entry.destination === '/box.html'));
  assert.match(read('sitemap.xml'), /https:\/\/cosmica\.ar\/box/);
});

test('Catálogo Cósmica BOX muestra Fiestas disponible y Stickers como piloto', () => {
  const stickers = read('stickers-preview.html');
  const img = new URL('box/stickers-preview.jpg', root);
  assert.match(box, /id="combos"/);
  assert.match(box, /Stickers con actitud/);
  assert.match(box, /PILOTO · 8 DISEÑOS/);
  assert.match(box, /Sin precio ni venta habilitada/);
  assert.match(box, /href="\/box\/stickers"/);
  assert.match(stickers, /8 STICKERS DE MUESTRA/);
  assert.match(stickers, /Consultar por la muestra en WhatsApp/);
  assert.ok(!stickers.includes('mpago.la/12rSj12'));
  assert.ok(fs.existsSync(img) && fs.statSync(img).size > 100000);
  assert.ok(build.includes("'stickers-preview.html'"));
  assert.ok(build.includes("'box/stickers-preview.jpg'"));
  assert.ok(vercel.rewrites.some(x => x.source === '/box/stickers' && x.destination === '/stickers-preview.html'));
  assert.match(read('sitemap.xml'), /https:\/\/cosmica\.ar\/box\/stickers/);
  assert.match(style, /\.catalog-grid/);
});
