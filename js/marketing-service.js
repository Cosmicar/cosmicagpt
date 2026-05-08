/**
 * marketing-service.js
 * Lógica para el Agente de Redes Sociales
 */

const PREDEFINED_POSTS = [
  "💻 ¿Tu notebook está lenta o calienta mucho? En Cósmica te la dejamos como nueva. Realizamos limpieza física, cambio de pasta térmica y optimización de software. ¡Escribinos y coordinamos! 🚀 #SoporteTecnico #Notebooks #Cosmica",
  "🛡️ ¡No pierdas tus archivos! Ofrecemos servicio de backup y recuperación de datos en discos dañados o formateados. Tu información es lo más importante. #DataRecovery #SeguridadInformatica #Cosmica",
  "⚡ ¡Armado de PC a medida! Decinos qué juegos o programas usás y te armamos el presupuesto ideal. Calidad, rendimiento y facha asegurados. 🎮 #GamingPC #CustomPC #Cosmica",
  "📱 ¿Se te rompió la pantalla del celu? En Cósmica hacemos cambios de módulos y baterías en el día para la mayoría de los modelos. ¡Volvé a estar conectado! #ReparacionDeCelulares #ServicioTecnico"
];

const PREDEFINED_TOPICS = {
  "notebook": "💻 ¿Tu notebook está lenta o calienta mucho? En Cósmica te la dejamos como nueva. Realizamos limpieza física, cambio de pasta térmica y optimización de software. ¡Escribinos y coordinamos! 🚀 #SoporteTecnico #Notebooks #Cosmica",
  "datos": "🛡️ ¡No pierdas tus archivos! Ofrecemos servicio de backup y recuperación de datos en discos dañados o formateados. Tu información es lo más importante. #DataRecovery #SeguridadInformatica #Cosmica",
  "pc": "⚡ ¡Armado de PC a medida! Decinos qué juegos o programas usás y te armamos el presupuesto ideal. Calidad, rendimiento y facha asegurados. 🎮 #GamingPC #CustomPC #Cosmica",
  "celu": "📱 ¿Se te rompió la pantalla del celu? En Cósmica hacemos cambios de módulos y baterías en el día para la mayoría de los modelos. ¡Volvé a estar conectado! #ReparacionDeCelulares #ServicioTecnico"
};

export function generarPost(topic = "") {
  topic = topic.toLowerCase();
  
  // Buscar por palabra clave
  for (const key in PREDEFINED_TOPICS) {
    if (topic.includes(key)) {
      return PREDEFINED_TOPICS[key];
    }
  }
  
  // Si no coincide, o está vacío, devolver uno aleatorio
  const randomIndex = Math.floor(Math.random() * PREDEFINED_POSTS.length);
  return PREDEFINED_POSTS[randomIndex];
}

export async function publicarEnRedes(content, plataformas) {
  // Simulación de publicación
  console.log(`[Marketing] Publicando en ${plataformas.join(", ")}:`, content);
  
  // Aquí se llamaría a una Netlify Function que conecte con las APIs de Meta y X
  // return await fetch('/.netlify/functions/publicar-redes', { ... });
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: true, msg: "Publicado con éxito en todas las redes seleccionadas." });
    }, 2000);
  });
}
