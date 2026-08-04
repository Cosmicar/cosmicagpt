import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const officialAssets = {
  'brand/official/avatar-light.png': ['35adc0ee6c36599c4f7deaf2d96a4b38236f7d3b5b0c65f2dd20a23b70f792a4', 1080, 1080],
  'brand/official/avatar-obsidian.png': ['071545d52ad293842cd96e7afc7c2acb7d3f0c5b661417c5721ec0a401323eef', 1080, 1080],
  'brand/official/cosmica-logo-dark.png': ['e4364e4a85e945738af2c1e56950208b90bfbe8fe97c8a261f5330069fb52903', 3798, 1851],
  'brand/official/cosmica-logo-light.png': ['0118c7840633be76e6713cdccab3ebe375d546d43e02cd03d93a1f44f477c3aa', 3798, 1851],
  'brand/official/cosmica-symbol.png': ['4187a11b8607df122f4b25bf01cbfd1cb2e43c38925dfcdd5a8f38fd2e46f6fb', 1080, 1080],
  'brand/official/cover-facebook.png': ['cc2ed6cfaf2e3094b54c79fd6140f166f10131efa4391e5f316b2e7113b396c9', 1640, 624],
  'brand/official/cover-x.png': ['9a29bfeb48f832788a0dc7cbe6603b15e4a81e9d84ddd6e7f2a28e1536873f71', 1500, 500],
};

const requiredFiles = [
  ...Object.keys(officialAssets),
  'marketing/brand-v2.js',
  'marketing/brand-v2.css',
  'scripts/sync-brand-markup.mjs',
  'brand/official/README.md',
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
    'tecnocosmica@gmail.com',
    'soporte@cosmica.ar',
    'info@cosmica.ar',
  ]) {
    if (source.includes(token)) errors.push(`${relativePath} conserva identidad retirada: ${token}`);
  }

  for (const requiredHead of [
    '/brand/official/cosmica-symbol.png?v=9',
    '/brand/official/avatar-light.png?v=9',
    '/marketing/brand-v2.css?v=9',
    '/marketing/brand-v2.js',
  ]) {
    if (!source.includes(requiredHead)) errors.push(`${relativePath} no contiene ${requiredHead}`);
  }

  if (/class=(["'])[^"']*\bbrand\b[^"']*\1/i.test(source)) {
    if (!source.includes('brand-official-logo') || !source.includes('/brand/official/cosmica-logo-')) {
      errors.push(`${relativePath} no usa la firma oficial completa`);
    }
  }
  if (source.includes('property="og:image"') && !source.includes('/brand/official/cover-facebook.png?v=9')) {
    errors.push(`${relativePath} no usa la portada oficial de Facebook`);
  }
  if (source.includes('name="twitter:image"') && !source.includes('/brand/official/cover-x.png?v=9')) {
    errors.push(`${relativePath} no usa la portada oficial de X`);
  }
}

const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!home.includes('mailto:hola@cosmica.ar') || !home.includes('>hola@cosmica.ar<')) {
  errors.push('index.html no publica hola@cosmica.ar como correo institucional');
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
    "const BRAND_VERSION = '9'",
    'cosmica-logo-${variant}.png',
    'cosmica-symbol.png',
    'avatar-light.png',
  ],
  'scripts/sync-brand-markup.mjs': [
    "const BRAND_VERSION = '9'",
    '/brand/official/cosmica-logo-${variant}.png',
    '/brand/official/cosmica-symbol.png',
    '/brand/official/cover-facebook.png?v=${BRAND_VERSION}',
  ],
  'brand/official/README.md': [
    'C limpia, sin acento ni trazo flotante',
    'En texto escrito, la marca conserva su ortografía: Cósmica.',
    'No utilizar ni reconstruir versiones anteriores.',
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
