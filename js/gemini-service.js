/**
 * gemini-service.js
 * Módulo profesional para generación de contenido IA usando Gemini 1.5 Flash
 * Diseñado para Cósmica - Soporte Técnico
 */

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────
// La API Key ahora se maneja de forma segura en las variables de entorno de Netlify.
const NETLIFY_FUNCTION_URL = "https://api-cosmica.netlify.app/.netlify/functions/generar-contenido";

// ── BRANDING E IDENTIDAD (CÓSMICA) ───────────────────────────────────────────
const BRANDING = {
  nombre: "Cósmica",
  descripcion: "Plataforma de soporte técnico informático y gestión.",
  estilo: "Tecnológico, moderno, cercano y profesional.",
  tono: "Argentino sutil (usar términos como 'notebook', 'vuela', 'bancar', 'che', sin caer en la exageración).",
  objetivo: "Transmitir tranquilidad, confianza y velocidad en la solución de problemas."
};

// ── PLANTILLAS DE PROMPTS POR TIPO ──────────────────────────────────────────
const PLANTILLAS = {
  reparacion: (datos) => 
    `Contá que reparamos un equipo ${datos.equipo}. El problema era "${datos.problema}" y lo solucionamos con "${datos.solucion}". Enfocate en el alivio del cliente.`,
    
  optimizacion: (datos) => 
    `Hablá de cómo optimizamos un equipo ${datos.equipo}. Estaba lento y ahora "vuela" gracias a "${datos.accion}". Ideal para tentar a quienes tienen PCs lentas.`,
    
  instalacion_remota: (datos) => 
    `Promocioná nuestro servicio de soporte remoto. Hoy instalamos/configuramos "${datos.software}" en tiempo récord y sin que el cliente se mueva de su casa.`,
    
  impresoras_epson: (datos) => 
    `Caso de éxito con impresora Epson. Tenía "${datos.problema}" (típico de almohadillas o cabezal) y la dejamos imprimiendo perfecto. Recordá que somos especialistas.`,
    
  promociones: (datos) => 
    `¡Promo Cósmica! Ofrecemos "${datos.titulo}" por tiempo limitado. El beneficio es "${datos.beneficio}". Apurá a la gente para que no se lo pierda.`,
    
  mantenimiento_pc: (datos) => 
    `Post preventivo. Explicá por qué es importante el mantenimiento que le hicimos a un equipo (limpieza, pasta térmica). Evitá que se queme.`
};

// ── FUNCIÓN BASE: LLAMADA A GEMINI (A través de Proxy Netlify) ───────────────
/**
 * Envía un prompt a la API de Gemini 1.5 Flash vía Netlify Function.
 * @param {string} prompt - El texto a enviar.
 * @param {boolean} isJson - Si se espera una respuesta en formato JSON.
 * @returns {Promise<string>} - La respuesta de la IA.
 */
export async function generarTextoIA(prompt, isJson = false) {
  try {
    // Manejo de Timeout (15 segundos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, isJson }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error en el servidor: ${response.status}`);
    }

    const data = await response.json();
    
    // El formato de respuesta de Gemini sigue siendo el mismo en la data devuelta por el proxy
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("La IA no devolvió ninguna respuesta válida.");
    }

    const text = data.candidates[0].content.parts[0].text;
    
    if (!text) {
      throw new Error("La respuesta de la IA está vacía.");
    }

    return text;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("La solicitud superó el tiempo de espera (Timeout).");
    }
    console.error("[Gemini Service] Error:", error);
    throw error;
  }
}

// ── FUNCIÓN ESPECIALIZADA: GENERADOR CÓSMICA ─────────────────────────────────
/**
 * Genera un post estructurado para redes sociales basado en la identidad de Cósmica.
 * @param {string} tipo - El tipo de plantilla (reparacion, optimizacion, etc).
 * @param {object} datos - Los datos variables para la plantilla.
 * @returns {Promise<{caption: string, hashtags: string, cta: string}>}
 */
export async function generarPostCosmica(tipo, datos) {
  const plantillaFn = PLANTILLAS[tipo];
  if (!plantillaFn) {
    throw new Error(`El tipo de post "${tipo}" no existe en las plantillas.`);
  }

  const instruccionEspecifica = plantillaFn(datos);

  // Construcción del Prompt con el Branding y la estructura requerida
  const promptCompleto = `
    Actúa como el Agente de Marketing e Inteligencia Artificial de la marca "${BRANDING.nombre}".
    Identidad de la marca: ${BRANDING.descripcion}
    Estilo de comunicación: ${BRANDING.estilo}
    Tono de voz: ${BRANDING.tono}
    Objetivo del post: ${BRANDING.objetivo}

    INSTRUCCIÓN PARA EL POST:
    ${instruccionEspecifica}

    REGLAS ESTRICTAS DE RESPUESTA:
    1. Debes responder ÚNICAMENTE con un objeto JSON válido.
    2. No incluyas markdown (como \`\`\`json) en la respuesta, solo el JSON puro.
    3. El JSON debe tener exactamente esta estructura:
    {
      "caption": "El texto principal del post. Usa emojis, saltos de línea para legibilidad y el tono argentino sutil solicitado.",
      "cta": "Un llamado a la acción corto y directo (ej: 'Mandanos un WhatsApp y lo solucionamos').",
      "hashtags": "Entre 3 y 6 hashtags relevantes separados por espacios (ej: '#SoporteTecnico #Notebooks #Cosmica')"
    }
  `;

  // Llamamos a la API forzando salida JSON
  const respuestaJsonRaw = await generarTextoIA(promptCompleto, true);

  try {
    const postEstructurado = JSON.parse(respuestaJsonRaw);
    
    // Validación básica de la estructura devuelta
    if (!postEstructurado.caption || !postEstructurado.cta || !postEstructurado.hashtags) {
      throw new Error("El JSON devuelto por la IA no contiene todos los campos requeridos.");
    }

    return postEstructurado;

  } catch (error) {
    console.error("[Gemini Service] Error al parsear el JSON de la IA:", respuestaJsonRaw);
    throw new Error("La IA no devolvió la estructura JSON requerida. Intenta de nuevo.");
  }
}
