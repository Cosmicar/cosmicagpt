import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND_VERSION = '10';
const BRAND_CSS = `/marketing/brand-v2.css?v=${BRAND_VERSION}`;
const BRAND_SCRIPT = '/marketing/brand-v2.js';
const ICON_ROOT = '/brand/official/icons';

const htmlFiles = fs
  .readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name);

const brandAnchorPattern = /<a([^>]*class=(["'])[^"']*\bbrand\b[^"']*\2[^>]*)>[\s\S]*?<\/a>/gi;

function upgradeBrandAnchors(source) {
  return source.replace(
    brandAnchorPattern,
    (match, attrs, _classQuote, offset, fullSource) => {
      const lastFooterOpen = fullSource.lastIndexOf('<footer', offset);
      const lastFooterClose = fullSource.lastIndexOf('</footer', offset);
      const variant = lastFooterOpen > lastFooterClose ? 'dark' : 'light';

      const upgradedAttrs = attrs.replace(
        /class=(["'])([^"']*)\1/i,
        (_classMatch, quote, classes) => {
          const classList = classes
            .split(/\s+/)
            .filter(Boolean)
            .filter(className => className !== 'brand-v2');
          if (!classList.includes('brand-official')) classList.push('brand-official');
          return `class=${quote}${classList.join(' ')}${quote}`;
        }
      );

      return `<a${upgradedAttrs}><img class="brand-official-logo" src="/brand/official/cosmica-logo-${variant}.png?v=${BRAND_VERSION}" alt="Cósmica" width="3798" height="1851" decoding="async"></a>`;
    }
  );
}

function ensureOfficialHead(source) {
  if (!source.includes('</head>')) return source;

  let updated = source
    .replace(/<link\b[^>]*rel=(["'])[^"']*(?:apple-touch-icon|(?:shortcut\s+)?icon)[^"']*\1[^>]*>\s*/gi, '')
    .replace(/<link\b[^>]*rel=(["'])manifest\1[^>]*>\s*/gi, '')
    .replace(/\/marketing\/brand-v2\.css\?v=\d+/g, BRAND_CSS)
    .replace(/(<meta\s+name=(["'])theme-color\2\s+content=(["']))[^"']+(["'][^>]*>)/gi, '$1#0F121A$4')
    .replace(/(<meta\s+property=(["'])og:image\2\s+content=(["']))[^"']+(["'][^>]*>)/gi, `$1https://cosmica.ar/brand/official/cover-facebook.png?v=${BRAND_VERSION}$4`)
    .replace(/(<meta\s+property=(["'])og:image:width\2\s+content=(["']))[^"']+(["'][^>]*>)/gi, '$11640$4')
    .replace(/(<meta\s+property=(["'])og:image:height\2\s+content=(["']))[^"']+(["'][^>]*>)/gi, '$1624$4')
    .replace(/(<meta\s+name=(["'])twitter:image\2\s+content=(["']))[^"']+(["'][^>]*>)/gi, `$1https://cosmica.ar/brand/official/cover-x.png?v=${BRAND_VERSION}$4`);

  const additions = [
    `<link rel="icon" type="image/png" sizes="16x16" href="${ICON_ROOT}/cosmica-c-v10-16.png">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${ICON_ROOT}/cosmica-c-v10-32.png">`,
    `<link rel="icon" type="image/x-icon" href="${ICON_ROOT}/favicon-c-v10.ico">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${ICON_ROOT}/cosmica-c-v10-180.png">`,
    `<link rel="manifest" href="/site.webmanifest?v=${BRAND_VERSION}">`,
  ];
  if (!updated.includes('/marketing/brand-v2.css')) {
    additions.push(`<link rel="stylesheet" href="${BRAND_CSS}">`);
  }
  if (!updated.includes(`src="${BRAND_SCRIPT}"`) && !updated.includes(`src='${BRAND_SCRIPT}'`)) {
    additions.push(`<script src="${BRAND_SCRIPT}" defer></script>`);
  }

  return updated.replace('</head>', `${additions.join('\n')}\n</head>`);
}

let changedFiles = 0;
let upgradedBrands = 0;

for (const relativePath of htmlFiles) {
  const absolutePath = path.join(root, relativePath);
  const original = fs.readFileSync(absolutePath, 'utf8');
  const beforeBrands = (original.match(/class=(["'])[^"']*\bbrand\b[^"']*\1/gi) ?? []).length;

  let updated = upgradeBrandAnchors(original);
  updated = ensureOfficialHead(updated);
  updated = updated
    .replaceAll('🚀', '')
    .replaceAll('https://cosmica.ar/preview.jpg', `https://cosmica.ar/brand/official/cover-facebook.png?v=${BRAND_VERSION}`);

  upgradedBrands += beforeBrands;

  if (updated !== original) {
    fs.writeFileSync(absolutePath, updated);
    changedFiles += 1;
  }
}

console.log(`✓ Identidad oficial sincronizada en ${changedFiles} archivos; ${upgradedBrands} firmas verificadas.`);
