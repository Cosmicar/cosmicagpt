import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredAssets = [
  'brand/v2/cosmica-isotipo-micro.svg',
  'brand/v2/cosmica-logo-integrado-light.svg',
  'brand/v2/cosmica-logo-integrado-dark.svg',
  'marketing/brand-v2.js',
  'marketing/brand-v2.css',
  'vercel.json'
];

const retiredFiles = [
  'generate_logos.py',
  'gen_logos_run.py',
  'crop_logo.py',
  'update_logo_uris.py'
];

const forbiddenPublicTokens = [
  '@cosmica.plus',
  'facebook.com/cosmica.arg',
  'x.com/cosmicaarg',
  '@cosmicaarg',
  'tecnocosmica@gmail.com',
  '#D70A3A',
  '#0D1520',
  '#090E17'
];

const officialTokens = {
  'marketing/brand-v2.css': ['#E1063A', '#0F121A', '#F6F3F0', '#D9D4CF'],
  'marketing/brand-v2.js': [
    "const BRAND_ROOT = '/brand/v2'",
    'cosmica-logo-integrado-${variant}.svg',
    'cosmica-isotipo-micro.svg',
    "replaceAll('🚀', '')"
  ],
  'vercel.json': [
    '"source": "/cosmica-logo.webp"',
    '"source": "/cosmica-logo.png"',
    '"destination": "/brand/v2/cosmica-isotipo-micro.svg?v=5"'
  ]
};

const publicFiles = fs
  .readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name);

for (const relativePath of [
  ...publicFiles,
  'generar-provincias.js',
  'marketing/home.js',
  'marketing/assistance.js',
  'marketing/province.js',
  'marketing/brand-v2.js',
  'marketing/brand-v2.css'
]) {
  if (!fs.existsSync(path.join(root, relativePath))) continue;

  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');

  for (const token of forbiddenPublicTokens) {
    if (source.includes(token)) {
      throw new Error(`[brand] ${relativePath} contiene un token prohibido: ${token}`);
    }
  }

  if (relativePath.endsWith('.html')) {
    if (source.includes('cosmica-logo.webp')) {
      throw new Error(`[brand] ${relativePath} todavía contiene el logo legacy.`);
    }

    if (source.includes('🚀')) {
      throw new Error(`[brand] ${relativePath} todavía contiene un cohete visible.`);
    }

    const hasBrandAnchor = /class=(["'])[^"']*\bbrand\b[^"']*\1/i.test(source);
    if (hasBrandAnchor) {
      for (const requiredMarkup of [
        '/marketing/brand-v2.css',
        '/marketing/brand-v2.js',
        '/brand/v2/cosmica-logo-integrado-'
      ]) {
        if (!source.includes(requiredMarkup)) {
          throw new Error(
            `[brand] ${relativePath} no contiene el markup oficial requerido: ${requiredMarkup}`
          );
        }
      }
    }
  }
}

for (const relativePath of requiredAssets) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`[brand] Falta el activo obligatorio ${relativePath}`);
  }
}

for (const relativePath of retiredFiles) {
  if (fs.existsSync(path.join(root, relativePath))) {
    throw new Error(
      `[brand] Reapareció la herramienta legacy retirada ${relativePath}. Usar únicamente los activos y generadores A1.1.`
    );
  }
}

for (const [relativePath, tokens] of Object.entries(officialTokens)) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const token of tokens) {
    if (!source.includes(token)) {
      throw new Error(`[brand] ${relativePath} no contiene el token oficial ${token}`);
    }
  }
}

console.log('✓ Identidad oficial A1.1, markup canónico y compatibilidad legacy verificados.');
