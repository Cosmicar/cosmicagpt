import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../marketing/remotto-connect.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../marketing/remotto-connect.html', import.meta.url), 'utf8');
function widget() {
  const scripts = [], status = {textContent:''}, calls = [];
  let timeout;
  const jquery = selector => ({ISLOnlineJoin: options => calls.push([selector, options])});
  jquery.fn = {ISLOnlineJoin() {}};
  const context = vm.createContext({
    document: {getElementById: () => status, createElement: () => ({}), head: {appendChild: s => scripts.push(s)}},
    window: {jQuery: jquery},
    setTimeout: callback => { timeout = callback; return 1; }, clearTimeout() {}
  });
  vm.runInContext(code, context);
  return {scripts, status, calls, timeout: () => timeout()};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('Snippet oficial usa hosts fijos y dependencias con integridad donde fue provista', async () => {
  const w = widget();
  assert.equal(w.scripts.length, 1);
  assert.equal(w.scripts[0].src, 'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js');
  assert.ok(w.scripts[0].integrity.startsWith('sha256-'));
  w.scripts[0].onload(); await tick();
  assert.equal(w.scripts[1].src, 'https://www.islonline.com/static/v7/scripts/islonline-join.jquery-v2.min.js');
  w.scripts[1].onload(); await tick();
  assert.equal(w.calls.length, 1);
  assert.equal(w.calls[0][1].serverUrl, 'https://www.islonline.net');
  assert.equal(w.calls[0][1].languageCode, 'es');
  assert.match(html, /noindex, nofollow/);
  assert.doesNotMatch(code + html, /localStorage|analytics|postMessage|remote_id|api_key|password/i);
});
for (const phase of [0,1]) test(`Fallo del recurso ${phase} mantiene descarga y ayuda disponibles`, async () => {
  const w = widget();
  if (phase) { w.scripts[0].onload(); await tick(); }
  w.scripts[phase].onerror(); await tick();
  assert.match(w.status.textContent, /No pudimos cargar/);
  assert.match(html, /https:\/\/remotto.app\/es\/descargas/);
  assert.equal(w.calls.length, 0);
});
test('Timeout evita inicializar un widget que termine de cargar tarde', async () => {
  const w = widget();
  w.timeout(); w.scripts[0].onload(); await tick();
  assert.match(w.status.textContent, /No pudimos cargar/);
  assert.equal(w.scripts.length, 1);
  assert.equal(w.calls.length, 0);
});
