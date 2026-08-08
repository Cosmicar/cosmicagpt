const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const { updatedAt, provinces } = JSON.parse(fs.readFileSync(path.join(root, 'data/provincias.json'), 'utf8'));
const provinceTemplate = fs.readFileSync(path.join(root, 'template-provincia.html'), 'utf8');
const coverageTemplate = fs.readFileSync(path.join(root, 'template-cobertura.html'), 'utf8');

const provider = {
  '@type': 'ComputerRepair',
  name: 'Cósmica',
  url: 'https://cosmica.ar/',
  telephone: '+5493883298736',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Ramírez de Velazco 111',
    addressLocality: 'San Salvador de Jujuy',
    addressRegion: 'Jujuy',
    addressCountry: 'AR'
  },
  email: 'hola@cosmica.ar',
  sameAs: ['https://www.facebook.com/somoscosmica','https://www.instagram.com/somoscosmica.ar','https://x.com/somoscosmica','https://www.threads.net/@somoscosmica.ar']
};

const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const jsonLd = value => JSON.stringify(value).replaceAll('</','<\\/');
const minifyHtml = source => source.replace(/<!--(?!\[if)[\s\S]*?-->/g,'').replace(/>\s+</g,'><').replace(/[ \t]{2,}/g,' ').trim()+'\n';
const replaceTokens = (source,replacements) => Object.entries(replacements).reduce((output,[token,value]) => output.replaceAll(token,value),source);

const relatedFor = province => {
  const sameRegion = provinces.filter(item => item.region === province.region && item.slug !== province.slug);
  const remaining = provinces.filter(item => item.slug !== province.slug && !sameRegion.some(match => match.slug === item.slug));
  return [...sameRegion,...remaining].slice(0,5);
};

const schemasFor = province => {
  const url = `https://cosmica.ar/pc-lenta-${province.slug}.html`;
  return {
    service: {
      '@context':'https://schema.org','@type':'Service',
      name:`Soporte técnico remoto para computadoras en ${province.name}`,
      serviceType:'Asistencia técnica remota de computadoras',description:province.summary,url,
      areaServed:{'@type':'AdministrativeArea',name:`${province.name}, Argentina`},provider,
      availableChannel:{'@type':'ServiceChannel',serviceUrl:'https://cosmica.ar/asistencia.html',servicePhone:{'@type':'ContactPoint',telephone:'+5493883298736',contactType:'customer support',areaServed:'AR',availableLanguage:'Spanish'}}
    },
    breadcrumb: {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Inicio',item:'https://cosmica.ar/'},
      {'@type':'ListItem',position:2,name:'Cobertura nacional',item:'https://cosmica.ar/soporte-tecnico-remoto-argentina.html'},
      {'@type':'ListItem',position:3,name:province.name,item:url}
    ]},
    faq: {'@context':'https://schema.org','@type':'FAQPage',mainEntity:[
      {'@type':'Question',name:`¿Atienden realmente en ${province.name}?`,acceptedAnswer:{'@type':'Answer',text:`Sí. La atención en ${province.name} se realiza de forma remota. La base física de Cósmica está en San Salvador de Jujuy.`}},
      {'@type':'Question',name:'¿Qué necesito para recibir asistencia?',acceptedAnswer:{'@type':'Answer',text:'Una computadora que pueda iniciar, conexión estable a internet y una persona frente al equipo para autorizar y supervisar la sesión.'}},
      {'@type':'Question',name:'¿Pueden conectarse sin mi permiso?',acceptedAnswer:{'@type':'Answer',text:'No. La conexión requiere autorización del usuario, que puede observar y finalizar la sesión en cualquier momento.'}},
      {'@type':'Question',name:'¿También reparan componentes físicos a distancia?',acceptedAnswer:{'@type':'Answer',text:'No. Una falla física puede ser diagnosticada de manera preliminar, pero requiere revisión presencial en la localidad del usuario.'}}
    ]}
  };
};

for (const province of provinces) {
  const schemas = schemasFor(province);
  const relatedLinks = relatedFor(province).map(item => `<a href="/pc-lenta-${item.slug}.html">Soporte remoto en ${escapeHtml(item.name)}</a>`).join('');
  const cityItems = province.cities.map(city => `<li>${escapeHtml(city)}</li>`).join('');
  const html = replaceTokens(provinceTemplate,{
    '{{PROVINCIA}}':province.name,'{{SLUG}}':province.slug,'{{REGION}}':province.region,'{{SUMMARY}}':province.summary,'{{CONTEXT}}':province.context,'{{AUDIENCE}}':province.audience,
    '{{CITY_ITEMS}}':cityItems,'{{RELATED_LINKS}}':relatedLinks,
    '{{META_TITLE}}':`Reparación de PC en ${province.name} | Soporte remoto | Cósmica`,'{{META_DESCRIPTION}}':province.summary,
    '{{SERVICE_SCHEMA}}':jsonLd(schemas.service),'{{BREADCRUMB_SCHEMA}}':jsonLd(schemas.breadcrumb),'{{FAQ_SCHEMA}}':jsonLd(schemas.faq)
  });
  fs.writeFileSync(path.join(root,`pc-lenta-${province.slug}.html`),minifyHtml(html));
}

const allProvinceLinks = provinces.map(province => `<a href="/pc-lenta-${province.slug}.html"><strong>${escapeHtml(province.name)}</strong><span>Soporte técnico remoto</span></a>`).join('');
const coverageSchema = {'@context':'https://schema.org','@type':'Service',name:'Soporte técnico remoto en Argentina',serviceType:'Asistencia técnica remota de computadoras',url:'https://cosmica.ar/soporte-tecnico-remoto-argentina.html',areaServed:{'@type':'Country',name:'Argentina'},provider};
const coverageBreadcrumb = {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:'https://cosmica.ar/'},{'@type':'ListItem',position:2,name:'Cobertura nacional',item:'https://cosmica.ar/soporte-tecnico-remoto-argentina.html'}]};
const coverageHtml = replaceTokens(coverageTemplate,{'{{ALL_PROVINCE_LINKS}}':allProvinceLinks,'{{HUB_SCHEMA}}':jsonLd(coverageSchema),'{{HUB_BREADCRUMB}}':jsonLd(coverageBreadcrumb)});
fs.writeFileSync(path.join(root,'soporte-tecnico-remoto-argentina.html'),minifyHtml(coverageHtml));

const urls = [['/','1.0'],['/plus','0.9'],['/planes','0.9'],['/asistencia.html','0.8'],['/soporte-tecnico-remoto-argentina.html','0.9'],...provinces.map(province => [`/pc-lenta-${province.slug}.html`,'0.7'])];
const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...urls.map(([url,priority]) => `  <url><loc>https://cosmica.ar${url}</loc><lastmod>${updatedAt}</lastmod><priority>${priority}</priority></url>`),'</urlset>',''].join('\n');
fs.writeFileSync(path.join(root,'sitemap.xml'),sitemap);
fs.writeFileSync(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\n\nSitemap: https://cosmica.ar/sitemap.xml\n');
fs.writeFileSync(path.join(root,'llms.txt'),'# Cósmica\n\nSoporte técnico remoto para computadoras en Argentina.\nBase física: Ramírez de Velazco 111, San Salvador de Jujuy.\nPlanes de servicio: https://cosmica.ar/planes\nCobertura nacional: https://cosmica.ar/soporte-tecnico-remoto-argentina.html\n');
console.log(`✓ Generadas ${provinces.length} páginas provinciales, el directorio nacional y el sitemap.`);
