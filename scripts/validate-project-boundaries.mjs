import fs from 'node:fs';

const fail = message => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};

const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const rewrites = vercelConfig.rewrites ?? [];
const redirects = vercelConfig.redirects ?? [];

for (const rewrite of rewrites) {
  const serialized = JSON.stringify(rewrite);
  if (serialized.includes('app.cosmica.ar')) {
    fail('vercel.json no puede usar app.cosmica.ar como host de una reescritura local.');
  }
  if (serialized.includes('/apps/cosmica-app')) {
    fail('vercel.json no puede servir una copia local de Cósmica.app.');
  }
}

const requiredRedirects = [
  '/app',
  '/app/:path*',
  '/staff',
  '/staff/:path*',
  '/login',
  '/login.html',
  '/panel',
  '/panel.html',
  '/estado',
  '/estado.html'
];

for (const source of requiredRedirects) {
  const match = redirects.find(redirect => redirect.source === source);
  if (!match) {
    fail(`Falta la redirección canónica para ${source}.`);
    continue;
  }
  if (!String(match.destination).startsWith('https://app.cosmica.ar/')) {
    fail(`${source} debe redirigir exclusivamente a app.cosmica.ar.`);
  }
}

const forbiddenPaths = [
  'apps',
  'release',
  'js',
  'components',
  'core',
  'services',
  'views',
  'docs',
  'panel.html',
  'login.html',
  'estado.html',
  'redesign.html',
  'indexold1.html',
  'firebase-messaging-sw.js',
  'manifest.json',
  'sw.js',
  'MIGRATION_RUNBOOK.md',
  'SYSTEM_OVERVIEW.md',
  'dev-server.err.log',
  'dev-server.out.log',
  'firestore.rules',
  '.vercelignore'
];

for (const legacyPath of forbiddenPaths) {
  if (fs.existsSync(legacyPath)) {
    fail(`El repositorio público no puede contener el legado: ${legacyPath}`);
  }
}

const readme = fs.readFileSync('README.md', 'utf8');
for (const required of ['www.cosmica.ar', 'app.cosmica.ar', 'Cosmicar/cosmica-app', 'rama autorizada', 'legado eliminado']) {
  if (!readme.includes(required)) fail(`README.md no documenta la regla canónica: ${required}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('✓ Repositorio limpio: la web pública y Cósmica.app permanecen separadas.');
