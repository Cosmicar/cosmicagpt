# Checklist de Backup - Cósmica

Para asegurar que el sistema sea recuperable, se debe realizar un backup periódico de los siguientes componentes:

## 1. Código Fuente
- [ ] Clonar o descargar la rama `main` (o la rama de producción) de GitHub.
- [ ] Guardar una copia de la carpeta `release/` generada.

## 2. Base de Datos (Firestore)
- [ ] Realizar una exportación manual desde la consola de Firebase (GCP Console).
  - Ir a Google Cloud Console -> Firestore -> Importar/Exportar.
  - Seleccionar un bucket de Google Cloud Storage.
- [ ] (Opcional) Configurar un script automático con Cloud Functions para exportación diaria.

## 3. Reglas y Configuración
- [ ] Resguardar el archivo `firestore.rules`.
- [ ] Resguardar el archivo `manifest.json` y la configuración de Firebase en el cliente.
