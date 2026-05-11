import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  serverTimestamp,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { COLLECTIONS } from "./domain.js";
import { getNextClienteCodigo } from "./work-repository.js";
import { logSystem } from "./system-service.js";
import { getSession } from "./auth-service.js";

/**
 * Script para migrar clientes existentes y asignarles un clienteCodigo secuencial.
 * 
 * ETAPA 2 — MIGRACIÓN CLIENTES EXISTENTES
 */
export async function ejecutarMigracionClientes() {
  console.log("═══════════════════════════════════════════════");
  console.log(" INICIANDO MIGRACIÓN DE IDENTIDAD DE CLIENTES ");
  console.log("═══════════════════════════════════════════════");

  const session = getSession();
  const usuario = session?.user?.email || "N/A";

  // Etapa 2B: Asegurar que config/clientes existe
  const counterRef = doc(db, COLLECTIONS.config, "clientes");
  const counterSnap = await getDoc(counterRef);
  if (!counterSnap.exists()) {
    await setDoc(counterRef, { current: 0, updatedAt: serverTimestamp() });
    console.log("[CONFIG] Creado contador config/clientes inicializado en 0");
  }

  // Etapa 2A: Snapshot Previo
  const clientesSnap = await getDocs(collection(db, COLLECTIONS.clientes));
  const totalClientes = clientesSnap.size;

  await logSystem("[IDENTITY_MIGRATION_START]", {
    cantidadClientesActuales: totalClientes,
    usuario
  });
  console.log(`[LOG] Registrado [IDENTITY_MIGRATION_START]. Total clientes a revisar: ${totalClientes}`);

  let migrados = 0;

  // Recorrer todos los clientes
  for (const docSnap of clientesSnap.docs) {
    const data = docSnap.data();

    // Regla: SI clienteCodigo NO existe, asignar uno nuevo secuencial
    if (!data.clienteCodigo) {
      try {
        // Generar código transaccional
        const clienteCodigo = await getNextClienteCodigo();

        // Actualizar cliente (Safe update, solo agrega el campo)
        await updateDoc(docSnap.ref, { clienteCodigo });

        // Registrar log individual
        await logSystem("[MIGRATION_CLIENT_CODE]", {
          clienteId: docSnap.id,
          clienteCodigo,
          usuario
        });

        migrados++;
        console.log(`[OK] Cliente ${docSnap.id} -> ${clienteCodigo}`);
      } catch (error) {
        console.error(`[ERROR] Falló migración para cliente ${docSnap.id}:`, error);
      }
    } else {
      console.log(`[SKIP] Cliente ${docSnap.id} ya tiene código: ${data.clienteCodigo}`);
    }
  }

  console.log("═══════════════════════════════════════════════");
  console.log(` MIGRACIÓN FINALIZADA`);
  console.log(` Total revisados: ${totalClientes}`);
  console.log(` Códigos asignados: ${migrados}`);
  console.log("═══════════════════════════════════════════════");

  return { totalClientes, migrados };
}
