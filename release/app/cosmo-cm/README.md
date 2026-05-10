# Cosmo CM - Bot Social Inteligente

Cosmo CM es un sistema automatizado para la generación y publicación de contenido en Facebook e Instagram, diseñado para correr de forma económica y autónoma.

## 🚀 Despliegue en VPS (Guía Rápida)

Para desplegar Cosmo CM en un VPS Ubuntu económico (Hetzner, Contabo, DigitalOcean), sigue estos pasos:

### 1. Preparar el Servidor
En tu terminal de Ubuntu, instala Docker y Docker Compose:
```bash
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Clonar y Configurar
Clona tu repositorio en el servidor y crea el archivo de variables de entorno:
```bash
cp .env.example .env
```
Edita el archivo `.env` y completa las variables:
- `OPENAI_API_KEY`: Tu clave de OpenAI.
- `NEXT_PUBLIC_SUPABASE_URL` y `ANON_KEY`: Tus credenciales de Supabase.
- `NEXT_PUBLIC_META_APP_ID` y `META_APP_SECRET`: Tus credenciales de Meta for Developers.

### 3. Levantar la Infraestructura
Usa Docker Compose para levantar todo el stack (Web, Worker, Redis, Nginx):
```bash
docker-compose up -d --build
```
Esto dejará corriendo:
- **App:** En el puerto 3000 (interno).
- **Nginx:** En el puerto 80 (público), apuntando a la App.
- **Worker:** Corriendo el scheduler en segundo plano.
- **Redis:** Gestionando datos temporales.

---

## 🛠️ Operaciones & Pruebas

### ¿Cómo probar el Scheduler?
Si quieres verificar que el sistema detecta posts y simula publicaciones sin gastar API:
1. Asegura que `TEST_MODE=true` en tu `.env`.
2. Crea un post de prueba: `npm run post:test`.
3. Corre el worker de prueba: `npm run worker:test`.

### Flujo de Publicación Real
1. Entra al panel web y ve a **Conexiones**.
2. Vincula tu cuenta de Meta (Facebook/Instagram).
3. Crea una campaña en el **Generador IA**.
4. Programa la campaña en el **Calendario**.
5. El worker se encargará de subirla automáticamente cuando llegue la fecha.

## 🔒 Seguridad Básica
- Nginx está configurado para ocultar su versión y aplicar cabeceras de seguridad básicas.
- Los tokens de Meta se guardan encriptados en la base de datos.
- Asegúrate de cambiar `TEST_MODE=false` en producción para que publique de verdad.
