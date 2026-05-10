# Cósmica — Sistema de Gestión de Soporte Técnico

## Descripción
Cósmica es un sistema liviano y robusto diseñado para la gestión de talleres de servicio técnico, control de inventario y punto de venta (POS). Está optimizado para funcionar en entornos de hosting estático como GitHub Pages, delegando la persistencia y la seguridad a Firebase.

## Stack Tecnológico
- **Frontend**: HTML5, CSS3 (Vanilla), Javascript ES6 puro.
- **Backend/Database**: Firebase Auth & Firestore.
- **Hosting**: GitHub Pages / Netlify.

## Instalación y Configuración Local
1. Clona este repositorio.
2. Abre el archivo `index.html` en tu navegador (se recomienda usar un servidor local como Live Server en VS Code).

## Configuración de Firebase
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Habilita **Firestore** y **Authentication** (Email/Password).
3. Crea una aplicación web y copia las credenciales.
4. Pega las credenciales en el archivo `js/firebase.js` (si existe) o en el bloque de inicialización correspondiente.
5. Despliega las reglas de seguridad contenidas en `firestore.rules`.

## Despliegue en GitHub Pages
1. Sube el proyecto a un repositorio de GitHub.
2. Ve a Settings -> Pages.
3. Selecciona la rama `main` y la carpeta `/` (root).
4. Guarda y espera a que GitHub genere la URL pública.

## Estructura de Carpetas (Core)
- `/`: Archivos HTML principales (`index.html`, `panel.html`, `login.html`).
- `js/`: Módulos de lógica y repositorios.
- `release/`: Documentación y snapshots para distribución.

## Módulos del Sistema
- **Órdenes Técnicas**: Ingreso, diagnóstico y entrega de equipos.
- **Inventario**: Control de stock y alerta de mínimos.
- **POS / Ventas**: Carrito de compras y registro de ventas transaccional.
- **Logger**: Registro de auditoría del sistema.
