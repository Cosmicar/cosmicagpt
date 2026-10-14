# Caso resuelto: impresora térmica 3nStar POS-80C sin impresión por IP fuera de segmento

> **Fecha:** 2026-10-13  
> **Estado:** Resuelto en soporte remoto Cósmica  
> **Ámbito:** Impresoras térmicas ESC/POS por Ethernet y estaciones Windows  
> **Equipo:** 3nStar, instalada en Windows como **POS-80C** (modelo físico exacto pendiente de corroborar en etiqueta).  
> **Confidencialidad:** Caso anonimizado para documentación en repositorio público; las direcciones IP de ejemplo **no reproducen** la red real del cliente.

## Síntomas

- Dos estaciones de trabajo del mismo comercio dejaron de imprimir comprobantes en una impresora térmica Ethernet.
- Windows tenía instalado el controlador/cola `POS-80C`, usando un puerto TCP/IP estándar.
- La impresora mostraba actividad en el conector Ethernet, pero la aplicación y la cola de Windows no imprimían correctamente.
- Una prueba inicial al puerto TCP 9100 desde la PC fallaba.

## Diagnóstico

1. **Descartar falla física:** prueba autónoma con el botón `FEED` al encender. La impresora imprimió el self-test, incluidos los parámetros de red.
2. **Comparar subredes:** el self-test reveló una IP estática en una subred distinta de la utilizada por las PC del local. El DHCP de la impresora estaba desactivado.
3. **Comprobar la ruta:** `ipconfig /all`, `route print -4`, `ping <IP-IMPRESORA>` y `Test-NetConnection <IP-IMPRESORA> -Port 9100` evidenciaron que, con la configuración habitual de la estación, no había conectividad.
4. **Acceso temporal:** se utilizó una IP compatible con la subred de la impresora para el diagnóstico. Esto interrumpió Internet y la sesión remota al cambiar la interfaz principal; se recuperó restaurando DHCP. **No repetir este paso sin acceso alternativo**, como Wi-Fi, otra interfaz o asistencia presencial.
5. **Validación de red:** ya en la subred antigua, `ping` respondió sin pérdidas, `arp -a <IP-IMPRESORA>` coincidió con la MAC del autodiagnóstico y `Test-NetConnection` confirmó TCP 9100. Se observó también un rechazo temporal de conexión, que dejó de reproducirse tras apagar y encender la impresora.
6. **Validación de impresión:** salieron tickets de POS Printer Test y una impresión de prueba desde el Panel de control. El equipo físico y el canal de impresión estaban operativos.

## Causa identificada

**Incompatibilidad de subredes por configuración IP fija de la impresora.** El equipo seguía en una dirección de un segmento anterior, mientras las estaciones utilizaban otra red. **Hipótesis no verificada:** un reinicio a valores de fábrica pudo haber restablecido la IP anterior o predeterminada. No afirmar el reseteo como hecho sin evidencia.

No se detectó una falla mecánica de impresión. Tampoco fue necesario reinstalar Windows ni el driver.

## Solución aplicada y confirmada por el técnico

1. Se configuró **la impresora** con una IP válida dentro de la subred que utilizan las PC del local. La dirección final exacta no quedó registrada en esta ficha anonimizada.
2. En **Panel de control → Dispositivos e impresoras → POS-80C → Propiedades de impresora → Puertos**, se reemplazó la referencia al puerto TCP/IP con la IP antigua por el puerto/configuración correspondiente a la IP nueva.
3. Se guardaron los cambios. La impresora volvió a responder.
4. Se contempló el segundo puesto, que también necesitaba usar el nuevo direccionamiento. El cliente confirmó el caso como **solucionado**.

**Importante:** cambiar la IP de la impresora exige revisar la configuración del puerto en **cada PC** que le imprima. Una cola de Windows que conserva el puerto viejo seguirá fallando aunque la impresora esté sana.

## Procedimiento recomendado para futuros casos

- Obtener un self-test impreso antes de modificar drivers o hardware.
- Comparar `IPv4 / máscara / puerta de enlace` de impresora y estación; verificar conectividad física y VLAN, además de las rutas.
- Comprobar `ping` (orientativo) y TCP 9100 (o el protocolo/puerto real configurado).
- Verificar que la IP nueva esté libre, pertenezca al segmento correcto y **no genere conflictos DHCP**. Preferir reserva DHCP si el entorno lo permite; si es fija, coordinar fuera del pool y documentarla.
- Reconfigurar la impresora por su utilidad oficial o interfaz web cuando esté disponible; volver a imprimir self-test y anotar IP/máscara/gateway.
- Actualizar puerto `Standard TCP/IP` en cada PC, sin eliminar puertos que estén usando otras impresoras.
- Probar desde Windows **y** con un ticket real del software de ventas.
- Dejar registrada la configuración y evitar el restablecimiento de fábrica sin respaldo.

## Lección del caso

**Si una impresora térmica imprime su self-test pero dejó de imprimir por red, primero comprobar si cambió su IP o el segmento LAN.** Una dirección de fábrica puede parecer una avería de hardware o de controlador. Evitar perder soporte remoto cambiando la IP principal del único adaptador con Internet.

_No implica incidencia, corrección ni despliegue de Cósmica.app._
