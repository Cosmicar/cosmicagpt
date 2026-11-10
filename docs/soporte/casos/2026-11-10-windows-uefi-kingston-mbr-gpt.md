# Caso resuelto: Windows no inicia tras restaurar imagen en PC UEFI-only (Kingston A400, MBR → GPT)

> **Fecha:** 2026-11-10  
> **Estado:** Resuelto; el técnico confirmó que Windows volvió a arrancar.  
> **Ámbito:** recuperación del arranque de Windows desde Hiren's BootCD PE después de trabajar con imágenes/clonaciones.  
> **Equipo:** SSD Kingston SA400S37480G, capacidad comercial 480 GB (aprox. 447,1 GiB visibles); PC con arranque UEFI, sin posibilidad operativa de utilizar Legacy/CSM.  
> **Confidencialidad:** caso técnico anonimizado; no incluye datos personales ni archivos del cliente.

## Síntoma

- Hiren's BootCD PE iniciaba normalmente desde USB.
- El SSD contenía una instalación de Windows visible, pero **no conseguía iniciar desde el disco**.
- Una reparación inicial de archivos de arranque había informado éxito sin resolver el inicio.
- El firmware de la PC **no permite arrancar Windows en modo Legacy/CSM**: la solución debía ser UEFI.

## Diagnóstico de solo lectura (Cósmica BootFix v1.1)

El diagnóstico generado por Hiren el 2026-11-10, 21:18:38, registró:

| Elemento | Evidencia |
| --- | --- |
| Hiren / WinPE | Iniciado en UEFI |
| Disco de Windows | **Disco 0**, Kingston SA400S37480G, 447,1 GB visibles |
| Tabla inicial | **MBR** |
| Partición 1 | **E:**, 499 MB, NTFS, marcada como activa |
| Partición 2 | **C:**, NTFS, contiene `C:\Windows` |
| Pendrive Hiren/Ventoy | **Disco 1**, USB: **no intervenir** |
| Indicio adicional | `bcdedit /enum firmware` no consiguió abrir el almacén de datos del firmware desde WinPE (`The requested system device cannot be found`); este resultado por sí solo no demuestra daño del BCD instalado |

**Diagnóstico funcional:** una instalación orientada al arranque BIOS/MBR no era apropiada para esta PC que únicamente trabaja en UEFI. Que Hiren arranque en UEFI no demuestra por sí solo el modo requerido por Windows; la restricción de firmware fue confirmada durante el soporte.

> **Error a evitar:** la partición activa NTFS `E:` es compatible con un esquema Legacy/MBR, pero **no equivale a una partición del sistema EFI (ESP)** para UEFI.

## Intervención y resultado observado

1. Se descartó la reparación propuesta por **BootFix v1.2 (BIOS/MBR)**: los comandos `bootsect /nt60 E: /mbr` y `bcdboot C:\Windows /s E: /f BIOS` no corresponden al destino UEFI-only.
2. Desde Hiren en UEFI se ejecutó **Cósmica BootFix UEFI v1.3** con destino al **Kingston, disco 0**. El flujo prevé validar con `mbr2gpt /validate` antes de convertir; el registro visual conservado confirma el éxito de la **conversión**, no reproduce todos los pasos previos.
3. `mbr2gpt` informó **`Conversion completed successfully`**, **código de salida 0** y, antes, mensajes de creación de la partición EFI, instalación de nuevos archivos de arranque, migración de la entrada de arranque y ajuste del mapeo de letras.
4. El script verificó el esquema resultante **GPT** y encontró una partición **System/EFI de 500 MB**, **disco 0, partición 1**; la partición de Windows permaneció como **Basic**, disco 0, partición 2.
5. `diskpart` consiguió asignar temporalmente la letra **S:** a la partición EFI.
6. **Fallo posterior del script, no de `mbr2gpt`:** la verificación con PowerShell devolvió `No MSFT_Volume objects found with property 'DriveLetter' equal to 'S'`. BootFix se detuvo para evitar seguir escribiendo a ciegas. Esa consulta de `MSFT_Volume` **no es una prueba fiable de ausencia de la ESP** cuando DiskPart ya pudo asignar la letra.
7. Se indicó comprobar `S:\EFI\Microsoft\Boot\bootmgfw.efi` y el orden/opción `Windows Boot Manager` en firmware, si hiciera falta. **No consta en el intercambio el resultado de ese comando ni qué ajuste final se realizó en BIOS.**
8. **Verificación final:** el técnico confirmó explícitamente **«solucionado»**. Por lo tanto, el arranque de Windows quedó recuperado; no se atribuye el éxito a una acción final no documentada.

