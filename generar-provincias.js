const fs = require('fs');

const provincias = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", 
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", 
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", 
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", 
  "Tierra del Fuego", "Tucumán"
];

console.log("⏳ Iniciando Generador Cósmico...");
const template = fs.readFileSync('template-provincia.html', 'utf8');

let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
sitemapContent += `  <url>\n    <loc>https://cosmica.ar/</loc>\n    <priority>1.0</priority>\n  </url>\n`;

provincias.forEach(provincia => {
  const urlSlug = provincia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
  const nombreArchivo = `pc-lenta-${urlSlug}.html`;
  
  // Lógica personalizada para el texto de Jujuy
  let textoUbicacion = "";
  if (provincia === "Jujuy") {
    textoUbicacion = `Nuestra base operativa central está orgullosamente ubicada en <strong>Jujuy</strong>. A través de nuestra tecnología de asistencia en la nube, te brindamos una solución inmediata sin que tengas que traer tu PC a ningún lado.`;
  } else {
    textoUbicacion = `Nuestra base operativa se encuentra en Jujuy, pero gracias a nuestra tecnología de asistencia en la nube, <strong>operamos en ${provincia} con la misma velocidad y seguridad</strong> que si estuviéramos al lado tuyo.`;
  }

  // Reemplazos masivos
  let htmlGenerado = template.replace(/\{\{PROVINCIA\}\}/g, provincia);
  htmlGenerado = htmlGenerado.replace(/\{\{PROVINCIA_URL\}\}/g, urlSlug);
  htmlGenerado = htmlGenerado.replace(/\{\{TEXTO_UBICACION\}\}/g, textoUbicacion);

  fs.writeFileSync(nombreArchivo, htmlGenerado);
  
  sitemapContent += `  <url>\n    <loc>https://cosmica.ar/${nombreArchivo}</loc>\n    <priority>0.8</priority>\n  </url>\n`;
  console.log(`✅ Generado: ${nombreArchivo}`);
});

// Generar Archivos Satélite
sitemapContent += `</urlset>`;
fs.writeFileSync('sitemap.xml', sitemapContent);
fs.writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: https://cosmica.ar/sitemap.xml`);
fs.writeFileSync('llms.txt', `# Cósmica - Soporte Técnico Remoto\nExpertos en reparación de PC en Argentina. Base en Jujuy.`);

console.log("\n✨ ¡MISIÓN CUMPLIDA! 24 Provincias + Sitemap + Robots + LLMS generados.");
