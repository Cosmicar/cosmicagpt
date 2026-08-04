import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);
const textExtensions = new Set(['.html', '.js', '.mjs', '.json', '.md', '.txt', '.xml', '.yml', '.yaml']);
const ignoredRelativePaths = new Set([
  'scripts/sync-brand-contacts.mjs',
  'scripts/check-brand-official.mjs',
]);

const replacements = [
  ['https://www.facebook.com/cosmica.arg/', 'https://www.facebook.com/somoscosmica'],
  ['https://www.facebook.com/cosmica.arg', 'https://www.facebook.com/somoscosmica'],
  ['https://www.instagram.com/cosmica.plus/', 'https://www.instagram.com/somoscosmica.ar'],
  ['https://www.instagram.com/cosmica.plus', 'https://www.instagram.com/somoscosmica.ar'],
  ['https://x.com/cosmicaarg', 'https://x.com/somoscosmica'],
  ['@cosmica.plus', '@somoscosmica.ar'],
  ['@cosmicaarg', '@somoscosmica'],
  ['tecnocosmica@gmail.com', 'hola@cosmica.ar'],
  ['soporte@cosmica.ar', 'hola@cosmica.ar'],
  ['info@cosmica.ar', 'hola@cosmica.ar']
];

const FACEBOOK_URL = 'https://www.facebook.com/somoscosmica';
const INSTAGRAM_URL = 'https://www.instagram.com/somoscosmica.ar';
const X_URL = 'https://x.com/somoscosmica';
const THREADS_URL = 'https://www.threads.net/@somoscosmica.ar';
const EMAIL = 'hola@cosmica.ar';

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolutePath));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolutePath);
  }
  return files;
}

function replaceLegacyReferences() {
  for (const absolutePath of walk(root)) {
    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
    if (ignoredRelativePaths.has(relativePath)) continue;
    const original = fs.readFileSync(absolutePath, 'utf8');
    let updated = original;
    for (const [from, to] of replacements) updated = updated.replaceAll(from, to);
    if (updated !== original) fs.writeFileSync(absolutePath, updated);
  }
}

function update(relativePath, transform) {
  const absolutePath = path.join(root, relativePath);
  const original = fs.readFileSync(absolutePath, 'utf8');
  const updated = transform(original);
  if (updated !== original) fs.writeFileSync(absolutePath, updated);
}

function socialLinksHtml() {
  return [
    `<a href="${INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer">Instagram</a>`,
    `<a href="${FACEBOOK_URL}" target="_blank" rel="noopener noreferrer">Facebook</a>`,
    `<a href="${X_URL}" target="_blank" rel="noopener noreferrer">X</a>`,
    `<a href="mailto:${EMAIL}">${EMAIL}</a>`
  ].join('\n          ');
}

replaceLegacyReferences();

update('index.html', source => {
  let output = source;
  output = output.replace(
    /"telephone":"\+5493883298736","areaServed":"AR"/,
    `"telephone":"+5493883298736","email":"${EMAIL}","areaServed":"AR"`
  );
  output = output.replace(
    /"sameAs":\[[^\]]*\]/,
    `"sameAs":["${FACEBOOK_URL}","${INSTAGRAM_URL}","${X_URL}","${THREADS_URL}"]`
  );
  output = output.replace(
    /<a href="https:\/\/www\.instagram\.com\/somoscosmica\.ar"[^>]*>Instagram<\/a>\s*<a href="https:\/\/www\.facebook\.com\/somoscosmica"[^>]*>Facebook<\/a>(?:\s*<a href="https:\/\/x\.com\/somoscosmica"[^>]*>X<\/a>)?(?:\s*<a href="mailto:hola@cosmica\.ar">hola@cosmica\.ar<\/a>)?/,
    socialLinksHtml()
  );
  return output;
});

update('template-cobertura.html', source => source.replace(
  /<a href="https:\/\/www\.instagram\.com\/somoscosmica\.ar"[^>]*>Instagram<\/a>(?:<a href="https:\/\/www\.facebook\.com\/somoscosmica"[^>]*>Facebook<\/a>)?(?:<a href="https:\/\/x\.com\/somoscosmica"[^>]*>X<\/a>)?(?:<a href="mailto:hola@cosmica\.ar">hola@cosmica\.ar<\/a>)?/,
  socialLinksHtml().replaceAll('\n          ', '')
));

update('template-provincia.html', source => source.replace(
  /<div class="footer-links"><a href="\/">Inicio<\/a><a href="\/soporte-tecnico-remoto-argentina\.html">Cobertura<\/a><a href="\/asistencia\.html">Asistencia<\/a>(?:<a[^>]+>[^<]+<\/a>)*<\/div>/,
  `<div class="footer-links"><a href="/">Inicio</a><a href="/soporte-tecnico-remoto-argentina.html">Cobertura</a><a href="/asistencia.html">Asistencia</a>${socialLinksHtml().replaceAll('\n          ', '')}</div>`
));

update('asistencia.html', source => source.replace(
  /<footer>© <span id="year"><\/span> Cósmica · Asistencia remota segura(?: · <a href="mailto:hola@cosmica\.ar">hola@cosmica\.ar<\/a>)?<\/footer>/,
  `<footer>© <span id="year"></span> Cósmica · Asistencia remota segura · <a href="mailto:${EMAIL}">${EMAIL}</a></footer>`
));

update('generar-provincias.js', source => {
  let output = source;
  output = output.replace(
    /\s*sameAs:\s*\[[^\]]*\]\s*/,
    `\n  email: '${EMAIL}',\n  sameAs: ['${FACEBOOK_URL}','${INSTAGRAM_URL}','${X_URL}','${THREADS_URL}']\n`
  );
  return output;
});

console.log('✓ Redes y correo oficiales sincronizados en el sitio.');
