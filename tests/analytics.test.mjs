import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../marketing/analytics.js', import.meta.url), 'utf8');
function setup(host = 'www.cosmica.ar') {
  const listeners = [], scripts = [];
  const window = { location: new URL(`https://${host}/?id=private#secret`) };
  const document = { referrer: 'https://example.org/path?private=yes', createElement: () => ({}), head: { appendChild: s => scripts.push(s) }, addEventListener: (_, cb) => listeners.push(cb) };
  const context = vm.createContext({ window, document, URL });
  vm.runInContext(code, context);
  const click = (href, button = false) => listeners.forEach(cb => cb({ target: { closest: () => ({ href, tagName: button ? 'BUTTON' : 'A', dataset: { source: 'hero' }, matches: () => button }) } }));
  return { window, listeners, scripts, context, click };
}
test('production initializes once with sanitized page URLs', () => {
  const s = setup();
  vm.runInContext(code, s.context);
  assert.equal(s.scripts.length, 1);
  assert.equal(s.listeners.length, 1);
  assert.equal(s.window.dataLayer.length, 2);
  const config = s.window.dataLayer[1];
  assert.equal(config[1], 'G-LM3ZVTL6YW');
  assert.equal(config[2].page_location, 'https://www.cosmica.ar/');
  assert.equal(config[2].page_referrer, 'https://example.org/path');
});
test('only business WhatsApp and assistance generate one custom event per click', () => {
  const s = setup();
  s.click('https://wa.me/5493883298736?text=private');
  s.click('/asistencia');
  s.click('', true);
  s.click('https://wa.me/?text=private');
  s.click('/planes');
  s.click('https://other.example/asistencia');
  const events = s.window.dataLayer.slice(2);
  assert.deepEqual(Array.from(events, e => e[1]), ['whatsapp_click', 'assistance_click', 'whatsapp_click']);
  assert.ok(!JSON.stringify(events).includes('private'));
});
test('preview and localhost do not load analytics', () => {
  for (const host of ['localhost', 'cosmicagpt-preview.vercel.app']) {
    const s = setup(host);
    assert.equal(s.scripts.length, 0);
    assert.equal(s.listeners.length, 0);
    assert.equal(s.window.dataLayer, undefined);
  }
});
