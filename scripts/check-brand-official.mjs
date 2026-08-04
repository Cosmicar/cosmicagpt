import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const officialAssets = {
  'brand/official/avatar-light.png': ['644b1530532b5b914e2436e6a5e0acd4dc0d5bde0001c45568b5932479150a18', 1080, 1080],
  'brand/official/avatar-obsidian.png': ['0194890ce4bdcf2c52395b223cbe1edfddb374acb3af1599b8804ac5d06698b3', 1080, 1080],
  'brand/official/cosmica-logo-dark.png': ['ccba584e1af8bc996b273b64c8e6f907d04e3ff6ea76adcf8a406c973d7b7e03', 3798, 1851],
  'brand/official/cosmica-logo-light.png': ['7687444931e1f093fcb5845edfeff1251b0b15ce01584fdf051c2351c4c57a61', 3798, 1851],
  'brand/official/cosmica-symbol.png': ['0854bb91003978d48f5156605dce3ef01e52b370b2cb0e0774380194c5b5dab7', 1592, 1851],
  'brand/official/cover-facebook.png': ['986b1f4559cd89fecb781c115b1bffde9e86cd9d55d5c1977541bddc7cc7aba7', 1640, 624],
  'brand/official/cover-x.png': ['98c7606bfcbf23130e8d4ab351e85cf619e64f322bef0501fc848f4adbfb55c0', 1500, 500],
};

const requiredFiles = [
  ...Object.keys(officialAssets),
  'marketing/brand-v2.js',
  'marketing/brand-v2.css',
  'scripts/sync-brand-markup.mjs',
];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Falta el archivo obligatorio ${relativePath}`);
  }
}

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const pngDimensions = buffer => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return null;
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

for (const [relativePath, [expectedHash, width, height]] of Object.entries(officialAssets)) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const file = fs.readFileSync(absolutePath);
  const dimensions = pngDimensions(file);
  if (!dimensions) errors.push(`${relativePath} no es un PNG válido`);
  else if (dimensions[0] !== width || dimensions[1] !== height) errors.push(`${relativePath} cambió de dimensiones`);
  if (sha256(file) !== expectedHash) errors.push(`${relativePath} no coincide con la entrega oficial`);
}

const publicFiles = fs
  .readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name);

for (const relativePath of publicFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (!source.includes('<html')) continue;
  for (const token of [
    '/brand/v2/',
    'cosmica-logo.webp',
    'favicon.ico',
    'apple-touch-icon.png',
    '🚀',
    '👨‍🚀',
    '#00E5FF',
  ]) {
    if (source.includes(token)) errors.push(`${relativePath} conserva identidad retirada: ${token}`);
  }

  for (const requiredHead of [
    '/brand/official/cosmica-symbol.png?v=7',
    '/brand/official/avatar-light.png?v=7',
    '/marketing/brand-v2.css?v=7',
    '/marketing/brand-v2.js',
  ]) {
    if (!source.includes(requiredHead)) errors.push(`${relativePath} no contiene ${requiredHead}`);
  }

  if (/class=(["'])[^"']*\bbrand\b[^"']*\1/i.test(source)) {
    if (!source.includes('brand-official-logo') || !source.includes('/brand/official/cosmica-logo-')) {
      errors.push(`${relativePath} no usa la firma oficial completa`);
    }
  }
  if (source.includes('property="og:image"') && !source.includes('/brand/official/cover-facebook.png?v=7')) {
    errors.push(`${relativePath} no usa la portada oficial de Facebook`);
  }
  if (source.includes('name="twitter:image"') && !source.includes('/brand/official/cover-x.png?v=7')) {
    errors.push(`${relativePath} no usa la portada oficial de X`);
  }
}

const contracts = {
  'marketing/brand-v2.css': [
    '#E1063A',
    '#0F121A',
    '#F6F3F0',
    '#D9D4CF',
    '.brand.brand-official',
  ],
  'marketing/brand-v2.js': [
    "const BRAND_ROOT = '/brand/official'",
    "const BRAND_VERSION = '7'",
    'cosmica-logo-${variant}.png',
    'cosmica-symbol.png',
    'avatar-light.png',
  ],
  'scripts/sync-brand-markup.mjs': [
    "const BRAND_VERSION = '7'",
    '/brand/official/cosmica-logo-${variant}.png',
    '/brand/official/cosmica-symbol.png',
    '/brand/official/cover-facebook.png?v=7',
  ],
};

for (const [relativePath, tokens] of Object.entries(contracts)) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${relativePath} no contiene el contrato ${token}`);
  }
  if (source.includes('/brand/v2/')) errors.push(`${relativePath} conserva activos reconstruidos`);
}

for (const retiredFile of [
  'brand/v2/cosmica-isotipo-micro.svg',
  'brand/v2/cosmica-logo-integrado-dark.svg',
  'brand/v2/cosmica-logo-integrado-light.svg',
  'apple-touch-icon.png',
  'cosmica-logo.datauri.txt',
  'cosmica-logo.png',
  'cosmica-logo.webp',
  'favicon.ico',
  'icon-512.png',
  'new_logo.png',
  'preview.jpg',
]) {
  if (fs.existsSync(path.join(root, retiredFile))) errors.push(`El activo legacy ${retiredFile} debe retirarse`);
}

if (errors.length) {
  console.error('\nVerificación de marca oficial fallida:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`✓ Identidad oficial verificada contra ${Object.keys(officialAssets).length} originales en ${publicFiles.length} páginas.`);
