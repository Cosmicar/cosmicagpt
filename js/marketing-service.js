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
  try {
    const response = await fetch('https://hook.us2.make.com/mpydkgg5horh21adhk9qfej2324v5rd9', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, plataformas })
    });

    if (response.ok) {
      alert("✅ Éxito: Se envió correctamente a la cola de publicación.");
      return { ok: true };
    } else {
      alert(`❌ Error: El Webhook respondió con estado ${response.status}`);
      return { ok: false };
    }
  } catch (error) {
    console.error("[Marketing] Error al publicar:", error);
    alert("❌ Error: No se pudo conectar con el Webhook de publicación.");
    return { ok: false };
  }
}
