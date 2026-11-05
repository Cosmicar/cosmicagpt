# Caso resuelto: LC-1060 con Ruida RDC6445G(EC) - fallo de comunicación RDWorks

> **Fecha:** 2026-11-05  
> **Estado:** Resuelto: comunicación y transferencia verificadas; prueba física de corte realizada por el cliente.  
> **Atención:** soporte remoto Cósmica, con operador presente junto a la máquina.  
> **Equipo:** cortadora láser LC-1060, controladora reportada Ruida RDC6445G(EC), área útil de referencia 1000 × 600 mm.  
> **Confidencialidad:** caso anonimizado para repositorio público; no se publica identidad, contacto ni direccionamiento específico de la red del cliente.

## Síntoma inicial

- RDWorks **V8.01.26** devolvía `Port test failure!` al probar la controladora vía **Ethernet**.
- La cortadora había sido adquirida usada; el vendedor la había mostrado cortando antes de su traslado.
- El cliente disponía de otra máquina láser más grande, de aproximadamente **1200 × 900 mm**, con otra PC y una instalación de RDWorks funcional. Se contempló un eventual cruce de perfiles o selección de controladora, **sin prueba de que ambas estuvieran conectadas simultáneamente**.

## Diagnóstico realizado antes de la solución

1. **Comprobación UDP:** se observó intercambio de datagramas entre PC y dirección de red configurada de la Ruida, con puerto local **UDP 40200** y destino **UDP 50200**. En pruebas surgieron una respuesta `ACK C6` y un identificador interpretado en el análisis como `0x72107210`.
2. **Emulación local en PowerShell:** se simuló una respuesta de controladora en `127.0.0.1:50200`. Una variante de identificación `0x6500` permitió pasar la prueba de puerto en el entorno de emulación; otra variante asociada a `0x7210` no produjo el mismo resultado. **Esto solo demostró sensibilidad de la prueba de RDWorks al protocolo/respuesta simulada; no demostró incompatibilidad de firmware ni defecto del ID real.**
3. **Hipótesis exploradas:** perfil de equipo incorrecto, configuración heredada/corrupta, diferencias entre versiones de RDWorks, selección de conexión USB versus red, o incompatibilidad de identificación.
4. **Límite de los indicios:** un ACK UDP o un test exitoso con emulador **no equivalen** a un corte funcional. Se requerían pruebas contra el hardware real.

## Intervención efectivamente realizada

1. El operador **reinició la PC**, dejando sin actividad el emulador de prueba en la sesión normal.
2. Desinstaló la versión anterior e instaló **RDWorks V8.01.72 desde cero**.
3. Configuró el dispositivo de tipo **Network** para la IP local de la controladora (dirección exacta omitida en el repositorio público).
4. RDWorks informó **«Éxito de la prueba del puerto»**.
5. Desde las herramientas del proveedor se solicitaron **lecturas** de parámetros. Se observaron recorridos X = **1000 mm** e Y = **600 mm**, coherentes con la LC-1060. No se documentó ninguna escritura de parámetros de fabricante.
6. En la pestaña **Usuario** se completó la lectura hasta **100 %**, con valores que cambiaron respecto de los mostrados antes de solicitarla.
7. En **Documento → Lectura** la lista estaba inicialmente vacía y mostraba aproximadamente **94,10 MB** disponibles.
8. Se transfirió un archivo de prueba desde RDWorks. Apareció el aviso **«Éxito de descarga de archivos»**. Una nueva consulta mostró **1 archivo** y aproximadamente **93,97 MB** libres.
9. El mismo archivo fue **visible en la pantalla física de la controladora Ruida**. Esto confirma que la transferencia no dependía de una simulación local.
10. El cliente, que conocía el funcionamiento de la máquina, realizó una **prueba física de corte** y remitió evidencia visual de una pieza cortada. No se realizaron ajustes mecánicos o de potencia como parte del diagnóstico remoto.

## Verificaciones y evidencias

| Comprobación | Evidencia | Estado |
| --- | --- | --- |
| Conexión de red de RDWorks | Prueba de puerto exitosa tras la instalación limpia | Confirmado |
| Lectura de parámetros de fabricante | X 1000 mm / Y 600 mm | Confirmado por capturas |
| Lectura de parámetros de usuario | Lectura al 100 %, valores actualizados | Confirmado por capturas |
| Transferencia de archivo | Mensaje de éxito y contador de 1 archivo en memoria | Confirmado |
| Recepción en hardware real | El archivo apareció en el panel físico Ruida | Confirmado |
| Operación física | Evidencia visual de corte aportada por el cliente | Confirmado a nivel de prueba |
| Causa raíz exacta del error previo | No se hizo una comparación controlada entre versiones/perfiles | **No determinada** |

## Conclusión técnica

**La comunicación RDWorks ↔ controladora Ruida quedó restablecida**, incluyendo lectura de parámetros, transferencia de trabajos y reconocimiento del archivo por el panel físico. Se efectuó una prueba de corte.

La resolución coincidió con **reinicio de Windows, desinstalación de RDWorks V8.01.26 e instalación limpia de V8.01.72**. No es posible atribuir inequívocamente el problema original a la versión del programa, a su configuración, a un perfil heredado o a un conflicto con la segunda máquina. La controladora **no requirió modificación de Card ID** y no hay evidencia de avería del puerto de red.

## Recomendaciones y criterios para casos similares

- Verificar primero si la conexión de RDWorks es **Network** y apunta a la controladora correcta; si conviven varias máquinas, identificar el perfil activo en cada PC.
- Una prueba de puerto exitosa **no cierra sola** el diagnóstico: confirmar lectura real, transferencia, listado de trabajos y aparición en el panel físico.
- Si los tests fallan pese a evidencia de respuestas UDP, investigar configuración/instalación de RDWorks antes de intervenir firmware o reemplazar la controladora.
- Tras recuperar el funcionamiento, guardar en lugar seguro una **exportación de la configuración conocida como válida** y anotar la versión de RDWorks y el perfil de red, sin escribir nuevos parámetros a la máquina sin necesidad.
- Ejecutar trabajos únicamente con personal experimentado presente, verificando límites, posición/origen, material, extracción y refrigeración.
- No dar por demostrada una falla de `Card ID 7210` por los resultados del emulador. Evitar modificaciones de identificación y protocolos sin nueva evidencia.

## Alcance

El registro es un caso de soporte técnico remoto. Se modificó solamente documentación de este repositorio; **no implica cambios de código, despliegues ni alteraciones de Cósmica.app**.