## Causa técnica y matices

**Causa principal identificada:** **desajuste entre el esquema MBR/Legacy del SSD y el requisito de UEFI de la PC**. La conversión MBR → GPT mediante `mbr2gpt` preparó la partición de sistema EFI y los archivos de arranque UEFI.

**Incidente secundario independiente:** **BootFix UEFI v1.3 produjo un falso bloqueo** en su comprobación posterior a la conversión al buscar la letra `S:` mediante `Get-Volume` / `MSFT_Volume`. No hay evidencia de que la conversión haya fallado; `mbr2gpt` notificó éxito. Se considera **defecto pendiente del script** hasta corregirlo y probarlo en una PC real.

## Procedimiento de referencia para futuras PC UEFI-only

> **Advertencia:** estos son criterios técnicos, no un script universal. Una conversión modifica la tabla de particiones. **Realizar o verificar antes un respaldo íntegro y recuperable**, validar el disco de destino y revisar cifrado/BitLocker y estado del almacenamiento. Nunca asumir que el disco correcto será el 0 ni que Windows será siempre `C:`.

1. Arrancar **Hiren en UEFI** y reconocer inequívocamente la instalación Windows, el disco físico, el número de particiones y las unidades USB conectadas. Diferenciar **disco origen** y **pendrive**.
2. Si el PC solo ofrece UEFI y Windows está en **MBR**, comprobar previamente que cumple los requisitos de `mbr2gpt`. Empezar por **validación no destructiva**:

   ```cmd
   mbr2gpt /validate /disk:<NUMERO_DEL_DISCO>
   ```

3. **Solo con validación satisfactoria y respaldo confirmado**, realizar la conversión desde WinPE:

   ```cmd
   mbr2gpt /convert /disk:<NUMERO_DEL_DISCO>
   ```

   En WinPE **no corresponde agregar `/allowFullOS`**. No repetir `/convert` si el disco ya quedó en GPT.
4. Verificar que exista una **partición EFI FAT32** en el disco correcto, que los archivos `\EFI\Microsoft\Boot\bootmgfw.efi` estén presentes y que la BIOS intente arrancar **Windows Boot Manager** de ese SSD.
5. **No ejecutar automáticamente `bootsect /mbr` ni `bcdboot ... /f BIOS`** en equipos UEFI-only. Tampoco rehacer BCD si `mbr2gpt` ya lo instaló y la máquina arranca.
6. Si el firmware no detecta el cargador o `bootmgfw.efi` falta, **diagnosticar primero** el contenido de la ESP y las entradas de firmware. Una reparación adicional con `bcdboot ... /f UEFI` exige identificar y montar **la ESP correcta**, no una partición NTFS cualquiera.
7. Retirar Hiren, iniciar desde el SSD y registrar la prueba de arranque real. **Éxito de `bcdboot` o `mbr2gpt` no sustituye la prueba de inicio.**

## Lecciones para Cósmica BootFix

- **v1.0:** una reparación de BCD puede informar éxito sin resolver un **esquema de arranque incompatible**.
- **v1.1:** el diagnóstico de solo lectura permitió identificar **MBR**, partición activa NTFS y Windows en `C:\Windows` sin modificar el SSD.
- **v1.2:** el flujo de reparación **Legacy/MBR** no se debe utilizar en este tipo de PC.
- **v1.3:** `mbr2gpt` realizó la conversión correctamente; revisar la lógica posterior que intenta localizar `S:` por `MSFT_Volume`.
- **Mejora pendiente:** admitir **GPT + ESP válida** como estado de éxito aunque falte una letra persistente en el proveedor de volúmenes; verificar la ruta EFI por disco/partición y `diskpart`, comprobar explícitamente la presencia del cargador y diferenciar en pantalla **«conversión exitosa»** de **«arranque comprobado»**.
- **Control de seguridad:** antes de escribir en discos, confirmar modelo, tamaño, número de disco y partición de Windows y excluir unidades USB; detenerse ante ambigüedades.

## Alcance y cierre

Registro de asistencia técnica para reutilización en el taller. **No contiene el SSD, la imagen de Windows, el backup original ni logs completos de la máquina**, solo los hallazgos y resultados aportados durante el soporte. La creación de este documento **no modifica la web pública, Cósmica.app, firmware ni herramientas ejecutables**.

**Resultado:** arranque Windows recuperado y confirmado por el técnico el **2026-11-10**.
