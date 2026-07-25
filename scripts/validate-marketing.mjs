import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const requiredFiles = [
  'index.html',
  'asistencia.html',
  'marketing/site.css',
  'marketing/sections.css',
  'marketing/responsive.css',
  'marketing/humans.css',
  'marketing/icons.svg',
  'marketing/hero-client.webp',
  'marketing/problem-client.webp',
  'marketing/review-client.webp',
  'marketing/home.js',
  'marketing/assistance.css',
  'marketing/assistance.js'
];
let failed = false;

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
    console.error(`✗ Falta archivo requerido: ${file}`);
    failed = true;
  }
}

const checks = {
  'index.html': [
    /<title>[^<]+<\/title>/,
    /href="\/marketing\/site\.css"/,
    /href="\/marketing\/sections\.css"/,
    /href="\/marketing\/responsive\.css"/,
    /src="\/marketing\/home\.js"/,
    /id="problemas"/,
    /id="planes"/,
    /id="seguridad"/,
    /data-source="hero-primary"/,
    /https:\/\/app\.cosmica\.ar/,
    /5493883298736/
  ],
  'asistencia.html': [
    /href="\/marketing\/assistance\.css"/,
    /src="\/marketing\/assistance\.js"/,
    /id="downloadAnydesk"/,
    /id="openedButton"/,
    /id="sendId"/,
    /anydesk\.com\/es\/downloads\/windows/,
    /5493883298736/
  ],
  'marketing/home.js': [
    /humanStyles\.href\s*=\s*['"]\/marketing\/humans\.css['"]/
  ],
  'marketing/humans.css': [
    /hero-client\.webp/,
    /problem-client\.webp/,
    /review-client\.webp/
  ]
};

for (const file of Object.keys(checks)) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  console.log(`\n${file}`);

  if (file.endsWith('.html')) {
    if (!/^<!doctype html>/i.test(source.trim())) {
      console.error('  ✗ Falta doctype');
      failed = true;
    } else console.log('  ✓ Doctype');

    for (const tag of ['html', 'head', 'body', 'main']) {
      const opens = (source.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || []).length;
      const closes = (source.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (opens !== closes || opens !== 1) {
        console.error(`  ✗ Balance incorrecto de <${tag}>: ${opens}/${closes}`);
        failed = true;
      } else console.log(`  ✓ <${tag}> balanceado`);
    }
  }

  for (const pattern of checks[file]) {
    if (!pattern.test(source)) {
      console.error(`  ✗ Falta patrón requerido: ${pattern}`);
      failed = true;
    }
  }

  if (file.endsWith('.html')) {
    if (/<a(?![^>]*id="sendLink")[^>]*href="#"/.test(source)) {
      console.error('  ✗ Enlace vacío detectado');
      failed = true;
    } else console.log('  ✓ Sin enlaces vacíos inesperados');

    if (/\{\{[^}]+\}\}/.test(source)) {
      console.error('  ✗ Placeholder sin reemplazar');
      failed = true;
    } else console.log('  ✓ Sin placeholders');
  }
}

for (const file of ['marketing/home.js', 'marketing/assistance.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  try {
    new Function(source);
    console.log(`✓ Sintaxis JS válida: ${file}`);
  } catch (error) {
    console.error(`✗ Error de sintaxis en ${file}: ${error.message}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nValidación fallida.');
  process.exit(1);
}
console.log('\n✓ Validación de marketing completada.');
