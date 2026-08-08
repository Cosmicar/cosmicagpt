import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failMessages = [];
const fail = message => failMessages.push(message);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

console.log('Generando páginas provinciales...');
try {
  execFileSync(process.execPath, [path.join(root, 'generar-provincias.js')], {
    cwd: root,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('✗ No se pudieron generar las páginas provinciales.');
  process.exit(error.status || 1);
}

const provinceData = JSON.parse(read('data/provincias.json'));
const provinces = provinceData.provinces;
const provinceFiles = provinces.map(province => `pc-lenta-${province.slug}.html`);
const requiredFiles = [
  'index.html',
  'asistencia.html',
  'plus.html',
  'planes.html',
  'template-provincia.html',
  'template-cobertura.html',
  'soporte-tecnico-remoto-argentina.html',
  'sitemap.xml',
  'robots.txt',
  'data/provincias.json',
  'marketing/site.css',
  'marketing/home.js',
  'marketing/assistance.css',
  'marketing/assistance.js',
  'marketing/humans.css',
  'marketing/refinements.css',
  'marketing/header-polish.css',
  'marketing/coverage.css',
  'marketing/province.css',
  'marketing/province.js',
  'marketing/plus.css',
  'marketing/planes.css',
  'marketing/hero-client.webp',
  'marketing/problem-client.webp',
  'marketing/review-client.webp',
  'marketing/assistance-client.webp',
  'marketing/assistance-technician.webp',
  'site.webmanifest',
  'favicon.ico',
  'brand/official/icons/cosmica-c-v10-16.png',
  'brand/official/icons/cosmica-c-v10-32.png',
  'brand/official/icons/cosmica-c-v10-180.png',
  'brand/official/icons/cosmica-c-v10-192.png',
  'brand/official/icons/cosmica-c-v10-512.png',
  'brand/official/icons/favicon-c-v10.ico',
  ...provinceFiles
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
    fail(`Falta archivo requerido: ${file}`);
  }
}

const balancedDocument = (html, file) => {
  if (!/^<!doctype html>/i.test(html.trim())) fail(`${file}: falta doctype`);
  for (const tag of ['html', 'head', 'body', 'main']) {
    const opens = (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || []).length;
    const closes = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (opens !== 1 || closes !== 1) fail(`${file}: balance incorrecto de <${tag}> (${opens}/${closes})`);
  }
  if (/\{\{[^}]+\}\}/.test(html)) fail(`${file}: contiene placeholders sin reemplazar`);
};

const extract = (html, pattern) => html.match(pattern)?.[1]?.trim() || '';

const indexHtml = read('index.html');
const assistanceHtml = read('asistencia.html');
const plusHtml = read('plus.html');
const plansHtml = read('planes.html');
const homeJs = read('marketing/home.js');
balancedDocument(indexHtml, 'index.html');
balancedDocument(assistanceHtml, 'asistencia.html');
balancedDocument(plusHtml, 'plus.html');
balancedDocument(plansHtml, 'planes.html');

const currentPlanPrices = ['$24.900', '$35.900', '$49.900'];
const retiredPlanPrices = ['$19.900', '$29.900', '$39.900'];
for (const price of currentPlanPrices) {
  if (!indexHtml.includes(price)) fail(`index.html: falta el precio vigente ${price}`);
  if (!plansHtml.includes(price)) fail(`planes.html: falta el precio vigente ${price}`);
}
for (const price of retiredPlanPrices) {
  if (indexHtml.includes(price)) fail(`index.html: conserva el precio anterior ${price}`);
  if (plansHtml.includes(price)) fail(`planes.html: conserva el precio anterior ${price}`);
}

const indexPatterns = [
  /<title>[^<]+<\/title>/,
  /href="\/marketing\/site\.css"/,
  /src="\/marketing\/home\.js"/,
  /src="\/marketing\/hero-client\.webp"/,
  /src="\/brand\/official\/cosmica-logo-light\.png\?v=10"/,
  /href="\/plus"/,
  /id="problemas"/,
  /id="planes"/,
  /id="seguridad"/,
  /https:\/\/app\.cosmica\.ar/,
  /5493883298736/
];
for (const pattern of indexPatterns) if (!pattern.test(indexHtml)) fail(`index.html: falta ${pattern}`);

