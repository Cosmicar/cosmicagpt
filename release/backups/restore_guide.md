# Guía de Restauración - Cósmica

En caso de fallo crítico o necesidad de migración, siga estos pasos para restaurar el sistema:

## 1. Restaurar Código
1. Suba los archivos de la carpeta `app/` (o la raíz del proyecto) a su hosting (ej. GitHub Pages).
2. Asegúrese de que el archivo `index.html` y los scripts en `js/` estén accesibles.

## 2. Restaurar Firestore
1. Cree un nuevo proyecto en Firebase si es necesario.
2. Desde la consola de Google Cloud, importe los datos desde el bucket de Storage donde guardó el backup.
3. El comando CLI de Firebase también se puede usar:
   ```bash
   gcloud firestore import gs://[BUCKET_NAME]/[BACKUP_FOLDER]
   ```

## 3. Aplicar Reglas
1. Copie el contenido de `release/firestore/firestore.rules`.
2. Vaya a la consola de Firebase -> Firestore -> Reglas.
3. Pegue las reglas y haga clic en "Publicar".

## 4. Verificar
1. Ingrese al panel.
2. Verifique que las órdenes y productos antiguos aparezcan correctamente.
