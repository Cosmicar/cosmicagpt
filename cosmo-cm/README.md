# Cosmo CM 🚀

> **Plataforma Inteligente de Generación y Administración de Contenido para Redes Sociales**

Cosmo CM es el panel central de marketing IA de Cósmica. Diseñada como una "central de operaciones tecnológica", permite generar campañas completas en segundos usando Inteligencia Artificial, administrando publicaciones, métricas y bibliotecas de contenido desde un dashboard unificado con una estética sci-fi premium.

## 🌟 Visión del Sistema
Construir una plataforma escalable que unifique la creación de contenido (OpenAI / Midjourney / DALL-E) con la distribución (Meta Graph API) y la comunicación directa (WhatsApp Business API), ofreciendo una experiencia moderna, enérgica y minimalista que respire innovación.

## 🛠 Stack Tecnológico

* **Framework:** Next.js (App Router)
* **Estilos:** TailwindCSS (v4)
* **Componentes UI:** shadcn/ui
* **Lenguaje:** TypeScript
* **Iconos:** Lucide React
* **Backend / Auth / DB (Proyectado):** Supabase
* **Integraciones Previstas:** OpenAI API, Meta Graph API, WhatsApp API

## 📂 Estructura del Proyecto

```
/cosmo-cm
├── /src
│   ├── /app            # Rutas y páginas de Next.js
│   ├── /components     # Componentes UI reutilizables (shadcn, layout)
│   ├── /modules        # Lógica de negocio encapsulada
│   ├── /services       # Servicios de integración API (OpenAI, Meta)
│   ├── /prompts        # Plantillas de system prompts IA
│   ├── /templates      # Plantillas de diseño y exportación
│   ├── /styles         # Estilos globales y variables
│   ├── /types          # Interfaces y tipos de TypeScript
│   ├── /hooks          # Custom React Hooks
│   └── /utils          # Funciones de ayuda
```

## ⚙️ Instrucciones de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone <repo-url>
   cd cosmo-cm
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo `.env.example` a `.env.local` y agrega tus credenciales.
   ```bash
   cp .env.example .env.local
   ```

4. **Ejecutar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el resultado.

## 🔐 Variables de Entorno (.env.local)

Crea un archivo `.env.local` en la raíz del proyecto con el siguiente formato:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI
OPENAI_API_KEY=sk-your_openai_api_key

# Meta / Facebook Graph API
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_meta_access_token

# WhatsApp Business API
WA_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WA_ACCESS_TOKEN=your_whatsapp_access_token
```

## 📜 Scripts Disponibles

* `npm run dev`: Inicia el servidor de desarrollo en modo watch.
* `npm run build`: Compila la aplicación para producción.
* `npm run start`: Inicia el servidor de producción.
* `npm run lint`: Ejecuta el linter para encontrar y arreglar problemas de código.

## 🎨 Diseño Visual
La aplicación utiliza un diseño oscuro personalizado (`class="dark"`) en TailwindCSS con una paleta de colores propia:
* **Primary:** Azul Eléctrico
* **Secondary:** Naranja Cósmica
* **Accent:** Rosa Enérgico

---
*Desarrollado para Cósmica - Transformando la gestión digital con IA.*
