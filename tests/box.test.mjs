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
  assert.match(box, /\$2\.990 ARS/);
  assert.match(box,/href="\/box\/stickers"/);
  assert.match(stickers,/96 stickers originales/);
  assert.match(stickers,/48 Stickers Mujeres/);
  assert.match(stickers,/48 Stickers Hombres/);
  assert.match(stickers,/12 hojas A4/);
  assert.match(stickers,/Comprar con Mercado Pago/);
  assert.match(stickers,/Ya pagué · Coordinar entrega por WhatsApp/);
  assert.match(stickers,/\$2\.990/);
  assert.equal(stickers.split('https://mpago.la/2WJXvzH').length-1,1,'Stickers debe tener solo un link de pago propio');
  assert.equal(box.includes('https://mpago.la/2WJXvzH'),false,'El link directo de Stickers no debe estar en portada');
  assert.equal(stickers.includes('mpago.la/12rSj12'),false,'No mezclar enlaces de ambos productos');
  assert.ok(stickers.indexOf('https://mpago.la/2WJXvzH')>stickers.indexOf('id="consultar"'));
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

test('Calendarios Mignon 2027 en catálogo como próximo combo, sin cobro',()=>{
 const cal=read('calendarios-2027.html');
 const asset=new URL('box/calendarios-mignon-2027.jpg',root);
 assert.match(box,/COMBO 03 · CALENDARIOS PARA IMPRIMIR/);
 assert.match(box,/DISPONIBLE · UNIVERSO 2027/);
 assert.match(box,/\$4\.990 ARS/);
 assert.match(box,/href="\/box\/calendarios-2027"/);
 assert.match(cal,/22 calendarios de tres formatos|22 piezas en tres formatos/);
 assert.match(cal,/12 mensuales/);
 assert.match(cal,/6 bimestrales/);
 assert.match(cal,/4 trimestrales/);
 assert.match(cal,/PowerPoint/);
 assert.match(cal,/Sin envío físico/);
 assert.match(cal,/Comprar con Mercado Pago/);
 assert.match(cal,/\$4\.990/);
 assert.match(cal,/Ya pagué · Coordinar entrega por WhatsApp/);
 assert.equal(cal.split('https://mpago.la/1sKw9Mo').length-1,1,'Un solo link MP específico de Calendarios');
 assert.equal(box.includes('https://mpago.la/1sKw9Mo'),false,'No incluir Link MP directo en catálogo');
 assert.equal(cal.includes('mpago.la/12rSj12'),false,'No confundir Link de Fiestas');
 assert.equal(cal.includes('mpago.la/2WJXvzH'),false,'No confundir Link de Stickers');
 assert.match(cal,/feriados turísticos/);
 assert.match(cal,/entrega del ZIP es manual/);
 assert.ok(fs.existsSync(asset) && fs.statSync(asset).size > 200000);
 assert.ok(build.includes("'calendarios-2027.html'"));
 assert.ok(build.includes("'box/calendarios-mignon-2027.jpg'"));
 assert.ok(vercel.rewrites.some(x=>x.source==='/box/calendarios-2027'&&x.destination==='/calendarios-2027.html'));
 assert.match(read('sitemap.xml'),/https:\/\/cosmica\.ar\/box\/calendarios-2027/);
});

test('Calendarios anime 2027 V3 con feriados y sin marcas, sin cobro Mignon',()=>{
 const cal=read('calendarios-2027.html');
 const image=new URL('box/calendarios-anime-2027-v3-feriados.jpg',root);
 assert.match(box,/COMBO 04 · CALENDARIOS ANIME A4/);
 assert.match(box,/href="\/box\/calendarios-2027#anime"/);
 assert.match(box,/Sin precio ni compra habilitada/);
 assert.match(box,/feriados nacionales de Argentina y sin marcas/);
 assert.match(cal,/id="anime"/);
 assert.match(cal,/12 calendarios tradicionales de pared/);
 assert.match(cal,/24 páginas A4 entre ambas ediciones/);
 assert.match(cal,/20 de noviembre puede trasladarse/);
 assert.match(cal,/Decreto 614\/2025/);
 assert.match(cal,/no están incluidos en el combo de \$4\.990/);
 assert.match(cal,/Consultar por Anime 2027/);
 assert.ok(fs.existsSync(image)&&fs.statSync(image).size>200000);
 assert.ok(build.includes("'box/calendarios-anime-2027-v3-feriados.jpg'"));
 assert.equal(cal.split('https://mpago.la/1sKw9Mo').length-1,1,'No duplicar links Mignon');
});
