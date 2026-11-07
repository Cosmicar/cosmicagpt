import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../marketing/assistance.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../asistencia.html', import.meta.url), 'utf8');

function createElement(id = '') {
  const listeners = {};
  const attrs = {};
  const classes = new Set();
  return {
    id, value: '', textContent: '', hidden: true, style: {}, dataset: {},
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle: (name, yes) => yes ? classes.add(name) : classes.delete(name),
      contains: name => classes.has(name)
    },
    listeners,
    addEventListener: (name, fn) => { listeners[name] = fn; },
    setAttribute: (key, val) => { attrs[key] = val; },
    getAttribute: key => attrs[key],
    removeAttribute: key => { delete attrs[key]; },
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = true; },
    querySelector(selector) { return this.children?.[selector] || null; },
    click() {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      listeners.click?.(event);
      return event;
    },
    input() { listeners.input?.(); }
  };
}
function setup({ userAgent = 'Windows NT 10.0', saved = null, storageThrows = false } = {}) {
  const idNames = ['progressBar', 'progressTrack', 'progressLabel', 'toast',
    'downloadRemotto', 'codeConfirmed', 'openedButton', 'readyConfirmed',
    'connectBoxFrame', 'mobileAlert', 'copyLink', 'sendLink', 'year', 'resetGuide'];
  const els = Object.fromEntries(idNames.map(name => [name, createElement(name)]));
  els.mobileAlert.hidden = true;
  const cards = [1, 2, 3].map(step => {
    const el = createElement();
    el.dataset.step = String(step);
    el.children = { '.number-value': createElement() };
    if (step === 1) el.children['.step-complete'] = createElement();
    return el;
  });
  const document = {
    getElementById: id => els[id],
    querySelectorAll: selector => selector === '[data-step]' ? cards : [],
    querySelector: selector => selector === '[data-step="3"]' ? cards[2] : null
  };
  const writes = [];
  const storage = {
    getItem(key) {
      if (storageThrows) throw Error('blocked');
      return key === 'cosmica_assistance_remotto_progress_v1' ? saved : null;
    },
    setItem(key, value) {
      if (storageThrows) throw Error('blocked');
      writes.push([key, value]);
    }
  };
  const window = { matchMedia: () => ({ matches: false }), prompt: () => {} };
  const navigator = { userAgent, clipboard: { writeText: async () => {} } };
  const context = vm.createContext({
    document, window, navigator, localStorage: storage, Date,
    encodeURIComponent, setTimeout: () => 1, clearTimeout: () => {}
  });
  vm.runInContext(script, context);
  return { els, cards, writes };
}

test('Remotto principal, contingencias secundarias, marca y rutas conservadas', () => {
  for (const token of ['id="downloadRemotto"', 'id="codeConfirmed"', 'id="readyConfirmed"',
    'id="connectBoxFrame"', 'id="progressTrack"',
    '/brand/official/cosmica-logo-light.png?v=10', '/marketing/assistance.css',
    '/marketing/assistance.js?v=remotto-2', 'https://remotto.app/es/descargas',
    'https://cosmica.ar/asistencia.html', 'id="alternativas"',
    'sandbox="allow-scripts allow-forms allow-popups allow-downloads"',
    'referrerpolicy="no-referrer"', 'https://remotto.app/es/privacidad']) {
    assert.ok(html.includes(token), 'Falta contrato: ' + token);
  }
  const primary = html.split('id="alternativas"')[0];
  assert.doesNotMatch(primary, /AnyDesk|RustDesk|supportId|sendId/);
  assert.doesNotMatch(html, /<script[^>]+src="https:/);
  assert.doesNotMatch(script, /supportId|sendId|remote_id|fetch\(/);
});

test('Descargar o pedir ayuda no confirma una conexión ni completa pasos', () => {
  const { els } = setup();
  els.downloadRemotto.click();
  assert.equal(els.progressLabel.textContent, '0 de 3 pasos');
});

test('Los pasos requieren confirmación explícita y guardan sólo números', () => {
  const { els, cards, writes } = setup();
  els.codeConfirmed.click();
  els.openedButton.click();
  els.readyConfirmed.click();
  assert.equal(els.progressLabel.textContent, '3 de 3 pasos');
  assert.equal(els.progressTrack.getAttribute('aria-valuenow'), '3');
  assert.equal(cards[0].classList.contains('completed'), true);
  assert.equal(els.readyConfirmed.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(writes.map(([, v]) => JSON.parse(v)), [[1], [1, 2], [1, 2, 3]]);
  assert.ok(writes.every(([key]) => key === 'cosmica_assistance_remotto_progress_v1'));
});

test('Código visible al entrar y descarga manual como alternativa', () => {
  const frame = html.match(/<iframe[^>]+id="connectBoxFrame"[^>]*>/)?.[0];
  assert.ok(frame);
  assert.match(frame, /src="\/marketing\/remotto-connect\.html"/);
  assert.match(frame, /loading="eager"/);
  assert.doesNotMatch(frame, /hidden|loading="lazy"/);
  assert.ok(html.indexOf('id="connectBoxFrame"') < html.indexOf('<details'));
  assert.doesNotMatch(html + script, /loadConnectBox|Cargar formulario/);
  assert.match(html, /<details class="manual-download"><summary>Descarga manual \(alternativa\)<\/summary>/);
  assert.match(html, /href="#conectar">Ingresar mi código/);
  assert.equal(setup().els.progressLabel.textContent, '0 de 3 pasos');
});

test('Restauración de progreso y almacenamiento bloqueado no rompen la guía', () => {
  const saved = setup({ saved: '[1,3,99,-2,"invalid"]' });
  assert.equal(saved.els.progressLabel.textContent, '2 de 3 pasos');
  assert.equal(saved.els.codeConfirmed.getAttribute('aria-pressed'), 'true');
  const blocked = setup({ storageThrows: true });
  blocked.els.codeConfirmed.click();
  assert.equal(blocked.els.progressLabel.textContent, '1 de 3 pasos');
  assert.equal(setup({saved: '{invalid'}).els.progressLabel.textContent, '0 de 3 pasos');
});

test('Reiniciar limpia también los estados accesibles de confirmación', () => {
  const { els } = setup({ saved: '[1,2,3]' });
  els.resetGuide.click();
  assert.equal(els.progressLabel.textContent, '0 de 3 pasos');
  for (const id of ['codeConfirmed','openedButton','readyConfirmed']) {
    assert.equal(els[id].getAttribute('aria-pressed'), 'false');
  }
});

test('En Android aparece la guía para continuar desde la PC', () => {
  const { els } = setup({ userAgent: 'Mozilla/5.0 (Android 14; Mobile)' });
  assert.equal(els.mobileAlert.hidden, false);
  assert.equal(new URL(els.sendLink.href).hostname, 'wa.me');
  assert.ok(decodeURIComponent(els.sendLink.href).includes('cosmica.ar/asistencia.html'));
});
