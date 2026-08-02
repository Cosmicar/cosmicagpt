import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const violations = [];
const strict = process.env.BRAND_STRICT !== '0';

const requiredAssets = [
  'brand/v2/cosmica-isotipo-micro.svg',
  'brand/v2/cosmica-logo-integrado-light.svg',
  'brand/v2/cosmica-logo-integrado-dark.svg',
  'marketing/brand-v2.js',
  'marketing/brand-v2.css'
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
      violations.push({ file: relativePath, rule: 'forbidden-token', token });
    }
  }

  if (relativePath.endsWith('.html')) {
    if (source.includes('cosmica-logo.webp')) {
      violations.push({ file: relativePath, rule: 'legacy-logo' });
    }

    if (source.includes('🚀')) {
      violations.push({ file: relativePath, rule: 'rocket-visible' });
    }

    const hasBrandAnchor = /class=(["'])[^"']*\bbrand\b[^"']*\1/i.test(source);
    if (hasBrandAnchor) {
      for (const requiredMarkup of [
        '/marketing/brand-v2.css',
        '/marketing/brand-v2.js',
        '/brand/v2/cosmica-logo-integrado-'
      ]) {
        if (!source.includes(requiredMarkup)) {
          violations.push({
            file: relativePath,
            rule: 'missing-official-markup',
            token: requiredMarkup
          });
        }
      }
    }
  }
}

for (const relativePath of requiredAssets) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    violations.push({ file: relativePath, rule: 'missing-required-asset' });
  }
}

for (const [relativePath, tokens] of Object.entries(officialTokens)) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const token of tokens) {
    if (!source.includes(token)) {
      violations.push({ file: relativePath, rule: 'missing-official-token', token });
    }
  }
}

const report = {
  standard: 'A1.1',
  strict,
  checkedFiles: publicFiles.length,
  violations
};

fs.writeFileSync(
  path.join(root, 'brand-check-report.json'),
  `${JSON.stringify(report, null, 2)}\n`
);

if (violations.length > 0) {
  console.error(`✗ Se detectaron ${violations.length} infracciones de marca.`);
  violations.forEach(item => console.error(`  - ${item.file}: ${item.rule}${item.token ? ` (${item.token})` : ''}`));
  if (strict) process.exit(1);
} else {
  console.log('✓ Identidad oficial A1.1 y markup canónico verificados en la landing.');
}