const assistancePatterns = [
  /href="\/marketing\/assistance\.css"/,
  /src="\/marketing\/assistance\.js"/,
  /src="\/marketing\/assistance-client\.webp"/,
  /src="\/marketing\/assistance-technician\.webp"/,
  /src="\/brand\/official\/cosmica-logo-light\.png\?v=10"/,
  /id="downloadAnydesk"/,
  /id="openedButton"/,
  /id="sendId"/,
  /anydesk\.com\/es\/downloads\/windows/,
  /5493883298736/
];
for (const pattern of assistancePatterns) if (!pattern.test(assistanceHtml)) fail(`asistencia.html: falta ${pattern}`);

const plusPatterns = [
  /<link rel="canonical" href="https:\/\/cosmica\.ar\/plus">/,
  /href="\/marketing\/plus\.css(?:\?v=[^"]+)?"/,
  /href="\/brand\/official\/icons\/cosmica-c-v10-16\.png"/,
  /href="\/brand\/official\/icons\/favicon-c-v10\.ico"/,
  /href="\/site\.webmanifest\?v=10"/,
  /Cósmica App Pro incluida/,
  /\$49\.000/,
  /https:\/\/cafecito\.app\/cosmica/,
  /5493883298736/
];
for (const pattern of plusPatterns) if (!pattern.test(plusHtml)) fail(`plus.html: falta ${pattern}`);

const plansPatterns = [
  /<link rel="canonical" href="https:\/\/cosmica\.ar\/planes">/,
  /href="\/marketing\/planes\.css(?:\?v=[^"]+)?"/,
  /src="\/brand\/official\/cosmica-logo-light\.png\?v=10"/,
  /href="\/brand\/official\/icons\/cosmica-c-v10-16\.png"/,
  /href="\/brand\/official\/icons\/favicon-c-v10\.ico"/,
  /href="\/site\.webmanifest\?v=10"/,
  /id="bronce"/,
  /id="oro"/,
  /id="platinum"/,
  /Windows 11/,
  /Garantía de 90 días/,
  /"@type":"Service"/,
  /"@type":"FAQPage"/,
  /5493883298736/
];
for (const pattern of plansPatterns) if (!pattern.test(plansHtml)) fail(`planes.html: falta ${pattern}`);

if (!homeJs.includes("plansNavLink.href = '/planes'")) fail('home.js: no enlaza la navegación de planes con /planes');
if (!homeJs.includes('Ver qué incluye cada plan')) fail('home.js: falta CTA hacia el detalle completo de planes');

const manifest = JSON.parse(read('site.webmanifest'));
if (manifest.theme_color !== '#0F121A' || manifest.background_color !== '#0F121A') fail('site.webmanifest: colores de marca incorrectos');
for (const [size, file] of [['192x192', 'cosmica-c-v10-192.png'], ['512x512', 'cosmica-c-v10-512.png']]) {
  if (!manifest.icons?.some(icon => icon.sizes === size && icon.src.endsWith(file))) fail(`site.webmanifest: falta el icono ${size}`);
}

const vercelConfig = JSON.parse(read('vercel.json'));
if (!vercelConfig.rewrites?.some(rewrite => rewrite.source === '/plus' && rewrite.destination === '/plus.html')) {
  fail('vercel.json: falta la reescritura directa de /plus');
}
if (!vercelConfig.rewrites?.some(rewrite => rewrite.source === '/planes' && rewrite.destination === '/planes.html')) {
  fail('vercel.json: falta la reescritura directa de /planes');
}

if (!homeJs.includes("coverage.id = 'cobertura-nacional'")) fail('home.js: no inserta el directorio provincial');
if (!homeJs.includes('/soporte-tecnico-remoto-argentina.html')) fail('home.js: falta enlace al directorio nacional');
if (!homeJs.includes('/pc-lenta-${slug}.html')) fail('home.js: falta la plantilla de enlaces provinciales');
for (const province of provinces) {
  if (!homeJs.includes(`'${province.slug}'`)) fail(`home.js: falta el slug de ${province.name}`);
}

