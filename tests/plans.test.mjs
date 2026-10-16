import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../planes.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../marketing/planes-refresh.css', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../marketing/planes-guide.js', import.meta.url), 'utf8');

function schema(type) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return blocks.map(([,json]) => JSON.parse(json)).find(item => item['@type'] === type);
}
test('Los precios de los tres servicios y el marcado coinciden', () => {
  const data = schema('Service');
  const expected = { Mercurio:'24900', Venus:'35900', 'Planeta X':'49900' };
  assert.deepEqual(Object.fromEntries(data.offers.map(offer => [offer.name, offer.price])), expected);
  for (const [name,price] of Object.entries(expected)) {
    const pesos = '$' + Number(price).toLocaleString('es-AR');
    assert.ok(html.includes(pesos), name + ' no incluye precio ' + pesos);
  }
  assert.ok(html.includes('Desde $49.900'));
  assert.ok(!html.includes('Cósmica+'));
  assert.ok(html.includes('https://app.cosmica.ar/'));
});
test('El FAQ estructurado refleja las preguntas y respuestas visibles', () => {
  const faq = schema('FAQPage');
  const markup = html.match(/<div class="faq-list">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/)?.[1];
  assert.ok(markup);
  const visible = [...markup.matchAll(/<details><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)]
    .map(([,name,text]) => ({name,text}));
  assert.equal(visible.length, 6);
  assert.equal(faq.mainEntity.length, 5);
  for (const item of faq.mainEntity) {
    assert.ok(visible.some(row => row.name === item.name && row.text === item.acceptedAnswer.text),
      'FAQ sin equivalencia visual: ' + item.name);
  }
});
test('Se preservan navegación, contacto, identidad y comparación móvil', () => {
  for (const token of [
    '/marketing/planes.css', '/marketing/planes-refresh.css', '/marketing/planes-guide.js',
    '/brand/official/cosmica-logo-light.png?v=10',
    '/brand/services/mercurio.svg','/brand/services/venus.svg','/brand/services/planeta-x.svg',
    'id="mercurio"','id="venus"','id="planeta-x"','id="orientador"',
    'id="comparacion"','id="preguntas"','id="cosmica-app"',
    '5493883298736','comparison-scroll-hint','class="sr-only"'
  ]) assert.ok(html.includes(token), 'Falta contrato ' + token);
  assert.ok(css.includes('@media (max-width:720px)'));
  assert.ok(css.includes('prefers-reduced-motion'));
});
function createElement(key) {
  const handlers = {},attrs={},classes=new Set();
  return {
    dataset:{planChoice:key},textContent:'',href:'',handlers,
    classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name),contains:name=>classes.has(name)},
    setAttribute:(name,value)=>{attrs[name]=value;},
    removeAttribute:name=>{delete attrs[name];},
    getAttribute:name=>attrs[name],
    addEventListener:(event,fn)=>{handlers[event]=fn;},
    click() { const e={prevented:false,preventDefault(){this.prevented=true;}};handlers.click?.(e);return e; }
  };
}
test('Orientador sugiere cada opción y genera un WhatsApp contextualizado', () => {
  const els = {
    chooserResultTitle:createElement(),chooserResultCopy:createElement(),
    chooserResultLink:createElement()
  };
  const options=['mercurio','venus','planeta-x'].map(createElement);
  const root={querySelectorAll:()=>options};
  const doc={querySelector:()=>root,getElementById:id=>els[id]};
  vm.runInNewContext(script,{document:doc,encodeURIComponent});
  const prices=['Mercurio','Venus','Planeta X'];
  for(let i=0;i<3;i++){
    const e=options[i].click();
    assert.equal(e.prevented,true);
    assert.ok(els.chooserResultTitle.textContent.includes(prices[i]) ||
              els.chooserResultLink.textContent.includes(prices[i]));
    const u=new URL(els.chooserResultLink.href);
    assert.equal(u.hostname,'wa.me');
    assert.equal(u.pathname,'/5493883298736');
    assert.equal(options[i].getAttribute('aria-current'),'true');
    for(let j=0;j<3;j++) if(i!==j) assert.equal(options[j].getAttribute('aria-current'),undefined);
  }
});
test('Sin scripts, las opciones llevan al servicio correspondiente',()=>{
  for(const slug of ['mercurio','venus','planeta-x'])
    assert.ok(html.includes('href="#'+slug+'" class="chooser-option" data-plan-choice="'+slug+'"'));
});
