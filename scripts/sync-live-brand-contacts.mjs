import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONTACTS = {
  email: 'hola@cosmica.ar',
  facebook: 'https://www.facebook.com/somoscosmica',
  instagram: 'https://www.instagram.com/somoscosmica.ar',
  x: 'https://x.com/somoscosmica',
  threads: 'https://www.threads.net/@somoscosmica.ar'
};

const legacyReplacements = [
  ['https://www.facebook.com/cosmica.arg/', CONTACTS.facebook],
  ['https://www.facebook.com/cosmica.arg', CONTACTS.facebook],
  ['https://www.instagram.com/cosmica.plus/', CONTACTS.instagram],
  ['https://www.instagram.com/cosmica.plus', CONTACTS.instagram],
  ['https://x.com/cosmicaarg', CONTACTS.x],
  ['@cosmica.plus', '@somoscosmica.ar'],
  ['@cosmicaarg', '@somoscosmica'],
  ['tecnocosmica@gmail.com', CONTACTS.email],
  ['soporte@cosmica.ar', CONTACTS.email]
];

const contactLinks = `
    <div class="seo-links brand-contact-links">
      <span>Contacto oficial</span>
      <a href="mailto:${CONTACTS.email}">${CONTACTS.email}</a>
      <a href="${CONTACTS.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a>
      <a href="${CONTACTS.facebook}" target="_blank" rel="noopener noreferrer">Facebook</a>
      <a href="${CONTACTS.x}" target="_blank" rel="noopener noreferrer">X</a>
      <a href="${CONTACTS.threads}" target="_blank" rel="noopener noreferrer">Threads</a>
    </div>`;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content);
}

function replaceLegacyReferences(source) {
  return legacyReplacements.reduce(
    (output, [legacy, current]) => output.replaceAll(legacy, current),
    source
  );
}

function updateComputerRepairSchema(source) {
  if (!source.includes('"@type": "ComputerRepair"') && !source.includes('"@type":"ComputerRepair"')) {
    return source;
  }

  let output = source;

  if (!/"email"\s*:\s*"hola@cosmica\.ar"/.test(output)) {
    output = output.replace(
      /("telephone"\s*:\s*"\+5493883298736"\s*,?)/,
      `$1\n  "email": "${CONTACTS.email}",`
    );
  }

  output = output.replace(
    /"sameAs"\s*:\s*\[[\s\S]*?\]/,
    `"sameAs": [\n    "${CONTACTS.facebook}",\n    "${CONTACTS.instagram}",\n    "${CONTACTS.x}",\n    "${CONTACTS.threads}"\n  ]`
  );

  return output;
}

function ensureContactFooter(source) {
  if (source.includes('class="seo-links brand-contact-links"')) return source;

  return source.replace(
    /(<div class="seo-links">[\s\S]*?<a href="\/pc-lenta-tucuman\.html">Tucumán<\/a>\s*<\/div>)(\s*<\/div>\s*<\/footer>)/,
    `$1${contactLinks}$2`
  );
}

function syncPage(relativePath, { schema = false, footer = false } = {}) {
  let source = replaceLegacyReferences(read(relativePath));
  if (schema) source = updateComputerRepairSchema(source);
  if (footer) source = ensureContactFooter(source);
  write(relativePath, source);
}

syncPage('index.html', { schema: true, footer: true });
syncPage('template-provincia.html', { schema: true, footer: true });

let assistance = replaceLegacyReferences(read('asistencia.html'));
assistance = assistance.replace(
  /<p>© <span id="year">2026<\/span> COSMICA · cosmica\.ar · Soporte técnico remoto profesional(?: · <a[^>]*>hola@cosmica\.ar<\/a>)?<\/p>/,
  `<p>© <span id="year">2026</span> Cósmica · cosmica.ar · <a href="mailto:${CONTACTS.email}">${CONTACTS.email}</a></p>`
);
write('asistencia.html', assistance);

console.log('✓ Contactos oficiales sincronizados en la web activa.');
