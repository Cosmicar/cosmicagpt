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

test('Catálogo Cósmica BOX ofrece Fiestas y pack Stickers de 96 sin mezclar pagos', () => {
  const stickers=read('stickers-preview.html');
  assert.match(box,/id="combos"/);
  assert.match(box,/48 de Mujeres y 48 de Hombres/);
  assert.match(box,/PACK COMPLETO · 96 DISEÑOS/);
  assert.match(box,/Consultar precio y entrega/);
  assert.match(box,/href="\/box\/stickers"/);
  assert.match(stickers,/96 stickers originales/);
  assert.match(stickers,/48 Stickers Mujeres/);
  assert.match(stickers,/48 Stickers Hombres/);
  assert.match(stickers,/12 hojas A4/);
  assert.match(stickers,/Consultar por WhatsApp/);
  assert.equal(stickers.includes('mpago.la'),false,'No activar enlace de precio desconocido');
  for(const name of ['stickers-96-general.jpg','stickers-96-mujeres.jpg','stickers-96-hombres.jpg']){
    const url=new URL('box/'+name,root);
    assert.ok(fs.existsSync(url),'Falta imagen '+name);
    assert.ok(fs.statSync(url).size>200000);
    assert.ok(build.includes("'box/"+name+"'"));
  }
  assert.ok(build.includes("'stickers-preview.html'"));
  assert.ok(vercel.rewrites.some(x => x.source==='/box/stickers' && x.destination==='/stickers-preview.html'));
  assert.match(read('sitemap.xml'),/https:\/\/cosmica\.ar\/box\/stickers/);
  assert.match(style,/\.catalog-grid/);
});
