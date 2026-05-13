# Auditoría de `js/auth-service.js`

Este documento presenta el análisis del archivo `js/auth-service.js` con el objetivo de preparar su futura migración al núcleo compartido del nuevo sistema SaaS.

## 1. Mapa de Funciones

| Función | Descripción | Dependencias | Tipo de Retorno |
| :--- | :--- | :--- | :--- |
| `getSession()` | Retorna el estado de la sesión actual (usuario y perfil). | Variable local `session` | Object `{user, profile}` |
| `loginWithEmail(email, password)` | Autentica un usuario con Firebase Auth. | `signInWithEmailAndPassword`, `auth` | Promise |
| `logout()` | Cierra la sesión y redirige al login. | `signOut`, `auth`, `window.location`, `APP_ROUTES` | Promise<void> |
| `getUserProfile(uid)` | Obtiene el perfil del usuario desde Firestore. | `getDoc`, `doc`, `db`, `COLLECTIONS` | Promise<Object\|null> |
| `requirePanelSession(...)` | Escucha el estado de autenticación, verifica permisos de staff y ejecuta callbacks. | `onAuthStateChanged`, `auth`, `getUserProfile`, `signOut`, `isStaff` | Function (unsubscribe) |
| `isTesterMode()` | Verifica si el usuario actual tiene rol de 'tester'. | `getSession` | Boolean |
| `redirectIfLoggedIn()` | Redirige al panel si el usuario ya está autenticado y es staff. | `onAuthStateChanged`, `auth`, `getUserProfile`, `isStaff`, `window.location`, `APP_ROUTES` | Function (unsubscribe) |
| `createOperatorUser(...)` | Crea un nuevo usuario operador usando una app secundaria de Firebase. | `createSecondaryFirebaseApp`, `createUserWithEmailAndPassword`, `setDoc`, `db` | Promise<Object> |

## 2. Análisis de Dependencias y Acoplamiento

### Dependencias Internas y Externas
- **Firebase SDK**: Utiliza imports directos de URLs de CDN (`https://www.gstatic.com/...`). Esto es funcional para el sistema actual pero incompatible con un entorno empaquetado (bundler) moderno como Vite o Next.js sin modificaciones.
- **Módulos Locales**: Depende de `./config.js`, `./firebase.js`, y `./domain.js`.
- **DOM/Browser**: Utiliza `window.location.href` para redirecciones en `logout` y `redirectIfLoggedIn`.

### Acoplamiento con Panel/Login
- Las funciones `logout` y `redirectIfLoggedIn` están fuertemente acopladas a las rutas definidas en `APP_ROUTES` y asumen una estructura de archivos HTML (`login.html`, `panel.html`).

## 3. Clasificación de Lógica

### Reusable (Listo para migrar con pocos cambios)
- `loginWithEmail`: Lógica pura de Firebase Auth.
- `getUserProfile`: Lógica pura de Firestore.
- `isTesterMode`: Helper de lógica de dominio.
- `getSession`: Manejo simple de estado.

### Requires-Refactor (Necesita cambios antes de migrar)
- `logout`: Se debe remover la redirección directa (`window.location.href`) para permitir que el router del nuevo SaaS maneje la navegación.
- `redirectIfLoggedIn`: Similar a `logout`, la lógica de redirección debe delegarse al router o a un hook de navegación.
- `requirePanelSession`: El patrón de callbacks (`onReady`, `onUnauthorized`) es útil, pero en el nuevo SaaS probablemente se prefiera un enfoque basado en hooks (si se usa React/Vue) o una integración directa con el nuevo `router.js`.
- `createOperatorUser`: El uso de `createSecondaryFirebaseApp` es una solución ingeniosa para crear usuarios sin desloguear al admin actual, pero debe verificarse su comportamiento en el nuevo entorno.

### Legacy-Only
- Ninguna función es estrictamente "obsoleta", pero la forma en que gestionan las redirecciones es específica del sistema multipágina actual.

## 4. Riesgos de Migración

1. **Imports de CDN**: Romperán si se intenta usar el archivo en un entorno con Node.js/Vite sin configurar soporte para imports de red o reemplazar por dependencias de npm.
2. **Redirecciones Hardcodeadas**: Provocarán errores de "404" o comportamientos inesperados si el nuevo SaaS usa rutas virtuales (hashes o History API) en lugar de archivos `.html` físicos.
3. **Estado Global Volátil**: La variable `session` es un objeto en memoria. En una SPA, se mantiene mientras no se recargue la página, pero no persiste entre recargas a menos que se use `localStorage` o el estado propio de Firebase Auth.

## 5. Plan de Desacople Progresivo

Para no romper el sistema legacy y preparar el SaaS, se recomienda:

1. **Fase 1: Extracción de Lógica Pura**
   - Crear en el nuevo SaaS (`/apps/cosmica-app/services/auth.js`) funciones que solo llamen a Firebase, retornando promesas y datos puros, sin redirecciones.

2. **Fase 2: Adaptación del Router**
   - Hacer que `router.js` en el SaaS utilice estas funciones puras para decidir qué vista renderizar, emulando el comportamiento de `requirePanelSession`.

3. **Fase 3: Unificación (Futuro)**
   - Una vez que el SaaS sea el sistema principal, se podrán instalar las dependencias de Firebase vía npm y remover definitivamente los imports de CDN.
