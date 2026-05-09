import { generarPostCosmica } from "./gemini-service.js";

async function generarContenidoRedes() {
  const tipo = document.getElementById('postTipo').value;
  const equipo = document.getElementById('postEquipo').value;
  const problema = document.getElementById('postProblema').value;
  const solucion = document.getElementById('postSolucion').value;

  if (!equipo || !problema || !solucion) {
    alert("Por favor completá los campos de equipo, problema y solución.");
    return;
  }

  const btn = document.getElementById('btnGenerarRedes');
  btn.disabled = true;
  btn.textContent = '⏳ Generando...';

  try {
    // Mapeo básico para que use las variables según la plantilla
    const datos = {
      equipo,
      problema,
      solucion,
      accion: solucion, // Para la plantilla de optimización
      software: solucion, // Para la de instalación remota
      titulo: equipo, // Para promociones
      beneficio: solucion // Para promociones
    };

    const post = await generarPostCosmica(tipo, datos);
    
    document.getElementById('previewCaption').textContent = post.caption;
    document.getElementById('previewCTA').textContent = post.cta;
    document.getElementById('previewHashtags').textContent = post.hashtags;
    
    document.getElementById('previewAreaRedes').style.display = 'block';
    
  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Generar contenido';
  }
}

function copiarContenido() {
  const caption = document.getElementById('previewCaption').textContent;
  const cta = document.getElementById('previewCTA').textContent;
  const hashtags = document.getElementById('previewHashtags').textContent;
  
  const textoCompleto = `${caption}\n\n${cta}\n\n${hashtags}`;
  
  navigator.clipboard.writeText(textoCompleto).then(() => {
    alert("¡Contenido copiado al portapapeles!");
  }).catch(err => {
    console.error("Error al copiar:", err);
    alert("No se pudo copiar automáticamente. Por favor seleccionalo manualmente.");
  });
}

function guardarBorrador() {
  alert("¡Próximamente! En la Fase 2 guardaremos esto en Firestore.");
}

function publicarFacebook() {
  alert("¡Próximamente! En la Fase 3 conectaremos con la Graph API de Meta.");
}

function prepararInstagram() {
  alert("¡Próximamente! En la Fase 3 conectaremos con Instagram Business.");
}

// Enlazar a window para el HTML
window.generarContenidoRedes = generarContenidoRedes;
window.copiarContenido = copiarContenido;
window.guardarBorrador = guardarBorrador;
window.publicarFacebook = publicarFacebook;
window.prepararInstagram = prepararInstagram;
