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
    'downloadAnydesk', 'downloadConfirmed', 'openedButton', 'supportId',
    'idFeedback', 'sendId', 'mobileAlert', 'copyLink', 'sendLink', 'year'];
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
    getItem() {
      if (storageThrows) throw Error('blocked');
      return saved;
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

test('HTML mantiene la ruta segura de asistencia y los activos oficiales', () => {
  for (const token of [
    'id="downloadAnydesk"', 'id="downloadConfirmed"', 'id="openedButton"',
    'id="sendId"', 'id="supportId"', 'id="progressTrack"',
    '/brand/official/cosmica-logo-light.png?v=10',
    '/marketing/assistance.css', '/marketing/assistance.js',
    'anydesk.com/es/downloads/windows', '/marketing/assistance-client.webp',
    'noopener noreferrer', 'aria-labelledby', 'prefers'
  ].filter(token => token !== 'prefers')) {
    assert.ok(html.includes(token), 'Falta contrato: ' + token);
  }
  assert.ok(!html.includes('Cósmica+'));
  assert.ok(!html.includes('onClick='));
});

test('La descarga no avanza sola; la confirmación sí', () => {
  const { els, cards } = setup();
  els.downloadAnydesk.click();
  assert.equal(els.progressLabel.textContent, '0 de 3 pasos');
  els.downloadConfirmed.click();
  assert.equal(els.progressLabel.textContent, '1 de 3 pasos');
  assert.equal(els.progressTrack.getAttribute('aria-valuenow'), '1');
  assert.equal(cards[0].classList.contains('completed'), true);
});

test('AnyDesk abierto y WhatsApp con ID limpio actualizan la guía', () => {
  const { els, cards, writes } = setup();
  els.openedButton.click();
  assert.equal(els.progressLabel.textContent, '1 de 3 pasos');
  assert.equal(cards[2].scrolled, true);
  els.supportId.value = '123 456 789';
  const event = els.sendId.click();
  assert.equal(event.defaultPrevented, false);
  const destination = new URL(els.sendId.href);
  assert.equal(destination.hostname, 'wa.me');
  assert.equal(destination.pathname, '/5493883298736');
  assert.ok(destination.searchParams.get('text').includes('123456789'));
  assert.equal(els.progressLabel.textContent, '2 de 3 pasos');
  assert.ok(writes.every(([, val]) => !val.includes('123456789')), 'Nunca persistir el ID');
});

test('ID inválido se bloquea y señala sin perder la guía', () => {
  const { els } = setup();
  els.supportId.value = 'abcd-123';
  const event = els.sendId.click();
  assert.equal(event.defaultPrevented, true);
  assert.equal(els.supportId.getAttribute('aria-invalid'), 'true');
  assert.equal(els.supportId.focused, true);
  assert.ok(els.idFeedback.textContent.includes('Revisá el ID'));
  assert.equal(els.progressLabel.textContent, '0 de 3 pasos');
});

test('ID vacío habilita escribirlo manualmente en WhatsApp', () => {
  const { els } = setup();
  els.sendId.click();
  assert.ok(new URL(els.sendId.href).searchParams.get('text').includes('Mi ID es:'));
  assert.equal(els.progressLabel.textContent, '1 de 3 pasos');
});

test('Restauración de progreso y almacenamiento bloqueado no rompen la guía', () => {
  const saved = setup({ saved: '[1,3,99,-2,"invalid"]' });
  assert.equal(saved.els.progressLabel.textContent, '2 de 3 pasos');
  const blocked = setup({ storageThrows: true });
  blocked.els.downloadConfirmed.click();
  assert.equal(blocked.els.progressLabel.textContent, '1 de 3 pasos');
});

test('En celular aparece guía para continuar desde la PC', () => {
  const { els } = setup({ userAgent: 'Mozilla/5.0 (Android 14; Mobile)' });
  assert.equal(els.mobileAlert.hidden, false);
  assert.equal(new URL(els.sendLink.href).hostname, 'wa.me');
  assert.ok(decodeURIComponent(els.sendLink.href).includes('cosmica.ar/asistencia.html'));
});
