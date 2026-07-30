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
    fail('vercel.json no puede servir la copia legacy de Cósmica.app.');
  }
  if (serialized.includes('cosmicagpt.vercel.app') && serialized.includes('cosmica-app')) {
    fail('El alias de Vercel no puede apuntar a la aplicación legacy.');
  }
}

const requiredRedirects = ['/app', '/app/:path*', '/staff', '/staff/:path*', '/login', '/panel'];
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

if (!fs.existsSync('.vercelignore')) {
  fail('Falta .vercelignore para excluir la aplicación legacy.');
} else {
  const ignored = fs.readFileSync('.vercelignore', 'utf8');
  if (!ignored.includes('apps/cosmica-app/')) {
    fail('.vercelignore debe excluir apps/cosmica-app/.');
  }
}

const readme = fs.readFileSync('README.md', 'utf8');
for (const required of ['www.cosmica.ar', 'app.cosmica.ar', 'Cosmicar/cosmica-app', 'rama autorizada']) {
  if (!readme.includes(required)) fail(`README.md no documenta la regla canónica: ${required}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('✓ Arquitectura canónica validada: web y app permanecen separadas.');
