import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND_VERSION = '5';
const BRAND_CSS = `/marketing/brand-v2.css?v=${BRAND_VERSION}`;
const BRAND_SCRIPT = '/marketing/brand-v2.js';

const htmlFiles = fs
  .readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name);

const legacyBrandPattern = /<a([^>]*class=(["'])[^"']*\bbrand\b[^"']*\2[^>]*)>\s*<img[^>]*src=(["'])\/?cosmica-logo\.webp\3[^>]*>\s*CÓSMICA\s*<\/a>/gi;

function upgradeBrandAnchors(source) {
  return source.replace(
    legacyBrandPattern,
    (match, attrs, classQuote, _srcQuote, offset, fullSource) => {
      const lastFooterOpen = fullSource.lastIndexOf('<footer', offset);
      const lastFooterClose = fullSource.lastIndexOf('</footer', offset);
      const variant = lastFooterOpen > lastFooterClose ? 'dark' : 'light';

      const upgradedAttrs = attrs.replace(
        /class=(["'])([^"']*)\1/i,
        (_classMatch, quote, classes) => {
          const classList = classes.split(/\s+/).filter(Boolean);
          if (!classList.includes('brand-v2')) classList.push('brand-v2');
          return `class=${quote}${classList.join(' ')}${quote}`;
        }
      );

      return `<a${upgradedAttrs}><img class="brand-v2-logo" src="/brand/v2/cosmica-logo-integrado-${variant}.svg?v=${BRAND_VERSION}" alt="Cósmica" decoding="async"></a>`;
    }
  );
}

function ensureOfficialHead(source) {
  if (!source.includes('</head>')) return source;

  const additions = [];
  if (!source.includes('/marketing/brand-v2.css')) {
    additions.push(`<link rel="stylesheet" href="${BRAND_CSS}">`);
  }
  if (!source.includes(`src="${BRAND_SCRIPT}"`) && !source.includes(`src='${BRAND_SCRIPT}'`)) {
    additions.push(`<script src="${BRAND_SCRIPT}" defer></script>`);
  }

  if (additions.length === 0) return source;
  return source.replace('</head>', `${additions.join('\n')}\n</head>`);
}

let changedFiles = 0;
let upgradedBrands = 0;

for (const relativePath of htmlFiles) {
  const absolutePath = path.join(root, relativePath);
  const original = fs.readFileSync(absolutePath, 'utf8');
  const beforeBrands = (original.match(/cosmica-logo\.webp/gi) ?? []).length;

  let updated = upgradeBrandAnchors(original);
  updated = ensureOfficialHead(updated);
  updated = updated.replaceAll('🚀', '');

  const afterBrands = (updated.match(/cosmica-logo\.webp/gi) ?? []).length;
  upgradedBrands += Math.max(0, beforeBrands - afterBrands);

  if (updated !== original) {
    fs.writeFileSync(absolutePath, updated);
    changedFiles += 1;
  }
}

console.log(`✓ Markup oficial A1.1 sincronizado en ${changedFiles} archivos; ${upgradedBrands} firmas legacy reemplazadas.`);
