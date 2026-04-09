const fs = require('fs');

// Lista completa de provincias
const provincias = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", 
  "Corrientes", "Entre Ríos", "Formosa", "La Pampa", "La Rioja", 
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", 
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", 
  "Tierra del Fuego", "Tucumán"
];

// Leer el molde (plantilla)
console.log("⏳ Leyendo plantilla...");
const template = fs.readFileSync('template-provincia.html', 'utf8');

provincias.forEach(provincia => {
  // 1. Crear la URL amigable (ej: "Tierra del Fuego" -> "tierra-del-fuego")
  const urlSlug = provincia
    .toLowerCase()
    .normalize("NFD") // Quita los acentos
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '-'); // Cambia espacios por guiones

  // 2. Reemplazar los comodines en el código
  let htmlGenerado = template.replace(/\{\{PROVINCIA\}\}/g, provincia);
  htmlGenerado = htmlGenerado.replace(/\{\{PROVINCIA_URL\}\}/g, urlSlug);

  // 3. Crear el archivo nuevo
  const nombreArchivo = `pc-lenta-${urlSlug}.html`;
  fs.writeFileSync(nombreArchivo, htmlGenerado);
  
  console.log(`✅ Creado: ${nombreArchivo}`);
});

console.log("🚀 ¡Todas las provincias fueron generadas con éxito!");