const seenTitles = new Set();
const seenDescriptions = new Set();
for (const province of provinces) {
  const file = `pc-lenta-${province.slug}.html`;
  const html = read(file);
  balancedDocument(html, file);

  const title = extract(html, /<title>([^<]+)<\/title>/i);
  const description = extract(html, /<meta name="description" content="([^"]+)"/i);
  const canonical = extract(html, /<link rel="canonical" href="([^"]+)"/i);
  const h1 = extract(html, /<h1>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '');

  if (!title.includes(province.name)) fail(`${file}: el title no incluye la provincia`);
  if (seenTitles.has(title)) fail(`${file}: title duplicado`);
  seenTitles.add(title);

  if (description.length < 85 || description.length > 170) fail(`${file}: description fuera de rango (${description.length})`);
  if (seenDescriptions.has(description)) fail(`${file}: meta description duplicada`);
  seenDescriptions.add(description);

  const expectedCanonical = `https://cosmica.ar/pc-lenta-${province.slug}.html`;
  if (canonical !== expectedCanonical) fail(`${file}: canonical incorrecto`);
  if (!h1.includes(province.name)) fail(`${file}: el H1 no incluye la provincia`);
  if (!html.includes('"@type":"Service"')) fail(`${file}: falta schema Service`);
  if (!html.includes('"@type":"BreadcrumbList"')) fail(`${file}: falta schema BreadcrumbList`);
  if (!html.includes('"@type":"FAQPage"')) fail(`${file}: falta schema FAQPage`);
  if (!html.includes('/soporte-tecnico-remoto-argentina.html')) fail(`${file}: falta enlace al hub nacional`);
  if (!html.includes('Nuestra base física está en San Salvador de Jujuy')) fail(`${file}: no aclara la base física real`);
  if (!html.includes('Planes desde $24.900')) fail(`${file}: falta el precio inicial vigente`);
  if (retiredPlanPrices.some(price => html.includes(price))) fail(`${file}: conserva un precio anterior`);

  const cityMatches = province.cities.filter(city => html.includes(city));
  if (cityMatches.length < 3) fail(`${file}: faltan ciudades de referencia`);
}

const hub = read('soporte-tecnico-remoto-argentina.html');
balancedDocument(hub, 'soporte-tecnico-remoto-argentina.html');
if (!hub.includes('"@type":"Service"')) fail('hub nacional: falta schema Service');
if (!hub.includes('"@type":"BreadcrumbList"')) fail('hub nacional: falta schema BreadcrumbList');
for (const province of provinces) {
  if (!hub.includes(`/pc-lenta-${province.slug}.html`)) fail(`hub nacional: falta ${province.name}`);
}

const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (sitemapUrls.length !== 29) fail(`sitemap: se esperaban 29 URLs y hay ${sitemapUrls.length}`);
if ((sitemap.match(/<lastmod>/g) || []).length !== 29) fail('sitemap: faltan lastmod');
if (!sitemapUrls.includes('https://cosmica.ar/plus')) fail('sitemap: falta Cósmica+');
if (!sitemapUrls.includes('https://cosmica.ar/planes')) fail('sitemap: falta la landing de planes');
for (const province of provinces) {
  const url = `https://cosmica.ar/pc-lenta-${province.slug}.html`;
  if (!sitemapUrls.includes(url)) fail(`sitemap: falta ${province.name}`);
}

for (const file of ['marketing/home.js', 'marketing/assistance.js', 'marketing/province.js', 'generar-provincias.js']) {
  const source = read(file);
  try {
    new Function(source);
  } catch (error) {
    fail(`${file}: error de sintaxis: ${error.message}`);
  }
}

if (failMessages.length) {
  console.error('\nValidación fallida:');
  for (const message of failMessages) console.error(`  ✗ ${message}`);
  process.exit(1);
}

console.log(`\n✓ Home, planes, asistencia, hub y ${provinces.length} páginas provinciales validadas.`);
